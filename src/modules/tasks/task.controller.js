import logger from "../../config/logger.js";
import { ENV } from "../../config/env.js";
import { taskService } from "./task.service.js";
import { asyncHandler, AppError } from "../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../helpers/responseHandler.js";

export const taskController = {
  getTaskSubmissions: asyncHandler(async (req, res) => {
    const response = await taskService.getTaskSubmissions();
    return ResponseHandler.success(res, response, "Task submissions fetched");
  }),
  getBatches: asyncHandler(async (req, res) => {
    const batches = await taskService.getBatches();
    return ResponseHandler.success(res, { batches }, "Batches fetched");
  }),

  createTasks: asyncHandler(async (req, res) => {
    const url = req.headers["handshake-url"];
    const authHeader = req.headers.authorization;
    const { datasetId, projectId, tasks, isLastBatch } = req.body;
    const finalBatch = isLastBatch === true;

    if (!projectId) throw new AppError("project id is required", 400);
    if (!datasetId) throw new AppError("datasetId is required", 400);
    if (!Array.isArray(tasks) || tasks.length === 0)
      throw new AppError("task files are required", 400);
    if (isLastBatch !== undefined && typeof isLastBatch !== "boolean")
      throw new AppError("isLastBatch must be boolean", 400);

    const configuredHandshakeUrl =
      ENV().handshake_url ||
      process.env.BACKEND_HANDSHAKE_URL ||
      process.env.BACKEND_HANDSHAKE;
    const expectedToken =
      process.env.TOKEN_VALUE ||
      process.env.INTERNAL_SECRET ||
      process.env.BACKEND_TOKEN;
    const handshakeMatches = !configuredHandshakeUrl || url === configuredHandshakeUrl;
    const tokenMatches = !!expectedToken && authHeader === `Bearer ${expectedToken}`;

    if (!handshakeMatches && !tokenMatches)
      throw new AppError("Invalid url", 401);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const serverUrl = `${protocol}://${host}`;

    const response = await taskService.createTask({ datasetId, projectId, tasks, isLastBatch: finalBatch, serverUrl });
    logger.info(`Tasks created for project ${projectId}, dataset ${datasetId}. Count: ${response.count}`);

    const statusCode = response.failedItems > 0 ? 202 : 201;
    return res.status(statusCode).json(response);
  }),

  getTasks: asyncHandler(async (req, res) => {
    const parsedPage = Number.parseInt(req.query.page, 10);
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 10;

    const response = await taskService.getTasks({
      page, limit,
      status: req.query.status,
      split: req.query.split,
      taskType: req.query.taskType,
    });
    return ResponseHandler.success(res, response, "Tasks fetched");
  }),

  getTaskById: asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) throw new AppError("Task id is required", 400);
    const response = await taskService.getTaskById(id, req.user);
    return ResponseHandler.success(res, response, "Task fetched");
  }),

  assignTask: asyncHandler(async (req, res) => {
    const taskId = req.params.id;
    const labellerId = req.body.labellerId || req.body.labellerUserId || req.body.userId;
    if (!taskId) throw new AppError("Task id is required", 400);
    if (!labellerId) throw new AppError("Labeller id is required", 400);
    if (!req.user) throw new AppError("Authentication required", 401);

    const response = await taskService.assignTask(taskId, labellerId);
    return ResponseHandler.success(res, response, "Task assigned");
  }),

  returnTaskToPool: asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) throw new AppError("Task id is required", 400);
    const response = await taskService.returnTaskToPool(id);
    return ResponseHandler.success(res, response, "Task returned to pool");
  }),

  submitTask: asyncHandler(async (req, res) => {
    const taskId = req.params.id;
    const { batchId, isFlagged, flagReason, flagDetail } = req.body;
    if (!taskId) throw new AppError("Task id is required", 400);
    if (!batchId) throw new AppError("Batch id is required", 400);

    const labellerId = req.labeller?._id;
    if (!labellerId) throw new AppError("Labeller profile is required", 403);
    if (req.user.role !== "labeler") throw new AppError("Only labelers can submit tasks", 403);

    if (isFlagged) {
      if (!flagReason) throw new AppError("Flag reason is required", 400);
      const response = await taskService.flagTask(taskId, labellerId, req.user?._id, flagReason, flagDetail, batchId);
      return ResponseHandler.success(res, response, "Task flagged for admin review");
    }

    const response = await taskService.submitTask(taskId, labellerId, batchId);
    return ResponseHandler.success(res, response, "Task submitted");
  }),

  generateSubmissionUrl: asyncHandler(async (req, res) => {
    const taskId = req.params.id;
    if (!taskId) throw new AppError("Task id is required", 400);

    const labellerId = req.labeller?._id;
    if (!labellerId) throw new AppError("Labeller profile is required", 403);
    if (req.user.role !== "labeler") throw new AppError("Only labelers can submit tasks", 403);

    const response = await taskService.generateSubmissionUrl(taskId, labellerId);
    return ResponseHandler.success(res, response, "Submission URL generated");
  }),

  verifyTask: asyncHandler(async (req, res) => {
    const taskId = req.params.id;
    if (!taskId) throw new AppError("Task id is required", 400);
    if (req.user.role !== "admin" && req.user.role !== "reviewer")
      throw new AppError("Only admins and reviewers can verify tasks", 403);

    const response = await taskService.verifyTask(taskId, req.user._id);
    return ResponseHandler.success(res, response, "Task verified");
  }),

  rejectTask: asyncHandler(async (req, res) => {
    const taskId = req.params.id;
    const { reason } = req.body;
    if (!taskId) throw new AppError("Task id is required", 400);
    if (!reason) throw new AppError("Reason is required", 400);
    const response = await taskService.rejectTask(taskId, reason);
    return ResponseHandler.success(res, response, "Task rejected");
  }),

  deleteTask: asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) throw new AppError("Task id is required", 400);
    const response = await taskService.deleteTask(id);
    return ResponseHandler.success(res, response, "Task deleted");
  }),

  reviewTask: asyncHandler(async (req, res) => {
    const taskId = req.params.id;
    const { score } = req.body;
    if (!taskId) throw new AppError("Task id is required", 400);
    if (score === undefined) throw new AppError("Score is required", 400);
    const response = await taskService.reviewTask(taskId, req.user?._id, score);
    return ResponseHandler.success(res, response, "Task reviewed successfully");
  }),

  revokeTask: asyncHandler(async (req, res) => {
    const { taskId } = req.body;
    if (!taskId) throw new AppError("Task id is required", 400);
    const response = await taskService.revokeTask(taskId);
    return ResponseHandler.success(res, response, "Task revoked");
  }),

  revokeDatasetBatches: asyncHandler(async (req, res) => {
    const { datasetId } = req.body;
    if (!datasetId) throw new AppError("datasetId is required", 400);
    const result = await taskService.revokeDatasetBatches(datasetId);
    return ResponseHandler.success(
      res,
      result,
      `${result.revoked} batch(es) revoked and renewed — ${result.tasksReset} task(s) returned to pool`
    );
  }),

  revokeExpiredBatchesGlobal: asyncHandler(async (req, res) => {
    const result = await taskService.revokeExpiredBatches();
    return ResponseHandler.success(
      res,
      result,
      `Global sweep complete: ${result.revoked} expired batch(es) revoked, ${result.tasksReset ?? 0} task(s) reset`
    );
  }),

  flagTask: asyncHandler(async (req, res) => {
    const taskId = req.params.id;
    const { reason, detail } = req.body;
    if (!taskId) throw new AppError("Task id is required", 400);
    if (!reason) throw new AppError("Flag reason is required", 400);

    const labellerId = req.labeller?._id;
    if (!labellerId) throw new AppError("Labeller profile is required", 403);

    const response = await taskService.flagTask(taskId, labellerId, req.user?._id, reason, detail);
    return ResponseHandler.success(res, response, "Task flagged for admin review");
  }),

  autoAssignTask: async () => { },


  claimBatch: asyncHandler(async (req, res) => {
    const { datasetId } = req.body;
    const labellerId = req.labeller?._id;
    if (!datasetId) throw new AppError("datasetId is required", 400);
    if (!labellerId) throw new AppError("Labeller profile is required", 403);
    const batch = await taskService.claimBatch(datasetId, labellerId);
    return ResponseHandler.success(res, batch, "Batch claimed");
  }),

  claimCategoryBatch: asyncHandler(async (req, res) => {
    const { category } = req.body;
    const labellerId = req.labeller?._id;
    if (!category) throw new AppError("category is required", 400);
    if (!labellerId) throw new AppError("Labeller profile is required", 403);
    const batch = await taskService.claimCategoryBatch(category, labellerId);
    return ResponseHandler.success(res, batch, "Rolling batch claimed successfully");
  }),

  getMyActiveBatch: asyncHandler(async (req, res) => {
    const labellerId = req.labeller?._id;
    if (!labellerId) throw new AppError("Labeller profile is required", 403);
    const batch = await taskService.getMyActiveBatch(labellerId);
    return ResponseHandler.success(res, batch ?? null, "Active batch fetched");
  }),

  generateMissingEmbeddings: asyncHandler(async (req, res) => {
    const { datasetId } = req.body;
    if (!datasetId) throw new AppError("datasetId is required", 400);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const serverUrl = `${protocol}://${host}`;

    const response = await taskService.generateMissingEmbeddings(datasetId, serverUrl);
    return ResponseHandler.success(res, response, "Missing embeddings generation triggered");
  }),
};
