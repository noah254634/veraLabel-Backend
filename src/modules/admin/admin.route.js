import express from "express";
import analyticsController from "../analytics/analytics.controller.js";
import authorize from "../../middlewares/authorization.middleware.js";
import { adminController } from "./admin.controller.js";
import { taskGenerationController } from "../tasks/task.generation.controller.js";
import settingsRouter from "./routes/settings.route.js";
const router=express.Router();


router.use(authorize("admin"))
 

router.get("/analytics/overview",analyticsController.overview)
router.put("/users/:id/suspend",adminController.suspendUser);
router.put("/users/:id/ban",adminController.banUser);
router.put("/users/:id/block",adminController.blockUser);

router.put("/users/:id/promote",adminController.promoteUser);
router.put("/users/:id/promote-to-reviewer",adminController.promoteToReviewer);
router.put("/users/:id/demote",adminController.demoteUser);

router.get("/datasets/pending",adminController.pendingDatasets);
router.put("/users/:id/unblock",adminController.unblockUser);
router.put("/users/:id/unsuspend",adminController.unsuspendUser);
router.get("/datasets/approved",adminController.approvedDatasets);
router.get("/datasets/rejected",adminController.rejectedDatasets);
router.get("/datasets/flagged",adminController.flaggedDatasets);           
router.put("/datasets/:id/approve",adminController.approveDataset);
router.put("/datasets/:id/reject",adminController.rejectDataset);
router.put("/datasets/:id/status", adminController.updateDatasetStatus);
router.put("/datasets/:id/flag",adminController.flagDataset);
router.put("/datasets/:id/unflag",adminController.unflagDataset);
router.delete("/datasets/:id",adminController.deleteDataset);
router.delete("/users/delete/:id",adminController.deleteUser);
router.put("/setDatasetprice/:id",adminController.updateDatasetPrice)
router.put("/datasets/:id/batch-price", adminController.updateDatasetBatchPrice);
router.put("/datasets/:id/priority", adminController.updateDatasetPriority);
router.put("/datasets/:id/max-labellers", adminController.updateDatasetMaxLabellers);
router.post("/datasets/unpublish/:id",adminController.unpublishDataset)
router.post("/datasets/publish/:id",adminController.publishDataset)
router.post("/datasets/:id/compile", adminController.compileDataset);
router.post("/datasets/:id/evaluate-consensus", adminController.evaluateDatasetConsensus);
router.put("/users/:id/rate",adminController.rateUser);
router.put("/users/:id/unverify",adminController.unverifyUser);
router.put("/users/:id/verify",adminController.verifyUser);

// Buyer Verification & Management Routes
router.get("/buyers", adminController.getBuyers);
router.put("/buyers/:id/approve", adminController.approveBuyer);
router.put("/buyers/:id/reject", adminController.rejectBuyer);

// Geo Access Tracking & Analytics
router.get("/geo-access-logs", adminController.getGeoAccessLogs);
router.get("/geo-request-audits", adminController.getGeoRequestAudits);
router.get("/geo-analytics", adminController.getGeoAnalytics);

// ML Engine Integration
router.get("/ml/sam2/telemetry", adminController.getSAM2Telemetry);
router.post("/ml/sam2/settings", adminController.updateSAM2Settings);

// Agentic Task Generation & Management
router.post("/tasks/generate", taskGenerationController.generateTasks);
router.get("/tasks/runs", taskGenerationController.getRuns);
router.get("/tasks/runs/:runId/tasks", taskGenerationController.getTasksForRun);
router.put("/tasks/tasks/:taskId", taskGenerationController.updateTaskText);
router.post("/tasks/runs/:runId/approve", taskGenerationController.approveRunAndBatch);
router.delete("/tasks/runs/:runId", taskGenerationController.deleteRun);

router.use("/settings", settingsRouter);

export default router;
