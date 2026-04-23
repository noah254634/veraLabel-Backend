import express from "express";
import { marketplaceController } from "./marketplace.controller.js";
import { protectRoute } from "../../middlewares/auth.middleware.js";
const router=express.Router();
router.get("/orders",protectRoute,marketplaceController.getOrders)
router.get("/datasetOrders",protectRoute,marketplaceController.getBuyerRequests)
router.get("/",marketplaceController.alldatasets);
router.post("/createOrder",protectRoute,marketplaceController.createOrder);
router.put("/cancelPayment/:orderId",protectRoute,marketplaceController.cancelPayment);
router.post("/reportIssue/:orderId",protectRoute,marketplaceController.reportIssue);
export default router;