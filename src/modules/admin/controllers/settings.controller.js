import { settingsService } from '../services/settings.service.js';
import logger from '../../../config/logger.js';
import { asyncHandler, AppError } from '../../../middlewares/errorHandler.middleware.js';

export const settingsController = {
  getPromotionThresholds: asyncHandler(async (req, res) => {
    logger.info('Fetching promotion thresholds');
    const thresholds = await settingsService.getPromotionThresholds();
    
    res.json({
      success: true,
      message: 'Promotion thresholds retrieved',
      data: thresholds
    });
  }),

  updatePromotionThresholds: asyncHandler(async (req, res) => {
    const { thresholds } = req.body;
    
    if (!thresholds) {
      throw new AppError('Thresholds object is required', 400);
    }

    logger.info('Updating promotion thresholds', {
      adminId: req.user._id,
      thresholds
    });

    const updated = await settingsService.updatePromotionThresholds(
      thresholds,
      req.user._id
    );

    res.json({
      success: true,
      message: 'Promotion thresholds updated successfully',
      data: updated.value
    });
  }),

  getCacheStatus: asyncHandler(async (req, res) => {
    const status = settingsService.getCacheStatus();
    
    res.json({
      success: true,
      message: 'Cache status retrieved',
      data: status
    });
  }),

  clearCache: asyncHandler(async (req, res) => {
    logger.info('Clearing promotion thresholds cache', {
      adminId: req.user._id
    });

    settingsService.clearCache();

    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  })
};
