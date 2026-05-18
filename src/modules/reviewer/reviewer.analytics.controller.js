import { reviewerAnalyticsService } from './reviewer.analytics.service.js';
import logger from '../../config/logger.js';
import { asyncHandler } from '../../middlewares/errorHandler.middleware.js';
import ResponseHandler from '../../helpers/responseHandler.js';
import { getUserIdFromRequest } from '../../helpers/userExtraction.js';
import { validateRequiredParams } from '../../helpers/validationHelpers.js';

export const reviewerAnalyticsController = {
  // 1. OVERVIEW - Dashboard snapshot
  getOverview: asyncHandler(async (req, res) => {
    const reviewerId = getUserIdFromRequest(req);
    const data = await reviewerAnalyticsService.getOverview(reviewerId);
    return ResponseHandler.success(res, data, 'Overview fetched');
  }),

  // 2. LABELLER PERFORMANCE
  getLabellerPerformance: asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, sortBy = 'avgRating' } = req.query;
    const data = await reviewerAnalyticsService.getLabellerPerformance(page, limit, sortBy);
    return ResponseHandler.success(res, data, 'Labeller performance fetched');
  }),

  getLabellerDetail: asyncHandler(async (req, res) => {
    validateRequiredParams(req.params, ['labellerID']);
    const { labellerID } = req.params;
    const data = await reviewerAnalyticsService.getLabellerDetail(labellerID);
    return ResponseHandler.success(res, data, 'Labeller detail fetched');
  }),

  getTopPerformers: asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;
    const data = await reviewerAnalyticsService.getTopPerformers(limit);
    return ResponseHandler.success(res, data, 'Top performers fetched');
  }),

  getUnderperformers: asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;
    const data = await reviewerAnalyticsService.getUnderperformers(limit);
    return ResponseHandler.success(res, data, 'Underperformers fetched');
  }),

  // 3. QUALITY METRICS
  getQualityScoreDistribution: asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const data = await reviewerAnalyticsService.getQualityScoreDistribution(days);
    return ResponseHandler.success(res, data, 'Quality score distribution fetched');
  }),

  getRejectionReasonAnalysis: asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const data = await reviewerAnalyticsService.getRejectionReasonAnalysis(days);
    return ResponseHandler.success(res, data, 'Rejection reasons fetched');
  }),

  getQualityTrend: asyncHandler(async (req, res) => {
    const { days = 60 } = req.query;
    const data = await reviewerAnalyticsService.getQualityTrend(days);
    return ResponseHandler.success(res, data, 'Quality trend fetched');
  }),

  getQualityByTaskType: asyncHandler(async (req, res) => {
    const data = await reviewerAnalyticsService.getQualityByTaskType();
    return ResponseHandler.success(res, data, 'Quality by task type fetched');
  }),

  // 4. WORKLOAD ANALYTICS
  getStatusDistribution: asyncHandler(async (req, res) => {
    const data = await reviewerAnalyticsService.getStatusDistribution();
    return ResponseHandler.success(res, data, 'Status distribution fetched');
  }),

  getWorkloadByDataset: asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const data = await reviewerAnalyticsService.getWorkloadByDataset(page, limit);
    return ResponseHandler.success(res, data, 'Workload by dataset fetched');
  }),

  getWorkloadByTaskType: asyncHandler(async (req, res) => {
    const data = await reviewerAnalyticsService.getWorkloadByTaskType();
    return ResponseHandler.success(res, data, 'Workload by task type fetched');
  }),

  getTurnaroundTimeAnalysis: asyncHandler(async (req, res) => {
    const data = await reviewerAnalyticsService.getTurnaroundTimeAnalysis();
    return ResponseHandler.success(res, data, 'Turnaround time analysis fetched');
  }),

  // 5. TEMPORAL ANALYTICS
  getDailyProductivity: asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const reviewerId = getUserIdFromRequest(req);
    const data = await reviewerAnalyticsService.getDailyProductivity(reviewerId, days);
    return ResponseHandler.success(res, data, 'Daily productivity fetched');
  }),

  getWeeklyProductivity: asyncHandler(async (req, res) => {
    const { weeks = 12 } = req.query;
    const reviewerId = getUserIdFromRequest(req);
    const data = await reviewerAnalyticsService.getWeeklyProductivity(reviewerId, weeks);
    return ResponseHandler.success(res, data, 'Weekly productivity fetched');
  }),

  getMonthlyProductivity: asyncHandler(async (req, res) => {
    const { months = 12 } = req.query;
    const reviewerId = getUserIdFromRequest(req);
    const data = await reviewerAnalyticsService.getMonthlyProductivity(reviewerId, months);
    return ResponseHandler.success(res, data, 'Monthly productivity fetched');
  }),

  getPeakReviewTimes: asyncHandler(async (req, res) => {
    const reviewerId = getUserIdFromRequest(req);
    const data = await reviewerAnalyticsService.getPeakReviewTimes(reviewerId);
    return ResponseHandler.success(res, data, 'Peak review times fetched');
  }),

  // 6. COMPARISON ANALYTICS
  getReviewerComparison: asyncHandler(async (req, res) => {
    const reviewerId = getUserIdFromRequest(req);
    const data = await reviewerAnalyticsService.getReviewerComparison(reviewerId);
    return ResponseHandler.success(res, data, 'Reviewer comparison fetched');
  }),

  getLabellerConsistency: asyncHandler(async (req, res) => {
    const data = await reviewerAnalyticsService.getLabellerConsistency();
    return ResponseHandler.success(res, data, 'Labeller consistency fetched');
  }),

  // 7. DATASET INSIGHTS
  getDatasetQualityScore: asyncHandler(async (req, res) => {
    const data = await reviewerAnalyticsService.getDatasetQualityScore();
    return ResponseHandler.success(res, data, 'Dataset quality score fetched');
  }),

  getDatasetBreakdown: asyncHandler(async (req, res) => {
    validateRequiredParams(req.params, ['datasetId']);
    const { datasetId } = req.params;
    const data = await reviewerAnalyticsService.getDatasetBreakdown(datasetId);
    return ResponseHandler.success(res, data, 'Dataset breakdown fetched');
  })
};
