import Dataset from '../../modules/datasets/dataset.model.js';
import Submission from '../../modules/tasks/task.submission.model.js';
import Task from '../../modules/tasks/task.model.js';
import UserVera from '../../modules/users/user.model.js';

/**
 * Lightweight, rule-based recommendation service.
 * - Purely deterministic (no AI/ML models)
 * - Modular and readable for local configuration
 * - Not wired into app; caller should mount routes/controllers as desired
 */

const DEFAULT_LIMIT = 10;

const getPopularDatasets = async (limit = DEFAULT_LIMIT) => {
  // Sort by a blend of purchaseCount, downloads and rating
  return Dataset.find({ isPublished: true })
    .sort({ purchaseCount: -1, downloadsCount: -1, rating: -1, createdAt: -1 })
    .limit(limit)
    .lean();
};

const getRecentDatasets = async (limit = DEFAULT_LIMIT) => {
  return Dataset.find({ isPublished: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

const getUserSubmittedDatasets = async ({ labellerId, userId, limit = DEFAULT_LIMIT }) => {
  // Prefer labellerId (internal), fallback to userId (UserVera)
  const match = {};
  if (labellerId) match.submittedBy = labellerId;

  if (!labellerId && userId) {
    const labeller = await Task.db.model('Labeller').findOne({ userId }).select('_id').lean();
    if (labeller) match.submittedBy = labeller._id;
  }

  if (Object.keys(match).length === 0) return [];

  const agg = await Submission.aggregate([
    { $match: match },
    { $group: { _id: '$datasetId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $lookup: { from: 'datasets', localField: '_id', foreignField: '_id', as: 'dataset' } },
    { $unwind: { path: '$dataset', preserveNullAndEmptyArrays: false } },
    { $replaceRoot: { newRoot: '$dataset' } }
  ]).exec();

  return agg;
};

const mixRecommendations = (primary = [], secondary = [], limit = DEFAULT_LIMIT) => {
  const result = [];
  const seen = new Set();

  const pushUnique = (arr) => {
    for (const item of arr) {
      const id = String(item._id || item.id);
      if (!seen.has(id)) {
        seen.add(id);
        result.push(item);
        if (result.length >= limit) return;
      }
    }
  };

  pushUnique(primary);
  if (result.length < limit) pushUnique(secondary);

  return result.slice(0, limit);
};

export const recommendationService = {
  getRecommendationsForUser: async ({ userId = null, labellerId = null, limit = DEFAULT_LIMIT } = {}) => {
    try {
      // 1) try personalized signals (user submissions)
      const personalized = await getUserSubmittedDatasets({ labellerId, userId, limit });

      // 2) fallback signals
      const popular = await getPopularDatasets(limit);
      const recent = await getRecentDatasets(limit);

      // 3) merge: personalized first, then popular, then recent
      const merged = mixRecommendations(personalized, popular.concat(recent), limit);

      return merged;
    } catch (err) {
      // On failure, return a safe fallback (popular)
      try { return await getPopularDatasets(limit); } catch (_) { return []; }
    }
  },

  // Utility for ad-hoc dataset recommendations by dataset features
  getSimilarByFeatures: async (datasetId, limit = DEFAULT_LIMIT) => {
    const d = await Dataset.findById(datasetId).lean();
    if (!d) return [];
    const features = Array.isArray(d.metadata?.features) ? d.metadata.features : [];
    if (features.length === 0) return getPopularDatasets(limit);

    // Simple similarity: datasets that share at least one feature, ordered by rating
    return Dataset.find({
      _id: { $ne: d._id },
      'metadata.features': { $in: features },
      isPublished: true
    }).sort({ rating: -1, purchaseCount: -1 }).limit(limit).lean();
  }
};

export default recommendationService;
