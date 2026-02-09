import express from "express";
const router=express.Router();
router.get("/platformOverview",analyticsController.overview);          // total, active, growth
router.get("/users/registrations");   // per day/week/month
router.get("/users/activity");        // DAU / MAU
router.get("/users/retention");       // cohort analysis
router.get("/datasets/summary");
router.get("/datasets/submissions");
router.get("/datasets/approval-rate");
router.get("/datasets/rejections");

router.get("/annotations/summary");
router.get("/annotations/time-spent");      // detect AI spam
router.get("/annotations/quality-score");
router.get("/revenue/summary");
router.get("/revenue/daily");
router.get("/revenue/monthly");
router.get("/revenue/by-product");

router.get("/subscriptions/summary");
router.get("/subscriptions/churn");
router.get("/system/health");
router.get("/system/errors");
router.get("/system/latency");
router.get("/system/uptime");
router.get("/security/login-attempts");
router.get("/security/failed-logins");
router.get("/security/suspicious-activity");
router.get("/security/token-refresh-rate");
router.get("/funnels/signup");
router.get("/funnels/purchase");
router.get("/funnels/dataset-creation");

