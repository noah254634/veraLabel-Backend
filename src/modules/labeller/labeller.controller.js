import { labellerService } from './labeller.service.js';
import logger from '../../config/logger.js';
import { asyncHandler, AppError } from '../../middlewares/errorHandler.middleware.js';
import ResponseHandler from '../../helpers/responseHandler.js';
import { getUserIdFromRequest } from '../../helpers/userExtraction.js';
import { validateRequiredFields, validateRequiredParams } from '../../helpers/validationHelpers.js';

export const labellerController = {
  createProfile: asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ['profileData']);
    const userId = getUserIdFromRequest(req);
    const labeller = await labellerService.createLabellerProfile(userId, req.body.profileData);
    return ResponseHandler.created(res, labeller, 'Labeller profile created successfully');
  }),

  getProfile: asyncHandler(async (req, res) => {
    const userId = getUserIdFromRequest(req);
    const labeller = await labellerService.getLabellerProfile(userId);
    return ResponseHandler.success(res, labeller, 'Profile retrieved successfully');
  }),

  updateProfile: asyncHandler(async (req, res) => {
    const userId = getUserIdFromRequest(req);
    const labeller = await labellerService.updateLabellerProfile(userId, req.body);
    return ResponseHandler.success(res, labeller, 'Profile updated successfully');
  }),

  getPerformance: asyncHandler(async (req, res) => {
    const userId = getUserIdFromRequest(req);
    const performance = await labellerService.getPerformanceMetrics(userId);
    return ResponseHandler.success(res, performance, 'Performance metrics retrieved');
  }),

  getAssignedTasks: asyncHandler(async (req, res) => {
    const userId = getUserIdFromRequest(req);
    const tasks = await labellerService.getAssignedTasks(userId);
    return ResponseHandler.success(res, tasks, 'Assigned tasks retrieved');
  }),

  completeTask: asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ['taskId', 'qualityScore']);
    const { taskId, qualityScore } = req.body;
    const userId = getUserIdFromRequest(req);
    const result = await labellerService.completeTask(userId, taskId, qualityScore);
    return ResponseHandler.success(res, result, 'Task completed successfully');
  }),

  rejectTask: asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ['taskId']);
    const { taskId } = req.body;
    const userId = getUserIdFromRequest(req);
    const result = await labellerService.rejectTask(userId, taskId);
    return ResponseHandler.success(res, result, 'Task rejected successfully');
  }),

  getEarnings: asyncHandler(async (req, res) => {
    const userId = getUserIdFromRequest(req);
    const earnings = await labellerService.getEarnings(userId);
    return ResponseHandler.success(res, earnings, 'Earnings retrieved successfully');
  }),

  getTier: asyncHandler(async (req, res) => {
    const userId = getUserIdFromRequest(req);
    const tierInfo = await labellerService.getTier(userId);
    return ResponseHandler.success(res, tierInfo, 'Tier information retrieved');
  }),

  getStats: asyncHandler(async (req, res) => {
    const userId = getUserIdFromRequest(req);
    const stats = await labellerService.getLabellerStats(userId);
    return ResponseHandler.success(res, stats, 'Statistics retrieved successfully');
  }),

  getTopLabellersByPerformance: asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;
    const labellers = await labellerService.getTopLabellersByPerformance(parseInt(limit));
    return ResponseHandler.success(res, labellers, 'Top labellers retrieved');
  }),

  getLabellersByTier: asyncHandler(async (req, res) => {
    validateRequiredParams(req.params, ['tier']);
    const { tier } = req.params;
    const labellers = await labellerService.getLabellersByTier(tier);
    return ResponseHandler.success(res, labellers, 'Labellers retrieved by tier');
  }),

  updateLabellerStatus: asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ['labellerUserId', 'status', 'reason']);
    const { labellerUserId, status, reason } = req.body;
    const result = await labellerService.updateLabellerStatus(labellerUserId, status, reason);
    return ResponseHandler.success(res, result, 'Labeller status updated');
  }),

  promoteLabellerTier: asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ['labellerUserId', 'newTier']);
    const { labellerUserId, newTier } = req.body;
    const result = await labellerService.promoteLabellerTier(labellerUserId, newTier);
    return ResponseHandler.success(res, result, 'Labeller promoted successfully');
  }),

  assignTasksToLabeller: asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ['labellerUserId', 'taskIds']);
    const { labellerUserId, taskIds } = req.body;
    const result = await labellerService.assignTasksToLabeller(labellerUserId, taskIds);
    return ResponseHandler.success(res, result, 'Tasks assigned successfully');
  })
};
