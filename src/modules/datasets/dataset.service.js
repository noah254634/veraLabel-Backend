import mongoose from "mongoose";
import Dataset from "./dataset.model.js";
import Invoice from "./invoice.model.js";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Order from "../marketplace/order.model.js";
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
import { AppError } from "../../middlewares/errorHandler.middleware.js";
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

export const calculateDatasetTaskCounts = async (datasetId) => {
  const [totalTasksCount, verifiedTasksCount, batches] = await Promise.all([
    Task.countDocuments({ datasetId }),
    Submission.countDocuments({ datasetId, status: "approved" }),
    Batch.find({ datasetId }).select("_id tasks assignedTo totalTasks").lean()
  ]);

  if (!batches || batches.length === 0) {
    return {
      totalTasksCount,
      submittedTasksCount: 0,
      verifiedTasksCount
    };
  }

  const batchIds = batches.map(b => b._id);
  const allTaskIds = batches.flatMap(b => b.tasks || []);

  const [submissionsGrouped, flaggedTasksGrouped] = await Promise.all([
    Submission.aggregate([
      { $match: { batchId: { $in: batchIds } } },
      { $group: { _id: { batchId: "$batchId", submittedBy: "$submittedBy" }, count: { $sum: 1 } } }
    ]),
    allTaskIds.length > 0 ? Task.aggregate([
      { $match: { _id: { $in: allTaskIds }, status: "flagged" } },
      { $group: { _id: "$batchId", count: { $sum: 1 } } }
    ]) : Promise.resolve([])
  ]);

  const subMap = new Map();
  for (const s of submissionsGrouped) {
    if (s._id?.batchId && s._id?.submittedBy) {
      subMap.set(`${s._id.batchId.toString()}_${s._id.submittedBy.toString()}`, s.count);
    }
  }

  const flagMap = new Map();
  for (const f of flaggedTasksGrouped) {
    if (f._id) {
      flagMap.set(f._id.toString(), f.count);
    }
  }

  let totalCompleted = 0;
  for (const batch of batches) {
    const fCount = flagMap.get(batch._id.toString()) || 0;
    for (const labellerId of (batch.assignedTo || [])) {
      const subCount = subMap.get(`${batch._id.toString()}_${labellerId.toString()}`) || 0;
      totalCompleted += Math.min(batch.totalTasks, subCount + fCount);
    }
  }

  const submittedTasksCount = Math.max(0, totalCompleted - verifiedTasksCount);

  return {
    totalTasksCount,
    submittedTasksCount,
    verifiedTasksCount
  };
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
    const datasets = await Dataset.find(filter).sort({ createdAt: -1 });
    return await Promise.all(datasets.map(async (d) => {
      const obj = d.toObject ? d.toObject() : d;
      const counts = await calculateDatasetTaskCounts(obj._id);
      const rows = obj.rows || counts.totalTasksCount || 0;
      const rowsCompleted = obj.rowsCompleted !== undefined && obj.rowsCompleted !== null && obj.rowsCompleted > 0 ? obj.rowsCompleted : counts.verifiedTasksCount;
      return { 
        ...obj, 
        ...counts,
        rows,
        rowsCompleted
      };
    }));
  },
  getDatasetById: async (id) => {
    const d = await Dataset.findById(id);
    if (!d) return null;
    const obj = d.toObject ? d.toObject() : d;
    const counts = await calculateDatasetTaskCounts(obj._id);
    const rows = obj.rows || counts.totalTasksCount || 0;
    const rowsCompleted = obj.rowsCompleted !== undefined && obj.rowsCompleted !== null && obj.rowsCompleted > 0 ? obj.rowsCompleted : counts.verifiedTasksCount;
    return { 
      ...obj, 
      ...counts,
      rows,
      rowsCompleted
    };
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
    timelineDays,
    maxLabellers
  ) => {
    const buyerExists = await Buyer.findById(buyerId);
    if (!buyerExists) throw new Error("Unauthorized access or buyer profile not found");
    if (!name) throw new Error("Name is required");
    if (!domain) throw new Error("Domain is required");
    if (!specifications) throw new Error("Specifications is required");
    if (!volume) throw new Error("Volume is required");
    if (!timeline) throw new Error("Timeline/SLA is required");
    const isSourcing = intent === "sourcing" || !fileUrl;
    if (!isSourcing && !fileUrl) {
      throw new Error("File URL is required for data labeling requests - upload file first using /datasets/generateUploadUrl");
    }
    const normalizedLabellingMethod = normalizeLabellingMethod(labellingMethod);
    const normalizedContentType = normalizeContentType(contentType, domain, format);

    if (normalizedLabellingMethod === "rlhf" && !instructionId) {
      throw new Error("RLHF datasets require an evaluation protocol. Select a protocol with preference ranking or dimensional scoring.");
    }
    
    const priceValue = budget ? parseFloat(budget.toString().replace(/\$|,/g, "")) || 0 : 0;
    const parsedMaxLabellers = maxLabellers ? parseInt(maxLabellers, 10) : 1;
    const safeFileUrl = fileUrl || "";

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
      maxLabellers: parsedMaxLabellers,
      format,
      timeline,
      timelineDays: timelineDays ? Number(timelineDays) : null,
      intent: intent || null,
      qualityMetrics: qualityMetrics || "",
      sourceLink: safeFileUrl,
      fileUrl: safeFileUrl,
      status: intent === "sourcing" ? "curation_requested" : "pending",
      datasetType: normalizeDatasetType(domain, normalizedLabellingMethod, normalizedContentType),
      datasetFormat: normalizeDatasetFormat(format),
      filePath: safeFileUrl,
      isPublished: false,
      price: 0, // Set price to 0 initially; updated after actual pricing / invoice generation
    });

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
            const questionMapping = template.buyerQuestions?.find(
              q => q.activatesRubric && q.activatesRubric.trim() === rubric.tag.trim()
            );

            if (questionMapping) {
              const buyerAnswer = answersMap[questionMapping.question.trim()];
              if (buyerAnswer && buyerAnswer.trim().toLowerCase() === 'yes') {
                activeRubrics.push(rubric);
              }
            } else {
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

  downloadDataset: async (datasetId, user) => {
    if (!datasetId) throw new AppError("Dataset ID is required", 400);
    const dataset = await Dataset.findById(datasetId);
    if (!dataset) throw new AppError("Dataset not found", 404);

    // Check authorization: Admin, or Buyer who owns/purchased it
    if (user.role !== "admin") {
      if (user.role !== "buyer") {
        throw new AppError("Unauthorized to access this dataset", 403);
      }
      
      const isOwner = dataset.buyerId && dataset.buyerId.toString() === user.id;
      if (!isOwner) {
        const order = await Order.findOne({
          buyerId: user.id,
          datasetId: dataset._id,
          $or: [
            { status: { $in: ["approved", "completed", "paid", "in_progress"] } },
            { isPaid: true }
          ]
        });
        if (!order) {
          throw new AppError("Unauthorized: you have not purchased or requested this dataset", 403);
        }
      }
    }

    let downloadKey = dataset.downloadUrl || dataset.filePath || dataset.fileUrl || dataset.sourceLink;
    
    // Fallback: check task input / dataset references if empty on Dataset document
    if (!downloadKey) {
      const sampleTask = await Task.findOne({ datasetId: dataset._id }).lean();
      if (sampleTask) {
        downloadKey = sampleTask.r2_url || sampleTask.r2_input_taskRef || sampleTask.r2_datasetUrl;
      }
    }

    // Fallback: check submission output references
    if (!downloadKey) {
      const sampleSub = await Submission.findOne({ datasetId: dataset._id }).lean();
      if (sampleSub) {
        downloadKey = sampleSub.r2_output_key;
      }
    }

    if (!downloadKey) {
      throw new AppError("Dataset package or file is not available for download yet. Please compile dataset assets or verify upload.", 400);
    }

    // Generate a secure presigned GET URL for the file (expires in 1 hour)
    const getCommand = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: downloadKey
    });

    const presignedUrl = await getSignedUrl(r2, getCommand, { expiresIn: 3600 });
    return presignedUrl;
  }
};
