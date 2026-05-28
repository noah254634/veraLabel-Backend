import { recommendationService } from './recommendation.service.js';
import ResponseHandler from '../../helpers/responseHandler.js';

export const recommendationController = {
  getForUser: async (req, res) => {
    const { userId } = req.params;
    const { labellerId, limit = 10 } = req.query;
    try {
      const recs = await recommendationService.getRecommendationsForUser({ userId, labellerId, limit: Number(limit) });
      return ResponseHandler.success(res, recs, 'Recommendations fetched');
    } catch (err) {
      return ResponseHandler.error(res, 'Failed to fetch recommendations', 500, err?.message);
    }
  },

  getSimilar: async (req, res) => {
    const { datasetId } = req.params;
    const { limit = 10 } = req.query;
    try {
      const recs = await recommendationService.getSimilarByFeatures(datasetId, Number(limit));
      return ResponseHandler.success(res, recs, 'Similar datasets fetched');
    } catch (err) {
      return ResponseHandler.error(res, 'Failed to fetch similar datasets', 500, err?.message);
    }
  }
};

export default recommendationController;
