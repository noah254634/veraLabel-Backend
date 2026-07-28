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
import { addEvents, addEvent, createSession } from "./progress.service.js";
import TaskProgressSession from "./task.progress.model.js";

/**
 * Sanitizes a path to prevent directory traversal.
 * It removes leading slashes and resolves any '..' segments.
 * @param {string} path - The path to sanitize.
 * @returns {string} The sanitized path.
 */
const sanitizeR2Key = (path) => (path || '').replace(/^\/+/, '').replace(/\.\.\//g, '');


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
    .select("labellingMethod contentType domain pricePerBatch metadata isCollection")
    .lean();

  const labellingMethod = dataset?.labellingMethod || "annotation";
  const datasetContentType = dataset?.contentType || "text";

  plain.labellingMethod = labellingMethod;
  plain.datasetContentType = datasetContentType;
  plain.pricePerBatch = dataset?.pricePerBatch || 0;
  plain.isCollection = dataset?.isCollection === true;

  if (Array.isArray(plain.tasks)) {
    plain.tasks = await Promise.all(
      plain.tasks.map(async (t) => {
        const task = t?.toObject ? t.toObject() : { ...t };
        const mappedTask = {
          ...task,
          contentType: task.contentType || normalizeContentType(task, dataset),
          labellingMethod,
          categories: task.categories || dataset?.metadata?.labels || [],
        };
        return await enrichTaskMedia(mappedTask, datasetContentType, dataset?.isCollection === true);
      })
    );
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

const enrichTaskMedia = async (task, datasetContentType, isCollection = false) => {
  const contentType = (task.contentType || datasetContentType || 'text').toLowerCase();

  if (isCollection) {
    try {
      const taskR2Url = task.r2_input_taskRef;
      if (taskR2Url) {
        const taskBuffer = await r2ContentFetcher.fetchTaskContent(taskR2Url);
        const parsed = JSON.parse(taskBuffer.toString('utf-8'));
        task.taskObject = parsed;
        task.instructionText = parsed.instructionText || parsed.instruction || parsed.prompt || null;
      }
    } catch (e) {
      logger.warn('Failed to parse collection task content during enrichment', { taskId: task._id || task.id, error: e.message });
    }
    return task;
  }

  if (!['image', 'audio', 'video'].includes(contentType)) {
    return task;
  }

  try {
    const taskR2Url = task.r2_input_taskRef;
    if (taskR2Url) {
      const presignedUrl = await r2ContentFetcher.getPresignedUrl(taskR2Url);
      task.url = presignedUrl;
      task.data = { ...task.data, url: presignedUrl };

      if (contentType === 'image') {
        const embeddingKey = getEmbeddingR2Key(taskR2Url);
        try {
          await r2ContentFetcher.getContentMetadata(embeddingKey);
          const embeddingUrl = await r2ContentFetcher.getPresignedUrl(embeddingKey);
          task.embeddingUrl = embeddingUrl;
          task.taskObject = {
            ...task.taskObject,
            url: presignedUrl,
            embeddingUrl: embeddingUrl
          };
        } catch (e) {
          logger.debug('No embedding found for image task during media enrichment', { taskId: task._id || task.id, error: e.message });
        }
      }
    }
  } catch (error) {
    logger.warn('Failed to enrich task media URLs', { taskId: task._id || task.id, error: error.message });
  }

  return task;
};

const triggerEmbeddingGeneration = async (task, datasetDoc, projectId = null, serverUrl = null) => {
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

    const resolvedProjectId = projectId || datasetDoc.datasetLabeler?.toString() || datasetDoc.buyerId?.toString() || "unknown";
    const resolvedServerUrl = process.env.SERVER_URL;
    if (!resolvedServerUrl) {
      throw new Error("SERVER_URL is not configured in the environment. Cannot generate callback URL.");
    }
    const callbackUrl = `${resolvedServerUrl}/api/v1/tasks/progress`;

    // 3. Dispatch POST request to the FastAPI ML service (asynchronous)
    logger.info('Triggering ML service for SAM 2 embedding', {
      taskId: task._id || task.id,
      r2Key: taskR2Url,
      embeddingKey,
      projectId: resolvedProjectId,
    });

    const response = await fetch(`${mlUrl}/api/v1/generate-embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.FASTAPI_ML_API_KEY,
      },
      body: JSON.stringify({
        image_url: presignedGetUrl,
        upload_url: presignedPutUrl,
        project_id: resolvedProjectId,
        dataset_id: (datasetDoc._id || task.datasetId)?.toString(),
        task_id: (task._id || task.id)?.toString(),
        callback_url: callbackUrl,
      }),
    });

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

  // ── Audio collection tasks: submitted as a Base64 JSON bundle ──
  // These payloads have audioBase64 + transcription, not contentType.
  if (annotation.audioBase64) {
    const hasTranscription = typeof annotation.transcription === "string" && annotation.transcription.trim().length >= 10;
    if (!hasTranscription) {
      throw new Error(
        "Invalid collection payload: 'transcription' is required and must be at least 10 characters."
      );
    }
    return; // Valid collection submission
  }

  // ── Standard audio tasks: expect transcription text or classification label ──
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
  const labeller = await Labeller.findById(labellerId);
  if (!labeller) return null;

  const batches = await Batch.find({
    assignedTo: labeller._id,
    status: 'in_progress'
  }).populate('tasks').sort({ assignedAt: -1, createdAt: -1 });

  for (const batch of batches) {
    if (!batch.tasks || batch.tasks.length === 0) continue;

    const taskIds = batch.tasks.map(t => t._id);
    const count = await Submission.countDocuments({
      taskId: { $in: taskIds },
      submittedBy: labeller._id
    });

    const flaggedCount = await Task.countDocuments({
      _id: { $in: taskIds },
      status: 'flagged'
    });

    if (count + flaggedCount < batch.totalTasks) {
      return batch;
    }
  }

  return null;
};

const findAndLockAvailableBatch = async (datasetId, labellerId) => {
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hour TTL
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
        expiresAt
      },
      $addToSet: { assignedTo: labellerId },
      $push: {
        labellerAssignments: {
          labellerId,
          assignedAt: new Date(),
          expiresAt
        }
      }
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
        labellerAssignments: [],
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

  createTask: async ({ datasetId, projectId, tasks, isLastBatch, serverUrl = null }) => {
    try {
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
        .select("labellingMethod contentType domain maxLabellers")
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
          r2_input_taskRef: sanitizeR2Key(r2Ref),
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

          // Trigger embedding generation for newly inserted tasks sequentially in the background
          if (datasetDoc && String(datasetDoc.contentType).toLowerCase() === 'image') {
            (async () => {
              const startTime = Date.now();
              let session;
              try {
                session = await createSession(projectId, datasetId);
                session.completionSummary = {
                  expectedCount: insertResult.length,
                  startTime: startTime
                };
                await TaskProgressSession.updateOne(
                  { sessionId: session.sessionId },
                  { $set: { completionSummary: session.completionSummary } }
                );

                await addEvent(projectId, datasetId, {
                  type: 'checkpoint',
                  message: `Starting background SAM 2 embedding generation for ${insertResult.length} images`,
                  severity: 'info'
                });
              } catch (sessionErr) {
                logger.warn("Failed to initialize progress session or send start checkpoint event", { error: sessionErr.message });
              }

              let successCount = 0;
              let failCount = 0;
              for (const task of insertResult) {
                try {
                  await triggerEmbeddingGeneration(task, datasetDoc, projectId, serverUrl);
                  successCount++;
                  await new Promise(resolve => setTimeout(resolve, 20)); // Delay to not overload the ML server
                } catch (err) {
                  failCount++;
                  logger.error('Failed to trigger embedding generation in insertResult', { error: err.message, taskId: task._id });
                }
              }
            })();
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
                triggerEmbeddingGeneration(task, datasetDoc, projectId, serverUrl).catch(err => {
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
          const maxLabellers = datasetDoc?.maxLabellers || 1;
          const totalAllocations = totalTasksInDataset * maxLabellers;
          invoice = await invoiceService.generateInvoice(invoiceTaskType, totalAllocations);
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
            rowsCount: totalAllocations,
            ...invoice
          });

          logger.info('Invoice generated and stored', {
            invoiceTaskType,
            totalTasks: totalTasksInDataset,
            maxLabellers,
            totalAllocations,
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
      const dataset = await Dataset.findById(task.datasetId).select("contentType domain isCollection").lean();
      const isCollection = dataset?.isCollection === true;
      const contentType = (task.contentType || normalizeContentType(task, dataset) || 'text').toLowerCase();
      let taskObject;

      if (!isCollection && ['image', 'audio', 'video'].includes(contentType)) {
        try {
          // Verify that the object actually exists in R2 first
          await r2ContentFetcher.getContentMetadata(taskR2Url);

          const presignedUrl = await r2ContentFetcher.getPresignedUrl(taskR2Url);
          taskObject = { url: presignedUrl };

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
  submitTask: async (taskId, labellerIdentifier, batchId, metadata = {}) => {
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

      const existingSubmission = await Submission.findOne({
        taskId: taskId,
        submittedBy: labeller._id
      });

      if (existingSubmission) {
        throw new Error("Task security block: You have already submitted an annotation for this task.");
      }

      // Check if dataset is a crowdsourced collection
      const dataset = await Dataset.findById(task.datasetId).select("isCollection").lean();
      const isCollection = dataset?.isCollection === true;

      // 3. Create the Submission Record
      const submissionId = `SUB-${taskId.toString().slice(-6)}-${labellerId.toString().slice(-6)}-${Date.now().toString().slice(-6)}`;
      const fileExtension = isCollection ? "wav" : "json";
      const r2_output_key = `${task.r2_datasetUrl}/results/${labellerId}/${task.taskId}.${fileExtension}`;

      // Verify that the file exists in Cloudflare R2
      try {
        const headCommand = new HeadObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: r2_output_key
        });
        await r2.send(headCommand);
        logger.info(`Verified collection/annotation file exists in R2`, { r2_output_key });
      } catch (r2Error) {
        logger.error(`Verification failed: file not found in R2`, { error: r2Error.message, r2_output_key });
        throw new Error("Validation failed: You must upload the data to cloud storage before final submission.");
      }

      if (isCollection) {
        // Validate metadata passed from frontend in request body
        validateAnnotationPayload({ audioBase64: "dummy_placeholder", ...metadata });
      } else {
        // Original standard flow: fetch JSON and validate
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
      }

      const submission = new Submission({
        submissionId,
        taskId,
        datasetId: task.datasetId,
        batchId: batchId,
        submittedBy: labeller._id,
        r2_output_key,
        status: 'submitted',
        ...(isCollection ? {
          collectionMetadata: {
            transcription: metadata.transcription || null,
            selectedTone: metadata.selectedTone || null,
            languageUsed: metadata.languageUsed || null,
            codeSwitchingUsed: metadata.codeSwitchingUsed || null,
            deviceInfo: metadata.deviceInfo || null,
            timezone: metadata.timezone || null,
            recordedAt: metadata.recordedAt ? new Date(metadata.recordedAt) : null,
          }
        } : {})
      });
      await submission.save();

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

      // Check if dataset is a crowdsourced collection
      const dataset = await Dataset.findById(task.datasetId).select("isCollection contentType").lean();
      const isCollection = dataset?.isCollection === true;

      const fileExtension = isCollection
        ? (dataset.contentType === "audio" ? "wav" : "bin")
        : "json";
      const contentType = isCollection
        ? (dataset.contentType === "audio" ? "audio/wav" : "application/octet-stream")
        : "application/json";
      const r2_output_key = `${task.r2_datasetUrl}/results/${labellerId}/${task.taskId}.${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: r2_output_key,
        ContentType: contentType,
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

      const datasetMeta = await Dataset.findById(datasetId)
        .select("labellingMethod contentType")
        .lean();

      const unbatchedTasks = await Task.find({
        datasetId,
        batchId: null
      }).select("_id taskType contentType category").lean();

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
          category: batchTasks[0].category || null,
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

      // Verify location eligibility if dataset has location restrictions
      if (dataset.isGlobalAccess === false) {
        const country = labeller?.profile?.location?.country?.trim()?.toUpperCase() || "";
        const region = labeller?.profile?.location?.region?.trim()?.toLowerCase() || "";
        const city = labeller?.profile?.location?.city?.trim()?.toLowerCase() || "";

        let isEligible = false;
        if (Array.isArray(dataset.allowedCountries) && dataset.allowedCountries.length > 0) {
          if (country && dataset.allowedCountries.includes(country)) {
            isEligible = true;
          }
        }
        if (Array.isArray(dataset.targetLocations) && dataset.targetLocations.length > 0) {
          for (const loc of dataset.targetLocations) {
            const locCountry = (loc.country || "").trim().toUpperCase();
            const locRegion = (loc.region || "").trim().toLowerCase();
            const locCity = (loc.city || "").trim().toLowerCase();
            if (locCountry && country === locCountry) isEligible = true;
            if (locRegion && (region === locRegion || city === locRegion)) isEligible = true;
            if (locCity && city === locCity) isEligible = true;
          }
        }

        if (!isEligible && (dataset.allowedCountries?.length > 0 || dataset.targetLocations?.length > 0)) {
          throw new Error("This mission dataset is restricted to labellers in a different geographic region.");
        }
      }

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

  claimCategoryBatch: async (category, labellerIdentifier) => {
    try {
      if (!category) throw new Error("Category is required for rolling claim");
      const labeller = await resolveLabellerDocument(labellerIdentifier);
      if (!labeller) throw new Error("Labeller profile not found");

      // 1. Check if they already have an active batch in progress
      const existingBatch = await checkExistingBatchAssignment(labeller._id);
      if (existingBatch) {
        logger.info('Labeller already has active batch assignment, returning existing batch', {
          labellerId: labeller._id,
          batchId: existingBatch._id
        });
        await existingBatch.populate("tasks");
        return enrichBatchWithDataset(existingBatch);
      }

      // 2. Find an available batch in this category where the labeller is not already assigned
      const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hour TTL
      const batch = await Batch.findOneAndUpdate(
        {
          category: category.toLowerCase().trim(),
          status: { $in: ['available', 'in_progress'] },
          assignedTo: { $ne: labeller._id },
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
            expiresAt
          },
          $addToSet: { assignedTo: labeller._id },
          $push: {
            labellerAssignments: {
              labellerId: labeller._id,
              assignedAt: new Date(),
              expiresAt
            }
          }
        },
        {
          sort: { priority: -1, createdAt: 1 },
          new: true
        }
      ).populate('tasks');

      if (!batch) {
        throw new Error(`No available batches in category: ${category}`);
      }

      // 3. Assign tasks to the labeller and update their profile metrics
      await assignBatchTasksToLabeller(batch, labeller._id);
      await batch.populate("tasks");
      return enrichBatchWithDataset(batch);
    } catch (error) {
      logger.error('Error claiming category batch', { error: error.message, category, labellerIdentifier });
      throw error;
    }
  },

  getMyActiveBatch: async (labellerIdentifier) => {
    try {
      if (!labellerIdentifier) throw new Error("Labeller ID required");

      const labeller = await resolveLabellerDocument(labellerIdentifier);
      if (!labeller) throw new Error("Labeller profile not found");

      const batch = await checkExistingBatchAssignment(labeller._id);
      if (!batch) return null;

      const submissions = await Submission.find({
        taskId: { $in: batch.tasks.map(t => t._id) },
        submittedBy: labeller._id
      }).lean();

      const flaggedCount = await Task.countDocuments({
        _id: { $in: batch.tasks.map(t => t._id) },
        status: 'flagged'
      });

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
        'labellerAssignments.expiresAt': { $lt: now }
      });

      if (expiredBatches.length === 0) return { revoked: 0, tasksReset: 0, submissionsDeleted: 0 };

      let revokedCount = 0;
      let tasksResetCount = 0;
      let submissionsDeletedCount = 0;

      for (const batch of expiredBatches) {
        for (const assignment of batch.labellerAssignments) {
          if (assignment.expiresAt < now) {
            const submissionsCount = await Submission.countDocuments({
              batchId: batch._id,
              submittedBy: assignment.labellerId
            });
            const flaggedCount = await Task.countDocuments({
              _id: { $in: batch.tasks },
              status: 'flagged'
            });

            if (submissionsCount + flaggedCount < batch.totalTasks) {
              const res = await taskService.revokeLabellerFromBatch(batch._id, assignment.labellerId);
              if (res.success) {
                revokedCount++;
                tasksResetCount += (res.tasksReset || 0);
                submissionsDeletedCount += (res.submissionsDeleted || 0);
              }
            }
          }
        }
      }

      logger.info('Global batch expiry sweep complete', {
        assignmentsRevoked: revokedCount,
        tasksReset: tasksResetCount,
        submissionsDeleted: submissionsDeletedCount,
      });

      return {
        revoked: revokedCount,
        tasksReset: tasksResetCount,
        submissionsDeleted: submissionsDeletedCount
      };
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

  generateMissingEmbeddings: async (datasetId, serverUrl = null) => {
    if (!datasetId) throw new Error("datasetId is required");
    const datasetDoc = await Dataset.findById(datasetId).select("contentType buyerId datasetLabeler").lean();
    if (!datasetDoc) throw new Error("Dataset not found");
    if (String(datasetDoc.contentType).toLowerCase() !== 'image') {
      throw new Error("Only image datasets support SAM 2 embeddings");
    }

    const resolvedProjectId = datasetDoc.datasetLabeler?.toString() || datasetDoc.buyerId?.toString() || "unknown";

    // Run missing check and generation asynchronously in the background
    (async () => {
      try {
        // Prevent race condition: check if a generation session is already in progress
        const existingSession = await TaskProgressSession.findOne({ datasetId, status: 'processing' }).lean();
        if (existingSession) {
          const now = new Date();
          const lastUpdate = new Date(existingSession.lastUpdate || existingSession.createdAt);
          if (now - lastUpdate < 30 * 60 * 1000) {
            logger.warn(`Rejected concurrent generateMissingEmbeddings for dataset ${datasetId}`);
            return;
          }
        }

        const tasksToTrigger = await Task.find({ datasetId, hasSam2Embedding: { $ne: true } }).lean();
        const totalTasksCount = await Task.countDocuments({ datasetId });
        const skippedCount = totalTasksCount - tasksToTrigger.length;

        const session = await createSession(resolvedProjectId, datasetId);

        await addEvent(resolvedProjectId, datasetId, {
          type: 'checkpoint',
          message: `Found ${tasksToTrigger.length} missing embeddings (skipped ${skippedCount} existing based on DB status). Starting generation...`,
          severity: 'info'
        });

        if (tasksToTrigger.length === 0) {
          const summary = {
            expectedCount: 0,
            total: 0,
            successCount: 0,
            failedCount: 0,
            durationMs: 0,
            success: true
          };
          await TaskProgressSession.updateOne(
            { sessionId: session.sessionId },
            {
              $set: {
                status: 'completed',
                endTime: new Date(),
                completionSummary: summary
              }
            }
          );
          await addEvent(resolvedProjectId, datasetId, {
            type: 'complete',
            message: 'Completed: All embeddings are already up to date.',
            severity: 'info',
            summary
          });
          return;
        }

        session.completionSummary = {
          expectedCount: tasksToTrigger.length,
          startTime: Date.now()
        };
        await TaskProgressSession.updateOne(
          { sessionId: session.sessionId },
          { $set: { completionSummary: session.completionSummary } }
        );

        let successCount = 0;
        let failCount = 0;
        for (const task of tasksToTrigger) {
          try {
            await triggerEmbeddingGeneration(task, datasetDoc, resolvedProjectId, serverUrl);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 20)); // Delay to not overload the ML server
          } catch (err) {
            failCount++;
            logger.error(`Generation failed for task ${task._id}`, { error: err.message });
          }
        }
      } catch (bgError) {
        logger.error('Error in background missing embedding generator', { error: bgError.message });
      }
    })();

    return { success: true, message: "Missing embedding generation triggered in background." };
  },

  revokeLabellerFromBatch: async (batchId, labellerId) => {
    try {
      if (!batchId || !labellerId) {
        throw new Error("batchId and labellerId are required");
      }

      logger.info('Revoking specific labeller from batch', { batchId, labellerId });

      const batch = await Batch.findById(batchId);
      if (!batch) {
        logger.warn('Batch not found for revocation', { batchId });
        return { success: false, reason: 'Batch not found' };
      }

      const taskIds = batch.tasks.map(id => id.toString());
      if (taskIds.length === 0) {
        return { success: true, message: 'No tasks in batch' };
      }

      // 1. Find and delete submissions for this labeller and batch tasks
      const submissionsToDelete = await Submission.find({
        batchId,
        submittedBy: labellerId
      }).lean();

      const deletedCount = submissionsToDelete.length;
      let submissionsDeletedResult = 0;
      if (deletedCount > 0) {
        const delRes = await Submission.deleteMany({
          batchId,
          submittedBy: labellerId
        });
        submissionsDeletedResult = delRes.deletedCount;
      }

      const taskReward = await getTaskReward(batch);

      // 2. Update the labeller's profile metrics
      const labeller = await Labeller.findById(labellerId);
      if (labeller) {
        const currentTotalAssigned = labeller.performance?.totalTasksAssigned || 0;
        const decAmount = Math.min(currentTotalAssigned, taskIds.length);

        const currentPendingPayment = labeller.earnings?.pendingPayment || 0;
        const pendingDecAmount = Math.min(currentPendingPayment, deletedCount * taskReward);

        await Labeller.updateOne(
          { _id: labellerId },
          {
            $pull: { currentAssignedTasks: { $in: taskIds } },
            $inc: {
              'performance.totalTasksAssigned': -decAmount,
              'earnings.pendingPayment': -pendingDecAmount
            }
          }
        );
        logger.info('Updated labeller metrics for revocation', {
          labellerId,
          decAmount,
          pendingDecAmount
        });
      }

      // 3. Update Tasks: pull labellerId from the tasks' assignedTo array
      await Task.updateMany(
        { _id: { $in: taskIds } },
        { $pull: { assignedTo: labellerId } }
      );

      // 4. Find tasks that no longer have any assigned labellers, reset their status
      const unassignedTasks = await Task.find({
        _id: { $in: taskIds },
        assignedTo: { $size: 0 }
      }).select('_id');

      if (unassignedTasks.length > 0) {
        const unassignedIds = unassignedTasks.map(t => t._id);
        await Task.updateMany(
          { _id: { $in: unassignedIds } },
          {
            $set: {
              status: 'pending',
              isAssigned: false,
              assignedAt: null,
              startedAt: null,
              completedAt: null
            }
          }
        );
        logger.info('Reset unassigned tasks status', { count: unassignedIds.length });
      }

      // 5. Update Batch: pull labellerId from assignedTo and labellerAssignments arrays
      const updatedBatch = await Batch.findOneAndUpdate(
        { _id: batchId },
        {
          $pull: {
            assignedTo: labellerId,
            labellerAssignments: { labellerId: labellerId }
          }
        },
        { new: true }
      );

      if (updatedBatch) {
        if (updatedBatch.assignedTo.length === 0) {
          await Batch.updateOne(
            { _id: batchId },
            {
              $set: {
                status: 'available',
                assignedAt: null,
                expiresAt: null
              }
            }
          );
          logger.info('Batch reset to available as no labellers are assigned', { batchId });
        } else {
          const remainingAssignments = updatedBatch.labellerAssignments;
          if (remainingAssignments && remainingAssignments.length > 0) {
            const nextExpiresAt = new Date(Math.min(...remainingAssignments.map(a => new Date(a.expiresAt).getTime())));
            await Batch.updateOne(
              { _id: batchId },
              { $set: { expiresAt: nextExpiresAt } }
            );
          }
        }
      }

      return {
        success: true,
        submissionsDeleted: submissionsDeletedResult,
        tasksReset: unassignedTasks.length
      };
    } catch (error) {
      logger.error('Error in revokeLabellerFromBatch', { error: error.message, batchId, labellerId });
      throw error;
    }
  },
};
