import logger from "../../config/logger.js";
import { ENV } from "../../config/env.js";
import { taskService } from "./task.service.js";
export const taskController = {
  getBatches:async(req,res)=>{
    try {
      const batches = await taskService.getBatches();
      return res.status(200).json(batches);
    } catch (err) {
      logger.error(`an error occurred while getting batches:${err.message}`);
      return res.status(500).json({ message: err.message });
    }
  },
  createTasks: async (req, res) => {
    try {
      logger.info({
        method: req.method,
        url: req.url,
        taskCount: Array.isArray(req.body?.tasks) ? req.body.tasks.length : 0,
      }, "Task creation request received");
      const url = req.headers["handshake-url"];
      const { datasetId, projectId, tasks, isLastBatch } = req.body;
      const finalBatch = isLastBatch === true;

      if (!projectId) return res.status(400).json({ message: "project id is required" });
      if (!datasetId) return res.status(400).json({ message: "datasetId is required" });
      if (!Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({
          message: "task files are required",
          receivedTasksType: Array.isArray(tasks) ? "array" : typeof tasks,
          receivedTasksLength: Array.isArray(tasks) ? tasks.length : undefined,
        });
      }
      if (isLastBatch !== undefined && typeof isLastBatch !== "boolean") {
        return res.status(400).json({ message: "isLastBatch must be boolean" });
      }

      const configuredHandshakeUrl = ENV().handshake_url;
      if (configuredHandshakeUrl && url !== configuredHandshakeUrl) {
        return res.status(401).json({ message: "Invalid url" });
      }

      const response = await taskService.createTask({ datasetId, projectId, tasks, isLastBatch: finalBatch });
      logger.info(`Tasks created successfully for project ${projectId}, dataset ${datasetId}. Count: ${response.count}`);
      logger.info(`Task creation response: ${JSON.stringify(response)}`);
      
      // Return 201 even if some items failed - we still successfully registered some tasks
      // The failedItems count indicates how many items in this batch failed (malformed, etc.)
      const statusCode = response.failedItems > 0 ? 202 : 201;  // 202 = Accepted (partial success)
      return res.status(statusCode).json(response);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : 'No stack';
      logger.error({
        error: errorMsg,
        stack: errorStack,
        requestBody: req.body,
        projectId: req.body?.projectId,
        datasetId: req.body?.datasetId,
        taskCount: Array.isArray(req.body?.tasks) ? req.body.tasks.length : 0,
        taskSample: Array.isArray(req.body?.tasks) ? req.body.tasks.slice(0, 2) : null,
      }, 'Task creation failed');
      return res.status(500).json({ 
        message: errorMsg,
        type: err?.constructor?.name || 'Unknown'
      });
    }
  },
  getTasks: async (req, res) => {
    try {
      const parsedPage = Number.parseInt(req.query.page, 10);
      const parsedLimit = Number.parseInt(req.query.limit, 10);

      const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 10;

      const response = await taskService.getTasks({
        page,
        limit,
        status: req.query.status,
        split: req.query.split,
        taskType: req.query.taskType,
      });

      return res.status(200).json(response);
    } catch (err) {
      logger.error(err.message);
      return res.status(500).json({ message: err.message });
    }
  },
  getTaskById: async (req, res) => {
    try {
      logger.info("Gettiing task by id");
      const id = req.params.id;
      if (!id) throw new Error("Task id is required");
      const response = await taskService.getTaskById(id);
      return res.status(200).json(response);
    } catch (err) {
      logger.error(`an error occurred while getting task by id:${err.message}`);
      return res.status(500).json({ message: err.message });
    }
  },
  assignTask: async (req, res) => {
    try {
      const taskId = req.params.id;
      const labellerId = req.body.labellerId || req.body.labellerUserId || req.body.userId;

      if (!taskId) throw new Error("Task id is required");
      if (!labellerId) throw new Error("Labeller id is required");

      if (!req.user) throw new Error("Authentication required");

      const response = await taskService.assignTask(taskId, labellerId);
      return res.status(200).json(response);
    } catch (err) {
      logger.error(`an error occurred while assigning task: ${err.message}`);
      return res.status(500).json({ message: err.message });
    }
  },
  returnTaskToPool: async (req, res) => {
    try {
      const id = req.params.id;
      if (!id) throw new Error("Task id is required");
      const response = await taskService.returnTaskToPool(id);
      return res.status(200).json(response);
    } catch (err) {
      logger.error(`an error occurred while returning task to pool:${err.message}`);
      return res.status(500).json({ message: err.message });
    }
  },
  submitTask: async (req, res) => {
    try {
      const taskId = req.params.id;
      const { batchId } = req.body;
      
      if (!taskId) throw new Error("Task id is required");
      if (!batchId) throw new Error("Batch id is required for verification");
      
      const labellerId = req.labeller?._id;
      if (!labellerId) throw new Error("Labeller profile is required");
      if (req.user.role !== "labeler")
        throw new Error("Only labelers can submit tasks");
        
      const response = await taskService.submitTask(taskId, labellerId, batchId);
      return res.status(200).json(response);
    } catch (err) {
      logger.error(`an error occurred while updating task status: ${err.message}`);
      return res.status(500).json({ message: err.message });
    }
  },
  verifyTask: async (req, res) => {
    try {
      const taskId = req.params.id;
      if (!taskId) throw new Error("Task id is required");
      const userId = req.user._id;
      if (req.user.role !== "admin" && req.user.role !== "reviewer")
        throw new Error("Only admins and reviewers can verify tasks");
      if (!userId) throw new Error("User id is required");
      const response = await taskService.verifyTask(taskId, userId);
      return res.status(200).json(response);
    } catch (err) {
      logger.error(`an error occurred while verifying task: ${err.message}`);
      return res.status(500).json({ message: err.message });
    }
  },
  rejectTask: async (req, res) => {
    try {
      logger.info("Rejecting task");
      const taskId = req.params.id;
      const { reason } = req.body;
      if (!taskId) throw new Error("Task id is required");
      if (!reason) throw new Error("Reason is required");
      const response = await taskService.rejectTask(taskId, reason);
      return res.status(200).json(response);
    } catch (err) {
      logger.error(`an error occurred while rejecting task: ${err.message}`);
      return res.status(500).json({ message: err.message });
    }
  },
  deleteTask: async (req, res) => {
    try {
      logger.info("Deleting task");
      const id = req.params.id;
      if (!id) throw new Error("Task id is required");
      const response = await taskService.deleteTask(id);
      return res.status(200).json(response);
    } catch (err) {
      logger.error(`an error occurred while deleting task: ${err.message}`);
      return res.status(500).json({ message: err.message });
    }
  },
  reviewTask: async (req, res) => {
    try {
      const taskId = req.params.id;
      const { score } = req.body;
      const userId = req.user?._id;

      if (!taskId) throw new Error("Task id is required");
      if (score === undefined) throw new Error("Score is required");
      
      const response = await taskService.reviewTask(taskId, userId, score);
      return res.status(200).json({ message: "Task reviewed successfully", data: response });
    } catch (err) {
      logger.error(`an error occurred in review task: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },
  revokeTask: async (req, res) => {
    try {
      const { taskId } = req.body;
      if (!taskId) throw new Error("Task id is required");

      const response = await taskService.revokeTask(taskId);
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },
  autoAssignTask: async () => {},
  claimBatch: async (req, res) => {
    try {
      const { datasetId } = req.body;
      const labellerId = req.labeller?._id;

      if (!datasetId) throw new Error("datasetId is required");
      if (!labellerId) throw new Error("Labeller profile is required");
      
      const batch = await taskService.claimBatch(datasetId, labellerId);
      return res.status(200).json(batch);
    } catch (err) {
      logger.error(`Error claiming batch: ${err.message}`);
      return res.status(500).json({ message: err.message });
    }
  },
  getMyActiveBatch: async (req, res) => {
    try {
      const labellerId = req.labeller?._id;
      if (!labellerId) throw new Error("Labeller profile is required");
      const batch = await taskService.getMyActiveBatch(labellerId);
      return res.status(200).json(batch);
    } catch (err) {
      return res.status(200).json(null); // Return null if no active batch
    }
  }
};
