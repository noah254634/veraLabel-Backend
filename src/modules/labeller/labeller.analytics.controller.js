import { labellerAnalyticsService } from './labeller.analytics.service.js';
import { asyncHandler } from '../../middlewares/errorHandler.middleware.js';
import ResponseHandler from '../../helpers/responseHandler.js';

export const labellerAnalyticsController = {
  getOverview: asyncHandler(async (req, res) => {
    const [
      labellerCount,
      activeLabellerCount,
      statusDistribution,
      performanceMetrics,
      earningsData,
      activityMetrics
    ] = await Promise.all([
      labellerAnalyticsService.getTotalLabellersCount(),
      labellerAnalyticsService.getActiveLabellerCount(),
      labellerAnalyticsService.getLabellersByStatus(),
      labellerAnalyticsService.getAveragePerformanceMetrics(),
      labellerAnalyticsService.getTotalEarningsPaid(),
      labellerAnalyticsService.getActivityMetrics()
    ]);

    return ResponseHandler.success(res, {
      totalLabellers: labellerCount,
      activeLabellers: activeLabellerCount,
      statusDistribution,
      performanceMetrics,
      earningsData,
      activityMetrics
    }, 'Overview retrieved successfully');
  }),

  getPerformanceAnalytics: asyncHandler(async (req, res) => {
    const [metrics, distribution] = await Promise.all([
      labellerAnalyticsService.getAveragePerformanceMetrics(),
      labellerAnalyticsService.getPerformanceDistribution()
    ]);

    return ResponseHandler.success(res, {
      averageMetrics: metrics,
      distribution
    }, 'Performance analytics retrieved');
  }),

  getTierAnalytics: asyncHandler(async (req, res) => {
    const [byTier, promotionTrend] = await Promise.all([
      labellerAnalyticsService.getLabellersByTierWithStats(),
      labellerAnalyticsService.getTierPromotionTrend()
    ]);

    return ResponseHandler.success(res, {
      byTier,
      promotionTrend
    }, 'Tier analytics retrieved');
  }),

  getEarningsAnalytics: asyncHandler(async (req, res) => {
    const [totals, distribution, topEarners] = await Promise.all([
      labellerAnalyticsService.getTotalEarningsPaid(),
      labellerAnalyticsService.getEarningsDistribution(),
      labellerAnalyticsService.getTopEarners()
    ]);

    return ResponseHandler.success(res, {
      totals,
      distribution,
      topEarners
    }, 'Earnings analytics retrieved');
  }),

  getActivityAnalytics: asyncHandler(async (req, res) => {
    const activityMetrics = await labellerAnalyticsService.getActivityMetrics();
    return ResponseHandler.success(res, activityMetrics, 'Activity analytics retrieved');
  }),

  getTaskCompletionAnalytics: asyncHandler(async (req, res) => {
    const stats = await labellerAnalyticsService.getTaskCompletionStats();
    return ResponseHandler.success(res, stats, 'Task completion analytics retrieved');
  }),

  getRatingAnalytics: asyncHandler(async (req, res) => {
    const [avgRating, distribution] = await Promise.all([
      labellerAnalyticsService.getAverageRating(),
      labellerAnalyticsService.getRatingDistribution()
    ]);

    return ResponseHandler.success(res, {
      averageRating: avgRating,
      distribution
    }, 'Rating analytics retrieved');
  })
};
