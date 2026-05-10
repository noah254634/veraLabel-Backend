import Task from "./task.model.js";
import UserVera from "../users/user.model.js";
import Dataset from "../datasets/dataset.model.js";
import Invoice from "../datasets/invoice.model.js";
import Labeller from "../labeller/labeller.model.js";
import { r2ContentFetcher } from "./r2.contentFetcher.js";
import mongoose from "mongoose";
import { invoiceService } from "../../helpers/priceCalculator.js";

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

    // Count tasks belonging to this dataset ID
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
      // Note: Status update to awaiting_payment will happen in createTask when invoice is generated
      logger.info('Dataset marked as approved and ready for invoicing', {
        datasetId: updated._id
      });
    }

    // If it was already approved, just fetch it to return the current data
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
        return {
          r2_datasetUrl: datasetRef,
          r2_input_taskRef: r2Ref,
          datasetId: datasetId, // Linked dataset ID for tracking
          
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
        };
      });

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

      let insertedCount = 0;
      let failedCount = 0;
      let duplicateCount = taskEntries.length - deduplicatedEntries.length;
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
          // Use unordered inserts: { ordered: false } allows valid tasks to be inserted
          // even if some fail validation. This ensures partial success instead of total failure.
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
      let invoice;      if (isLastBatch) {
        // Count total tasks for this dataset (including duplicates already in DB)
        totalTasksInDataset = await Task.countDocuments({
          $or: [{ datasetId }, { r2_datasetUrl: datasetRef }]
        });

        const invoiceTaskType = normalizeTaskTypeForInvoice(taskEntries[0]?.taskType);
        try {
          invoice = await invoiceService.generateInvoice(invoiceTaskType, totalTasksInDataset);          await Dataset.findByIdAndUpdate(
            datasetId,
            { 
              status: "awaiting_payment",
              price: invoice.totalCost,
              rows: totalTasksInDataset,
              "metadata.numRecords": totalTasksInDataset
            }
          );          await Invoice.create({
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

      // Only include invoice if it was generated (last batch)
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

      const filters = {};      if (status && typeof status === 'string') {
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
      }      const existingUniqueKeys = new Set();
      existingTasks.forEach(task => {
        if (task.taskId) existingUniqueKeys.add(task.taskId);
        if (task.r2_input_taskRef) existingUniqueKeys.add(task.r2_input_taskRef);
      });      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid task ID format: ${id}`);
      }

      logger.debug('Fetching task by ID', { taskId: id });

      const task = await Task.findById(id).lean();
      
      if (!task) {
        logger.warn('Task not found', { taskId: id });
        throw new Error(`Task with ID ${id} not found`);
      }
      const taskR2Url=task.r2_input_taskRef;
      const taskBuffer = await r2ContentFetcher.fetchTaskContent(taskR2Url);      let taskObject;
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

      const previousAssignee = task.assignedTo;

      task.status = "pending";
      task.isAssigned = false;
      task.assignedTo = null;
      task.assignedAt = null;
      task.startedAt = null;
      task.completedAt = null;

      await task.save();      if (previousAssignee) {
        await Labeller.findOneAndUpdate(
          { userId: previousAssignee },
          {
            $pull: { currentAssignedTasks: id }
          }
        );

        logger.info('Removed task from labeller profile', {
          taskId: id,
          userId: previousAssignee
        });
      }

      logger.info('Task returned to pool successfully', {
        taskId: id,
        previousAssignee: previousAssignee || 'unassigned',
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
    try {
      if (!taskId || !userId) throw new Error("taskId and userId are required");
      
      const task = await Task.findById(taskId);
      if (!task) throw new Error("Task not found");
      
      const user = await UserVera.findById(userId).select('role');
      if (!user) throw new Error("User not found");
      if (user.role !== "labeler") throw new Error("User is not a labeler");
      if (task.isAssigned) throw new Error("Task already assigned");

      // Update Task document
      task.isAssigned = true;
      task.assignedTo = userId;
      task.assignedAt = new Date();
      task.status = "in_progress";
      await task.save();      const labeller = await Labeller.findOneAndUpdate(
        { userId },
        {
          $addToSet: { currentAssignedTasks: task._id },
          $inc: { 'performance.totalTasksAssigned': 1 }
        },
        { new: true }
      ).select('currentAssignedTasks performance');

      if (!labeller) throw new Error("Labeller profile not found for user");

      logger.info('Task assigned successfully', {
        taskId,
        userId,
        totalAssigned: labeller.performance.totalTasksAssigned,
        currentTasks: labeller.currentAssignedTasks.length
      });

      return { 
        message: "Task assigned successfully", 
        task,
        labeller: {
          currentTasksCount: labeller.currentAssignedTasks.length,
          totalAssigned: labeller.performance.totalTasksAssigned
        }
      };
    } catch (error) {
      logger.error('Error assigning task', {
        error: error.message,
        taskId,
        userId
      });
      throw error;
    }
  },
  submitTask: async (taskId, userId) => {
    if (!taskId) throw new Error("Task id is required");
    if (!userId) throw new Error("User id is required");

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
      await task.save();      await taskService.returnTaskToPool(taskId);      if (labellerId) {
        await Labeller.findOneAndUpdate(
          { userId: labellerId },
          {
            $inc: { 'performance.totalTasksRejected': 1 }
          }
        );

        logger.info('Updated labeller rejection metrics', {
          taskId,
          userId: labellerId
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
  deleteTaskBatch: async () => {

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
