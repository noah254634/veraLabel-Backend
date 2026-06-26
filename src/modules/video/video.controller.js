import logger from "../../config/logger.js";
import { videoService } from "./video.service.js";
import { asyncHandler, AppError } from "../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../helpers/responseHandler.js";

export const videoController = {

  /**
   * POST /api/v1/video/trigger
   * Admin triggers SAM2 propagation for a dataset once seeds are approved.
   */
  triggerPropagation: asyncHandler(async (req, res) => {
    const { datasetId } = req.body;
    if (!datasetId) throw new AppError("datasetId is required", 400);

    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const serverUrl = `${protocol}://${host}`;

    const result = await videoService.triggerPropagation({
      datasetId,
      triggeredBy: req.user._id,
      serverUrl,
    });

    logger.info(`[VideoController] Propagation triggered for dataset ${datasetId} by user ${req.user._id}`);
    return ResponseHandler.success(res, result, "Video propagation job queued successfully.");
  }),

  /**
   * POST /api/v1/video/callback
   * Internal — called by vera_segment when a propagation job completes.
   * Authenticated via X-API-Key header (same pattern as /tasks/progress).
   */
  handleCallback: async (req, res) => {
    const apiKey = req.headers["x-api-key"];
    const expectedKey = process.env.FASTAPI_ML_API_KEY;

    if (!apiKey || apiKey !== expectedKey) {
      logger.warn("[VideoController] Unauthorized callback attempt", { ip: req.ip });
      return res.status(403).json({ success: false, message: "Forbidden: Invalid API Key" });
    }

    try {
      const { job_id, status, frames_propagated, frame_keys, error } = req.body;

      if (!job_id) {
        return res.status(400).json({ success: false, message: "job_id is required" });
      }

      logger.info(`[VideoController] Callback received for job ${job_id}: status=${status}`);

      await videoService.handlePropagationCallback({
        job_id,
        status,
        frames_propagated,
        frame_keys,
        error,
      });

      return res.status(200).json({ success: true, message: "Callback processed" });
    } catch (err) {
      logger.error(`[VideoController] Callback processing failed: ${err.message}`);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /api/v1/video/status/:jobId
   * Poll the current state of a video propagation job.
   */
  getJobStatus: asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    if (!jobId) throw new AppError("jobId is required", 400);

    const status = await videoService.getJobStatus(jobId);
    if (!status) throw new AppError("Video job not found", 404);

    return ResponseHandler.success(res, status, "Video job status fetched");
  }),

  /**
   * GET /api/v1/video/jobs/:datasetId
   * List all video propagation jobs for a dataset (admin view).
   */
  listJobs: asyncHandler(async (req, res) => {
    const { datasetId } = req.params;
    if (!datasetId) throw new AppError("datasetId is required", 400);

    const jobs = await videoService.listJobsByDataset(datasetId);
    return ResponseHandler.success(res, { jobs }, "Video jobs fetched");
  }),
};
