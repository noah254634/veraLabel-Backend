import Task from '../tasks/task.model.js';
import UserVera from '../users/user.model.js';
import Labeller from '../labeller/labeller.model.js';
import { labellerService } from '../labeller/labeller.service.js';
import mailService from '../mailer/mailService.js';
import logger from '../../config/logger.js';
import { get } from 'node:http';

export const reviewerService = {
    getDashboardAnalytics: async (reviewerId) => {
        

    },
  // Rate a task submission
  rateTask: async (taskId, reviewerId, rating, comment = '') => {
    try {
      const task = await Task.findById(taskId).populate('assignedTo');
      if (!task) throw new Error('Task not found');
      if (task.status !== 'submitted') {
        const error = new Error('Task must be in submitted status to rate');
        error.status = 400;
        throw error;
      }

      const labellerUserId = task.assignedTo._id;

      // Update task with rating
      task.verificationScore = rating;
      task.verifiedBy = reviewerId;
      task.reviewComment = comment;
      task.reviewedAt = new Date();
      task.status = 'verified'; // Mark as verified after rating
      await task.save();

      // Update labeller's performance metrics using the labeller service
      await labellerService.updateRatingFromTaskReview(labellerUserId, rating);

      // Check if labeller is now eligible for promotion
      const promotionEligibility = await labellerService.checkPromotionEligibility(labellerUserId);
      
      let promotionResult = null;
      if (promotionEligibility.isEligible) {
        // Auto-promote if eligible
        promotionResult = await labellerService.promoteIfEligible(labellerUserId);
        
        // Notify admin and labeller about the promotion
        if (promotionResult.promoted) {
          try {
            // Notify admins
            await mailService.sendLabellerPromotionNotificationToAdmin({
              labellerName: promotionEligibility.labeller.name,
              labellerEmail: promotionEligibility.labeller.email,
              previousTier: promotionEligibility.currentTier,
              newTier: promotionEligibility.nextTier,
              metrics: promotionEligibility.metrics
            });

            // Notify labeller about their promotion
            await mailService.sendLabellerPromotionEmail(
              promotionEligibility.labeller.name,
              promotionEligibility.labeller.email,
              promotionEligibility.nextTier
            );

            logger.info('Promotion notifications sent successfully', {
              labellerUserId,
              newTier: promotionEligibility.nextTier
            });
          } catch (mailError) {
            logger.warn('Failed to send promotion notification emails', {
              error: mailError.message,
              labellerUserId
            });
            // Don't throw - promotion already happened, email is just a bonus
          }
        }
      } else {
        // Send notification if close to promotion
        const metricsGap = {
          avgScoreGap: (promotionEligibility.requirements.minAvgScore - promotionEligibility.metrics.averageQualityScore).toFixed(2),
          approvalRateGap: (promotionEligibility.requirements.minApprovalRate - promotionEligibility.metrics.approvalRate).toFixed(2),
          tasksGap: promotionEligibility.requirements.minTasksCompleted - promotionEligibility.metrics.totalTasksCompleted
        };

        logger.info('Labeller metrics updated but not yet eligible for promotion', {
          labellerUserId,
          currentTier: promotionEligibility.currentTier,
          metricsGap
        });
      }

      return {
        taskId,
        rating,
        labellerUserId,
        promotionEligibility,
        promotionResult,
        message: promotionResult?.promoted 
          ? `Task rated and labeller promoted to ${promotionResult.newTier}!`
          : 'Task rated successfully'
      };
    } catch (err) {
      logger.error(`Service error rating task: ${err.message}`);
      throw err;
    }
  },

  // Submit detailed feedback
  submitFeedback: async (taskId, reviewerId, feedback, suggestions, issues) => {
    try {
      const task = await Task.findById(taskId);
      if (!task) throw new Error('Task not found');

      task.reviewFeedback = {
        feedback,
        suggestions: suggestions || [],
        issues: issues || [],
        submittedBy: reviewerId,
        submittedAt: new Date()
      };
      await task.save();

      return { taskId, feedbackRecorded: true };
    } catch (err) {
      logger.error(`Service error submitting feedback: ${err.message}`);
      throw err;
    }
  },

  // Get pending review tasks
  getPendingReviewTasks: async (reviewerId, page = 1, limit = 20) => {
    try {
      const skip = (page - 1) * limit;
      
      const tasks = await Task.find({ 
        status: 'submitted',
        verifiedBy: null 
      })
        .populate('assignedTo', 'name email')
        .populate('dataset', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await Task.countDocuments({ 
        status: 'submitted',
        verifiedBy: null 
      });

      return { tasks, total, page, pages: Math.ceil(total / limit) };
    } catch (err) {
      logger.error(`Service error fetching pending tasks: ${err.message}`);
      throw err;
    }
  },

  // Get completed reviews
  getCompletedReviews: async (reviewerId, page = 1, limit = 20) => {
    try {
      const skip = (page - 1) * limit;
      
      const tasks = await Task.find({ 
        verifiedBy: reviewerId 
      })
        .populate('assignedTo', 'name email')
        .populate('dataset', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ reviewedAt: -1 });

      const total = await Task.countDocuments({ verifiedBy: reviewerId });

      return { tasks, total, page, pages: Math.ceil(total / limit) };
    } catch (err) {
      logger.error(`Service error fetching completed reviews: ${err.message}`);
      throw err;
    }
  },

  // Get reviewer performance stats
  getReviewerStats: async (reviewerId) => {
    try {
      const totalReviewed = await Task.countDocuments({ verifiedBy: reviewerId });
      
      const avgScore = await Task.aggregate([
        { $match: { verifiedBy: reviewerId } },
        { $group: { _id: null, avgScore: { $avg: '$verificationScore' } } }
      ]);

      const pendingCount = await Task.countDocuments({ 
        status: 'submitted',
        verifiedBy: null 
      });

      const approvedCount = await Task.countDocuments({ 
        verifiedBy: reviewerId,
        status: 'verified'
      });

      const rejectedCount = await Task.countDocuments({ 
        verifiedBy: reviewerId,
        status: 'rejected'
      });

      return {
        totalReviewed,
        averageScore: avgScore[0]?.avgScore || 0,
        pendingReviews: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        approvalRate: totalReviewed > 0 ? (approvedCount / totalReviewed * 100).toFixed(2) + '%' : '0%'
      };
    } catch (err) {
      logger.error(`Service error getting reviewer stats: ${err.message}`);
      throw err;
    }
  },

  // Get specific task for review
  getTaskForReview: async (taskId, reviewerId) => {
    try {
      const task = await Task.findById(taskId)
        .populate('assignedTo', 'name email avgRating')
        .populate('dataset', 'name description');

      if (!task) throw new Error('Task not found');
      if (task.status !== 'submitted') {
        const error = new Error('Task is not available for review');
        error.status = 400;
        throw error;
      }

      return task;
    } catch (err) {
      logger.error(`Service error getting task: ${err.message}`);
      throw err;
    }
  },

  // Approve submission
  approveSubmission: async (taskId, reviewerId, comment = '') => {
    try {
      const task = await Task.findById(taskId);
      if (!task) throw new Error('Task not found');

      task.status = 'verified';
      task.isVerified = true;
      task.verifiedBy = reviewerId;
      task.verificationScore = 5; // Auto-approve gives top score
      task.reviewedAt = new Date();
      task.reviewComment = comment;
      await task.save();

      return { taskId, status: 'approved', verificationScore: 5 };
    } catch (err) {
      logger.error(`Service error approving submission: ${err.message}`);
      throw err;
    }
  },

  // Reject submission
  rejectSubmission: async (taskId, reviewerId, reason, suggestions = []) => {
    try {
      const task = await Task.findById(taskId);
      if (!task) throw new Error('Task not found');

      task.status = 'rejected';
      task.verifiedBy = reviewerId;
      task.rejectionReason = reason;
      task.reviewedAt = new Date();
      task.reviewFeedback = {
        feedback: reason,
        suggestions,
        submittedBy: reviewerId,
        submittedAt: new Date()
      };
      await task.save();

      return { taskId, status: 'rejected', reason };
    } catch (err) {
      logger.error(`Service error rejecting submission: ${err.message}`);
      throw err;
    }
  }
};
