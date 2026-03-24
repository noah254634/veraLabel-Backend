import logger from "../../config/logger.js";
import { ENV } from "../../config/env.js";
import { taskService } from "./task.service.js";
export const taskController = {
  //      datasetId, projectId, tasks: taskBuffer, isLastBatch: isLast,

  createTasks: async (req, res) => {
    try {
      logger.info(`${req.method} ${JSON.stringify(req.body)} ${req.url}`);
      const url = req.headers["handshake-url"];
      const { datasetId, projectId, tasks, isLastBatch } = req.body;

      if (!projectId) return res.status(400).json({ message: "project id is required" });
      if (!datasetId) return res.status(400).json({ message: "datasetId is required" });
      if (!Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({
          message: "task files are required",
          receivedTasksType: Array.isArray(tasks) ? "array" : typeof tasks,
          receivedTasksLength: Array.isArray(tasks) ? tasks.length : undefined,
        });
      }
      if (typeof isLastBatch !== "boolean") {
        return res.status(400).json({ message: "isLastBatch must be boolean" });
      }

      const configuredHandshakeUrl = ENV().handshake_url;
      if (configuredHandshakeUrl && url !== configuredHandshakeUrl) {
        return res.status(401).json({ message: "Invalid url" });
      }

      const response = await taskService.createTask({ datasetId, projectId, tasks });
      logger.info(`Tasks created successfully for project ${projectId}, dataset ${datasetId}. Count: ${response.count}`);

      return res.status(201).json(response);
    } catch (err) {
      logger.error(err.message);
      return res.status(500).json({ message: err.message });
    }
  },
  getTasks: async (req, res) => {
    try {
      const response = await taskService.getTasks();
      return res.status(200).json({ tasks: response });
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
  assignTask:async(req,res)=>{},
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
      if (!taskId) throw new Error("Task id is required");
      const userId = req.user._id;
      if (req.user.role !== "labeler")
        throw new Error("Only labelers can submit tasks");
      if (!userId) throw new Error("User id is required");
      const response = await taskService.submitTask(taskId, userId);
      return res.status(200).json(response);
    } catch (err) {}
  },
  verifyTask: async (taskId) => {
    try {
      if (!taskId) throw new Error("Task id is required");
      const userId = req.user._id;
      if (req.user.role !== "admin" && req.user.role !== "reviewer")
        throw new Error("Only admins and reviewers can verify tasks");
      if (!userId) throw new Error("User id is required");
      const response = await taskService.verifyTask(taskId, userId);
      return res.status(200).json(response);
    } catch (err) {}
  },
  rejectTask: async (taskId, reason) => {
    try {
      logger.info("Rejecting task");
      if (!taskId) throw new Error("Task id is required");
      if (!reason) throw new Error("Reason is required");
      const response = await taskService.rejectTask(taskId, reason);
      return res.status(200).json(response);
    } catch (err) {
      logger.error(`an error occurred while rejecting task:${err.message}`);
      return res.status(500).json({ message: err.message });
    }
  },
  deleteTask: async () => {
    try {
        logger.info("Deleting task");
        const id=req.params.id
        if(!id) throw new Error("Task id is required")
        const response=await taskService.deleteTask(id)
        return res.status(200).json(response)
    }catch(err){
        logger.error(`an error occurred while deleting task:${err.message}`)
        return res.status(500).json({message:err.message})
    }
  },
  reviewTask: async (taskId, score) => {
    try {
        if(!taskId) throw new Error("Task id is required");
        if(!score) throw new Error("Score is required");
        const response=await taskService.reviewTask(taskId,score)
        return res.status(200).json({message:`task reviewed successully:${response}`})
      
    } catch (err) {
        logger.error('an error occurred in review task')
      return res.status(500).json({ error: err.message });
    }
  },
  revokeTask: async (taskId) => {
    try {
      if (!taskId) throw new Error("Task id is required");

      const response = await taskService.revokeTask(taskId);
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },
  autoAssignTask: async () => {},
};
