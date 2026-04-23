import Settings from '../models/settings.model.js';
import logger from '../../../config/logger.js';

// In-memory cache with TTL
const cache = {
  promotionThresholds: null,
  lastUpdated: null,
  cacheTTL: 5 * 60 * 1000 // 5 minutes
};

// Default thresholds (fallback if none exist in DB)
const DEFAULT_PROMOTION_THRESHOLDS = {
  'Trainee': {
    requiredAvgScore: 3.5,
    requiredApprovalRate: 80,
    requiredTasksCompleted: 50,
    nextTier: 'Bronze'
  },
  'Bronze': {
    requiredAvgScore: 4.0,
    requiredApprovalRate: 85,
    requiredTasksCompleted: 150,
    nextTier: 'Silver'
  },
  'Silver': {
    requiredAvgScore: 4.3,
    requiredApprovalRate: 90,
    requiredTasksCompleted: 300,
    nextTier: 'Gold'
  },
  'Gold': {
    requiredAvgScore: 4.5,
    requiredApprovalRate: 95,
    requiredTasksCompleted: 500,
    nextTier: null
  }
};

export const settingsService = {
  getPromotionThresholds: async () => {
    try {
      if (cache.promotionThresholds && cache.lastUpdated) {
        const cacheAge = Date.now() - cache.lastUpdated;
        if (cacheAge < cache.cacheTTL) {
          logger.debug('Returning cached promotion thresholds');
          return cache.promotionThresholds;
        }
      }

      let settings = await Settings.findOne({ key: 'promotionThresholds' }).lean();

      if (!settings) {
        logger.info('Creating default promotion thresholds in DB');
        settings = await Settings.create({
          key: 'promotionThresholds',
          value: DEFAULT_PROMOTION_THRESHOLDS,
          description: 'Promotion tier thresholds for labellers'
        });
      }

      cache.promotionThresholds = settings.value;
      cache.lastUpdated = Date.now();

      logger.info('Promotion thresholds loaded from DB and cached');
      return settings.value;
    } catch (error) {
      logger.error('Error getting promotion thresholds', { error: error.message });
      return DEFAULT_PROMOTION_THRESHOLDS;
    }
  },

  updatePromotionThresholds: async (newThresholds, updatedBy) => {
    try {
      if (!newThresholds || typeof newThresholds !== 'object') {
        throw new Error('Invalid thresholds format');
      }

      const validTiers = ['Trainee', 'Bronze', 'Silver', 'Gold'];
      for (const tier of validTiers) {
        if (!newThresholds[tier]) {
          throw new Error(`Missing threshold configuration for tier: ${tier}`);
        }

        const threshold = newThresholds[tier];
        if (typeof threshold.requiredAvgScore !== 'number' ||
            typeof threshold.requiredApprovalRate !== 'number' ||
            typeof threshold.requiredTasksCompleted !== 'number') {
          throw new Error(`Invalid threshold values for tier: ${tier}`);
        }
      }

      const updated = await Settings.findOneAndUpdate(
        { key: 'promotionThresholds' },
        {
          value: newThresholds,
          updatedBy,
          updatedAt: new Date()
        },
        { new: true, upsert: true }
      );

      cache.promotionThresholds = null;
      cache.lastUpdated = null;

      logger.info('Promotion thresholds updated', {
        updatedBy,
        newThresholds
      });

      return updated;
    } catch (error) {
      logger.error('Error updating promotion thresholds', {
        error: error.message
      });
      throw error;
    }
  },

  clearCache: () => {
    cache.promotionThresholds = null;
    cache.lastUpdated = null;
    logger.info('Promotion thresholds cache cleared');
  },

  getCacheStatus: () => {
    return {
      isCached: !!cache.promotionThresholds,
      lastUpdated: cache.lastUpdated,
      age: cache.lastUpdated ? Date.now() - cache.lastUpdated : null,
      ttl: cache.cacheTTL
    };
  }
};
