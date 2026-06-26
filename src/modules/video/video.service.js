import { v4 as uuidv4 } from "uuid";
import VideoJob from "./video.model.js";
import Task from "../tasks/task.model.js";
import Submission from "../tasks/task.submission.model.js";
import logger from "../../config/logger.js";
import { ENV } from "../../config/env.js";

const VERA_SEGMENT_URL = process.env.VERA_SEGMENT_URL || "http://localhost:8080";
const FASTAPI_ML_API_KEY = process.env.FASTAPI_ML_API_KEY || "local-dev-key";

export const videoService = {

  /**
   * Trigger a SAM2 video propagation job for a dataset.
   * Collects all approved seed-frame submissions, calls vera_segment,
   * and creates a VideoJob record to track the propagation.
   */
  triggerPropagation: async ({ datasetId, triggeredBy, serverUrl }) => {
    // Find all video tasks for this dataset that are seed frames with approved submissions
    const seedTasks = await Task.find({
      datasetId,
      contentType: "video",
      isSeedFrame: true,
      status: "verified",
    }).lean();

    if (seedTasks.length === 0) {
      throw new Error("No approved seed frames found for this dataset. Ensure labellers have submitted and reviewers have verified at least one seed frame.");
    }

    // Find all video frame tasks (seed + non-seed) to build the full frame list
    const allFrameTasks = await Task.find({
      datasetId,
      contentType: "video",
    })
      .sort({ videoFrameIndex: 1 })
      .lean();

    if (allFrameTasks.length === 0) {
      throw new Error("No video frame tasks found for this dataset.");
    }

    // Pull the approved submission for each seed frame to get the R2 mask key
    const seedSubmissions = await Submission.find({
      taskId: { $in: seedTasks.map((t) => t._id) },
      status: "approved",
    }).lean();

    const seedMaskByTaskId = {};
    for (const sub of seedSubmissions) {
      seedMaskByTaskId[sub.taskId.toString()] = sub.r2_output_key;
    }

    const seeds = seedTasks
      .filter((t) => seedMaskByTaskId[t._id.toString()])
      .map((t) => ({
        frame_idx: t.videoFrameIndex,
        mask_npz_url: seedMaskByTaskId[t._id.toString()],
      }));

    if (seeds.length === 0) {
      throw new Error("Seed frames found but no approved submissions with mask keys. Check that reviewers approved the mask files.");
    }

    const frames = allFrameTasks.map((t) => ({
      frame_idx: t.videoFrameIndex,
      url: t.r2_presignedUrl || t.r2_input_taskRef,
    }));

    const jobId = `vjob_${uuidv4()}`;
    const callbackUrl = `${serverUrl}/api/v1/video/callback`;
    const uploadPrefix = `${process.env.R2_PUBLIC_URL || ""}/video-masks/${datasetId}`;

    const job = await VideoJob.create({
      jobId,
      datasetId,
      status: "propagating",
      totalFrames: allFrameTasks.length,
      seedFrameIndices: seeds.map((s) => s.frame_idx),
      triggeredBy,
      startedAt: new Date(),
    });

    logger.info(`[VideoService] Triggering propagation job ${jobId} for dataset ${datasetId} — ${frames.length} frames, ${seeds.length} seeds`);

    // Call vera_segment — fire and forget (result comes back via callback)
    const payload = {
      job_id: jobId,
      frames,
      seeds,
      upload_prefix: uploadPrefix,
      callback_url: callbackUrl,
    };

    const response = await fetch(`${VERA_SEGMENT_URL}/api/v1/propagate-video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": FASTAPI_ML_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      await VideoJob.findOneAndUpdate({ jobId }, { status: "failed", errorMessage: errText });
      throw new Error(`vera_segment returned ${response.status}: ${errText}`);
    }

    return {
      jobId,
      status: "propagating",
      totalFrames: allFrameTasks.length,
      seedCount: seeds.length,
    };
  },

  /**
   * Called by vera_segment via POST /api/v1/video/callback when a job completes.
   * Updates the VideoJob, creates auto-Submission records for propagated frames,
   * and marks those tasks as verified.
   */
  handlePropagationCallback: async ({ job_id, status, frames_propagated, frame_keys, error }) => {
    const job = await VideoJob.findOne({ jobId: job_id });
    if (!job) {
      logger.warn(`[VideoService] Callback received for unknown job: ${job_id}`);
      return;
    }

    if (status === "failed") {
      await VideoJob.findOneAndUpdate(
        { jobId: job_id },
        { status: "failed", errorMessage: error, completedAt: new Date() }
      );
      logger.error(`[VideoService] Job ${job_id} failed: ${error}`);
      return;
    }

    // Build list of propagated frame keys
    const propagatedKeys = frame_keys
      ? Object.entries(frame_keys).map(([frameIdx, key]) => key)
      : [];

    await VideoJob.findOneAndUpdate(
      { jobId: job_id },
      {
        status: "completed",
        completedAt: new Date(),
        framesCompleted: frames_propagated || 0,
        propagatedFrameKeys: propagatedKeys,
      }
    );

    // Mark non-seed video tasks for this dataset as auto-verified
    if (frame_keys && job.datasetId) {
      const propagatedFrameIndices = Object.keys(frame_keys).map(Number);

      await Task.updateMany(
        {
          datasetId: job.datasetId,
          contentType: "video",
          isSeedFrame: { $ne: true },
          videoFrameIndex: { $in: propagatedFrameIndices },
        },
        {
          status: "verified",
          isVerified: true,
          completedAt: new Date(),
        }
      );

      logger.info(`[VideoService] Job ${job_id} completed — auto-verified ${propagatedFrameIndices.length} frames`);
    }
  },

  /**
   * Get the current status of a video propagation job.
   */
  getJobStatus: async (jobId) => {
    const job = await VideoJob.findOne({ jobId })
      .populate("triggeredBy", "email")
      .lean();

    if (!job) return null;

    return {
      jobId: job.jobId,
      status: job.status,
      totalFrames: job.totalFrames,
      framesCompleted: job.framesCompleted,
      seedFrameIndices: job.seedFrameIndices,
      seedCount: job.seedFrameIndices?.length || 0,
      progressPercent: job.totalFrames > 0
        ? Math.round((job.framesCompleted / job.totalFrames) * 100)
        : 0,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      errorMessage: job.errorMessage,
      triggeredBy: job.triggeredBy,
    };
  },

  /**
   * List all video jobs for a given dataset.
   */
  listJobsByDataset: async (datasetId) => {
    return VideoJob.find({ datasetId })
      .sort({ createdAt: -1 })
      .populate("triggeredBy", "email")
      .lean();
  },
};
