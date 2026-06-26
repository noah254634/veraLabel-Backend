import express from "express";
import { videoController } from "./video.controller.js";
import { protectRoute } from "../../middlewares/auth.middleware.js";
import authorize from "../../middlewares/authorization.middleware.js";
import { createRateLimiter } from "../../middlewares/rateLimit.middleware.js";

const router = express.Router();

const videoReadLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 500 });
const videoWriteLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 100 });
const callbackLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 1000 });

// Admin: trigger propagation for a dataset
router.post(
  "/trigger",
  protectRoute,
  authorize("admin", "superadmin"),
  videoWriteLimiter,
  videoController.triggerPropagation
);

// Internal: vera_segment callback (API key auth handled inside controller)
router.post("/callback", callbackLimiter, videoController.handleCallback);

// Admin/Reviewer: poll job status
router.get(
  "/status/:jobId",
  protectRoute,
  authorize("admin", "superadmin", "reviewer"),
  videoReadLimiter,
  videoController.getJobStatus
);

// Admin/Reviewer: list all jobs for a dataset
router.get(
  "/jobs/:datasetId",
  protectRoute,
  authorize("admin", "superadmin", "reviewer"),
  videoReadLimiter,
  videoController.listJobs
);

export default router;
