import express from "express";
import analyticsController from "./analytics.controller.js";

const router = express.Router();

const notImplemented = (req, res) => {
  return res.status(501).json({ error: "Not implemented" });
};

router.get("/platformOverview", analyticsController.overview);          // total, active, growth
router.get("/users/registrations", notImplemented);   // per day/week/month
router.get("/users/activity", notImplemented);        // DAU / MAU
router.get("/users/retention", notImplemented);       // cohort analysis
router.get("/datasets/summary", notImplemented);
router.get("/datasets/submissions", notImplemented);
router.get("/datasets/approval-rate", notImplemented);
router.get("/datasets/rejections", notImplemented);

router.get("/annotations/summary", notImplemented);
router.get("/annotations/time-spent", notImplemented);      // detect AI spam
router.get("/annotations/quality-score", notImplemented);
router.get("/revenue/summary", notImplemented);
router.get("/revenue/daily", notImplemented);
router.get("/revenue/monthly", notImplemented);
router.get("/revenue/by-product", notImplemented);

router.get("/subscriptions/summary", notImplemented);
router.get("/subscriptions/churn", notImplemented);
router.get("/system/health", notImplemented);
router.get("/system/errors", notImplemented);
router.get("/system/latency", notImplemented);
router.get("/system/uptime", notImplemented);
router.get("/security/login-attempts", notImplemented);
router.get("/security/failed-logins", notImplemented);
router.get("/security/suspicious-activity", notImplemented);
router.get("/security/token-refresh-rate", notImplemented);
router.get("/funnels/signup", notImplemented);
router.get("/funnels/purchase", notImplemented);
router.get("/funnels/dataset-creation", notImplemented);
export default router;

