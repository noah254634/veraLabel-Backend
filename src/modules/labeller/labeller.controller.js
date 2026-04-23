import { labellerService } from './labeller.service.js';
import logger from '../../config/logger.js';

export const labellerController = {
  createProfile: async (req, res) => {
    const { profileData } = req.body;
    const userId = req.user._id;

    const labeller = await labellerService.createLabellerProfile(userId, profileData);
    return res.status(201).json(labeller);
  },

  getProfile: async (req, res) => {
    const userId = req.user._id;
    const labeller = await labellerService.getLabellerProfile(userId);
    return res.status(200).json(labeller);
  },

  updateProfile: async (req, res) => {
    const userId = req.user._id;
    const labeller = await labellerService.updateLabellerProfile(userId, req.body);
    return res.status(200).json(labeller);
  },

  getPerformance: async (req, res) => {
    const userId = req.user._id;
    const performance = await labellerService.getPerformanceMetrics(userId);
    return res.status(200).json(performance);
  },

  getAssignedTasks: async (req, res) => {
    const userId = req.user._id;
    const tasks = await labellerService.getAssignedTasks(userId);
    return res.status(200).json(tasks);
  },

  completeTask: async (req, res) => {
    const { taskId, qualityScore } = req.body;
    const userId = req.user._id;

    const result = await labellerService.completeTask(userId, taskId, qualityScore);
    return res.status(200).json({ message: 'Task completed', result });
  },

  rejectTask: async (req, res) => {
    const { taskId } = req.body;
    const userId = req.user._id;

    const result = await labellerService.rejectTask(userId, taskId);
    return res.status(200).json({ message: 'Task rejected', result });
  },

  getEarnings: async (req, res) => {
    const userId = req.user._id;
    const earnings = await labellerService.getEarnings(userId);
    return res.status(200).json(earnings);
  },

  getTier: async (req, res) => {
    const userId = req.user._id;
    const tierInfo = await labellerService.getTier(userId);
    return res.status(200).json(tierInfo);
  },

  getStats: async (req, res) => {
    const userId = req.user._id;
    const stats = await labellerService.getLabellerStats(userId);
    return res.status(200).json(stats);
  },

  getTopLabellersByPerformance: async (req, res) => {
    const { limit = 10 } = req.query;
    const labellers = await labellerService.getTopLabellersByPerformance(parseInt(limit));
    return res.status(200).json(labellers);
  },

  getLabellersByTier: async (req, res) => {
    const { tier } = req.params;
    const labellers = await labellerService.getLabellersByTier(tier);
    return res.status(200).json(labellers);
  },

  updateLabellerStatus: async (req, res) => {
    const { labellerUserId, status, reason } = req.body;
    const result = await labellerService.updateLabellerStatus(labellerUserId, status, reason);
    return res.status(200).json(result);
  },

  promoteLabellerTier: async (req, res) => {
    const { labellerUserId, newTier } = req.body;
    const result = await labellerService.promoteLabellerTier(labellerUserId, newTier);
    return res.status(200).json(result);
  },

  assignTasksToLabeller: async (req, res) => {
    const { labellerUserId, taskIds } = req.body;
    const result = await labellerService.assignTasksToLabeller(labellerUserId, taskIds);
    return res.status(200).json(result);
  }
};
