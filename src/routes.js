import express from "express";
import authorize from "./middlewares/authorization.middleware.js";
import { paymentRouter } from "./modules/payments/routes/payment.route.js";
import { authRouter } from "./modules/auth/auth.route.js";
import { userRouter } from "./modules/users/user.route.js";
import { checkisBlocked } from "./middlewares/block.middleware.js";
import { protectRoute } from "./middlewares/auth.middleware.js";
import adminRouter from "./modules/admin/admin.route.js";
import marketplaceRouter from "./modules/marketplace/marketplace.route.js";
import datasetRouter from "./modules/datasets/dataset.route.js";
import logger from "./config/logger.js";
const router=express.Router();
logger.info("Request started in route.js");
router.use("/marketplace",protectRoute,checkisBlocked,authorize("admin","buyer"),marketplaceRouter)
router.use("/datasets",protectRoute,checkisBlocked,authorize("admin","buyer","Labeler"),datasetRouter);
router.use("/auth",authRouter);
router.use("/payments",protectRoute,checkisBlocked,authorize("admin","buyer","Labeler"),paymentRouter)
router.use("/users",userRouter);
router.use("/admin",protectRoute,checkisBlocked,adminRouter);
export default router;