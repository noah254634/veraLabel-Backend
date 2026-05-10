import express from 'express';
import { labellerAnalyticsController } from './labeller.analytics.controller.js';
import  authorize  from '../../middlewares/authorization.middleware.js';

const router = express.Router();

// All analytics endpoints require auth and admin/reviewer role
router.use(authorize('admin', 'superadmin', 'reviewer'));

// Overview & Dashboard
router.get('/overview', labellerAnalyticsController.getOverview);

// Performance Analytics
router.get('/performance', labellerAnalyticsController.getPerformanceAnalytics);

// Tier Analytics
router.get('/tiers', labellerAnalyticsController.getTierAnalytics);

// Earnings Analytics
router.get('/earnings', labellerAnalyticsController.getEarningsAnalytics);

// Activity Analytics
router.get('/activity', labellerAnalyticsController.getActivityAnalytics);

// Task Completion Analytics
router.get('/task-completion', labellerAnalyticsController.getTaskCompletionAnalytics);

// Rating Analytics
router.get('/ratings', labellerAnalyticsController.getRatingAnalytics);

export default router;
