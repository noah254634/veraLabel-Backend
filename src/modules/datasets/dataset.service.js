import mongoose from "mongoose";
import Dataset from "./dataset.model.js";
import Invoice from "./invoice.model.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { r2 } from "../../config/r2Upload.js";
import UserVera from "../users/user.model.js";
import Buyer from "../buyer/buyer.model.js";
import ensureCorsConfigured from "../../helpers/r2CorsConfiguration.js";
import { verifyFileInR2 } from "../../helpers/r2Verify.js";
import { triggerWorker } from "../../helpers/workerTrigger.js";
import Task from "../tasks/task.model.js";
import Batch from "../tasks/task.batch.model.js";
import Submission from "../tasks/task.submission.model.js";
import Labeller from "../labeller/labeller.model.js";
import logger from "../../config/logger.js";
import { createSession } from "../tasks/progress.service.js";
import { taskService } from "../tasks/task.service.js";
import {
  ALLOWED_LABELLING_METHODS,
  ALLOWED_CONTENT_TYPES,
  assertProtocolMatchesMethod,
  inferContentTypeFromDomain,
  inferContentTypeFromFileName,
} from "./labellingProtocol.js";

const ALLOWED_LABELLING_METHODS_SET = new Set(ALLOWED_LABELLING_METHODS);
const ALLOWED_CONTENT_TYPES_SET = new Set(ALLOWED_CONTENT_TYPES);

const normalizeLabellingMethod = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) throw new Error("labellingMethod is required");
  if (["rfhlearning", "rflhf"].includes(raw)) return "rlhf";
  if (ALLOWED_LABELLING_METHODS_SET.has(raw)) return raw;
  throw new Error(`Invalid labellingMethod: ${value}`);
};

const normalizeContentType = (value, domain, format) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw && ALLOWED_CONTENT_TYPES_SET.has(raw)) return raw;
  if (format) {
    const fromFormat = inferContentTypeFromFileName(`file.${format}`);
    if (fromFormat && ALLOWED_CONTENT_TYPES_SET.has(fromFormat)) return fromFormat;
  }
  if (domain) {
    const fromDomain = inferContentTypeFromDomain(domain);
    if (fromDomain) return fromDomain;
  }
  throw new Error(
    `contentType is required (${ALLOWED_CONTENT_TYPES.join(", ")})`
  );
};

const normalizeDatasetType = (domain, labellingMethod, contentType) => {
  const rawMethod = String(labellingMethod || "").trim().toLowerCase();
  if (rawMethod === "rlhf") {
    return "RLHF";
  }
  const rawContentType = String(contentType || "").trim().toLowerCase();
  if (["image", "audio", "video", "text"].includes(rawContentType)) {
    return rawContentType;
  }
  const rawDomain = String(domain || "").trim().toLowerCase();
  if (rawDomain === "audio") return "audio";
  if (rawDomain === "tabular") return "Tabular";
  if (rawDomain === "nlp" || rawDomain === "code" || rawDomain === "legal") return "text";
  return "text";
};

const normalizeDatasetFormat = (format) => {
  const raw = String(format || "").trim().toLowerCase();
  const allowed = ["csv", "json", "xml", "excel", "jsonl", "txt", "wav", "mp3", "parquet"];
  if (allowed.includes(raw)) return raw;
  
  if (raw.includes("jsonl") || raw.includes("json lines")) return "jsonl";
  if (raw.includes("json")) return "json";
  if (raw.includes("csv")) return "csv";
  if (raw.includes("text") || raw.includes("txt")) return "txt";
  if (raw.includes("excel") || raw.includes("xlsx") || raw.includes("xls")) return "excel";
  if (raw.includes("wav")) return "wav";
  if (raw.includes("mp3")) return "mp3";
  if (raw.includes("xml")) return "xml";
  if (raw.includes("parquet")) return "parquet";

  return "json";
};

export const datasetService = {
  generateUploadUrl: async (userId, fileType) => {
  
    await ensureCorsConfigured();
    
    if (!userId) throw new Error("userId is required");
    if (!fileType) throw new Error("fileType is required");
    const folderMap={
      rlhf:"rlhfDatasets",
      images:"imageDatasets",
      general:"generalDatasets",
      datasets:"datasets",
      synthetic:"syntheticDatasets"
    }
    const folder = folderMap[fileType] || "datasets";
    const key = `${folder}/${userId}/${uuidv4()}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(r2, command, {
      expiresIn: 900, // 15 minutes — 60s was too short for real file uploads
    });

    return { uploadUrl, key };
  },
  buyerSideDatasets: async () => {
    const datasets = await Dataset.aggregate([
      {
        $match: {
          //visibility: "public",
          isPublished: true,
          // isVerified: true,
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $project: {
          _id: 1,
          datasetFormat: 1,
          reviews: 1,
          exclusivePrice: 1,
          price: 1,
          isVerified: 1,
          name: 1,
          description: 1,
          version: 1,
          size: 1,
          rating: 1,
        },
      },
    ]);
    return datasets;
  },

  getAllDatasets: async (filter = {}) => {
    return await Dataset.find(filter).sort({ createdAt: -1 });
  },
  getDatasetById: async (id) => {
    return await Dataset.findById(id);
  },
  deleteDataset: async (id) => {
    if (!id) throw new Error("id is required");
    if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid dataset id");

    const dataset = await Dataset.findById(id).lean();
    if (!dataset) throw new Error("No dataset with that Id in database");

    const session = await mongoose.startSession();
    let result;

    try {
      await session.withTransaction(async () => {
        // 1. Collect all task IDs belonging to this dataset
        const taskIds = await Task.find({ datasetId: id }, { _id: 1 }, { session })
          .lean()
          .then((docs) => docs.map((d) => d._id));

        logger.info("Dataset cascade delete initiated", {
          datasetId: id,
          taskCount: taskIds.length,
        });

        // 2. Remove tasks from labeller currentAssignedTasks + completedTasksLog
        if (taskIds.length > 0) {
          await Labeller.updateMany(
            { currentAssignedTasks: { $in: taskIds } },
            { $pull: { currentAssignedTasks: { $in: taskIds } } },
            { session }
          );
          await Labeller.updateMany(
            { "completedTasksLog.taskId": { $in: taskIds } },
            { $pull: { completedTasksLog: { taskId: { $in: taskIds } } } },
            { session }
          );
        }

        // 3. Delete all submissions tied to these tasks
        const submissionResult = await Submission.deleteMany(
          { datasetId: id },
          { session }
        );

        // 4. Delete all tasks
        const taskResult = await Task.deleteMany(
          { datasetId: id },
          { session }
        );

        // 5. Delete all batches
        const batchResult = await Batch.deleteMany(
          { datasetId: id },
          { session }
        );

        // 6. Delete all invoices
        const invoiceResult = await Invoice.deleteMany(
          { datasetId: id },
          { session }
        );

        // 7. Delete the dataset itself
        await Dataset.findByIdAndDelete(id, { session });

        logger.info("Dataset cascade delete completed", {
          datasetId: id,
          tasksDeleted: taskResult.deletedCount,
          batchesDeleted: batchResult.deletedCount,
          submissionsDeleted: submissionResult.deletedCount,
          invoicesDeleted: invoiceResult.deletedCount,
        });

        result = {
          datasetId: id,
          tasksDeleted: taskResult.deletedCount,
          batchesDeleted: batchResult.deletedCount,
          submissionsDeleted: submissionResult.deletedCount,
          invoicesDeleted: invoiceResult.deletedCount,
        };
      });
    } finally {
      await session.endSession();
    }

    return result;
  },
  updateDataset: async (id, data) => {
    return await Dataset.findByIdAndUpdate(id, data, { new: true });
  },
  filterDatasets: async (filters) => {
    const now = new Date();
    const date = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
    const [
      datasetsToday,
      datasetsThiMonth,
      approvedDatasets,
      rejectedDatasets,
    ] = await Promise.all([
      Dataset.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfDay },
          },
        },
      ]),
    ]);
    return await Dataset.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay },
          status: "approved",
        },
      },
    ]);
  },
  createDataset: async (
    name,
    domain,
    specifications,
    volume,
    format,
    budget,
    fileUrl,
    timeline,
    qualityMetrics,
    buyerId,
    instructionId,
    buyerAnswers,
    labellingMethod,
    contentType,
    intent,
    timelineDays
  ) => {
    const buyerExists = await Buyer.findById(buyerId);
    if (!buyerExists) throw new Error("Unauthorized access or buyer profile not found");
    if (!name) throw new Error("Name is required");
    if (!domain) throw new Error("Domain is required");
    if (!specifications) throw new Error("Specifications is required");
    if (!volume) throw new Error("Volume is required");
    if (!format) throw new Error("Format is required");
    if (!fileUrl) throw new Error("File URL is required - upload file first using /datasets/generateUploadUrl");
    if (!timeline) throw new Error("Timeline/SLA is required");
    const normalizedLabellingMethod = normalizeLabellingMethod(labellingMethod);
    const normalizedContentType = normalizeContentType(contentType, domain, format);

    if (normalizedLabellingMethod === "rlhf" && !instructionId) {
      throw new Error("RLHF datasets require an evaluation protocol. Select a protocol with preference ranking or dimensional scoring.");
    }
    
    // Step 1: Create a Dataset with type 'custom'
    const priceValue = parseFloat(budget.toString().replace(/\$|,/g, "")) || 0;

    const dataset = await Dataset.create({
      type: "custom",
      name: name,
      description: specifications,
      buyerId: buyerId,
      domain,
      labellingMethod: normalizedLabellingMethod,
      contentType: normalizedContentType,
      volume,
      budget: priceValue,
      format,
      timeline,
      timelineDays: timelineDays ? Number(timelineDays) : null,
      intent: intent || null,
      qualityMetrics: qualityMetrics || "",
      sourceLink: fileUrl,
      fileUrl: fileUrl,
      status: "pending",
      datasetType: normalizeDatasetType(domain, normalizedLabellingMethod, normalizedContentType),
      datasetFormat: normalizeDatasetFormat(format),
      filePath: fileUrl,
      isPublished: false,
      price: 0, // Set price to 0 initially; updated after actual pricing / invoice generation
    });

    // Step 2: If instructionId is provided, clone template into DatasetInstruction and link it
    if (instructionId) {
      const { InstructionTemplate, DatasetInstruction } = await import("./instruction.model.js");
      const template = await InstructionTemplate.findById(instructionId);
      if (!template) {
        throw new Error("Selected evaluation protocol was not found");
      }
      assertProtocolMatchesMethod(template, normalizedLabellingMethod);

      // Map buyer answers for easier lookup
      const answersMap = {};
        if (buyerAnswers && Array.isArray(buyerAnswers)) {
          buyerAnswers.forEach(ans => {
            if (ans.question) {
              answersMap[ans.question.trim()] = ans.answer;
            }
          });
        }

        // Determine which rubrics to activate
        const activeRubrics = [];
        if (template.rubrics && Array.isArray(template.rubrics)) {
          template.rubrics.forEach(rubric => {
            // Find the question that activates this rubric (if any)
            const questionMapping = template.buyerQuestions?.find(
              q => q.activatesRubric && q.activatesRubric.trim() === rubric.tag.trim()
            );

            if (questionMapping) {
              const buyerAnswer = answersMap[questionMapping.question.trim()];
              // If the answer is "Yes" (case-insensitive), we activate it.
              if (buyerAnswer && buyerAnswer.trim().toLowerCase() === 'yes') {
                activeRubrics.push(rubric);
              }
            } else {
              // If there's no question activating this rubric, check if it's conditional.
              // If it's not conditional, it's always active.
              if (!rubric.conditional) {
                activeRubrics.push(rubric);
              }
            }
          });
        }

        const datasetInstruction = await DatasetInstruction.create({
          datasetId: dataset._id,
          templateId: template._id,
          version: template.version,
          buyerAnswers: buyerAnswers || [],
          rubrics: activeRubrics,
          goldenExamples: template.goldenExamples || [],
          edgeCases: template.edgeCases || [],
          scoringConfig: template.scoringConfig || {},
          adjudicationPolicy: template.adjudicationPolicy || {},
          finalDirectives: template.baseDirectives || [],
          antiPatterns: template.antiPatterns || []
        });

      dataset.instructionId = datasetInstruction._id;
      await dataset.save();
    }

    return {
      datasetId: dataset._id.toString(),
      dataset,
    };
  },

  confirmUpload: async (r2Key, datasetId, dataType) => {
    if (!r2Key) throw new Error("r2Key is required");
    if (!datasetId) throw new Error("datasetId is required");
    if (!dataType) throw new Error("dataType is required");

    const fileMetadata = await verifyFileInR2(r2Key);

    const dataset = await Dataset.findByIdAndUpdate(
      datasetId,
      {
        status: "pending",
        filePath: r2Key,
        size: fileMetadata.size,
      },
      { new: true }
    );

    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}. Create dataset request first.`);
    }

    const extension = r2Key.split('.').pop().toLowerCase();
    const isZip = fileMetadata.contentType === 'application/zip' || 
                  fileMetadata.contentType === 'application/x-zip-compressed' || 
                  extension === 'zip';
                  
    const audioExtensions = ['wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac'];
    const isSingleAudio = !isZip && (
      audioExtensions.includes(extension) ||
      fileMetadata.contentType?.startsWith('audio/') ||
      dataset.contentType === 'audio' ||
      dataset.datasetType === 'audio'
    );

    if (isSingleAudio) {
      const projectId = dataset.datasetLabeler?.toString() || dataset.buyerId?.toString() || "unknown";
      logger.info("Single audio file detected. Bypassing worker and registering task directly.", {
        datasetId,
        projectId,
        r2Key,
        size: fileMetadata.size,
      });

      const mime = fileMetadata.contentType?.startsWith('audio/')
        ? fileMetadata.contentType
        : (extension === 'wav' ? 'audio/wav' : 'audio/mpeg');
      const filename = r2Key.split('/').pop() || 'audio-task';

      // Pre-create the progress session
      try {
        await createSession(projectId, datasetId);
      } catch (sessionError) {
        logger.warn("Failed to pre-create progress session in confirmUpload for single audio", {
          projectId,
          datasetId,
          error: sessionError.message,
        });
      }

      // Register the task directly in the database
      await taskService.createTask({
        datasetId: dataset._id.toString(),
        projectId,
        tasks: [{
          taskId: uuidv4(),
          taskType: 'audio',
          r2_url: r2Key,
          split: 'train',
          fileName: filename,
          fileSize: fileMetadata.size,
          contentType: mime,
        }],
        isLastBatch: true,
      });

      return {
        success: true,
        message: "File uploaded successfully. Single audio task registered directly.",
        datasetId: dataset._id.toString(),
        status: "awaiting_payment",
      };
    }

    // Map format to worker's supported DATA_TYPES
    const dataTypeMap = {
      'json': 'text',
      'jsonl': 'text',
      'csv': 'text',
      'txt': 'text',
      'jpg': 'media',
      'jpeg': 'media',
      'png': 'media',
      'gif': 'media',
      'mp4': 'media',
      'rlhf': 'rlhf'
    };

    let workerDataType = dataTypeMap[dataset.datasetFormat?.toLowerCase()] || 'text';
    
    // Override with provided dataType if it matches a known type, or infer from domain
    if (dataset.labellingMethod === 'rlhf') {
      workerDataType = 'rlhf';
        } else if (['rlhf', 'media', 'text', 'audio'].includes(dataType?.toLowerCase())) {
      workerDataType = dataType.toLowerCase();
    } else {
      const domainLower = (dataset.domain || dataset.datasetType || '').toLowerCase();
      if (domainLower.includes('rlhf') || domainLower.includes('rfhlearning')) {
        workerDataType = 'rlhf';
      }
    }

    // Step 3: Trigger worker to start splitting
    const projectId = dataset.datasetLabeler?.toString() || dataset.buyerId?.toString() || "unknown";

    // Pre-create progress session to avoid concurrent creation race conditions in progress updates
    try {
      await createSession(projectId, datasetId);
    } catch (sessionError) {
      logger.warn("Failed to pre-create progress session in confirmUpload", {
        projectId,
        datasetId,
        error: sessionError.message,
      });
    }

    const workerResult = await triggerWorker(r2Key, projectId, dataset._id.toString(), workerDataType);

    return {
      success: true,
      message: workerResult.partialSuccess
        ? "File uploaded successfully. Processing started but some task batches failed to register — they will be retried."
        : "File uploaded and verified successfully, splitting initiated",
      datasetId: dataset._id.toString(),
      status: dataset.status,
      ...(workerResult.partialSuccess && {
        partialSuccess: true,
        failedBatches: workerResult.failedBatches,
        count: workerResult.count,
      }),
    };
  },
};
