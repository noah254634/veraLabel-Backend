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
};
export default analyticsController;
