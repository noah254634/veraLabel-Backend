import express from "express";
import { marketplaceController } from "./marketplace.controller.js";
import { Upload } from "../datasets/datasets.multer.js";
import { protectRoute } from "../../middlewares/auth.middleware.js";
const router=express.Router();
router.get("/orders",protectRoute,marketplaceController.getOrders)
router.post("/send-dataset-request",protectRoute,Upload().single("uploadedFile"),marketplaceController.createDatasetRequest)
router.get("/datasetOrders",protectRoute,marketplaceController.getBuyerRequests)
router.get("/",marketplaceController.alldatasets);
router.post("/createOrder",protectRoute,marketplaceController.createOrder);
export default router;