import Task from "./task.model.js";
import UserVera from "../users/user.model.js";
import Dataset from "../datasets/dataset.model.js";
import Invoice from "../datasets/invoice.model.js";
import Labeller from "../labeller/labeller.model.js";
import { r2ContentFetcher } from "./r2.contentFetcher.js";
import mongoose from "mongoose";
import { invoiceService } from "../../helpers/priceCalculator.js";
import logger from "../../config/logger.js";
import Batch from "./task.batch.model.js";

const normalizeTaskType = (task = {}) => {
  try {
    const rawType = String(task.taskType || task.type || "").trim().toLowerCase();

    if (["text", "audio", "video", "rfhlearning", "image"].includes(rawType)) {
      return rawType;
    }

    if (["rlhf", "rflhf"].includes(rawType)) {
      return "rfhlearning";
    }

    const contentType = String(task.contentType || "").toLowerCase();
    if (contentType.startsWith("text/") || contentType.includes("json")) return "text";
    if (contentType.startsWith("image/")) return "image";
    if (contentType.startsWith("audio/")) return "audio";
    if (contentType.startsWith("video/")) return "video";

    return "text";
  } catch (error) {
    logger.warn('Error normalizing task type', { error: error.message, task });
    return "text";
  }
};

const normalizeTaskTypeForInvoice = (taskType) => {
  try {
    const normalizedType = String(taskType || "").trim().toLowerCase();

    if (["rlhf", "rflhf", "rfhlearning"].includes(normalizedType)) return "rlhf";
    if (normalizedType === "image") return "images";
    if (normalizedType === "video") return "videos";

    return normalizedType || "text";
  } catch (error) {
    logger.warn('Error normalizing invoice task type', { error: error.message, taskType });
    return "text";
  }
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

const updateDatasetRecordsAndPrice = async ({ datasetId, datasetRef }) => {
  try {
    if (!datasetId || !datasetRef) {
      throw new Error('datasetId and datasetRef are required');
    }

    const totalRows = await Task.countDocuments({
      $or: [
        { datasetId: datasetId },
        { r2_datasetUrl: datasetRef }
      ]
    });

    let taskTypeForPricing = 'text';
    const sampleTask = await Task.findOne({ datasetId: datasetId }).select('taskType').lean();
    if (sampleTask) {
      taskTypeForPricing = normalizeTaskTypeForInvoice(sampleTask.taskType);
    }
    
    let calculatedPrice = 0;
    try {
      const invoice = await invoiceService.generateInvoice(taskTypeForPricing, totalRows);
      calculatedPrice = invoice.totalCost;
    } catch (invoiceError) {
      logger.error('Critical failure in price calculation via invoiceService', {
        error: invoiceError.message,
        taskType: taskTypeForPricing,
        totalRows,
      });
      throw new Error(`Pricing calculation failed: ${invoiceError.message}`);
    }

    const update = {
      "metadata.numRecords": totalRows,
      price: calculatedPrice,
      status: "approved"
    };

    const isObjectId = mongoose.Types.ObjectId.isValid(datasetId);
    const updated = isObjectId
      ? await Dataset.findOneAndUpdate(
          { _id: datasetId, status: { $ne: "approved" } }, // Only update if not already approved
          update, 
          { new: true }
        )
      : await Dataset.findOneAndUpdate(
          { name: datasetId, status: { $ne: "approved" } }, 
          update, 
          { new: true }
        );

    if (updated) {
      logger.info('Dataset marked as approved and ready for invoicing', {
        datasetId: updated._id
      });
    }

    const finalDataset = updated || (isObjectId ? await Dataset.findById(datasetId) : await Dataset.findOne({ name: datasetId }));

    logger.info('Dataset records and price updated', {
      datasetId,
      totalRows,
      calculatedPrice,
      updated: Boolean(updated),
    });

    return { rowsUpdated: Boolean(updated), totalRows, calculatedPrice };
  } catch (error) {
    logger.error('Error updating dataset records and price', {
      error: error.message,
      datasetId,
      datasetRef,
    });
    throw error;
  }
};
export const taskService = {
getBatches: async () => {
  const batches=await Batch.find();
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

      const taskEntries = tasks.map((task, index) => {
          throw new Error(`Invalid task at index ${index}: task must be an object`);
        }
      )
        const r2Ref = task.key || task.r2_url;
        if (!r2Ref) {
          throw new Error(`Invalid task payload at index ${index}: missing 'key' or 'r2_url'`);
        }
        return {
          r2_datasetUrl: datasetRef,
          r2_input_taskRef: r2Ref,
          datasetId: datasetId,
          taskType: normalizeTaskType(task),
          taskName: task.name || task.taskId || `task-${index + 1}`,
          taskId: task.taskId || null,
          split: normalizeSplit(task.split),
          status: "pending",
          isAssigned: false,
          _uniqueKey: task.taskId || r2Ref,
        };
      

      logger.debug('Task entries prepared', {
        datasetRef,
        taskTypes: [...new Set(taskEntries.map(t => t.taskType))],
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
        } catch (insertError) {

          const isDuplicateError = insertError.code === 11000 ||
                                  (insertError.writeErrors && insertError.writeErrors.some(e => e.code === 11000));

          if (insertError.insertedIds && insertError.insertedIds.length > 0) {
            insertedCount = insertError.insertedIds.length;
            failedCount = tasksToInsert.length - insertedCount;

            logger.warn('Partial insertion success (some duplicates or failures)', {
              datasetRef,
              insertedCount,
              failedCount,
              isDuplicateError,
            });
          } else {
            failedCount = tasksToInsert.length;
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

        const invoiceTaskType = normalizeTaskTypeForInvoice(taskEntries[0]?.taskType);
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
        if (['text', 'audio', 'video', 'rfhlearning', 'image'].includes(normalizedType)) {
          filters.taskType = normalizedType;
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
      const taskBuffer = await r2ContentFetcher.fetchTaskContent(taskR2Url);
      let taskObject;
      try {
        taskObject = JSON.parse(taskBuffer.toString('utf-8'));
      } catch (parseError) {
        logger.warn('Could not parse task content as JSON, returning raw content', { taskId: id });
        taskObject = taskBuffer.toString('utf-8');
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

  returnTaskToPool: async (id) => {
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
        await Labeller.updateMany(
          { _id: { $in: previousAssignees } },
          {
            $pull: { currentAssignedTasks: id }
          }
        );

        logger.info('Removed task from labeller profiles', {
          taskId: id,
          labellerIds: previousAssignees
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

      if (task.status === 'verified' || task.status === 'submitted') {
        throw new Error("Task security block: Task has already been submitted or verified.");
      }

      // 3. Update Task Work State
      // Note: Raw submission data is handled directly between frontend and Cloudflare R2.
      // The backend only manages the lifecycle metadata and verification states.
      task.status = 'submitted';
      task.completedAt = new Date();
      
      // Construct the expected R2 result path for verification later
      if (!task.r2_task_resultRef) {
         task.r2_task_resultRef = `${task.r2_datasetUrl}/results/${task.taskId}.json`;
      }
      
      await task.save();

      // 4. Update Batch Progress (Atomic)
      const updatedBatch = await Batch.findByIdAndUpdate(
        batchId,
        { $inc: { completedTasks: 1 } },
        { new: true }
      );

      // 5. Automatic Batch Lifecycle Transition
      if (updatedBatch.completedTasks >= updatedBatch.totalTasks) {
        updatedBatch.status = 'completed';
        updatedBatch.completedAt = new Date();
        await updatedBatch.save();
        
        logger.info(`Mission accomplished: Batch ${updatedBatch.batchId} fully completed by labeller ${labellerId}`);
      }

      logger.info(`Task submission metadata updated`, { taskId, batchId, labellerId });
      
      return { 
        success: true, 
        message: "Task marked as submitted",
        progress: {
          completed: updatedBatch.completedTasks,
          total: updatedBatch.totalTasks,
          percent: Math.round((updatedBatch.completedTasks / updatedBatch.totalTasks) * 100)
        }
      };
    } catch (error) {
      logger.error('Error updating task submission state', { error: error.message, taskId, batchId, labellerIdentifier });
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
    
    return { message: "Task verified successfully", task };
  },
  rejectTask: async (taskId, reason) => {
    try {
      if (!taskId) throw new Error("Task ID is required");
      
      const task = await Task.findById(taskId);
      if (!task) throw new Error("Task not found");

      const labellerId = task.assignedTo;

      task.isVerified = false;
      task.verifiedBy = null;
      task.status = "rejected";
      task.rejectionReason = reason;
      task.verificationScore = 0;
      await task.save();

      await taskService.returnTaskToPool(taskId);

      if (labellerId) {
        await Labeller.findOneAndUpdate(
          { _id: labellerId },
          {
            $inc: { 'performance.totalTasksRejected': 1 }
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
  deleteTaskBatch: async () => {},
  autoAssignTask: async () => {},
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
    
    return { message: "Task verified successfully", task };
  },
  revokeTask: async (taskId) => {
    const task = await Task.findById(taskId);
    if(!task) throw new Error("Task not found");
    if(!task.isAssigned) throw new Error("Task not assigned");
    const newTask = await taskService.returnTaskToPool(taskId);
    return { message: "Task revoked successfully", newTask };
  },
  autoAssignTask: async () => {},
  revokeExpiredTasks:async()=>{
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

      // 1. Fetch all unbatched tasks for this dataset
      const unbatchedTasks = await Task.find({
        datasetId,
        batchId: null
      }).select('_id taskType').lean();

      if (unbatchedTasks.length === 0) {
        logger.info('No unbatched tasks found for dataset', { datasetId });
        return { created: 0 };
      }

      logger.info(`Starting batch generation for dataset ${datasetId}`, { 
        totalTasks: unbatchedTasks.length 
      });

      const batchSize = 10;
      const batchesToCreate = [];

      // 2. Group into 10s
      for (let i = 0; i < unbatchedTasks.length; i += batchSize) {
        const batchTasks = unbatchedTasks.slice(i, i + batchSize);
        const taskIds = batchTasks.map(t => t._id);
        const type = batchTasks[0].taskType;

        batchesToCreate.push({
          batchId: `B-${datasetId.toString().slice(-4)}-${Math.floor(i / batchSize)}-${Date.now().toString().slice(-4)}`,
          datasetId,
          tasks: taskIds,
          totalTasks: taskIds.length,
          completedTasks: 0,
          batchType: type,
          status: 'available',
          priority: 0 // Could be inherited from tasks if needed
        });
      }

      // 3. Save batches and update tasks
      const createdBatches = await Batch.insertMany(batchesToCreate);

      // Link tasks back to their batches
      const updatePromises = createdBatches.map(batch => 
        Task.updateMany(
          { _id: { $in: batch.tasks } },
          { $set: { batchId: batch._id } }
        )
      );

      await Promise.all(updatePromises);

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
      // 1. Verify Dataset is allowed to be worked on
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

      // 2. Find an available batch and assign it atomically
      const labeller = await resolveLabellerDocument(labellerIdentifier);
      if (!labeller) throw new Error("Labeller profile not found");

      const batch = await Batch.findOneAndUpdate(
        {
          datasetId,
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
            expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hour TTL
          },
          $addToSet: { assignedTo: labeller._id }
        },
        { new: true }
      ).populate('tasks');

      if (!batch) {
        throw new Error("All active batches for this node are currently occupied or completed.");
      }

      // Mark all tasks in the batch as assigned
      const taskIds = batch.tasks.filter(t => t).map(t => t._id || t);
      await Task.updateMany(
        { _id: { $in: taskIds } },
        {
          $set: {
            isAssigned: true,
            assignedAt: new Date(),
            status: 'in_progress'
          },
          $addToSet: { assignedTo: labeller._id }
        }
      );

      return batch;
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
      }).populate({
        path: 'tasks',
        match: { status: { $ne: 'verified' } }
      }).sort({ assignedAt: -1 }).lean();

      return batch || null;
    } catch (error) {
      logger.error('Error fetching active batch', { error: error.message, labellerIdentifier });
      throw error;
    }
  },

  revokeExpiredBatches: async () => {
    try {
      const now = new Date();
      const expiredBatches = await Batch.find({
        status: 'in_progress',
        expiresAt: { $lt: now }
      });

      if (expiredBatches.length === 0) return { revoked: 0 };

      const batchIds = expiredBatches.map(b => b._id);
      
      // Reset batches to available state
      await Batch.updateMany(
        { _id: { $in: batchIds } },
        {
          $set: {
            status: 'available',
            assignedTo: [],
            assignedAt: null,
            expiresAt: null
          }
        }
      );

      // Reset tasks within those batches that are still marked as in_progress
      await Task.updateMany(
        { batchId: { $in: batchIds }, status: 'in_progress' },
        {
          $set: {
            status: 'pending',
            isAssigned: false,
            assignedTo: [],
            assignedAt: null
          }
        }
      );

      logger.info(`Batch auto-revocation complete: ${expiredBatches.length} batches returned to pool`);
      return { revoked: expiredBatches.length };
    } catch (error) {
      logger.error('Critical error in batch auto-revocation', { error: error.message });
      throw error;
    }
  }
};
