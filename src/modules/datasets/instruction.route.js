import express from "express";
import { instructionController } from "./instruction.controller.js";
import { protectRoute } from "../../middlewares/auth.middleware.js";
import authorize from "../../middlewares/authorization.middleware.js";

const router = express.Router();

// Public/Buyer endpoints to view active templates
router.get("/", instructionController.getTemplates);
router.get("/dataset/:datasetId", instructionController.getByDataset);

// Admin endpoints for managing templates
router.post("/", protectRoute, authorize("admin"), instructionController.createTemplate);
router.put("/:id", protectRoute, authorize("admin"), instructionController.updateTemplate);
router.delete("/:id", protectRoute, authorize("admin"), instructionController.deleteTemplate);

export default router;
