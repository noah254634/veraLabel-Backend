import analyticsService from "./analytics.service.js";
const analyticsController = {
  overview: async (req, res) => {
    try {
      const overviewStats = await analyticsService.overview();
      return res.json(overviewStats);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
  revenueAnalytics: async (req, res) => {
    try {
      const revenueStats = await analyticsService.getRevenueAnalytics();
      return res.json(revenueStats);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
  datasetAnalytics: async (req, res) => {
    try {
      const datasetStats = await analyticsService.getDatasetAnalytics();
      return res.json(datasetStats);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};
export default analyticsController;
