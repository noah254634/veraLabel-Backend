import express from "express";
import { marketplaceController } from "./marketplace.controller.js";
import { Upload } from "../datasets/datasets.multer.js";
import { protectRoute } from "../../middlewares/auth.middleware.js";
const router=express.Router();
router.post("/send-dataset-request",protectRoute,Upload().single("uploadedFile"),marketplaceController.createDatasetRequest)
router.get("/",marketplaceController.alldatasets);
router.post("/createOrder",marketplaceController.createOrder);
export default router;