import { reviewerService } from './reviewer.service.js';
import logger from '../../config/logger.js';
import { asyncHandler, AppError } from "../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../helpers/responseHandler.js";
import { get } from 'node:http';
import Reviewer from './reviewer.model.js';

const getReviewerProfileId = async (userId) => {
  let reviewer = await Reviewer.findOne({ reviewerUserId: userId });
  if (!reviewer) {
    reviewer = await Reviewer.create({ reviewerUserId: userId });
  }
  return reviewer._id;
};

export const reviewerController = {
    getDashboardAnalytics:asyncHandler(async (req, res) => {
  
        const reviewerId = await getReviewerProfileId(req.user._id);
        const response = await reviewerService.getDashboardAnalytics(reviewerId);
        return ResponseHandler.success(res,{response},"dashboard analytics successfully fetched")
})
 ,

  rateTask: asyncHandler(async (req, res) => {
    
      const { taskId } = req.params;
      const { rating, comment } = req.body; // rating: 1-5
      const reviewerId = await getReviewerProfileId(req.user._id);

      if (!taskId) throw new Error('Task ID is required');
      if (!rating || rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');

      const response = await reviewerService.rateTask(taskId, reviewerId, rating, comment);
      logger.info(`Task ${taskId} rated by reviewer ${reviewerId}`);
      
      return ResponseHandler.success(res,{response},"Tasks rated successfully")
}),


  submitFeedback: asyncHandler(async (req, res) => {
 
      const { taskId } = req.params;
      const { feedback, suggestions, issues } = req.body;
      const reviewerId = await getReviewerProfileId(req.user._id);

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
      return ResponseHandler.success(res,{response},"Feedback submitted successfully");
}),


  getPendingReviewTasks: asyncHandler(async (req, res) => {
 
      const reviewerId = await getReviewerProfileId(req.user._id);
      const { page = 1, limit = 20 } = req.query;

      const response = await reviewerService.getPendingReviewTasks(reviewerId, page, limit);
      
      return ResponseHandler.success(res,response,'Pending review tasks fetched')
  }),


  getCompletedReviews: asyncHandler(async (req, res) => {
      const reviewerId = await getReviewerProfileId(req.user._id);
      const { page = 1, limit = 20 } = req.query;

      const response = await reviewerService.getCompletedReviews(reviewerId, page, limit);
      
      return ResponseHandler.success(res,{response},"completed reviews found successfully")
  }),


  getReviewerStats:asyncHandler(async (req, res) => {
      const reviewerId = await getReviewerProfileId(req.user._id);

      const response = await reviewerService.getReviewerStats(reviewerId);
      
      return ResponseHandler.success(res,response,"review ststs correctly synced")
  }),


  getTaskForReview: asyncHandler(async (req, res) => {
      const { taskId } = req.params;
      const reviewerId = await getReviewerProfileId(req.user._id);

      if (!taskId) throw new AppError('Task ID is required', 400);

      const response = await reviewerService.getTaskForReview(taskId, reviewerId);
      
      return ResponseHandler.success(res,response,"Task details fetched")
  }),


  approveSubmission: asyncHandler(async (req, res) => {
      const { taskId } = req.params;
      const reviewerId = await getReviewerProfileId(req.user._id);
      const { comment } = req.body;

      if (!taskId) throw new AppError('Task ID is required', 400);

      const response = await reviewerService.approveSubmission(taskId, reviewerId, comment);
      
      logger.info(`Task ${taskId} approved by reviewer ${reviewerId}`);
      return ResponseHandler.success(res,response,"Task approved successfully")
  }),


  rejectSubmission: asyncHandler(async (req, res) => {
      const { taskId } = req.params;
      const reviewerId = await getReviewerProfileId(req.user._id);
      const { reason, suggestions } = req.body;

      if (!taskId) throw new AppError('Task ID is required', 400);
      if (!reason) throw new AppError('Rejection reason is required', 400);

      const response = await reviewerService.rejectSubmission(taskId, reviewerId, reason, suggestions);
      
      logger.info(`Task ${taskId} rejected by reviewer ${reviewerId}`);
      return ResponseHandler.success(res, response, "Task rejected successfully");
  }),

  requestPayout: asyncHandler(async (req, res) => {
      const { amount, method } = req.body;
      const reviewerId = await getReviewerProfileId(req.user._id);

      if (!amount || amount <= 0) throw new AppError('Amount must be greater than 0', 400);
      if (!method) throw new AppError('Payout method is required', 400);

      const response = await reviewerService.requestPayout(reviewerId, Number(amount), method);
      
      logger.info(`Payout requested by reviewer ${reviewerId} of amount ${amount}`);
      return ResponseHandler.success(res, response, "Payout requested successfully");
  })
};
