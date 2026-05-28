import express from "express";
import { marketplaceController } from "./marketplace.controller.js";

const router = express.Router();

router.get("/", marketplaceController.alldatasets);

export default router;