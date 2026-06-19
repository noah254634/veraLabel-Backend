import Task from "./task.model.js";
import UserVera from "../users/user.model.js";
import Dataset from "../datasets/dataset.model.js";
import Invoice from "../datasets/invoice.model.js";
import Labeller from "../labeller/labeller.model.js";
import Submission from "./task.submission.model.js";
import { r2ContentFetcher } from "./r2.contentFetcher.js";
import mongoose from "mongoose";
import { invoiceService } from "../../helpers/priceCalculator.js";
import logger from "../../config/logger.js";
import Batch from "./task.batch.model.js";
import { PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2 } from "../../config/r2Upload.js";
import { normalizeContentType, isLegacyRlhfTaskType } from "./taskContentType.js";
import { addEvents } from "./progress.service.js";


const normalizeTaskTypeForInvoice = (contentTypeOrLegacy, labellingMethod) => {
  try {
    if (labellingMethod === "rlhf") return "rlhf";

    const normalizedType = String(contentTypeOrLegacy || "").trim().toLowerCase();
    if (isLegacyRlhfTaskType(normalizedType)) return "rlhf";
    if (normalizedType === "image") return "images";
    if (normalizedType === "video") return "videos";

    return normalizedType || "text";
  } catch (error) {
    logger.warn('Error normalizing invoice task type', { error: error.message, contentTypeOrLegacy });
    return "text";
  }
};

const enrichBatchWithDataset = async (batch) => {
  if (!batch) return batch;

  // Preserve original task order if batch is a Mongoose document and tasks array is populated
  if (typeof batch.populated === 'function' && batch.populated('tasks')) {
    const originalIds = batch.populated('tasks').map(id => id.toString());
    batch.tasks.sort((a, b) => {
      const idA = (a._id || a).toString();
      const idB = (b._id || b).toString();
      return originalIds.indexOf(idA) - originalIds.indexOf(idB);
    });
  }

  const plain = batch?.toObject ? batch.toObject() : { ...batch };
  if (!plain?.datasetId) return plain;

  const dataset = await Dataset.findById(plain.datasetId)
    .select("labellingMethod contentType domain pricePerBatch metadata")
    .lean();

  const labellingMethod = dataset?.labellingMethod || "annotation";
  const datasetContentType = dataset?.contentType || "text";

  plain.labellingMethod = labellingMethod;
  plain.datasetContentType = datasetContentType;
  plain.pricePerBatch = dataset?.pricePerBatch || 0;

  if (Array.isArray(plain.tasks)) {
    plain.tasks = plain.tasks.map((t) => {
      const task = t?.toObject ? t.toObject() : { ...t };
      return {
        ...task,
        contentType: task.contentType || normalizeContentType(task, dataset),
        labellingMethod,
        categories: task.categories || dataset?.metadata?.labels || [],
      };
    });
  }

  return plain;
};

const getTaskReward = async (batch) => {
  if (!batch) return 0.42;
  const dataset = await Dataset.findById(batch.datasetId).select("pricePerBatch").lean();
  const pricePerBatch = dataset?.pricePerBatch || 0;
  const totalTasks = batch.totalTasks || 1;
  return pricePerBatch > 0 ? (pricePerBatch / totalTasks) : 0.42;
};

const normalizeSplit = (split) => {
  try {
    const rawSplit = String(split || "").trim().toLowerCase();
    if (rawSplit === "val") return "validation";
    if (["train", "validation", "test"].includes(rawSplit)) return rawSplit;
    return "train";
  } catch (error) {
    logger.warn('Error normalizing split', { error: error.message, split });
    return "train";
  }
};

const resolveLabellerDocument = async (identifier) => {
  if (!identifier) {
    return null;
  }

  const identifierString = String(identifier);

  if (mongoose.Types.ObjectId.isValid(identifierString)) {
    const labellerById = await Labeller.findById(identifierString);
    if (labellerById) {
      return labellerById;
    }
  }

  return Labeller.findOne({ userId: identifierString });
};

const streamToString = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
};

const isValidNormalizedBox = (box) => {
  if (!box || typeof box !== "object") return false;
  const keys = ["x", "y", "w", "h"];
  for (const key of keys) {
    const value = Number(box[key]);
    if (!Number.isFinite(value)) return false;
  }
  const x = Number(box.x);
  const y = Number(box.y);
  const w = Number(box.w);
  const h = Number(box.h);
  const label = String(box.label || "").trim();
  return (
    x >= 0 &&
    y >= 0 &&
    w > 0 &&
    h > 0 &&
    x <= 100 &&
    y <= 100 &&
    x + w <= 100 &&
    y + h <= 100 &&
    label.length > 0
  );
};

const getEmbeddingR2Key = (imageR2Key) => {
  const parts = imageR2Key.split('.');
  if (parts.length > 1) {
    parts[parts.length - 1] = 'npy';
    return parts.join('.');
  }
  return `${imageR2Key}.npy`;
};

const triggerEmbeddingGeneration = async (task, datasetDoc) => {
  try {
    const mlUrl = process.env.FASTAPI_ML_URL;
    if (!mlUrl) {
      logger.warn('FASTAPI_ML_URL is not configured. Skipping embedding generation.', { taskId: task._id || task.id });
      return;
    }

    const taskR2Url = task.r2_input_taskRef;
    const embeddingKey = getEmbeddingR2Key(taskR2Url);

    // 1. Generate a presigned GET URL for the raw image
    const presignedGetUrl = await r2ContentFetcher.getPresignedUrl(taskR2Url);

    // 2. Generate a presigned PUT URL for the embedding file
    const putCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: embeddingKey,
      ContentType: "application/octet-stream",
    });
    const presignedPutUrl = await getSignedUrl(r2, putCommand, {
      expiresIn: 3600, // 1 hour
    });

    // 3. Dispatch POST request to the FastAPI ML service (asynchronous)
    logger.info('Triggering ML service for SAM 2 embedding', {
      taskId: task._id || task.id,
      r2Key: taskR2Url,
      embeddingKey,
    });

    fetch(`${mlUrl}/api/v1/generate-embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: presignedGetUrl,
        upload_url: presignedPutUrl,
      }),
    }).then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        logger.error('ML service failed to generate embedding', {
          status: response.status,
          response: text,
          taskId: task._id || task.id,
        });
      } else {
        logger.info('ML service successfully generated embedding', {
          taskId: task._id || task.id,
        });
      }
    }).catch((err) => {
      logger.error('Error contacting ML service for embedding', {
        error: err.message,
        taskId: task._id || task.id,
      });
    });
  } catch (error) {
    logger.error('Failed to trigger embedding generation', {
      error: error.message,
      taskId: task?._id || task?.id,
    });
  }
};

const isValidPolygon = (polyObj) => {
  if (!polyObj || typeof polyObj !== "object") return false;
  const label = String(polyObj.label || "").trim();
  if (label.length === 0) return false;
  const polygon = polyObj.polygon;
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  for (const pt of polygon) {
    if (!Array.isArray(pt) || pt.length !== 2) return false;
    const x = Number(pt[0]);
    const y = Number(pt[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  }
  return true;
};

const validateAnnotationPayload = (annotation) => {
  if (!annotation || typeof annotation !== "object") {
    throw new Error("Invalid annotation payload: expected JSON object.");
  }

  const ct = String(annotation.contentType || "").toLowerCase();

  // ── Audio tasks: expect transcription text or classification label ──
  if (ct === "audio") {
    const hasTranscription = typeof annotation.transcription === "string" && annotation.transcription.trim().length >= 10;
    const hasClassification = typeof annotation.classificationLabel === "string" && annotation.classificationLabel.trim().length > 0;
    if (!hasTranscription && !hasClassification) {
      throw new Error(
        "Invalid annotation payload: audio tasks require a non-empty 'transcription' (≥10 chars) or a 'classificationLabel'."
      );
    }
    return;
  }

  // ── Image / video tasks: validate bounding boxes or polygons ──
  const { boundingBoxes, polygons } = annotation;
  if (boundingBoxes == null && polygons == null) {
    throw new Error("Invalid annotation payload: must provide either 'boundingBoxes' or 'polygons' for image/video annotations.");
  }
  if (boundingBoxes != null) {
    if (!Array.isArray(boundingBoxes)) {
      throw new Error("Invalid annotation payload: 'boundingBoxes' must be an array.");
    }
    if (boundingBoxes.length === 0 && (polygons == null || polygons.length === 0)) {
      throw new Error("Invalid annotation payload: 'boundingBoxes' cannot be empty unless 'polygons' is provided.");
    }
    const hasInvalidBox = boundingBoxes.some((box) => !isValidNormalizedBox(box));
    if (hasInvalidBox) {
      throw new Error("Invalid annotation payload: one or more bounding boxes are malformed.");
    }
  }
  if (polygons != null) {
    if (!Array.isArray(polygons)) {
      throw new Error("Invalid annotation payload: 'polygons' must be an array.");
    }
    if (polygons.length === 0 && (boundingBoxes == null || boundingBoxes.length === 0)) {
      throw new Error("Invalid annotation payload: 'polygons' cannot be empty unless 'boundingBoxes' is provided.");
    }
    const hasInvalidPolygon = polygons.some((poly) => !isValidPolygon(poly));
    if (hasInvalidPolygon) {
      throw new Error("Invalid annotation payload: one or more polygons are malformed.");
    }
  }
};

const normalizeIncomingTask = (task, index) => {
  if (typeof task === 'string') {
    try {
      const parsedTask = JSON.parse(task);
      if (parsedTask && typeof parsedTask === 'object' && !Array.isArray(parsedTask)) {
        return parsedTask;
      }
    } catch (error) {
      logger.warn('Failed to parse stringified task payload', {
        index,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (task && typeof task === 'object' && !Array.isArray(task)) {
    return task;
  }

  return null;
};


const checkExistingBatchAssignment = async (labellerId) => {
  const batch = await Batch.findOne({
    assignedTo: labellerId,
    status: 'in_progress'
  }).populate('tasks');

  if (!batch) return null;

  const labeller = await Labeller.findById(labellerId);
  if (!labeller) return null;

  const count = await Submission.countDocuments({
    taskId: { $in: batch.tasks.map(t => t._id) },
    submittedBy: labeller._id
  });

  const flaggedCount = await Task.countDocuments({
    _id: { $in: batch.tasks.map(t => t._id) },
    status: 'flagged'
  });

  if (count + flaggedCount >= batch.totalTasks) {
    return null;
  }

  return batch;
};

const findAndLockAvailableBatch = async (datasetId, labellerId) => {
  return Batch.findOneAndUpdate(
    {
      datasetId,
      status: { $in: ['available', 'in_progress'] },
      assignedTo: { $ne: labellerId },
      $expr: {
        $lt: [
          { $size: { $ifNull: ["$assignedTo", []] } },
          { $ifNull: ["$maxLabellers", 1] }
        ]
      }
    },
    {
      $set: {
        status: 'in_progress',
        assignedAt: new Date(),
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hour TTL
      },
      $addToSet: { assignedTo: labellerId }
    },
    { 
      sort: { priority: -1, createdAt: 1 },
      new: true 
    }
  ).populate('tasks');
};

const assignBatchTasksToLabeller = async (batch, labellerId) => {
  const taskIds = batch.tasks.filter(t => t).map(t => t._id || t);
  if (taskIds.length === 0) return;

  await Task.updateMany(
    { _id: { $in: taskIds } },
    {
      $set: {
        isAssigned: true,
        assignedAt: new Date(),
        status: 'in_progress'
      },
      $addToSet: { assignedTo: labellerId }
    }
  );

  // Add the tasks to the Labeller profile and increment totalTasksAssigned
  await Labeller.updateOne(
    { _id: labellerId },
    {
      $addToSet: { currentAssignedTasks: { $each: taskIds } },
      $inc: { 'performance.totalTasksAssigned': taskIds.length }
    }
  );
};

const performBatchRevocationCleanup = async (batchIds) => {
  if (!Array.isArray(batchIds) || batchIds.length === 0) {
    return { revoked: 0, tasksReset: 0, submissionsDeleted: 0 };
  }

  // Fetch affected task IDs first
  const affectedTaskIds = await Task.find(
    { batchId: { $in: batchIds } },
    { _id: 1 }
  ).lean().then(docs => docs.map(d => d._id));

  let submissionsDeletedCount = 0;

  if (affectedTaskIds.length > 0) {
    const submissionDeleteResult = await Submission.deleteMany({
      taskId: { $in: affectedTaskIds }
    });
    submissionsDeletedCount = submissionDeleteResult.deletedCount;
    const labellersWithCompletedTasks = await Labeller.find({
      "completedTasksLog.taskId": { $in: affectedTaskIds }
    }).lean();

    for (const labeller of labellersWithCompletedTasks) {
      const completedCount = labeller.completedTasksLog.filter(log =>
        affectedTaskIds.some(id => id.toString() === log.taskId.toString())
      ).length;

      if (completedCount > 0) {
        const newTotalCompleted = Math.max(0, (labeller.performance.totalTasksCompleted || 0) - completedCount);
        const newTotalAssigned = Math.max(0, (labeller.performance.totalTasksAssigned || 0) - completedCount);

        await Labeller.updateOne(
          { _id: labeller._id },
          {
            $set: {
              "performance.totalTasksCompleted": newTotalCompleted,
              "performance.totalTasksAssigned": newTotalAssigned
            }
          }
        );
      }
    }

    // Decrement totalTasksAssigned for in-progress tasks being revoked
    const inProgressTasks = await Task.find({
      batchId: { $in: batchIds },
      status: 'in_progress'
    }).lean();

    const labellerInProgressCountMap = {};
    for (const t of inProgressTasks) {
      const lIds = Array.isArray(t.assignedTo) ? t.assignedTo : (t.assignedTo ? [t.assignedTo] : []);
      for (const lId of lIds) {
        const lIdStr = lId.toString();
        labellerInProgressCountMap[lIdStr] = (labellerInProgressCountMap[lIdStr] || 0) + 1;
      }
    }

    for (const lIdStr of Object.keys(labellerInProgressCountMap)) {
      const count = labellerInProgressCountMap[lIdStr];
      const labeller = await Labeller.findById(lIdStr);
      if (labeller) {
        const newTotalAssigned = Math.max(0, (labeller.performance.totalTasksAssigned || 0) - count);
        await Labeller.updateOne(
          { _id: labeller._id },
          { $set: { "performance.totalTasksAssigned": newTotalAssigned } }
        );
      }
    }

    await Labeller.updateMany(
      { currentAssignedTasks: { $in: affectedTaskIds } },
      { $pull: { currentAssignedTasks: { $in: affectedTaskIds } } }
    );

    await Labeller.updateMany(
      { "completedTasksLog.taskId": { $in: affectedTaskIds } },
      { $pull: { completedTasksLog: { taskId: { $in: affectedTaskIds } } } }
    );
  }
  const taskUpdate = await Task.updateMany(
    {
      batchId: { $in: batchIds },
      status: { $in: ['in_progress', 'pending', 'submitted', 'rejected', 'verified'] }
    },
    {
      $set: {
        status: 'pending',
        isAssigned: false,
        assignedTo: [],
        assignedAt: null,
        startedAt: null,
        completedAt: null,
        r2_task_resultRef: null,
        isVerified: false,
        verifiedBy: null,
        verificationScore: null,
        rejectionReason: null
      }
    }
  );

  await Batch.updateMany(
    { _id: { $in: batchIds } },
    {
      $set: {
        status: 'available',
        assignedTo: [],
        assignedAt: null,
        expiresAt: null,
        completedTasks: 0,
        completedAt: null
      }
    }
  );

  return {
    revoked: batchIds.length,
    tasksReset: taskUpdate.modifiedCount,
    submissionsDeleted: submissionsDeletedCount
  };
};

export const taskService = {
  getTaskSubmissions: async () => {
    const submission = await Submission.find();
    return submission;
  },
  getBatches: async () => {
    const batches = await Batch.find();
    return batches;
  },

  createTask: async ({ datasetId, projectId, tasks, isLastBatch }) => {
    try {
      // Validate inputs with defensive checks
      if (!datasetId || typeof datasetId !== 'string') {
        throw new Error('datasetId is required and must be a string');
      }
      if (!projectId || typeof projectId !== 'string') {
        throw new Error('projectId is required and must be a string');
      }
      if (!Array.isArray(tasks) || tasks.length === 0) {
        throw new Error('tasks must be a non-empty array');
      }

      logger.info('Task creation initiated', {
        projectId,
        datasetId,
        taskCount: tasks.length,
        isLastBatch,
      });

      const datasetRef = `projects/${projectId}/${datasetId}`;
      const datasetDoc = await Dataset.findById(datasetId)
        .select("labellingMethod contentType domain")
        .lean();

      const taskEntries = tasks.map((task, index) => {
        const normalizedTask = normalizeIncomingTask(task, index);
        if (!normalizedTask) {
          throw new Error(`Invalid task at index ${index}: task must be an object`);
        }

        const r2Ref = normalizedTask.key || normalizedTask.r2_url || normalizedTask.r2Key || normalizedTask.r2_input_taskRef;
        if (!r2Ref) {
          throw new Error(`Invalid task payload at index ${index}: missing 'key' or 'r2_url'`);
        }
        const contentType = normalizeContentType(normalizedTask, datasetDoc);
        return {
          r2_datasetUrl: datasetRef,
          r2_input_taskRef: r2Ref,
          datasetId: datasetId,
          contentType,
          taskType: contentType,
          taskName: normalizedTask.name || normalizedTask.taskId || `task-${index + 1}`,
          taskId: normalizedTask.taskId || null,
          split: normalizeSplit(normalizedTask.split),
          status: "pending",
          isAssigned: false,
          _uniqueKey: normalizedTask.taskId || r2Ref,
        };
      });

      logger.debug('Task entries prepared', {
        datasetRef,
        contentTypes: [...new Set(taskEntries.map((t) => t.contentType))],
        labellingMethod: datasetDoc?.labellingMethod,
      });
      const refsToCheck = taskEntries.map(t => t.r2_input_taskRef).filter(Boolean);
      const taskIdsToCheck = taskEntries.map(t => t.taskId).filter(Boolean);

      const orConditions = [];
      if (taskIdsToCheck.length > 0) {
        orConditions.push({ taskId: { $in: taskIdsToCheck } });
      }
      if (refsToCheck.length > 0) {
        orConditions.push({ r2_input_taskRef: { $in: refsToCheck } });
      }

      let existingTasks = [];
      if (orConditions.length > 0) {
        existingTasks = await Task.find(
          {
            r2_datasetUrl: datasetRef,
            $or: orConditions,
          },
          { taskId: 1, r2_input_taskRef: 1 }
        ).lean();
      }

      const existingUniqueKeys = new Set();
      existingTasks.forEach(task => {
        if (task.taskId) existingUniqueKeys.add(task.taskId);
        if (task.r2_input_taskRef) existingUniqueKeys.add(task.r2_input_taskRef);
      });

      if (existingUniqueKeys.size > 0) {
        logger.warn('Potential duplicates detected', {
          datasetRef,
          existingUniqueKeysCount: existingUniqueKeys.size,
          totalIncomingTasks: taskEntries.length,
          existingTasks: existingTasks.length,
        });
      }

      const newTaskEntries = taskEntries.filter(task => {
        const hasMatchingTaskId = task.taskId && existingUniqueKeys.has(task.taskId);
        const hasMatchingRef = task.r2_input_taskRef && existingUniqueKeys.has(task.r2_input_taskRef);

        return !(hasMatchingTaskId || hasMatchingRef);
      });

      // Filter out duplicates within the current batch
      const seenUniqueKeys = new Set();
      const deduplicatedEntries = newTaskEntries.filter(task => {
        const key = task.r2_input_taskRef;
        if (seenUniqueKeys.has(key)) {
          logger.warn('Duplicate detected within current batch', {
            datasetRef,
            ref: key,
            taskId: task.taskId,
          });
          return false;
        }
        seenUniqueKeys.add(key);
        return true;
      });

      let insertedCount = 0;
      let failedCount = 0;
      let duplicateCount = taskEntries.length - deduplicatedEntries.length;

      logger.info('Duplicate filtering completed', {
        totalTasks: taskEntries.length,
        afterExistingCheck: newTaskEntries.length,
        afterBatchDedup: deduplicatedEntries.length,
        duplicatesSkipped: taskEntries.length - deduplicatedEntries.length,
      });
      if (deduplicatedEntries.length > 0) {
        // Remove internal _uniqueKey field before saving to DB
        const tasksToInsert = deduplicatedEntries.map(({ _uniqueKey, ...task }) => task);

        try {
          const insertResult = await Task.insertMany(tasksToInsert, { ordered: false });
          insertedCount = insertResult.length;
          logger.info('Tasks inserted into database', {
            datasetRef,
            insertedCount,
            duplicateCount,
            failedCount: tasksToInsert.length - insertedCount,
          });

          // Trigger embedding generation for newly inserted tasks
          if (datasetDoc && String(datasetDoc.contentType).toLowerCase() === 'image') {
            for (const task of insertResult) {
              triggerEmbeddingGeneration(task, datasetDoc).catch(err => {
                logger.error('Failed to trigger embedding generation in insertResult', { error: err.message, taskId: task._id });
              });
            }
          }
        } catch (insertError) {
          const isBulkDuplicate = insertError.writeErrors && 
            insertError.writeErrors.length > 0 && 
            insertError.writeErrors.every(e => e.code === 11000);
          const isSingleDuplicate = insertError.code === 11000;
          const isDuplicateError = isSingleDuplicate || isBulkDuplicate;

          const insertedDocs = insertError.insertedDocs || [];
          insertedCount = insertedDocs.length;
          const failedWriteCount = tasksToInsert.length - insertedCount;

          if (isDuplicateError) {
            duplicateCount += failedWriteCount;
            logger.info('Duplicate tasks skipped during insertion', {
              datasetRef,
              insertedCount,
              duplicateCount,
            });

            // Trigger embedding generation for newly inserted tasks in the catch block
            if (datasetDoc && String(datasetDoc.contentType).toLowerCase() === 'image') {
              for (const task of insertedDocs) {
                triggerEmbeddingGeneration(task, datasetDoc).catch(err => {
                  logger.error('Failed to trigger embedding generation in insertedDocs', { error: err.message, taskId: task._id });
                });
              }
            }
          } else {
            failedCount = failedWriteCount;
            logger.error('Failed to insert tasks due to database error', {
              datasetRef,
              error: insertError.message,
              insertedCount,
              failedCount,
            });
            throw insertError;
          }
        }
      } else {
        logger.info('No new tasks to insert after deduplication', {
          datasetRef,
          skipped: duplicateCount,
        });
      }

      let totalTasksInDataset;
      let invoice;
      if (isLastBatch) {
        // Count total tasks for this dataset (including duplicates already in DB)
        totalTasksInDataset = await Task.countDocuments({
          $or: [{ datasetId }, { r2_datasetUrl: datasetRef }]
        });

        const invoiceTaskType = normalizeTaskTypeForInvoice(
          taskEntries[0]?.contentType || taskEntries[0]?.taskType,
          datasetDoc?.labellingMethod
        );
        try {
          invoice = await invoiceService.generateInvoice(invoiceTaskType, totalTasksInDataset);
          await Dataset.findByIdAndUpdate(
            datasetId,
            {
              status: "awaiting_payment",
              price: invoice.totalCost,
              rows: totalTasksInDataset,
              "metadata.numRecords": totalTasksInDataset
            }
          );
          await Invoice.create({
            datasetId: datasetId,
            status: "pending",
            taskType: invoiceTaskType,
            rowsCount: totalTasksInDataset,
            ...invoice
          });

          logger.info('Invoice generated and stored', {
            invoiceTaskType,
            totalTasks: totalTasksInDataset,
            totalCost: invoice.totalCost
          });

          await taskService.createBatchesForDataset(datasetId);

          // Mark the progress session complete
          addEvents(projectId, datasetId, [{
            type: 'complete',
            timestamp: new Date().toISOString(),
            summary: {
              processed: totalTasksInDataset,
              success: true,
              invoice: { totalCost: invoice.totalCost }
            },
          }]).catch(err =>
            logger.warn('Failed to mark progress session complete', { error: err.message })
          );

        } catch (invoiceError) {
          logger.error('Failed to generate final invoice', {
            error: invoiceError.message,
            invoiceTaskType,
            totalTasks: totalTasksInDataset,
          });
          throw invoiceError;
        }
      }

      const response = {
        message: "Tasks created successfully",
        count: insertedCount,
        duplicatesSkipped: duplicateCount,
        failedItems: failedCount,
        totalTasksInDataset,
        success: failedCount === 0,
      };

      if (invoice) {
        response.invoice = invoice;
        response.message = "Tasks completed. Invoice generated and ready for payment.";
      }

      logger.info('Task creation completed', {
        datasetId,
        projectId,
        response,
      });

      return response;
    } catch (error) {
      logger.error('Error creating tasks', {
        error: error.message,
        stack: error.stack,
        projectId,
        datasetId,
        taskCount: tasks?.length,
      });
      throw error;
    }
  },
  getTasks: async ({ page = 1, limit = 50, status, split, taskType }) => {
    try {

      const validPage = Math.max(1, Number.parseInt(page, 10) || 1);
      const validLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 50));

      const filters = {};
      if (status && typeof status === 'string') {
        const normalizedStatus = status.trim().toLowerCase();
        if (['pending', 'assigned', 'completed', 'rejected', 'verified'].includes(normalizedStatus)) {
          filters.status = normalizedStatus;
        }
      }

      if (split && typeof split === 'string') {
        const normalizedSplit = normalizeSplit(split);
        filters.split = normalizedSplit;
      }

      if (taskType && typeof taskType === 'string') {
        const normalizedType = String(taskType).trim().toLowerCase();
        if (['text', 'audio', 'video', 'image', 'code', 'document', 'rfhlearning'].includes(normalizedType)) {
          filters.$or = [
            { contentType: normalizedType },
            { taskType: normalizedType },
          ];
        }
      }

      const skip = (validPage - 1) * validLimit;

      logger.debug('Fetching tasks with filters', {
        page: validPage,
        limit: validLimit,
        filters,
        skip,
      });

      const [tasks, total] = await Promise.all([
        Task.find(filters)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(validLimit)
          .lean(),
        Task.countDocuments(filters),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / validLimit));

      logger.info('Tasks fetched successfully', {
        page: validPage,
        limit: validLimit,
        returnedCount: tasks.length,
        total,
        totalPages,
      });

      return {
        tasks,
        pagination: {
          page: validPage,
          limit: validLimit,
          total,
          totalPages,
          hasNextPage: validPage < totalPages,
          hasPreviousPage: validPage > 1,
        },
      };
    } catch (error) {
      logger.error('Error fetching tasks', {
        error: error.message,
        stack: error.stack,
        page,
        limit,
        filters: { status, split, taskType },
      });
      throw error;
    }
  },
  getTaskById: async (id) => {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Valid task ID is required');
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid task ID format: ${id}`);
      }

      logger.debug('Fetching task by ID', { taskId: id });

      const task = await Task.findById(id).lean();

      if (!task) {
        logger.warn('Task not found', { taskId: id });
        throw new Error(`Task with ID ${id} not found`);
      }
      const taskR2Url = task.r2_input_taskRef;
      const dataset = await Dataset.findById(task.datasetId).select("contentType domain").lean();
      const contentType = (task.contentType || normalizeContentType(task, dataset) || 'text').toLowerCase();
      let taskObject;

      if (['image', 'audio', 'video'].includes(contentType)) {
        try {
          // Verify that the object actually exists in R2 first
          await r2ContentFetcher.getContentMetadata(taskR2Url);

          const presignedUrl = await r2ContentFetcher.getPresignedUrl(taskR2Url);
          taskObject = { url: presignedUrl };

          // Check if a SAM 2 embedding file exists right next to the image
          if (contentType === 'image') {
            const embeddingKey = getEmbeddingR2Key(taskR2Url);
            try {
              await r2ContentFetcher.getContentMetadata(embeddingKey);
              const embeddingUrl = await r2ContentFetcher.getPresignedUrl(embeddingKey);
              taskObject.embeddingUrl = embeddingUrl;
              logger.info('Generated presigned URL for SAM 2 embedding', { taskId: id, embeddingKey });
            } catch (e) {
              logger.debug('No embedding found for image task', { taskId: id, error: e.message });
            }
          }
        } catch (presignError) {
          logger.warn('Could not generate presigned URL or verify media task in R2', { taskId: id, error: presignError.message });
          taskObject = { url: null, error: `Media verification failed: ${presignError.message}` };
        }
      } else {
        try {
          const taskBuffer = await r2ContentFetcher.fetchTaskContent(taskR2Url);
          try {
            taskObject = JSON.parse(taskBuffer.toString('utf-8'));
          } catch (parseError) {
            logger.warn('Could not parse task content as JSON, returning raw content', { taskId: id });
            taskObject = taskBuffer.toString('utf-8');
          }
        } catch (fetchError) {
          logger.warn('Could not fetch task content from R2', { taskId: id, error: fetchError.message });
          taskObject = { url: null, error: `Content fetch failed: ${fetchError.message}` };
        }
      }

      logger.debug('Task fetched successfully', { taskId: id, status: task.status });
      return { task, taskObject };
    } catch (error) {
      logger.error('Error fetching task by ID', {
        error: error.message,
        taskId: id,
      });
      throw error;
    }
  },

  returnTaskToPool: async (id, { decrementAssignedCount = false } = {}) => {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Valid task ID is required');
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid task ID format: ${id}`);
      }

      logger.info('Returning task to pool', { taskId: id });

      const task = await Task.findById(id);

      if (!task) {
        logger.warn('Task not found for return to pool', { taskId: id });
        throw new Error(`Task with ID ${id} not found`);
      }

      const previousAssignees = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);

      task.status = "pending";
      task.isAssigned = false;
      task.assignedTo = [];
      task.assignedAt = null;
      task.startedAt = null;
      task.completedAt = null;

      await task.save();
      if (previousAssignees.length > 0) {
        if (decrementAssignedCount) {
          for (const labellerId of previousAssignees) {
            const labeller = await Labeller.findById(labellerId);
            if (labeller) {
              const newTotalAssigned = Math.max(0, (labeller.performance.totalTasksAssigned || 0) - 1);
              await Labeller.updateOne(
                { _id: labellerId },
                {
                  $pull: { currentAssignedTasks: id },
                  $set: { "performance.totalTasksAssigned": newTotalAssigned }
                }
              );
            }
          }
        } else {
          await Labeller.updateMany(
            { _id: { $in: previousAssignees } },
            {
              $pull: { currentAssignedTasks: id }
            }
          );
        }

        logger.info('Removed task from labeller profiles', {
          taskId: id,
          labellerIds: previousAssignees,
          decremented: decrementAssignedCount
        });
      }

      logger.info('Task returned to pool successfully', {
        taskId: id,
        previousAssignees: previousAssignees.length > 0 ? previousAssignees : 'unassigned',
      });

      return task;
    } catch (error) {
      logger.error('Error returning task to pool', {
        error: error.message,
        taskId: id,
      });
      throw error;
    }
  },
  assignTask: async (taskId, labellerIdentifier) => {
    try {
      if (!taskId || !labellerIdentifier) throw new Error("taskId and labellerId are required");

      const task = await Task.findById(taskId);
      if (!task) throw new Error("Task not found");

      const labeller = await resolveLabellerDocument(labellerIdentifier);
      if (!labeller) throw new Error("Labeller profile not found");

      const user = await UserVera.findById(labeller.userId).select('role');
      if (!user) throw new Error("User not found");
      if (user.role !== "labeler") throw new Error("User is not a labeler");
      if (task.isAssigned) throw new Error("Task already assigned");

      // Update Task document
      task.isAssigned = true;
      if (!task.assignedTo) task.assignedTo = [];
      if (!task.assignedTo.includes(labeller._id)) {
        task.assignedTo.push(labeller._id);
      }
      task.assignedAt = new Date();
      task.status = "in_progress";
      await task.save();

      const updatedLabeller = await Labeller.findByIdAndUpdate(
        labeller._id,
        {
          $addToSet: { currentAssignedTasks: task._id },
          $inc: { 'performance.totalTasksAssigned': 1 }
        },
        { new: true }
      ).select('currentAssignedTasks performance');

      if (!updatedLabeller) throw new Error("Labeller profile not found for user");

      logger.info('Task assigned successfully', {
        taskId,
        labellerId: labeller._id,
        totalAssigned: updatedLabeller.performance.totalTasksAssigned,
        currentTasks: updatedLabeller.currentAssignedTasks.length
      });

      return {
        message: "Task assigned successfully",
        task,
        labeller: {
          currentTasksCount: updatedLabeller.currentAssignedTasks.length,
          totalAssigned: updatedLabeller.performance.totalTasksAssigned
        }
      };
    } catch (error) {
      logger.error('Error assigning task', {
        error: error.message,
        taskId,
        labellerIdentifier
      });
      throw error;
    }
  },
  submitTask: async (taskId, labellerIdentifier, batchId) => {
    try {
      if (!taskId) throw new Error("Task id is required");
      if (!labellerIdentifier) throw new Error("Labeller id is required");
      if (!batchId) throw new Error("Batch id is required for verification");

      const labeller = await resolveLabellerDocument(labellerIdentifier);
      if (!labeller) throw new Error("Labeller profile not found");
      const labellerId = labeller._id;

      // 1. Verify Batch Assignment and Status
      const batch = await Batch.findOne({
        _id: batchId,
        assignedTo: labellerId,
        status: 'in_progress'
      });

      if (!batch) {
        throw new Error("Target batch not found, not assigned to you, or mission has expired.");
      }

      // 2. Verify Task-to-Batch Relationship and Individual Assignment
      const task = await Task.findOne({
        _id: taskId,
        batchId: batchId,
        assignedTo: labellerId
      });

      if (!task) {
        throw new Error("Task mismatch: This task does not belong to the specified batch or is not assigned to you.");
      }

      // Check if this labeller has already submitted for this task
      const existingSubmission = await Submission.findOne({
        taskId: taskId,
        submittedBy: labeller._id
      });

      if (existingSubmission) {
        throw new Error("Task security block: You have already submitted an annotation for this task.");
      }

      // 3. Create the Submission Record
      const submissionId = `SUB-${taskId.toString().slice(-6)}-${labellerId.toString().slice(-6)}-${Date.now().toString().slice(-6)}`;
      const r2_output_key = `${task.r2_datasetUrl}/results/${labellerId}/${task.taskId}.json`;

      // Verify that the annotation result file exists in Cloudflare R2
      try {
        const headCommand = new HeadObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: r2_output_key
        });
        await r2.send(headCommand);
        logger.info(`Verified annotation file exists in R2`, { r2_output_key });
      } catch (r2Error) {
        logger.error(`Verification failed: annotation result file not found in R2`, { error: r2Error.message, r2_output_key });
        throw new Error("Validation failed: You must upload the annotation payload to cloud storage before final submission.");
      }

      // Validate uploaded annotation JSON before finalizing submission state.
      try {
        const getCommand = new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: r2_output_key,
        });
        const object = await r2.send(getCommand);
        const bodyString = await streamToString(object.Body);
        let annotation;
        try {
          annotation = JSON.parse(bodyString);
        } catch {
          throw new Error("Invalid annotation payload: uploaded file is not valid JSON.");
        }
        validateAnnotationPayload(annotation);
      } catch (validationError) {
        logger.error("Annotation payload validation failed", {
          taskId,
          batchId,
          labellerId,
          r2_output_key,
          error: validationError.message,
        });
        throw validationError;
      }

      const submission = new Submission({
        submissionId,
        taskId,
        datasetId: task.datasetId,
        batchId: batchId,
        submittedBy: labeller._id,
        r2_output_key,
        status: 'submitted'
      });
      await submission.save();

      // Update task status and completion time
      task.status = 'submitted';
      task.completedAt = new Date();
      await task.save();

      // Increment labeller pending payment dynamically based on pricePerBatch
      const taskReward = await getTaskReward(batch);
      await Labeller.updateOne(
        { _id: labellerId },
        { $inc: { 'earnings.pendingPayment': taskReward } }
      );

      // 4. Calculate Labeller-Specific Progress
      const submissionsCount = await Submission.countDocuments({
        taskId: { $in: batch.tasks },
        submittedBy: labeller._id
      });
      const flaggedCount = await Task.countDocuments({
        _id: { $in: batch.tasks },
        status: 'flagged'
      });
      const completedCount = submissionsCount + flaggedCount;

      // 5. Automatic Batch Lifecycle Transition
      // A batch is globally completed when every assigned labeller has completed all tasks (submitted + flagged)
      if (batch.assignedTo.length >= batch.maxLabellers) {
        const labellers = await Labeller.find({ _id: { $in: batch.assignedTo } });
        let allCompleted = true;
        for (const l of labellers) {
          const count = await Submission.countDocuments({
            taskId: { $in: batch.tasks },
            submittedBy: l._id
          });
          const fCount = await Task.countDocuments({
            _id: { $in: batch.tasks },
            status: 'flagged'
          });
          if (count + fCount < batch.totalTasks) {
            allCompleted = false;
            break;
          }
        }
        if (allCompleted) {
          batch.status = 'completed';
          batch.completedAt = new Date();
          await batch.save();
          logger.info(`Mission accomplished: Batch ${batch.batchId} fully completed by all assigned labellers`);
        }
      }

      logger.info(`Task submission metadata updated`, { taskId, batchId, labellerId });

      return {
        success: true,
        message: "Task marked as submitted",
        progress: {
          completed: completedCount,
          total: batch.totalTasks,
          percent: Math.round((completedCount / batch.totalTasks) * 100)
        }
      };
    } catch (error) {
      logger.error('Error updating task submission state', { error: error.message, taskId, batchId, labellerIdentifier });
      throw error;
    }
  },

  generateSubmissionUrl: async (taskId, labellerIdentifier) => {
    try {
      if (!taskId) throw new Error("Task id is required");
      if (!labellerIdentifier) throw new Error("Labeller id is required");

      const labeller = await resolveLabellerDocument(labellerIdentifier);
      if (!labeller) throw new Error("Labeller profile not found");
      const labellerId = labeller._id;

      const task = await Task.findById(taskId);
      if (!task) throw new Error("Task not found");

      const r2_output_key = `${task.r2_datasetUrl}/results/${labellerId}/${task.taskId}.json`;

      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: r2_output_key,
        ContentType: "application/json",
      });

      const uploadUrl = await getSignedUrl(r2, command, {
        expiresIn: 900, // 15 minutes
      });

      return { uploadUrl, r2_output_key };
    } catch (error) {
      logger.error('Error generating submission URL', { error: error.message, taskId });
      throw error;
    }
  },
  verifyTask: async (taskId, userId) => {
    if (!taskId || !userId) throw new Error("Task ID and User ID are required");

    const task = await Task.findById(taskId);
    if (!task) throw new Error("Task not found");

    const user = await UserVera.findOne({
      _id: userId,
      role: { $in: ["admin", "reviewer"] }
    });

    if (!user) throw new Error("User not found or not authorized (must be admin/reviewer)");
    if (task.isVerified) throw new Error("Task already verified");

    task.isVerified = true;
    task.verifiedBy = userId;
    task.status = "verified";
    await task.save();

    const labellerId = task.assignedTo?.[0] || task.assignedTo;
    if (labellerId) {
      const batch = task.batchId ? await Batch.findById(task.batchId) : null;
      const taskReward = await getTaskReward(batch);
      await Labeller.updateOne(
        { _id: labellerId },
        { 
          $inc: { 
            'earnings.pendingPayment': -taskReward,
            'earnings.currentBalance': taskReward,
            'earnings.totalEarned': taskReward,
            'performance.totalTasksCompleted': 1
          } 
        }
      );
    }

    return { message: "Task verified successfully", task };
  },
  rejectTask: async (taskId, reason) => {
    try {
      if (!taskId) throw new Error("Task ID is required");

      const task = await Task.findById(taskId);
      if (!task) throw new Error("Task not found");

      const labellerId = task.assignedTo?.[0] || task.assignedTo;

      task.isVerified = false;
      task.verifiedBy = null;
      task.status = "rejected";
      task.rejectionReason = reason;
      task.verificationScore = 0;
      await task.save();

      await taskService.returnTaskToPool(taskId);

      if (labellerId) {
        const batch = task.batchId ? await Batch.findById(task.batchId) : null;
        const taskReward = await getTaskReward(batch);
        await Labeller.findOneAndUpdate(
          { _id: labellerId },
          {
            $inc: { 
              'performance.totalTasksRejected': 1,
              'earnings.pendingPayment': -taskReward
            }
          }
        );

        logger.info('Updated labeller rejection metrics', {
          taskId,
          labellerId
        });
      }

      return { message: "Task rejected successfully", task };
    } catch (error) {
      logger.error('Error rejecting task', {
        error: error.message,
        taskId
      });
      throw error;
    }
  },

  reviewTask: async (taskId, userId, score) => {
    const task = await Task.findById(taskId);
    if (!task) throw new Error("Task not found");

    const user = await UserVera.findById(userId);
    if (!user) throw new Error("User not found");
    if (task.isVerified) throw new Error("Task already verified");

    task.isVerified = true;
    task.verifiedBy = userId;
    task.status = "verified";
    task.verificationScore = score;
    await task.save();

    const labellerId = task.assignedTo?.[0] || task.assignedTo;
    if (labellerId) {
      const batch = task.batchId ? await Batch.findById(task.batchId) : null;
      const taskReward = await getTaskReward(batch);
      await Labeller.updateOne(
        { _id: labellerId },
        { 
          $inc: { 
            'earnings.pendingPayment': -taskReward,
            'earnings.currentBalance': taskReward,
            'earnings.totalEarned': taskReward,
            'performance.totalTasksCompleted': 1
          } 
        }
      );
    }

    return { message: "Task verified successfully", task };
  },
  revokeTask: async (taskId) => {
    const task = await Task.findById(taskId);
    if (!task) throw new Error("Task not found");
    if (!task.isAssigned) throw new Error("Task not assigned");

    const newTask = await taskService.returnTaskToPool(taskId, { decrementAssignedCount: true });

    if (task.batchId) {
      const batch = await Batch.findById(task.batchId);
      if (batch) {
        batch.status = 'available';
        batch.assignedTo = [];
        batch.assignedAt = null;
        batch.expiresAt = null;
        batch.completedTasks = 0;
        batch.completedAt = null;
        await batch.save();

        const batchTasks = await Task.find({
          batchId: batch._id,
          _id: { $ne: task._id },
          status: { $ne: 'pending' }
        });

        for (const bt of batchTasks) {
          await taskService.returnTaskToPool(bt._id.toString(), { decrementAssignedCount: true });
        }
      }
    }

    return { message: "Task revoked successfully", newTask };
  },

  revokeExpiredTasks: async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = await Task.updateMany(
      {
        isAssigned: true,
        status: "in_progress",
        assignedAt: { $lt: twoHoursAgo },
      },
      {
        $set: {
          status: "pending",
          isAssigned: false,
          assignedTo: [],
          assignedAt: null,
          startedAt: null,
          completedAt: null,
        },
      }
    );
    return { message: "Tasks revoked successfully", result };
  },
  createBatchesForDataset: async (datasetId) => {
    try {
      if (!datasetId) throw new Error("datasetId is required for batching");

      // Fetch all unbatched tasks for this dataset
      const datasetMeta = await Dataset.findById(datasetId)
        .select("labellingMethod contentType")
        .lean();

      const unbatchedTasks = await Task.find({
        datasetId,
        batchId: null
      }).select("_id taskType contentType").lean();

      if (unbatchedTasks.length === 0) {
        logger.info('No unbatched tasks found for dataset', { datasetId });
        return { created: 0 };
      }

      logger.info(`Starting batch generation for dataset ${datasetId}`, {
        totalTasks: unbatchedTasks.length
      });

      const batchSize = 10;
      const batchesToCreate = [];

      // Group into 10s
      for (let i = 0; i < unbatchedTasks.length; i += batchSize) {
        const batchTasks = unbatchedTasks.slice(i, i + batchSize);
        const taskIds = batchTasks.map(t => t._id);
        const type =
          batchTasks[0].contentType ||
          normalizeContentType(batchTasks[0], datasetMeta);

        batchesToCreate.push({
          batchId: `B-${datasetId.toString().slice(-4)}-${Math.floor(i / batchSize)}-${Date.now().toString().slice(-4)}`,
          datasetId,
          tasks: taskIds,
          totalTasks: taskIds.length,
          completedTasks: 0,
          batchType: type,
          labellingMethod: datasetMeta?.labellingMethod || "annotation",
          status: 'available',
          priority: 0 // Could be inherited from tasks if needed
        });
      }

      // Save batches and update tasks
      const createdBatches = await Batch.insertMany(batchesToCreate);

      // Link tasks back to their batches using bulk write
      const bulkOps = createdBatches.map(batch => ({
        updateMany: {
          filter: { _id: { $in: batch.tasks } },
          update: { $set: { batchId: batch._id } }
        }
      }));
      
      await Task.bulkWrite(bulkOps);

      logger.info(`Batch generation completed for dataset ${datasetId}`, {
        batchesCreated: createdBatches.length
      });

      return { created: createdBatches.length };
    } catch (error) {
      logger.error('Error in createBatchesForDataset', {
        error: error.message,
        datasetId
      });
      throw error;
    }
  },

  claimBatch: async (datasetId, labellerIdentifier) => {
    try {
      // Verify Dataset is allowed to be worked on
      const dataset = await Dataset.findById(datasetId);
      if (!dataset) throw new Error("Mission target node not found.");

      // Allow claiming if published OR if approved for production work
      if (dataset.isPublished && !['approved', 'in_progress', 'processing'].includes(dataset.status)) {
        throw new Error("This mission node is currently offline (Unpublished).");
      }

      const allowedStatuses = ['approved', 'in_progress', 'processing', 'completed'];
      if (!allowedStatuses.includes(dataset.status)) {
        throw new Error(`Mission authorization pending. Status: ${dataset.status}`);
      }

      const labeller = await resolveLabellerDocument(labellerIdentifier);
      if (!labeller) throw new Error("Labeller profile not found");

      const existingBatch = await checkExistingBatchAssignment(labeller._id);
      if (existingBatch) {
        if (existingBatch.datasetId.toString() !== datasetId.toString()) {
          throw new Error("You already have an active batch in another dataset. Please complete it before claiming a new one.");
        }
        logger.info('Labeller already has active batch assignment, returning existing batch', {
          datasetId,
          labellerId: labeller._id,
          batchId: existingBatch._id
        });
        await existingBatch.populate("tasks");
        return enrichBatchWithDataset(existingBatch);
      }

      // Find and lock an available batch
      const batch = await findAndLockAvailableBatch(datasetId, labeller._id);
      if (!batch) {
        throw new Error("All active batches for this node are currently occupied or completed.");
      }

      // Assign tasks to the labeller and update their profile metrics
      await assignBatchTasksToLabeller(batch, labeller._id);

      await batch.populate("tasks");

      return enrichBatchWithDataset(batch);
    } catch (error) {
      logger.error('Error claiming batch', { error: error.message, datasetId, labellerIdentifier });
      throw error;
    }
  },

  getMyActiveBatch: async (labellerIdentifier) => {
    try {
      if (!labellerIdentifier) throw new Error("Labeller ID required");

      const labeller = await resolveLabellerDocument(labellerIdentifier);
      if (!labeller) throw new Error("Labeller profile not found");

      // Find any batch that is currently 'in_progress' for this user
      const batch = await Batch.findOne({
        assignedTo: labeller._id,
        status: 'in_progress'
      }).populate('tasks').sort({ assignedAt: -1 });

      if (!batch) return null;

      // Fetch all submissions by this user for the tasks in the batch
      const submissions = await Submission.find({
        taskId: { $in: batch.tasks.map(t => t._id) },
        submittedBy: labeller._id
      }).lean();

      // Fetch flagged tasks count for this batch
      const flaggedCount = await Task.countDocuments({
        _id: { $in: batch.tasks.map(t => t._id) },
        status: 'flagged'
      });

      // If the user has completed all tasks in this batch, it is no longer active for them
      if (submissions.length + flaggedCount >= batch.totalTasks) {
        return null;
      }

      // Enrich batch (which sorts and converts to plain object)
      const plainBatch = await enrichBatchWithDataset(batch);

      // Map task statuses dynamically in memory based on user's submission state on the plain object
      const submissionMap = new Map(submissions.map(s => [s.taskId.toString(), s]));
      plainBatch.tasks = plainBatch.tasks.map(t => {
        const sub = submissionMap.get(t._id.toString());
        let mappedStatus = 'pending';
        if (sub) {
          if (sub.status === 'approved') mappedStatus = 'verified';
          else if (sub.status === 'rejected') mappedStatus = 'rejected';
          else mappedStatus = 'submitted';
        } else if (t.status === 'flagged') {
          mappedStatus = 'flagged';
        }
        return { ...t, status: mappedStatus };
      });

      // Dynamic completion count for active batch telemetry
      plainBatch.completedTasks = submissions.length + flaggedCount;

      return plainBatch;
    } catch (error) {
      logger.error('Error fetching active batch', { error: error.message, labellerIdentifier });
      throw error;
    }
  },

  revokeExpiredBatches: async ({ datasetId } = {}) => {
    try {
      const now = new Date();

      // ── Targeted mode: revoke ALL batches for a specific dataset ──────────
      // Ignores expiry — useful for admin resets, dataset suspension, re-ingest
      if (datasetId) {
        if (!mongoose.Types.ObjectId.isValid(datasetId)) {
          throw new Error(`Invalid datasetId: ${datasetId}`);
        }

        const datasetBatches = await Batch.find({
          datasetId,
          status: { $in: ['in_progress', 'available', 'completed', 'expired', 'flagged'] }
        }).lean();

        if (datasetBatches.length === 0) {
          logger.info('No active batches found for dataset', { datasetId });
          return { revoked: 0, tasksReset: 0, datasetId };
        }

        const batchIds = datasetBatches.map(b => b._id);
        const cleanupResult = await performBatchRevocationCleanup(batchIds);

        logger.info('Dataset batches force-revoked and renewed with full ripple cleanup', {
          datasetId,
          batchesRevoked: cleanupResult.revoked,
          tasksReset: cleanupResult.tasksReset,
          submissionsDeleted: cleanupResult.submissionsDeleted,
        });

        return {
          datasetId,
          ...cleanupResult
        };
      }

      // ── Global cron mode: sweep all expired in_progress batches ───────────
      const expiredBatches = await Batch.find({
        status: 'in_progress',
        expiresAt: { $lt: now }
      }).lean();

      if (expiredBatches.length === 0) return { revoked: 0 };

      const batchIds = expiredBatches.map(b => b._id);
      const cleanupResult = await performBatchRevocationCleanup(batchIds);

      logger.info('Global batch expiry sweep complete', {
        batchesRevoked: cleanupResult.revoked,
        tasksReset: cleanupResult.tasksReset,
        submissionsDeleted: cleanupResult.submissionsDeleted,
      });

      return cleanupResult;
    } catch (error) {
      logger.error('Error in revokeExpiredBatches', {
        error: error.message,
        datasetId: datasetId ?? 'global-sweep',
      });
      throw error;
    }
  },

  // Convenience alias — explicit intent at admin call sites
  revokeDatasetBatches: async (datasetId) => {
    if (!datasetId) throw new Error('datasetId is required');
    return taskService.revokeExpiredBatches({ datasetId });
  },

  /**
   * Flag a task as corrupted/problematic.
   * Sets status → 'flagged', stores reason, and unassigns from labeller.
   * Admin review queue will pick it up.
   */
  flagTask: async (taskId, labellerId, userId, reason, detail, batchId) => {
    const task = await Task.findOne({
      _id: taskId,
      assignedTo: labellerId,
      status: { $in: ['in_progress', 'pending'] }
    });

    if (!task) throw new Error('Task not found or not assigned to you');

    task.status = 'flagged';
    task.flagReason = reason;
    task.flagDetail = detail || null;
    task.flaggedBy = userId;
    task.flaggedAt = new Date();
    // Release from labeller so they can move on
    task.isAssigned = false;
    await task.save();

    // Remove from labeller's active task list and increment pending payment dynamically based on pricePerBatch
    const batch = batchId ? await Batch.findById(batchId) : (task.batchId ? await Batch.findById(task.batchId) : null);
    const taskReward = await getTaskReward(batch);
    await Labeller.updateOne(
      { _id: labellerId },
      { 
        $pull: { currentAssignedTasks: task._id },
        $inc: { 'earnings.pendingPayment': taskReward }
      }
    );

    let progress = null;

    if (batchId) {
      const batch = await Batch.findOne({
        _id: batchId,
        assignedTo: labellerId,
        status: 'in_progress'
      });
      if (batch) {
        const submissionsCount = await Submission.countDocuments({
          taskId: { $in: batch.tasks },
          submittedBy: labellerId
        });

        const flaggedCount = await Task.countDocuments({
          _id: { $in: batch.tasks },
          status: 'flagged'
        });

        const completedCount = submissionsCount + flaggedCount;
        progress = {
          completed: completedCount,
          total: batch.totalTasks,
          percent: Math.round((completedCount / batch.totalTasks) * 100)
        };

        if (completedCount >= batch.totalTasks) {
          if (batch.assignedTo.length >= batch.maxLabellers) {
            const labellers = await Labeller.find({ _id: { $in: batch.assignedTo } });
            let allCompleted = true;
            for (const l of labellers) {
              const count = await Submission.countDocuments({
                taskId: { $in: batch.tasks },
                submittedBy: l._id
              });
              const fCount = await Task.countDocuments({
                _id: { $in: batch.tasks },
                status: 'flagged'
              });
              if (count + fCount < batch.totalTasks) {
                allCompleted = false;
                break;
              }
            }
            if (allCompleted) {
              batch.status = 'completed';
              batch.completedAt = new Date();
              await batch.save();
              logger.info(`Mission accomplished: Batch ${batch.batchId} fully completed (with flags)`);
            }
          }
        }
      }
    }

    logger.info('Task flagged by labeller', {
      taskId: task._id,
      labellerId,
      reason,
    });

    return { taskId: task._id, status: 'flagged', reason, progress };
  },
};
