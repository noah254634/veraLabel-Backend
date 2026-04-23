import { labellerAnalyticsService } from './labeller.analytics.service.js';

export const labellerAnalyticsController = {
  getOverview: async (req, res) => {
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

    return res.status(200).json({
      totalLabellers: labellerCount,
      activeLabellers: activeLabellerCount,
      statusDistribution,
      performanceMetrics,
      earningsData,
      activityMetrics
    });
  },

  getPerformanceAnalytics: async (req, res) => {
    const metrics = await labellerAnalyticsService.getAveragePerformanceMetrics();
    const distribution = await labellerAnalyticsService.getPerformanceDistribution();

    return res.status(200).json({
      averageMetrics: metrics,
      distribution
    });
  },

  getTierAnalytics: async (req, res) => {
    const byTier = await labellerAnalyticsService.getLabellersByTierWithStats();
    const promotionTrend = await labellerAnalyticsService.getTierPromotionTrend();

    return res.status(200).json({
      byTier,
      promotionTrend
    });
  },

  getEarningsAnalytics: async (req, res) => {
    const [totals, distribution, topEarners] = await Promise.all([
      labellerAnalyticsService.getTotalEarningsPaid(),
      labellerAnalyticsService.getEarningsDistribution(),
      labellerAnalyticsService.getTopEarners()
    ]);

    return res.status(200).json({
      totals,
      distribution,
      topEarners
    });
  },

  getActivityAnalytics: async (req, res) => {
    const activityMetrics = await labellerAnalyticsService.getActivityMetrics();
    return res.status(200).json(activityMetrics);
  },

  getTaskCompletionAnalytics: async (req, res) => {
    const stats = await labellerAnalyticsService.getTaskCompletionStats();
    return res.status(200).json(stats);
  },

  getRatingAnalytics: async (req, res) => {
    const [avgRating, distribution] = await Promise.all([
      labellerAnalyticsService.getAverageRating(),
      labellerAnalyticsService.getRatingDistribution()
    ]);

    return res.status(200).json({
      averageRating: avgRating,
      distribution
    });
  }
};
