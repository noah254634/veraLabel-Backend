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
import { adminService } from "./modules/admin/admin.service.js";
import marketplaceRouter from "./modules/marketplace/marketplace.route.js";
import datasetRouter from "./modules/datasets/dataset.route.js";
import logger from "./config/logger.js";
import onboardinRouter from "./modules/onboarding/onboarding.route.js";
const router=express.Router();
logger.info("Request started in route.js");

// TEMPORARY: Dev-only admin setup endpoint (remove in production)
router.put("/admin/promote-by-email/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const user = await adminService.promoteUserByEmail(email);
    res.json({ success: true, user, message: `User ${email} promoted to admin` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.use("/marketplace",protectRoute,checkisBlocked,authorize("admin","buyer"),marketplaceRouter)
router.use("/datasets",datasetRouter);
router.use("/auth",authRouter);
router.use("/payments",paymentRouter)
router.use("/users",userRouter);
router.use("/admin",protectRoute,checkisBlocked,adminRouter);
router.use("/analytics",protectRoute,checkisBlocked,analyticsRouter);
router.use("/onboarding",protectRoute,checkisBlocked,onboardinRouter);
router.use('/tasks',taskRouter)
export default router;
