import { labellerAnalyticsService } from './labeller.analytics.service.js';

export const labellerAnalyticsController = {
  getOverview: async (req, res) => {
    try {
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
  }
catch(err){
  return res.status(500).json({error:err.message});
}
},

  getPerformanceAnalytics: async (req, res) => {
    try{
    const metrics = await labellerAnalyticsService.getAveragePerformanceMetrics();
    const distribution = await labellerAnalyticsService.getPerformanceDistribution();

    return res.status(200).json({
      averageMetrics: metrics,
      distribution
    });
  }catch(err){
    return res.status(500).json({error:err.message});
  }
  },


  getTierAnalytics: async (req, res) => {
    try{

    const byTier = await labellerAnalyticsService.getLabellersByTierWithStats();
    const promotionTrend = await labellerAnalyticsService.getTierPromotionTrend();

    return res.status(200).json({
      byTier,
      promotionTrend
    });
  }
  catch(err){
    return res.status(500).json({error:err.message});
  }
  } ,

  getEarningsAnalytics: async (req, res) => {
    try{
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
  }catch(err){
    return res.status(500).json({error:err.message});
  }
  },


  getActivityAnalytics: async (req, res) => {
    try{
    const activityMetrics = await labellerAnalyticsService.getActivityMetrics();
    return res.status(200).json(activityMetrics);
  }catch(err){
    return res.status(500).json({error:err.message});
  }
  },

  getTaskCompletionAnalytics: async (req, res) => {
    try{
      const stats = await labellerAnalyticsService.getTaskCompletionStats();
      return res.status(200).json(stats);
    }catch(err){
      return res.status(500).json({error:err.message});
    }
  },

  getRatingAnalytics: async (req, res) => {
    try{
      const [avgRating, distribution] = await Promise.all([
        labellerAnalyticsService.getAverageRating(),
        labellerAnalyticsService.getRatingDistribution()
      ]);

    return res.status(200).json({
      averageRating: avgRating,
      distribution
    });
  }catch(err){
    return res.status(500).json({error:err.message}); 
  }
}
};
