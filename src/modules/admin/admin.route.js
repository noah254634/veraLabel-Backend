import express from "express";
import analyticsController from "../analytics/analytics.controller.js";
import authorize from "../../middlewares/authorization.middleware.js";
import { adminController } from "./admin.controller.js";
const router=express.Router();
router.use(authorize("admin"))
router.get("/users",()=>{});                     // list users (filters, pagination)
router.get("/users/:id",()=>{}); 
                // inspect a user
router.get("/analytics/overview",analyticsController.overview)
router.put("/users/:id/suspend",adminController.suspendUser);         // temporary ban
router.put("/users/:id/ban",adminController.banUser);             // permanent ban
router.put("/users/:id/block",adminController.blockUser);        // block/unblock pair
//router.delete("/users/:id",adminController.deleteUser);              // hard delete (rare)
router.put("/users/:id/promote",adminController.promoteUser);          // user → admin / moderator
router.put("/users/:id/demote",adminController.demoteUser);           // admin → user
//router.put("/users/:id/assign-role",adminController.assignRole);      // generic RBAC
router.get("/datasets/pending",adminController.pendingDatasets);
router.put("/users/:id/unblock",adminController.unblockUser);
router.put("/users/:id/block",adminController.blockUser);
router.put("/users/:id/unsuspend",adminController.unsuspendUser);
router.get("/datasets/approved",adminController.approvedDatasets);
router.get("/datasets/rejected",adminController.rejectedDatasets);
router.get("/datasets/flagged",adminController.flaggedDatasets);           
router.put("/datasets/:id/approve",adminController.approveDataset);
router.put("/datasets/:id/reject",adminController.rejectDataset);
router.put("/datasets/:id/flag",adminController.flagDataset);
router.put("/datasets/:id/unflag",adminController.unflagDataset);
router.delete("/datasets/:id",adminController.deleteDataset);
router.put("/setDatasetprice/:id",adminController.updateDatasetPrice)
router.post("/datasets/unpublish/:id",adminController.unpublishDataset)
router.post("/datasets/publish/:id",adminController.publishDataset)
router.put("/users/:id/rate",adminController.rateUser);
router.put("/users/:id/unverify",adminController.unverifyUser);
router.put("/users/:id/verify",adminController.verifyUser);

/*

router.get("/payments");
router.get("/payments/:id");

router.put("/payments/:id/refund");
router.put("/payments/:id/flag");
router.put("/payments/:id/resolve");
router.get("/subscriptions");

router.put("/subscriptions/:id/pause");
router.put("/subscriptions/:id/resume");
router.put("/subscriptions/:id/cancel");
router.get("/sessions");
router.delete("/sessions/:id");            
router.delete("/sessions/user/:id");      
router.get("/stats/overview");
router.get("/stats/users");
router.get("/stats/revenue");
router.get("/stats/datasets");

router.get("/system/errors");
router.get("/system/health");
router.get("/me");
router.put("/me/password");
router.put("/me/2fa-enable");
router.put("/me/2fa-disable");*/
export default router;
