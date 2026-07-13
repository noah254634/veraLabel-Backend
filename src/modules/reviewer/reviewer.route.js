import express from 'express';
import { reviewerController } from './reviewer.controller.js';
import { reviewerAnalyticsController } from './reviewer.analytics.controller.js';
import authorize from '../../middlewares/authorization.middleware.js';

const router = express.Router();

// Protect all routes - only reviewers/admins
router.use(authorize('reviewer', 'admin'));

router.put('/rate/:taskId', reviewerController.rateTask);
router.put('/feedback/:taskId', reviewerController.submitFeedback);
router.get('/pending', reviewerController.getPendingReviewTasks);
router.get('/completed', reviewerController.getCompletedReviews);
router.get('/stats', reviewerController.getReviewerStats);
router.post('/request-payout', reviewerController.requestPayout);
router.get('/task/:taskId', reviewerController.getTaskForReview);
router.put('/approve/:taskId', reviewerController.approveSubmission);
router.put('/reject/:taskId', reviewerController.rejectSubmission);

router.post('/claim-batch/:batchId', reviewerController.claimBatch);
router.post('/release-batch/:batchId', reviewerController.releaseBatchReviewLock);
router.post('/submit-batch/:batchId', reviewerController.submitBatchAudit);

router.get('/analytics/overview', reviewerAnalyticsController.getOverview);

// 2. LABELLER PERFORMANCE (who needs improvement)
router.get('/analytics/labellers', reviewerAnalyticsController.getLabellerPerformance);
router.get('/analytics/labellers/:labellerID/detail', reviewerAnalyticsController.getLabellerDetail);
router.get('/analytics/labellers/top', reviewerAnalyticsController.getTopPerformers);
router.get('/analytics/labellers/bottom', reviewerAnalyticsController.getUnderperformers);

// 3. QUALITY METRICS (accuracy, consistency, trends)
router.get('/analytics/quality/distribution', reviewerAnalyticsController.getQualityScoreDistribution);
router.get('/analytics/quality/rejection-reasons', reviewerAnalyticsController.getRejectionReasonAnalysis);
router.get('/analytics/quality/trend', reviewerAnalyticsController.getQualityTrend);
router.get('/analytics/quality/by-tasktype', reviewerAnalyticsController.getQualityByTaskType);

// 4. WORKLOAD ANALYTICS (task distribution, bottlenecks)
router.get('/analytics/workload/status', reviewerAnalyticsController.getStatusDistribution);
router.get('/analytics/workload/dataset', reviewerAnalyticsController.getWorkloadByDataset);
router.get('/analytics/workload/tasktype', reviewerAnalyticsController.getWorkloadByTaskType);
router.get('/analytics/workload/turnaround', reviewerAnalyticsController.getTurnaroundTimeAnalysis);

// 5. TEMPORAL ANALYTICS (productivity, patterns)
router.get('/analytics/temporal/daily', reviewerAnalyticsController.getDailyProductivity);
router.get('/analytics/temporal/weekly', reviewerAnalyticsController.getWeeklyProductivity);
router.get('/analytics/temporal/monthly', reviewerAnalyticsController.getMonthlyProductivity);
router.get('/analytics/temporal/peak-hours', reviewerAnalyticsController.getPeakReviewTimes);

// 6. COMPARISON ANALYTICS (peer comparison, benchmarks)
router.get('/analytics/comparison/reviewers', reviewerAnalyticsController.getReviewerComparison);
router.get('/analytics/comparison/labeller-consistency', reviewerAnalyticsController.getLabellerConsistency);

// 7. DATASET INSIGHTS
router.get('/analytics/datasets/quality', reviewerAnalyticsController.getDatasetQualityScore);
router.get('/analytics/datasets/:datasetId', reviewerAnalyticsController.getDatasetBreakdown);

export default router;
