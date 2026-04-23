import express from "express";
import authorize from "./middlewares/authorization.middleware.js";
import { paymentRouter } from "./modules/payments/routes/payment.route.js";
import { authRouter } from "./modules/auth/auth.route.js";
import { userRouter } from "./modules/users/user.route.js";
import { checkisBlocked } from "./middlewares/block.middleware.js";
import { checkIsSuspended } from "./middlewares/suspended.middleware.js";
import { protectRoute } from "./middlewares/auth.middleware.js";
import analyticsRouter from "./modules/analytics/analytics.route.js";
import taskRouter from "./modules/tasks/task.route.js"
import adminRouter from "./modules/admin/admin.route.js";
import reviewerRouter from "./modules/reviewer/reviewer.route.js";
import { adminService } from "./modules/admin/admin.service.js";
import marketplaceRouter from "./modules/marketplace/marketplace.route.js";
import datasetRouter from "./modules/datasets/dataset.route.js";
import logger from "./config/logger.js";
import onboardinRouter from "./modules/onboarding/onboarding.route.js";
import { asyncHandler, AppError } from "./middlewares/errorHandler.middleware.js";
import { geoMiddleware } from "./middlewares/geo.middleware.js";
import reviewRouter from "./modules/reviewer/reviewer.route.js";
import { createRateLimiter } from "./middlewares/rateLimit.middleware.js";

const router=express.Router();


// TEMPORARY: Dev-only admin setup endpoint (remove in production)
router.put("/admin/promote-by-email/:email", asyncHandler(async (req, res) => {
  const { email } = req.params;
  if (!email) throw new AppError("Email is required", 400);
  
  const user = await adminService.promoteUserByEmail(email);
  if (!user) throw new AppError("User not found", 404);
  
  res.json({ success: true, user, message: `User ${email} promoted to admin` });
}));
//router.use(geoMiddleware); // Apply geolocation middleware globally
//router.use(createRateLimiter); // Apply rate limiting globally (can be overridden in specific routes)
router.use("/marketplace",protectRoute,checkisBlocked,authorize("admin","buyer"),marketplaceRouter)
router.use("/review",protectRoute,checkisBlocked,reviewRouter)
router.use("/datasets",datasetRouter);
router.use("/auth",authRouter);
router.use("/payments",paymentRouter)
router.use("/users",userRouter);
router.use("/admin",protectRoute,checkisBlocked,adminRouter );
router.use("/reviewer",protectRoute,checkisBlocked,reviewerRouter);
router.use("/analytics",protectRoute,checkisBlocked,analyticsRouter);
router.use("/onboarding",protectRoute,checkisBlocked,onboardinRouter);
router.use('/tasks',taskRouter)
export default router;
