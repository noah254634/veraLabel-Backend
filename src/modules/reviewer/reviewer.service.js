import Task from '../tasks/task.model.js';
import UserVera from '../users/user.model.js';
import Labeller from '../labeller/labeller.model.js';
import Dataset from '../datasets/dataset.model.js';
import { labellerService } from '../labeller/labeller.service.js';
import mailService from '../mailer/mailService.js';
import logger from '../../config/logger.js';
import { r2ContentFetcher } from "../tasks/r2.contentFetcher.js";
import Submission from '../tasks/task.submission.model.js';
import Reviewer from './reviewer.model.js';
import { normalizeContentType } from '../tasks/taskContentType.js';
import Payout from '../payments/models/payout.model.js';
import Batch from '../tasks/task.batch.model.js';
import { taskService } from '../tasks/task.service.js';
import { NotificationService } from '../notifications/notification.service.js';
const updateReviewerMetrics = async (reviewerId, rating, isApproved, submissionId) => {
  try {
    let reviewer = await Reviewer.findById(reviewerId);
    if (!reviewer) {
      throw new Error(`Reviewer profile not found: ${reviewerId}`);
    }

    const totalReviews = (reviewer.performanceMetrics?.totalReviews || 0) + 1;
    
    let prevApproved = Math.round(((reviewer.performanceMetrics?.approvalRate || 0) / 100) * (reviewer.performanceMetrics?.totalReviews || 0));
    if (isApproved) prevApproved += 1;
    const approvalRate = parseFloat(((prevApproved / totalReviews) * 100).toFixed(2));

    const prevRating = reviewer.performanceMetrics?.averageRating || 0;
    const totalRatingSum = prevRating * (reviewer.performanceMetrics?.totalReviews || 0) + rating;
    const averageRating = parseFloat((totalRatingSum / totalReviews).toFixed(2));

    await Reviewer.updateOne(
      { _id: reviewerId },
      {
        $set: {
          'performanceMetrics.totalReviews': totalReviews,
          'performanceMetrics.approvalRate': approvalRate,
          'performanceMetrics.averageRating': averageRating,
          'performanceMetrics.updatedAt': new Date()
        },
        $addToSet: { tasksreviewed: submissionId }
      }
    );

    logger.info('Reviewer metrics updated', { reviewerId, totalReviews, approvalRate, averageRating });
  } catch (error) {
    logger.warn('Failed to update reviewer metrics', { error: error.message, reviewerId });
  }
};

const getReviewerReward = async (batch) => {
  if (!batch) return 0.15;
  const dataset = await Dataset.findById(batch.datasetId).select("pricePerBatch").lean();
  const pricePerBatch = dataset?.pricePerBatch || 0;
  const totalTasks = batch.totalTasks || 1;
  return pricePerBatch > 0 ? Number(((pricePerBatch * 0.20) / totalTasks).toFixed(4)) : 0.15;
};

const getTaskReward = async (batch) => {
  if (!batch) return 0.42;
  const dataset = await Dataset.findById(batch.datasetId).select("pricePerBatch").lean();
  const pricePerBatch = dataset?.pricePerBatch || 0;
  const totalTasks = batch.totalTasks || 1;
  return pricePerBatch > 0 ? Number((pricePerBatch / totalTasks).toFixed(4)) : 0.42;
};

export const reviewerService = {
    getDashboardAnalytics: async (reviewerId) => {
        

    },

  rateTask: async (submissionId, reviewerId, rating, comment = '') => {
    try {
      const submission = await Submission.findById(submissionId);
      if (!submission) throw new Error('Submission not found');
      if (submission.status !== 'submitted') {
        const error = new Error('Submission must be in submitted status to rate');
        error.status = 400;
        throw error;
      }

      submission.status = 'approved';
      submission.verificationScore = rating;
      submission.humanReview = {
        reviewedBy: reviewerId,
        verdict: 'approved',
        notes: comment,
        reviewedAt: new Date()
      };
      await submission.save();

      await updateReviewerMetrics(reviewerId, rating, true, submissionId);

      const batch = submission.batchId ? await Batch.findById(submission.batchId) : null;
      const reviewReward = await getReviewerReward(batch);
      await Reviewer.updateOne(
        { _id: reviewerId },
        { $inc: { 'earnings.pending': reviewReward, 'earnings.total': reviewReward } }
      );

      const task = await Task.findById(submission.taskId);
      if (task) {
        task.status = 'verified';
        task.isVerified = true;
        task.verifiedBy = reviewerId;
        task.r2_task_resultRef = submission.r2_output_key;
        task.verificationScore = rating;
        task.reviewedAt = new Date();
        task.reviewComment = comment;
        await task.save();

        try {
          const datasetId = task.datasetId;
          const totalTasksCount = await Task.countDocuments({ datasetId });
          const verifiedTasksCount = await Task.countDocuments({ datasetId, status: 'verified' });
          if (totalTasksCount > 0 && verifiedTasksCount === totalTasksCount) {
            const dataset = await Dataset.findById(datasetId);
            if (dataset) {
              const admins = await UserVera.find({ role: 'admin', deletedAt: null });
              if (admins.length > 0) {
                const adminIds = admins.map(a => a._id);
                await NotificationService.sendToMany(adminIds, {
                  title: "Dataset Ready for Compile",
                  body: `Dataset "${dataset.name}" has reached 100% verification and is ready to be compiled.`,
                  data: { datasetId: dataset._id.toString(), type: "dataset_ready_compile" }
                });
                logger.info(`Notified ${admins.length} admins that dataset ${dataset.name} is ready for compile`);
              }
            }
          }
        } catch (notifyErr) {
          logger.error("Failed to process compile notifications: " + notifyErr.message);
        }
      }

      const labeller = await Labeller.findById(submission.submittedBy);
      if (labeller) {
        const taskReward = await getTaskReward(batch);
        await Labeller.updateOne(
          { _id: labeller._id },
          { 
            $inc: { 
              'earnings.pendingPayment': -taskReward,
              'earnings.currentBalance': taskReward,
              'earnings.totalEarned': taskReward,
              'performance.totalTasksCompleted': 1
            } 
          }
        );
        await labellerService.updateRatingFromTaskReview(labeller.userId, rating);
        
        const promotionEligibility = await labellerService.checkPromotionEligibility(labeller.userId);
        
        let promotionResult = null;
        if (promotionEligibility.isEligible) {
          promotionResult = await labellerService.promoteIfEligible(labeller.userId);
          
          if (promotionResult.promoted) {
            try {
              await mailService.sendLabellerPromotionNotificationToAdmin({
                labellerName: promotionEligibility.labeller.name,
                labellerEmail: promotionEligibility.labeller.email,
                previousTier: promotionEligibility.currentTier,
                newTier: promotionEligibility.nextTier,
                metrics: promotionEligibility.metrics
              });

              await mailService.sendLabellerPromotionEmail(
                promotionEligibility.labeller.name,
                promotionEligibility.labeller.email,
                promotionEligibility.nextTier
              );

              logger.info('Promotion notifications sent successfully', {
                labellerId: labeller._id,
                newTier: promotionEligibility.nextTier
              });
            } catch (mailError) {
              logger.warn('Failed to send promotion notification emails', {
                error: mailError.message,
                labellerId: labeller._id
              });
            }
          }
        }
        
        return {
          taskId: submissionId,
          rating,
          labellerId: labeller._id,
          promotionEligibility,
          promotionResult,
          message: promotionResult?.promoted 
            ? `Submission rated and labeller promoted to ${promotionResult.newTier}!`
            : 'Submission rated successfully'
        };
      }

      return {
        taskId: submissionId,
        rating,
        message: 'Submission rated successfully'
      };
    } catch (err) {
      logger.error(`Service error rating submission: ${err.message}`);
      throw err;
    }
  },


  submitFeedback: async (submissionId, reviewerId, feedback, suggestions, issues) => {
    try {
      const submission = await Submission.findById(submissionId);
      if (!submission) throw new Error('Submission not found');

      submission.humanReview = {
        reviewedBy: reviewerId,
        verdict: submission.humanReview?.verdict || 'needs_revision',
        notes: feedback,
        reviewedAt: new Date()
      };
      await submission.save();

      return { taskId: submissionId, feedbackRecorded: true };
    } catch (err) {
      logger.error(`Service error submitting feedback: ${err.message}`);
      throw err;
    }
  },


  getPendingReviewTasks: async (reviewerId, page = 1, limit = 20) => {
    try {
      const skip = (page - 1) * limit;
      
      const submissions = await Submission.find({ 
        status: 'submitted'
      })
        .populate({
          path: 'taskId',
          populate: { path: 'datasetId', select: 'name labellingMethod contentType' }
        })
        .populate({
          path: 'submittedBy',
          populate: { path: 'userId', select: 'name email' }
        })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await Submission.countDocuments({ 
        status: 'submitted'
      });

      const formattedTasks = submissions.map((sub) => {
        const task = sub.taskId;
        const labeller = sub.submittedBy;
        const contentType = task?.contentType || task?.taskType || 'text';
        return {
          _id: sub._id,
          taskId: task?.taskId || 'N/A',
          taskType: contentType,
          contentType,
          labellingMethod: task?.datasetId?.labellingMethod || 'annotation',
          status: sub.status,
          priority: task?.priority || 0,
          datasetId: task?.datasetId || sub.datasetId,
          assignedTo: labeller ? [
            {
              _id: labeller._id,
              userId: {
                name: labeller.userId?.name,
                email: labeller.userId?.email
              }
            }
          ] : []
        };
      });

      return { tasks: formattedTasks, total, page, pages: Math.ceil(total / limit) };
    } catch (err) {
      logger.error(`Service error fetching pending submissions: ${err.message}`);
      throw err;
    }
  },


  getCompletedReviews: async (reviewerId, page = 1, limit = 20) => {
    try {
      const skip = (page - 1) * limit;
      
      const submissions = await Submission.find({ 
        'humanReview.reviewedBy': reviewerId 
      })
        .populate({
          path: 'taskId',
          populate: { path: 'datasetId', select: 'name labellingMethod contentType' }
        })
        .populate({
          path: 'submittedBy',
          populate: { path: 'userId', select: 'name email' }
        })
        .skip(skip)
        .limit(limit)
        .sort({ 'humanReview.reviewedAt': -1 });

      const total = await Submission.countDocuments({ 'humanReview.reviewedBy': reviewerId });

      const formattedTasks = submissions.map((sub) => {
        const task = sub.taskId;
        const labeller = sub.submittedBy;
        const contentType = task?.contentType || task?.taskType || 'text';
        return {
          _id: sub._id,
          taskId: task?.taskId || 'N/A',
          taskType: contentType,
          contentType,
          labellingMethod: task?.datasetId?.labellingMethod || 'annotation',
          status: sub.status === 'approved' ? 'verified' : sub.status,
          verificationScore: sub.verificationScore || 5,
          reviewedAt: sub.humanReview?.reviewedAt,
          reviewComment: sub.humanReview?.notes,
          rejectionReason: sub.status === 'rejected' ? sub.humanReview?.notes : undefined,
          datasetId: task?.datasetId || sub.datasetId,
          assignedTo: labeller ? [
            {
              _id: labeller._id,
              userId: {
                name: labeller.userId?.name,
                email: labeller.userId?.email
              }
            }
          ] : []
        };
      });

      return { tasks: formattedTasks, total, page, pages: Math.ceil(total / limit) };
    } catch (err) {
      logger.error(`Service error fetching completed reviews: ${err.message}`);
      throw err;
    }
  },


  getReviewerStats: async (reviewerId) => {
    try {
      const totalReviewed = await Submission.countDocuments({ 'humanReview.reviewedBy': reviewerId });
      
      const avgScore = await Submission.aggregate([
        { $match: { 'humanReview.reviewedBy': reviewerId, verificationScore: { $ne: null } } },
        { $group: { _id: null, avgScore: { $avg: '$verificationScore' } } }
      ]);

      const pendingCount = await Submission.countDocuments({ 
        status: 'submitted'
      });

      const approvedCount = await Submission.countDocuments({ 
        'humanReview.reviewedBy': reviewerId,
        status: 'approved'
      });

      const rejectedCount = await Submission.countDocuments({ 
        'humanReview.reviewedBy': reviewerId,
        status: 'rejected'
      });

      const reviewer = await Reviewer.findById(reviewerId).select('earnings').lean();

      return {
        totalReviewed,
        averageScore: avgScore[0]?.avgScore || 0,
        pendingReviews: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        approvalRate: totalReviewed > 0 ? (approvedCount / totalReviewed * 100).toFixed(2) + '%' : '0%',
        earnings: reviewer?.earnings || { total: 0, pending: 0, paid: 0 }
      };
    } catch (err) {
      logger.error(`Service error getting reviewer stats: ${err.message}`);
      throw err;
    }
  },


  getTaskForReview: async (submissionId, reviewerId) => {
    try {
      const submission = await Submission.findById(submissionId)
        .populate({
          path: 'taskId',
          populate: { path: 'datasetId', select: 'name description isCollection' }
        })
        .populate({
          path: 'submittedBy',
          populate: { path: 'userId', select: 'name email' }
        });

      if (!submission) throw new Error('Submission not found');
      if (submission.status !== 'submitted') {
        const error = new Error('Submission is not available for review');
        error.status = 400;
        throw error;
      }

      const task = submission.taskId;
      if (!task) throw new Error('Associated task not found');

      // Check if dataset is a crowdsourced collection
      const isCollection = task.datasetId?.isCollection === true;

      let taskObject = null;
      if (task.r2_input_taskRef) {
        try {
          const dataset = await Dataset.findById(task.datasetId).select("contentType domain").lean();
          const contentType = (task.contentType || normalizeContentType(task, dataset) || 'text').toLowerCase();
          if (['image', 'audio', 'video'].includes(contentType) && !isCollection) {
            try {
              // Verify that the object actually exists in R2 first
              await r2ContentFetcher.getContentMetadata(task.r2_input_taskRef);

              const presignedUrl = await r2ContentFetcher.getPresignedUrl(task.r2_input_taskRef);
              taskObject = { url: presignedUrl };
            } catch (presignError) {
              logger.warn('Could not generate presigned URL or verify media task in R2', { taskId: task._id, error: presignError.message });
              taskObject = { url: null, error: `Media verification failed: ${presignError.message}` };
            }
          } else {
            try {
              const taskBuffer = await r2ContentFetcher.fetchTaskContent(task.r2_input_taskRef);
              taskObject = JSON.parse(taskBuffer.toString('utf-8'));
            } catch (parseError) {
              logger.warn('Could not parse task content as JSON', { taskId: task._id, error: parseError.message });
              taskObject = { url: null, error: `Content fetch failed: ${parseError.message}` };
            }
          }
        } catch (fetchError) {
          logger.warn('Could not fetch task content from R2', { taskId: task._id, error: fetchError.message });
          taskObject = { url: null, error: `Task verification failed: ${fetchError.message}` };
        }
      }

      let submissionObject = null;
      if (submission.r2_output_key) {
        if (isCollection) {
          try {
            const presignedUrl = await r2ContentFetcher.getPresignedUrl(submission.r2_output_key);
            submissionObject = {
              audio: presignedUrl,
              transcription: submission.collectionMetadata?.transcription || null,
              selectedTone: submission.collectionMetadata?.selectedTone || null,
              languageUsed: submission.collectionMetadata?.languageUsed || null,
              codeSwitchingUsed: submission.collectionMetadata?.codeSwitchingUsed || null,
              deviceInfo: submission.collectionMetadata?.deviceInfo || null,
              timezone: submission.collectionMetadata?.timezone || null,
              recordedAt: submission.collectionMetadata?.recordedAt || null
            };
          } catch (presignError) {
            logger.warn('Could not generate presigned URL for collection submission in R2', { submissionId, error: presignError.message });
          }
        } else {
          try {
            const submissionBuffer = await r2ContentFetcher.fetchTaskContent(submission.r2_output_key);
            submissionObject = JSON.parse(submissionBuffer.toString('utf-8'));
          } catch (fetchError) {
            logger.warn('Could not fetch submission content from R2', { taskId: task._id, error: fetchError.message });
          }
        }
      }

      // Query other submissions for the same task for consensus comparison
      const otherSubmissions = await Submission.find({
        taskId: task._id,
        _id: { $ne: submissionId }
      }).populate({
        path: 'submittedBy',
        populate: { path: 'userId', select: 'name email' }
      }).lean();

      const consensusSubmissions = await Promise.all(otherSubmissions.map(async (sub) => {
        let content = null;
        if (sub.r2_output_key) {
          if (isCollection) {
            try {
              const presignedUrl = await r2ContentFetcher.getPresignedUrl(sub.r2_output_key);
              content = {
                audio: presignedUrl,
                transcription: sub.collectionMetadata?.transcription || null,
                selectedTone: sub.collectionMetadata?.selectedTone || null,
                languageUsed: sub.collectionMetadata?.languageUsed || null,
                codeSwitchingUsed: sub.collectionMetadata?.codeSwitchingUsed || null,
                deviceInfo: sub.collectionMetadata?.deviceInfo || null,
                timezone: sub.collectionMetadata?.timezone || null,
                recordedAt: sub.collectionMetadata?.recordedAt || null
              };
            } catch (presignError) {
              logger.warn('Failed to generate presigned URL for other collection submission', { submissionId: sub._id });
            }
          } else {
            try {
              const buffer = await r2ContentFetcher.fetchTaskContent(sub.r2_output_key);
              content = JSON.parse(buffer.toString('utf-8'));
            } catch (err) {
              logger.warn('Failed to fetch other submission content', { submissionId: sub._id });
            }
          }
        }
        return {
          _id: sub._id,
          submittedBy: {
            name: sub.submittedBy?.userId?.name || 'Unknown',
            email: sub.submittedBy?.userId?.email || 'N/A'
          },
          status: sub.status,
          content
        };
      }));

      const labeller = submission.submittedBy;

      const formattedTask = {
        _id: submission._id,
        taskId: task.taskId,
        taskType: task.taskType,
        status: submission.status,
        priority: task.priority,
        datasetId: task.datasetId,
        isCollection: isCollection,
        assignedTo: labeller ? [
          {
            _id: labeller._id,
            userId: {
              _id: labeller.userId?._id,
              name: labeller.userId?.name,
              email: labeller.userId?.email,
              avgRating: labeller.averageRating
            }
          }
        ] : []
      };

      return {
        task: formattedTask,
        taskObject,
        submissionObject,
        otherSubmissions: consensusSubmissions
      };
    } catch (err) {
      logger.error(`Service error getting submission for review: ${err.message}`);
      throw err;
    }
  },


  approveSubmission: async (submissionId, reviewerId, comment = '') => {
    try {
      const submission = await Submission.findById(submissionId);
      if (!submission) throw new Error('Submission not found');

      submission.status = 'approved';
      submission.verificationScore = 5;
      submission.humanReview = {
        reviewedBy: reviewerId,
        verdict: 'approved',
        notes: comment,
        reviewedAt: new Date()
      };
      await submission.save();

      await updateReviewerMetrics(reviewerId, 5, true, submissionId);

      const batch = submission.batchId ? await Batch.findById(submission.batchId) : null;
      const reviewReward = await getReviewerReward(batch);
      await Reviewer.updateOne(
        { _id: reviewerId },
        { $inc: { 'earnings.pending': reviewReward, 'earnings.total': reviewReward } }
      );

      const task = await Task.findById(submission.taskId);
      if (task) {
        task.status = 'verified';
        task.isVerified = true;
        task.verifiedBy = reviewerId;
        task.r2_task_resultRef = submission.r2_output_key;
        task.verificationScore = 5;
        task.reviewedAt = new Date();
        task.reviewComment = comment;
        await task.save();
      }

      const labeller = await Labeller.findById(submission.submittedBy);
      if (labeller) {
        const taskReward = await getTaskReward(batch);
        await Labeller.updateOne(
          { _id: labeller._id },
          { 
            $inc: { 
              'earnings.pendingPayment': -taskReward,
              'earnings.currentBalance': taskReward,
              'earnings.totalEarned': taskReward,
              'performance.totalTasksCompleted': 1
            } 
          }
        );
        await labellerService.updateRatingFromTaskReview(labeller.userId, 5);
      }

      return { taskId: submissionId, status: 'approved', verificationScore: 5 };
    } catch (err) {
      logger.error(`Service error approving submission: ${err.message}`);
      throw err;
    }
  },


  rejectSubmission: async (submissionId, reviewerId, reason, suggestions = []) => {
    try {
      const submission = await Submission.findById(submissionId);
      if (!submission) throw new Error('Submission not found');

      submission.status = 'rejected';
      submission.verificationScore = 1;
      submission.humanReview = {
        reviewedBy: reviewerId,
        verdict: 'rejected',
        notes: reason,
        reviewedAt: new Date()
      };
      await submission.save();

      await updateReviewerMetrics(reviewerId, 1, false, submissionId);

      const batch = submission.batchId ? await Batch.findById(submission.batchId) : null;
      const reviewReward = await getReviewerReward(batch);
      await Reviewer.updateOne(
        { _id: reviewerId },
        { $inc: { 'earnings.pending': reviewReward, 'earnings.total': reviewReward } }
      );

      const labeller = await Labeller.findById(submission.submittedBy);
      if (labeller) {
        const taskReward = await getTaskReward(batch);
        await Labeller.updateOne(
          { _id: labeller._id },
          {
            $inc: { 
              'performance.totalTasksRejected': 1,
              'earnings.pendingPayment': -taskReward
            }
          }
        );
        await labellerService.updateRatingFromTaskReview(labeller.userId, 1);
      }

      const task = await Task.findById(submission.taskId);
      if (task) {
        task.status = 'rejected';
        task.isVerified = false;
        task.verifiedBy = null;
        task.rejectionReason = reason;
        await task.save();

        await taskService.returnTaskToPool(task._id.toString());
      }

      return { taskId: submissionId, status: 'rejected', reason };
    } catch (err) {
      logger.error(`Service error rejecting submission: ${err.message}`);
      throw err;
    }
  },

  requestPayout: async (reviewerId, amount, method) => {
    try {
      const reviewer = await Reviewer.findById(reviewerId);
      if (!reviewer) throw new Error('Reviewer profile not found');

      const available = reviewer.earnings?.pending || 0;
      if (available < amount) {
        throw new Error(`Insufficient funds. Available: $${available.toFixed(2)}, Requested: $${amount.toFixed(2)}`);
      }

      reviewer.earnings.pending = Number((available - amount).toFixed(2));
      reviewer.earnings.paid = Number(((reviewer.earnings.paid || 0) + amount).toFixed(2));
      await reviewer.save();

      const payout = await Payout.create({
        recipientUserId: reviewer.reviewerUserId,
        provider: 'paystack',
        amount: amount,
        currency: 'USD',
        method: method?.toLowerCase() === 'm-pesa' || method?.toLowerCase() === 'mpesa' || method?.toLowerCase() === 'mobile_money' ? 'mobile_money' : 'bank_transfer',
        destination: {
          mobileNetwork: 'MPESA',
          phoneNumber: ''
        },
        status: 'paid',
        processedAt: new Date()
      });

      return {
        success: true,
        earnings: reviewer.earnings,
        payout
      };
    } catch (err) {
      logger.error(`Service error requesting reviewer payout: ${err.message}`);
      throw err;
    }
  }
};
