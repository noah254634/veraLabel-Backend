import { reviewerService } from './reviewer.service.js';
import logger from '../../config/logger.js';
import { get } from 'node:http';

export const reviewerController = {
    getDashboardAnalytics: async (req, res) => {
    try {
        const reviewerId = req.user._id;
        const response = await reviewerService.getDashboardAnalytics(reviewerId);
        return res.status(200).json({ 
          message: 'Dashboard analytics fetched', 
          data: response 
        });
    }catch(err){
        logger.error(`Error fetching dashboard analytics: ${err.message}`);
        return res.status(500).json({error:err.message})
    }
    },
  // Rate a labeller's task submission (1-5 stars, quality score)
  rateTask: async (req, res) => {
    try {
      const { taskId } = req.params;
      const { rating, comment } = req.body; // rating: 1-5
      const reviewerId = req.user._id;

      if (!taskId) throw new Error('Task ID is required');
      if (!rating || rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');

      const response = await reviewerService.rateTask(taskId, reviewerId, rating, comment);
      logger.info(`Task ${taskId} rated by reviewer ${reviewerId}`);
      
      return res.status(200).json({ 
        message: 'Task rated successfully', 
        data: response 
      });
    } catch (err) {
      logger.error(`Error rating task: ${err.message}`);
      return res.status(err.status || 500).json({ error: err.message });
    }
  },

  // Submit detailed feedback on a task
  submitFeedback: async (req, res) => {
    try {
      const { taskId } = req.params;
      const { feedback, suggestions, issues } = req.body;
      const reviewerId = req.user._id;

      if (!taskId) throw new Error('Task ID is required');
      if (!feedback) throw new Error('Feedback is required');

      const response = await reviewerService.submitFeedback(
        taskId,
        reviewerId,
        feedback,
        suggestions,
        issues
      );
      
      logger.info(`Feedback submitted for task ${taskId}`);
      return res.status(200).json({ 
        message: 'Feedback submitted successfully', 
        data: response 
      });
    } catch (err) {
      logger.error(`Error submitting feedback: ${err.message}`);
      return res.status(err.status || 500).json({ error: err.message });
    }
  },

  // Get all tasks pending review for this reviewer
  getPendingReviewTasks: async (req, res) => {
    try {
      const reviewerId = req.user._id;
      const { page = 1, limit = 20 } = req.query;

      const response = await reviewerService.getPendingReviewTasks(reviewerId, page, limit);
      
      return res.status(200).json({ 
        message: 'Pending review tasks fetched', 
        data: response 
      });
    } catch (err) {
      logger.error(`Error fetching pending tasks: ${err.message}`);
      return res.status(err.status || 500).json({ error: err.message });
    }
  },

  // Get completed reviews by this reviewer
  getCompletedReviews: async (req, res) => {
    try {
      const reviewerId = req.user._id;
      const { page = 1, limit = 20 } = req.query;

      const response = await reviewerService.getCompletedReviews(reviewerId, page, limit);
      
      return res.status(200).json({ 
        message: 'Completed reviews fetched', 
        data: response 
      });
    } catch (err) {
      logger.error(`Error fetching completed reviews: ${err.message}`);
      return res.status(err.status || 500).json({ error: err.message });
    }
  },

  // Get reviewer performance stats
  getReviewerStats: async (req, res) => {
    try {
      const reviewerId = req.user._id;

      const response = await reviewerService.getReviewerStats(reviewerId);
      
      return res.status(200).json({ 
        message: 'Reviewer stats fetched', 
        data: response 
      });
    } catch (err) {
      logger.error(`Error fetching reviewer stats: ${err.message}`);
      return res.status(err.status || 500).json({ error: err.message });
    }
  },

  // Get specific task details for review
  getTaskForReview: async (req, res) => {
    try {
      const { taskId } = req.params;
      const reviewerId = req.user._id;

      if (!taskId) throw new Error('Task ID is required');

      const response = await reviewerService.getTaskForReview(taskId, reviewerId);
      
      return res.status(200).json({ 
        message: 'Task details fetched', 
        data: response 
      });
    } catch (err) {
      logger.error(`Error fetching task: ${err.message}`);
      return res.status(err.status || 500).json({ error: err.message });
    }
  },

  // Approve a labeller's submission
  approveSubmission: async (req, res) => {
    try {
      const { taskId } = req.params;
      const reviewerId = req.user._id;
      const { comment } = req.body;

      if (!taskId) throw new Error('Task ID is required');

      const response = await reviewerService.approveSubmission(taskId, reviewerId, comment);
      
      logger.info(`Task ${taskId} approved by reviewer ${reviewerId}`);
      return res.status(200).json({ 
        message: 'Submission approved successfully', 
        data: response 
      });
    } catch (err) {
      logger.error(`Error approving submission: ${err.message}`);
      return res.status(err.status || 500).json({ error: err.message });
    }
  },

  // Reject a labeller's submission with reason
  rejectSubmission: async (req, res) => {
    try {
      const { taskId } = req.params;
      const reviewerId = req.user._id;
      const { reason, suggestions } = req.body;

      if (!taskId) throw new Error('Task ID is required');
      if (!reason) throw new Error('Rejection reason is required');

      const response = await reviewerService.rejectSubmission(taskId, reviewerId, reason, suggestions);
      
      logger.info(`Task ${taskId} rejected by reviewer ${reviewerId}`);
      return res.status(200).json({ 
        message: 'Submission rejected successfully', 
        data: response 
      });
    } catch (err) {
      logger.error(`Error rejecting submission: ${err.message}`);
      return res.status(err.status || 500).json({ error: err.message });
    }
  }
};
