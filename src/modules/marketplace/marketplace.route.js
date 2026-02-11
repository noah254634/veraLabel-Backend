import express from "express";
import { marketplaceController } from "./marketplace.controller.js";
const router=express.Router();
router.get("/",marketplaceController.alldatasets);
router.post("/createOrder",marketplaceController.createOrder);
export default router;