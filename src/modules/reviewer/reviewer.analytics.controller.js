import { reviewerAnalyticsService } from './reviewer.analytics.service.js';
import logger from '../../config/logger.js';

export const reviewerAnalyticsController = {
  // 1. OVERVIEW - Dashboard snapshot
  getOverview: async (req, res) => {
    try {
      const reviewerId = req.user._id;
      const data = await reviewerAnalyticsService.getOverview(reviewerId);
      return res.status(200).json({ message: 'Overview fetched', data });
    } catch (err) {
      logger.error(`Error fetching overview: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  // 2. LABELLER PERFORMANCE
  getLabellerPerformance: async (req, res) => {
    try {
      const { page = 1, limit = 20, sortBy = 'avgRating' } = req.query;
      const data = await reviewerAnalyticsService.getLabellerPerformance(page, limit, sortBy);
      return res.status(200).json({ message: 'Labeller performance fetched', data });
    } catch (err) {
      logger.error(`Error fetching labeller performance: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  getLabellerDetail: async (req, res) => {
    try {
      const { labellerID } = req.params;
      const data = await reviewerAnalyticsService.getLabellerDetail(labellerID);
      return res.status(200).json({ message: 'Labeller detail fetched', data });
    } catch (err) {
      logger.error(`Error fetching labeller detail: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  getTopPerformers: async (req, res) => {
    try {
      const { limit = 10 } = req.query;
      const data = await reviewerAnalyticsService.getTopPerformers(limit);
      return res.status(200).json({ message: 'Top performers fetched', data });
    } catch (err) {
      logger.error(`Error fetching top performers: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  getUnderperformers: async (req, res) => {
    try {
      const { limit = 10 } = req.query;
      const data = await reviewerAnalyticsService.getUnderperformers(limit);
      return res.status(200).json({ message: 'Underperformers fetched', data });
    } catch (err) {
      logger.error(`Error fetching underperformers: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  // 3. QUALITY METRICS
  getQualityScoreDistribution: async (req, res) => {
    try {
      const { days = 30 } = req.query;
      const data = await reviewerAnalyticsService.getQualityScoreDistribution(days);
      return res.status(200).json({ message: 'Quality score distribution fetched', data });
    } catch (err) {
      logger.error(`Error fetching quality distribution: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  getRejectionReasonAnalysis: async (req, res) => {
    try {
      const { days = 30 } = req.query;
      const data = await reviewerAnalyticsService.getRejectionReasonAnalysis(days);
      return res.status(200).json({ message: 'Rejection reasons fetched', data });
    } catch (err) {
      logger.error(`Error fetching rejection reasons: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  getQualityTrend: async (req, res) => {
    try {
      const { days = 60 } = req.query;
      const data = await reviewerAnalyticsService.getQualityTrend(days);
      return res.status(200).json({ message: 'Quality trend fetched', data });
    } catch (err) {
      logger.error(`Error fetching quality trend: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  getQualityByTaskType: async (req, res) => {
    try {
      const data = await reviewerAnalyticsService.getQualityByTaskType();
      return res.status(200).json({ message: 'Quality by task type fetched', data });
    } catch (err) {
      logger.error(`Error fetching quality by task type: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  // 4. WORKLOAD ANALYTICS
  getStatusDistribution: async (req, res) => {
    try {
      const data = await reviewerAnalyticsService.getStatusDistribution();
      return res.status(200).json({ message: 'Status distribution fetched', data });
    } catch (err) {
      logger.error(`Error fetching status distribution: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  getWorkloadByDataset: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const data = await reviewerAnalyticsService.getWorkloadByDataset(page, limit);
      return res.status(200).json({ message: 'Workload by dataset fetched', data });
    } catch (err) {
      logger.error(`Error fetching workload by dataset: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  getWorkloadByTaskType: async (req, res) => {
    try {
      const data = await reviewerAnalyticsService.getWorkloadByTaskType();
      return res.status(200).json({ message: 'Workload by task type fetched', data });
    } catch (err) {
      logger.error(`Error fetching workload by task type: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  getTurnaroundTimeAnalysis: async (req, res) => {
    try {
      const data = await reviewerAnalyticsService.getTurnaroundTimeAnalysis();
      return res.status(200).json({ message: 'Turnaround time analysis fetched', data });
    } catch (err) {
      logger.error(`Error fetching turnaround time: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  // 5. TEMPORAL ANALYTICS
  getDailyProductivity: async (req, res) => {
    try {
      const { days = 30 } = req.query;
      const reviewerId = req.user._id;
      const data = await reviewerAnalyticsService.getDailyProductivity(reviewerId, days);
      return res.status(200).json({ message: 'Daily productivity fetched', data });
    } catch (err) {
      logger.error(`Error fetching daily productivity: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  getWeeklyProductivity: async (req, res) => {
    try {
      const { weeks = 12 } = req.query;
      const reviewerId = req.user._id;
      const data = await reviewerAnalyticsService.getWeeklyProductivity(reviewerId, weeks);
      return res.status(200).json({ message: 'Weekly productivity fetched', data });
    } catch (err) {
      logger.error(`Error fetching weekly productivity: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  getMonthlyProductivity: async (req, res) => {
    try {
      const { months = 12 } = req.query;
      const reviewerId = req.user._id;
      const data = await reviewerAnalyticsService.getMonthlyProductivity(reviewerId, months);
      return res.status(200).json({ message: 'Monthly productivity fetched', data });
    } catch (err) {
      logger.error(`Error fetching monthly productivity: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  getPeakReviewTimes: async (req, res) => {
    try {
      const reviewerId = req.user._id;
      const data = await reviewerAnalyticsService.getPeakReviewTimes(reviewerId);
      return res.status(200).json({ message: 'Peak review times fetched', data });
    } catch (err) {
      logger.error(`Error fetching peak review times: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  // 6. COMPARISON ANALYTICS
  getReviewerComparison: async (req, res) => {
    try {
      const reviewerId = req.user._id;
      const data = await reviewerAnalyticsService.getReviewerComparison(reviewerId);
      return res.status(200).json({ message: 'Reviewer comparison fetched', data });
    } catch (err) {
      logger.error(`Error fetching reviewer comparison: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  getLabellerConsistency: async (req, res) => {
    try {
      const data = await reviewerAnalyticsService.getLabellerConsistency();
      return res.status(200).json({ message: 'Labeller consistency fetched', data });
    } catch (err) {
      logger.error(`Error fetching labeller consistency: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  // 7. DATASET INSIGHTS
  getDatasetQualityScore: async (req, res) => {
    try {
      const data = await reviewerAnalyticsService.getDatasetQualityScore();
      return res.status(200).json({ message: 'Dataset quality score fetched', data });
    } catch (err) {
      logger.error(`Error fetching dataset quality score: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },

  getDatasetBreakdown: async (req, res) => {
    try {
      const { datasetId } = req.params;
      const data = await reviewerAnalyticsService.getDatasetBreakdown(datasetId);
      return res.status(200).json({ message: 'Dataset breakdown fetched', data });
    } catch (err) {
      logger.error(`Error fetching dataset breakdown: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }
};
