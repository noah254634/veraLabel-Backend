import Labeller from './labeller.model.js';
import Task from '../tasks/task.model.js';
import { settingsService } from '../admin/services/settings.service.js';
import logger from '../../config/logger.js';
import { normalizeLabellerProfilePayload, populateLabellerUser } from './labellerProfile.utils.js';

export const labellerService = {
  createLabellerProfile: async (userId, profileData) => {
    const normalizedPayload = normalizeLabellerProfilePayload(profileData);
    const existingLabeller = await Labeller.findOne({ userId });

    if (existingLabeller) {
      const updatedLabeller = await Labeller.findOneAndUpdate(
        { userId },
        { $set: normalizedPayload },
        { new: true, runValidators: true }
      );

      return populateLabellerUser(updatedLabeller);
    }

    const labeller = await Labeller.create({
      userId,
      ...normalizedPayload,
      isOnboarded: normalizedPayload.isOnboarded ?? false,
      status: normalizedPayload.status || 'active'
    });
    return populateLabellerUser(Labeller.findById(labeller._id));
  },

  getLabellerProfile: async (labellerUserId) => {
    const labeller = await populateLabellerUser(
      Labeller.findOne({ userId: labellerUserId })
    ).lean();
    if (!labeller) throw new Error('Labeller profile not found');
    return labeller;
  },

  updateLabellerProfile: async (labellerUserId, updates) => {
    const normalizedUpdates = normalizeLabellerProfilePayload(updates);
    const labeller = await Labeller.findOneAndUpdate(
      { userId: labellerUserId },
      { $set: normalizedUpdates },
      { new: true, runValidators: true }
    );
    if (!labeller) throw new Error('Labeller profile not found');
    return populateLabellerUser(labeller);
  },

  getPerformanceMetrics: async (labellerUserId) => {
    const labeller = await Labeller.findOne({ userId: labellerUserId })
      .select('performance earnings training tier')
      .lean();
    if (!labeller) throw new Error('Labeller not found');
    return labeller;
  },

  updatePerformanceMetrics: async (labellerUserId, taskQualityScore) => {
    const labeller = await Labeller.findOne({ userId: labellerUserId });
    if (!labeller) throw new Error('Labeller not found');

    // Recalculate metrics
    const totalCompleted = labeller.performance.totalTasksCompleted + 1;
    const totalAssigned = labeller.performance.totalTasksAssigned || 1;
    const newAvgScore = (
      (labeller.performance.averageQualityScore * labeller.performance.totalTasksCompleted + taskQualityScore) /
      totalCompleted
    ).toFixed(2);

    const completionRate = ((totalCompleted / totalAssigned) * 100).toFixed(2);
    const approvalRate = ((totalCompleted / totalAssigned) * 100).toFixed(2);
    const reliabilityScore = Math.min(
      100,
      (parseFloat(newAvgScore) / 5) * 100 * (parseFloat(approvalRate) / 100)
    ).toFixed(2);

    const updated = await Labeller.findOneAndUpdate(
      { userId: labellerUserId },
      {
        $inc: { 'performance.totalTasksCompleted': 1 },
        $set: {
          'performance.averageQualityScore': parseFloat(newAvgScore),
          'performance.completionRate': parseFloat(completionRate),
          'performance.approvalRate': parseFloat(approvalRate),
          'performance.reliabilityScore': parseFloat(reliabilityScore)
        }
      },
      { new: true }
    ).select('performance');

    return updated;
  },

  assignTasksToLabeller: async (labellerUserId, taskIds) => {
    const labeller = await Labeller.findOneAndUpdate(
      { userId: labellerUserId },
      {
        $addToSet: { currentAssignedTasks: { $each: taskIds } },
        $inc: { 'performance.totalTasksAssigned': taskIds.length }
      },
      { new: true }
    ).select('currentAssignedTasks performance');

    if (!labeller) throw new Error('Labeller not found');
    return labeller;
  },

  getAssignedTasks: async (labellerUserId) => {
    const labeller = await Labeller.findOne({ userId: labellerUserId })
      .populate('currentAssignedTasks')
      .select('currentAssignedTasks');

    if (!labeller) throw new Error('Labeller not found');
    return labeller.currentAssignedTasks || [];
  },

  completeTask: async (labellerUserId, taskId, qualityScore) => {
    const labeller = await Labeller.findOneAndUpdate(
      { userId: labellerUserId },
      {
        $pull: { currentAssignedTasks: taskId },
        $push: {
          completedTasksLog: {
            taskId,
            completedAt: new Date(),
            qualityScore,
            approvalStatus: 'pending'
          }
        }
      },
      { new: true }
    );

    if (!labeller) throw new Error('Labeller not found');
    return await labellerService.updatePerformanceMetrics(labellerUserId, qualityScore);
  },

  rejectTask: async (labellerUserId, taskId) => {
    const labeller = await Labeller.findOneAndUpdate(
      { userId: labellerUserId },
      {
        $pull: { currentAssignedTasks: taskId },
        $inc: { 'performance.totalTasksRejected': 1 }
      },
      { new: true }
    );

    if (!labeller) throw new Error('Labeller not found');
    return labeller;
  },

  getEarnings: async (labellerUserId) => {
    const labeller = await Labeller.findOne({ userId: labellerUserId })
      .select('earnings');

    if (!labeller) throw new Error('Labeller not found');
    return labeller.earnings;
  },

  updateEarnings: async (labellerUserId, amount, type = 'completed') => {
    // type: 'completed' | 'payout'
    const updateObj = {};

    if (type === 'completed') {
      updateObj['$inc'] = {
        'earnings.totalEarned': amount,
        'earnings.currentBalance': amount
      };
    } else if (type === 'payout') {
      updateObj['$inc'] = {
        'earnings.currentBalance': -amount,
        'earnings.totalPayouts': 1
      };
      updateObj['$set'] = {
        'earnings.lastPayoutDate': new Date()
      };
    }

    const labeller = await Labeller.findOneAndUpdate(
      { userId: labellerUserId },
      updateObj,
      { new: true }
    ).select('earnings');

    if (!labeller) throw new Error('Labeller not found');
    return labeller.earnings;
  },

  promoteLabellerTier: async (labellerUserId, newTier) => {
    const validTiers = ['Trainee', 'Bronze', 'Silver', 'Gold'];
    if (!validTiers.includes(newTier)) {
      throw new Error('Invalid tier');
    }

    const labeller = await Labeller.findOneAndUpdate(
      { userId: labellerUserId },
      {
        $set: { tier: newTier },
        $addToSet: { 'training.completedTiers': newTier }
      },
      { new: true }
    ).select('tier training');

    if (!labeller) throw new Error('Labeller not found');
    return labeller;
  },

  getTier: async (labellerUserId) => {
    const labeller = await Labeller.findOne({ userId: labellerUserId })
      .select('tier training');

    if (!labeller) throw new Error('Labeller not found');
    return { tier: labeller.tier, training: labeller.training };
  },

  updateLabellerStatus: async (labellerUserId, status, reason = '') => {
    const validStatuses = ['active', 'inactive', 'suspended', 'banned'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }

    const updateObj = { $set: { status } };
    if (status !== 'active') {
      updateObj['$set'].suspensionReason = reason;
      updateObj['$set'].suspendedAt = new Date();
    }

    const labeller = await Labeller.findOneAndUpdate(
      { userId: labellerUserId },
      updateObj,
      { new: true }
    ).select('status');

    if (!labeller) throw new Error('Labeller not found');
    return labeller;
  },

  getTopLabellersByPerformance: async (limit = 10) => {
    const labellers = await Labeller.find({ status: 'active' })
      .sort({ 'performance.reliabilityScore': -1 })
      .limit(limit)
      .populate('userId', 'name email')
      .select('tier performance earnings userId')
      .lean();

    return labellers;
  },

  getLabellersByTier: async (tier) => {
    const labellers = await Labeller.find({ tier, status: 'active' })
      .populate('userId', 'name email')
      .select('tier performance earnings')
      .lean();

    return labellers;
  },

  getLabellerStats: async (labellerUserId) => {
    const labeller = await Labeller.findOne({ userId: labellerUserId });
    if (!labeller) throw new Error('Labeller not found');

    return {
      profileComplete: !!labeller.profile.location && !!labeller.expertise.skills.length,
      tier: labeller.tier,
      isOnboarded: labeller.isOnboarded,
      performance: labeller.performance,
      earnings: labeller.earnings,
      status: labeller.status,
      averageRating: labeller.averageRating
    };
  },

  updateLastActivity: async (labellerUserId) => {
    const labeller = await Labeller.findOneAndUpdate(
      { userId: labellerUserId },
      {
        $set: { 'activityMetrics.lastActiveAt': new Date() },
        $inc: { 'activityMetrics.loginCount': 1 }
      },
      { new: true }
    ).select('activityMetrics');

    if (!labeller) throw new Error('Labeller not found');
    return labeller;
  },

  updateRatingFromTaskReview: async (labellerUserId, taskRating, taskQualityScore) => {
    try {
      if (!labellerUserId) throw new Error('Labeller userId is required');
      
      const labeller = await Labeller.findOne({ userId: labellerUserId });
      if (!labeller) throw new Error('Labeller not found');

      // Update performance metrics with new rating
      const totalCompleted = labeller.performance.totalTasksCompleted;
      const currentAvgScore = labeller.performance.averageQualityScore;
      
      // Recalculate average quality score
      const newAvgScore = (
        (currentAvgScore * totalCompleted + taskRating) / (totalCompleted + 1)
      ).toFixed(2);

      const updated = await Labeller.findOneAndUpdate(
        { userId: labellerUserId },
        {
          $set: { 'performance.averageQualityScore': parseFloat(newAvgScore) }
        },
        { new: true }
      ).select('performance tier userId');

      logger.info('Labeller rating updated', {
        userId: labellerUserId,
        newAvgScore: parseFloat(newAvgScore),
        totalCompleted: totalCompleted + 1
      });

      return {
        updated,
        newAvgScore: parseFloat(newAvgScore),
        shouldCheckPromotion: true
      };
    } catch (error) {
      logger.error('Error updating labeller rating', {
        error: error.message,
        labellerUserId
      });
      throw error;
    }
  },

  checkPromotionEligibility: async (labellerUserId) => {
    try {
      if (!labellerUserId) throw new Error('Labeller userId is required');

      const labeller = await Labeller.findOne({ userId: labellerUserId })
        .populate('userId', 'name email');
      
      if (!labeller) throw new Error('Labeller not found');

      const perf = labeller.performance;
      const currentTier = labeller.tier;

      const promotionThresholds = await settingsService.getPromotionThresholds();

      const threshold = promotionThresholds[currentTier];
      if (!threshold || !threshold.nextTier) {
        return { isEligible: false, reason: 'Already at maximum tier', currentTier };
      }

      const isEligible = 
        perf.averageQualityScore >= threshold.requiredAvgScore &&
        perf.approvalRate >= threshold.requiredApprovalRate &&
        perf.totalTasksCompleted >= threshold.requiredTasksCompleted;

      const promotionData = {
        isEligible,
        currentTier,
        nextTier: threshold.nextTier,
        metrics: {
          averageQualityScore: parseFloat(perf.averageQualityScore.toFixed(2)),
          approvalRate: parseFloat(perf.approvalRate.toFixed(2)),
          totalTasksCompleted: perf.totalTasksCompleted
        },
        requirements: {
          minAvgScore: threshold.requiredAvgScore,
          minApprovalRate: threshold.requiredApprovalRate,
          minTasksCompleted: threshold.requiredTasksCompleted
        },
        labeller: {
          userId: labeller.userId._id,
          name: labeller.userId.name,
          email: labeller.userId.email
        }
      };

      logger.info('Promotion eligibility checked', {
        userId: labellerUserId,
        isEligible,
        currentTier,
        nextTier: threshold.nextTier
      });

      return promotionData;
    } catch (error) {
      logger.error('Error checking promotion eligibility', {
        error: error.message,
        labellerUserId
      });
      throw error;
    }
  },

  promoteIfEligible: async (labellerUserId) => {
    try {
      const eligibilityData = await labellerService.checkPromotionEligibility(labellerUserId);
      
      if (!eligibilityData.isEligible) {
        return {
          promoted: false,
          reason: 'Labeller does not meet promotion criteria',
          eligibilityData
        };
      }

      // Promote labeller to next tier
      const labeller = await Labeller.findOneAndUpdate(
        { userId: labellerUserId },
        {
          $set: { tier: eligibilityData.nextTier },
          $addToSet: { 'training.completedTiers': eligibilityData.nextTier }
        },
        { new: true }
      ).populate('userId', 'name email');

      logger.info('Labeller promoted automatically', {
        userId: labellerUserId,
        previousTier: eligibilityData.currentTier,
        newTier: eligibilityData.nextTier
      });

      return {
        promoted: true,
        previousTier: eligibilityData.currentTier,
        newTier: eligibilityData.nextTier,
        labeller,
        notifyAdmin: true // Signal that admin should be notified
      };
    } catch (error) {
      logger.error('Error promoting labeller', {
        error: error.message,
        labellerUserId
      });
      throw error;
    }
  }
};
