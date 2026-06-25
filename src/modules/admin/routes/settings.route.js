import express from 'express';
import { settingsController } from '../controllers/settings.controller.js';
import { protectRoute } from '../../../middlewares/auth.middleware.js';
import authorize from '../../../middlewares/authorization.middleware.js';

const settingsRouter = express.Router();
// All settings endpoints require admin authorization
settingsRouter.use(protectRoute, authorize('admin', 'superadmin'));

settingsRouter.get('/promotion-thresholds', settingsController.getPromotionThresholds);

settingsRouter.put('/promotion-thresholds', settingsController.updatePromotionThresholds);

// Cache management (debugging/admin only)
settingsRouter.get('/cache-status', settingsController.getCacheStatus);
settingsRouter.post('/cache/clear', settingsController.clearCache);

export default settingsRouter;
