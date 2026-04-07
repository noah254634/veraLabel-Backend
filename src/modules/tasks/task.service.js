import Task from "./task.model.js";
import UserVera from "../users/user.model.js";
import Dataset from "../datasets/dataset.model.js";
import mongoose from "mongoose";
import { invoiceService } from "../../helpers/priceCalculator.js";
import logger from "../../config/logger.js";

// ===== TASK-SPECIFIC HELPERS (normalization only) =====

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

const updateDatasetRecordsAndPrice = async ({ datasetId, datasetRef }) => {
  try {
    if (!datasetId || !datasetRef) {
      throw new Error('datasetId and datasetRef are required');
    }

    const totalRows = await Task.countDocuments({
      r2_datasetUrl: { $in: [datasetRef, datasetId] },
    });
    
    // Use invoice service to get proper pricing
    const invoiceTaskType = normalizeTaskTypeForInvoice('rlhf'); // Default tier, actual type comes from tasks
    let calculatedPrice = 0;
    
    try {
      const invoice = await invoiceService.generateInvoice(invoiceTaskType, totalRows);
      calculatedPrice = invoice.totalCost;
    } catch (invoiceError) {
      logger.warn('Failed to calculate price from invoiceService', {
        error: invoiceError.message,
        totalRows,
      });
      // Fallback to simple tier pricing if invoice fails
      if (totalRows <= 100) calculatedPrice = 10;
      else if (totalRows <= 1000) calculatedPrice = 25;
      else if (totalRows <= 10000) calculatedPrice = 100;
      else if (totalRows <= 50000) calculatedPrice = 400;
      else calculatedPrice = 800;
    }

    const update = {
      "metadata.numRecords": totalRows,
      price: calculatedPrice,
    };

    const isObjectId = mongoose.Types.ObjectId.isValid(datasetId);
    const updated = isObjectId
      ? await Dataset.findByIdAndUpdate(datasetId, update, { new: true })
      : await Dataset.findOneAndUpdate({ name: datasetId }, update, { new: true });

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

// ===== SERVICE EXPORT =====

export const taskService = {
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
        // Validate task payload
        if (!task || (typeof task !== 'object')) {
          throw new Error(`Invalid task at index ${index}: task must be an object`);
        }

        const r2Ref = task.key || task.r2_url;
        if (!r2Ref) {
          throw new Error(`Invalid task payload at index ${index}: missing 'key' or 'r2_url'`);
        }

        // SANITIZED: Store only attributes and references, NOT raw content
        // contentPreview and other raw data are STRIPPED
        return {
          // References to R2 (use these to fetch content)
          r2_datasetUrl: datasetRef,
          r2_input_taskRef: r2Ref,
          
          // Metadata attributes
          taskType: normalizeTaskType(task),
          taskName: task.name || task.taskId || `task-${index + 1}`,
          taskId: task.taskId || null,
          split: normalizeSplit(task.split),
          
          // Status
          status: "pending",
          isAssigned: false,
          
          // Internal tracking
          _uniqueKey: task.taskId || r2Ref,
          
          // NOTE: contentPreview, raw content, and other large data are NOT stored
          // Use r2_input_taskRef with R2 client to fetch actual content when needed
        };
      });

      logger.debug('Task entries prepared', {
        datasetRef,
        entryCount: taskEntries.length,
        taskTypes: [...new Set(taskEntries.map(t => t.taskType))],
      });

      // Comprehensive duplicate detection - check both taskId and R2 reference
      // Only check non-null taskIds to avoid null collisions
      const refsToCheck = taskEntries.map(t => t.r2_input_taskRef).filter(Boolean);
      const taskIdsToCheck = taskEntries.map(t => t.taskId).filter(Boolean); // Only non-null
      
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

      // Build a set of existing unique keys (taskId or r2_input_taskRef)
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

      // Filter out tasks that already exist (check both taskId and R2 reference)
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
          return false; // Skip this duplicate
        }
        seenUniqueKeys.add(key);
        return true;
      });

      logger.info('Duplicate filtering completed', {
        totalTasks: taskEntries.length,
        afterExistingCheck: newTaskEntries.length,
        afterBatchDedup: deduplicatedEntries.length,
        duplicatesSkipped: taskEntries.length - deduplicatedEntries.length,
      });

      // Only insert deduplicated tasks
      let insertedCount = 0;
      let duplicateCount = taskEntries.length - deduplicatedEntries.length;
      
      if (deduplicatedEntries.length > 0) {
        // Remove internal _uniqueKey field before saving to DB
        const tasksToInsert = deduplicatedEntries.map(({ _uniqueKey, ...task }) => task);
        
        const insertResult = await Task.insertMany(tasksToInsert);
        insertedCount = insertResult.length;
        logger.info('Tasks inserted into database', {
          datasetRef,
          insertedCount,
          duplicateCount,
        });
      } else {
        logger.warn('No new tasks to insert after deduplication', {
          datasetRef,
          skipped: duplicateCount,
        });
      }

      let rowsUpdated = false;
      let calculatedPrice = null;

      if (isLastBatch) {
        const updateResult = await updateDatasetRecordsAndPrice({ datasetId, datasetRef });
        rowsUpdated = updateResult.rowsUpdated;
        calculatedPrice = updateResult.calculatedPrice;
        logger.info('Dataset finalized after last batch', {
          datasetRef,
          totalRows: updateResult.totalRows,
          calculatedPrice,
        });
      }

      // Count actual unique tasks (including previously existing ones) 
      const totalTasksInDataset = await Task.countDocuments({ r2_datasetUrl: datasetRef });
      const invoiceTaskType = normalizeTaskTypeForInvoice(taskEntries[0]?.taskType);
      
      let invoice = null;
      try {
        // Generate invoice for NEWLY inserted tasks only, not the entire dataset
        invoice = await invoiceService.generateInvoice(invoiceTaskType, insertedCount);
        logger.debug('Invoice generated', { 
          invoiceTaskType, 
          newlyInserted: insertedCount,
          totalInDataset: totalTasksInDataset 
        });
      } catch (invoiceError) {
        logger.warn('Failed to generate invoice', {
          error: invoiceError.message,
          invoiceTaskType,
          newlyInserted: insertedCount,
        });
      }

      const response = {
        invoice,
        message: "Tasks created successfully",
        count: insertedCount,
        duplicatesSkipped: duplicateCount,
        totalTasksInDataset,
        rowsUpdated,
      };

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
      // Validate pagination parameters with defensive checks
      const validPage = Math.max(1, Number.parseInt(page, 10) || 1);
      const validLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 50));

      const filters = {};

      // Build filters with normalization
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

      // Validate MongoDB ObjectId format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid task ID format: ${id}`);
      }

      logger.debug('Fetching task by ID', { taskId: id });

      const task = await Task.findById(id).lean();
      
      if (!task) {
        logger.warn('Task not found', { taskId: id });
        throw new Error(`Task with ID ${id} not found`);
      }

      logger.debug('Task fetched successfully', { taskId: id, status: task.status });
      return task;
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

      task.status = "pending";
      task.isAssigned = false;
      task.assignedTo = null;
      task.assignedAt = null;
      task.startedAt = null;
      task.completedAt = null;

      await task.save();

      logger.info('Task returned to pool successfully', {
        taskId: id,
        previousAssignee: task.assignedTo || 'unassigned',
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
  assignTask: async (taskId, userId) => {
    const task = await Task.findById(taskId);
    if (!task) throw new Error("Task not found");
    const user = await UserVera.find({ _id: userId, role: "labeler" });
    if (!user) throw new Error("User not found or not a labeler");
    if (task.isAssigned) throw new Error("Task already assigned");
    task.isAssigned = true;
    task.assignedTo = userId;
    task.assignedAt = new Date();
    task.status = "in_progress";
    await task.save();
    return { message: "Task assigned successfully", task };
  },
  submitTask: async (taskId, userId) => {
    if (!taskId) throw new Error("Task id is required");
    if (!userId) throw new Error("User id is required");
    //verification logic will go here by calling the fastAPI Microservices to do the verification and sent the response for verification
  },
  verifyTask: async (taskId, userId) => {
    if (!taskId) throw new Error("Task id is required");
    if (!userId) throw new Error("User id is required");
    const task = await Task.findById(taskId);
    if (!task) throw new Error("Task not found");
    const user = await UserVera.find({
      _id: userId,
      role: "admin" || "reviewer",
    });
    if (!user)
      throw new Error(
        "User not found or not authorized to perform this action",
      );
    if (task.isVerified) throw new Error("Task already verified");
    task.isVerified = true;
    task.verifiedBy = userId;
    task.status = "verified";
    await task.save();
    return { message: "Task verified successfully", task };
  },
  rejectTask: async (taskId, reason) => {
    const task = await Task.findById(taskId);
    if (!task) throw new Error("Task not found");
    task.isVerified = false;
    task.verifiedBy = null;
    task.status = "rejected";
    task.rejectionReason = reason;
    task.verificationScore = 0;
    await taskService.returnTaskToPool(taskId);

    return { message: "Task rejected successfully", task };
  },
  deleteTaskBatch: async () => {

  },
  reviewTask: async (taskId, userId,score) => {
    const task = await Task.findById(taskId);
    if(!task) throw new Error("Task not found");
    const user = await UserVera.findById(userId);
    if(!user) throw new Error("User not found");
    if(task.isVerified) throw new Error("Task already verified");
    task.isVerified=true;
    task.verifiedBy=userId;
    task.status="verified";
    task.verificationScore=score;
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
          assignedTo: null,
          assignedAt: null,
          startedAt: null,
          completedAt: null,
        },
      }
    );
    return { message: "Tasks revoked successfully", result };
  },
};
