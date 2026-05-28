import Task from '../tasks/task.model.js';
import UserVera from '../users/user.model.js';
import Dataset from '../datasets/dataset.model.js';
import Submission from '../tasks/task.submission.model.js';
import logger from '../../config/logger.js';
import mongoose from 'mongoose';
import Labeller from '../labeller/labeller.model.js';

export const reviewerAnalyticsService = {
  getOverview: async (reviewerId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalReviewed,
      todayReviewed,
      pending,
      approvedCount,
      rejectedCount,
      avgScoreResult,
      avgTurnaroundMs
    ] = await Promise.all([
      Submission.countDocuments({ 'humanReview.reviewedBy': reviewerId }),
      Submission.countDocuments({ 'humanReview.reviewedBy': reviewerId, 'humanReview.reviewedAt': { $gte: today } }),
      Submission.countDocuments({ status: 'submitted' }),
      Submission.countDocuments({ 'humanReview.reviewedBy': reviewerId, status: 'approved' }),
      Submission.countDocuments({ 'humanReview.reviewedBy': reviewerId, status: 'rejected' }),
      Submission.aggregate([
        { $match: { 'humanReview.reviewedBy': new mongoose.Types.ObjectId(reviewerId), verificationScore: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$verificationScore' } } }
      ]),
      Submission.aggregate([
        { $match: { 'humanReview.reviewedBy': new mongoose.Types.ObjectId(reviewerId), 'humanReview.reviewedAt': { $exists: true } } },
        {
          $group: {
            _id: null,
            avgTime: {
              $avg: { $subtract: ['$humanReview.reviewedAt', '$createdAt'] }
            }
          }
        }
      ])
    ]);

    const avgScore = avgScoreResult[0]?.avg || 0;
    const approvalRate = totalReviewed > 0 
      ? ((approvedCount / totalReviewed) * 100).toFixed(2)
      : 0;
    const avgTurnaround = avgTurnaroundMs[0]?.avgTime 
      ? Math.round(avgTurnaroundMs[0].avgTime / (1000 * 60)) // minutes
      : 0;

    return {
      totalReviewed,
      todayReviewed,
      pendingTasks: pending,
      avgQualityScore: parseFloat(avgScore.toFixed(2)),
      approvalRate: parseFloat(approvalRate),
      rejectionRate: (100 - parseFloat(approvalRate)).toFixed(2),
      approvedCount,
      rejectedCount,
      avgTurnaroundMinutes: avgTurnaround
    };
  },

  getLabellerPerformance: async (page = 1, limit = 20, sortBy = 'avgRating') => {
    const skip = (page - 1) * limit;
    
    const [labellers, totalDocs] = await Promise.all([
      Submission.aggregate([
        { $match: { submittedBy: { $exists: true } } },
        {
          $group: {
            _id: '$submittedBy',
            totalTasks: { $sum: 1 },
            avgScore: { $avg: '$verificationScore' },
            approvedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
            },
            rejectedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
            }
          }
        },
        { $sort: { [sortBy === 'avgRating' ? 'avgScore' : 'totalTasks']: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'labellers',
            localField: '_id',
            foreignField: '_id',
            as: 'labellerDoc'
          }
        },
        { $unwind: { path: '$labellerDoc', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'userveras',
            localField: 'labellerDoc.userId',
            foreignField: '_id',
            as: 'labellerInfo'
          }
        }
      ]),
      Submission.distinct('submittedBy', { submittedBy: { $exists: true } })
    ]);

    const total = totalDocs;

    return {
      labellers: labellers.map(l => ({
        labellerID: l._id,
        name: l.labellerInfo[0]?.name || 'Unknown',
        email: l.labellerInfo[0]?.email || 'N/A',
        totalTasks: l.totalTasks,
        avgScore: parseFloat(l.avgScore?.toFixed(2)) || 0,
        approvalRate: l.totalTasks > 0 ? ((l.approvedCount / l.totalTasks) * 100).toFixed(2) : 0,
        approvedCount: l.approvedCount,
        rejectedCount: l.rejectedCount
      })),
      page,
      total: total.length,
      pages: Math.ceil(total.length / limit)
    };
  },

  getLabellerDetail: async (labellerID) => {
    const labellerDoc = await Labeller.findById(labellerID).populate('userId');
    if (!labellerDoc) throw new Error('Labeller not found');
    const labellerUser = labellerDoc.userId;

    const [stats, recentTasks] = await Promise.all([
      Submission.aggregate([
        { $match: { submittedBy: new mongoose.Types.ObjectId(labellerID) } },
        {
          $group: {
            _id: null,
            totalTasks: { $sum: 1 },
            avgScore: { $avg: '$verificationScore' },
            inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
            submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
            verified: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
          }
        }
      ]),
      Submission.find({ submittedBy: labellerID })
        .populate('taskId', 'taskName')
        .sort({ 'humanReview.reviewedAt': -1 })
        .limit(10)
        .lean()
    ]);

    const mappedTasks = recentTasks.map(sub => ({
      _id: sub._id,
      taskName: sub.taskId?.taskName || 'N/A',
      status: sub.status === 'approved' ? 'verified' : sub.status,
      verificationScore: sub.verificationScore,
      rejectionReason: sub.status === 'rejected' ? sub.humanReview?.notes : undefined,
      reviewedAt: sub.humanReview?.reviewedAt
    }));

    return {
      labellerID,
      name: labellerUser?.name || 'Unknown',
      email: labellerUser?.email || 'N/A',
      joinedDate: labellerDoc.createdAt,
      stats: stats[0] || {},
      recentTasks: mappedTasks
    };
  },

  getTopPerformers: async (limit = 10) => {
    const toppers = await Submission.aggregate([
      { $match: { submittedBy: { $exists: true }, verificationScore: { $ne: null } } },
      {
        $group: {
          _id: '$submittedBy',
          avgScore: { $avg: '$verificationScore' },
          totalReviewed: { $sum: 1 }
        }
      },
      { $match: { totalReviewed: { $gte: 5 } } },
      { $sort: { avgScore: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'labellers',
          localField: '_id',
          foreignField: '_id',
          as: 'labellerDoc'
        }
      },
      { $unwind: { path: '$labellerDoc', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'userveras',
          localField: 'labellerDoc.userId',
          foreignField: '_id',
          as: 'info'
        }
      }
    ]);

    return toppers.map(t => ({
      rank: toppers.indexOf(t) + 1,
      labellerID: t._id,
      name: t.info[0]?.name,
      avgScore: parseFloat(t.avgScore.toFixed(2)),
      totalReviewed: t.totalReviewed
    }));
  },

  getUnderperformers: async (limit = 10) => {
    const underperformers = await Submission.aggregate([
      { $match: { submittedBy: { $exists: true }, verificationScore: { $ne: null } } },
      {
        $group: {
          _id: '$submittedBy',
          avgScore: { $avg: '$verificationScore' },
          totalReviewed: { $sum: 1 },
          rejectionRate: {
            $avg: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          }
        }
      },
      { $match: { totalReviewed: { $gte: 5 } } },
      { $sort: { avgScore: 1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'labellers',
          localField: '_id',
          foreignField: '_id',
          as: 'labellerDoc'
        }
      },
      { $unwind: { path: '$labellerDoc', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'userveras',
          localField: 'labellerDoc.userId',
          foreignField: '_id',
          as: 'info'
        }
      }
    ]);

    return underperformers.map(u => ({
      labellerID: u._id,
      name: u.info[0]?.name,
      avgScore: parseFloat(u.avgScore.toFixed(2)),
      rejectionRate: (u.rejectionRate * 100).toFixed(2),
      totalReviewed: u.totalReviewed,
      needsAttention: u.avgScore < 3
    }));
  },

  getQualityScoreDistribution: async (days = 30) => {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const distribution = await Submission.aggregate([
      { $match: { 'humanReview.reviewedAt': { $gte: fromDate }, verificationScore: { $ne: null } } },
      {
        $bucket: {
          groupBy: '$verificationScore',
          boundaries: [0, 1, 2, 3, 4, 5, 6],
          default: 'unscored',
          output: { count: { $sum: 1 } }
        }
      }
    ]);

    const scoreLabels = {
      0: 'No Score',
      1: '1 Star',
      2: '2 Stars',
      3: '3 Stars',
      4: '4 Stars',
      5: '5 Stars'
    };

    const totalCount = distribution.reduce((s, x) => s + x.count, 0);

    return {
      period: `Last ${days} days`,
      distribution: distribution.map(d => ({
        score: scoreLabels[d._id] || d._id,
        count: d.count,
        percentage: totalCount > 0 ? ((d.count / totalCount) * 100).toFixed(2) : 0
      }))
    };
  },

  getRejectionReasonAnalysis: async (days = 30) => {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const reasons = await Submission.aggregate([
      { $match: { 'humanReview.reviewedAt': { $gte: fromDate }, status: 'rejected' } },
      {
        $group: {
          _id: '$humanReview.notes',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const total = reasons.reduce((sum, r) => sum + r.count, 0);

    return {
      period: `Last ${days} days`,
      topReasons: reasons.slice(0, 10).map(r => ({
        reason: r._id || 'Not specified',
        count: r.count,
        percentage: total > 0 ? ((r.count / total) * 100).toFixed(2) : 0
      })),
      totalRejections: total
    };
  },

  getQualityTrend: async (days = 60) => {
    const trend = await Submission.aggregate([
      {
        $match: {
          'humanReview.reviewedAt': { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
          verificationScore: { $ne: null }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$humanReview.reviewedAt' }
          },
          avgScore: { $avg: '$verificationScore' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return {
      period: `Last ${days} days`,
      trend: trend.map(t => ({
        date: t._id,
        avgScore: parseFloat(t.avgScore.toFixed(2)),
        reviewedCount: t.count
      }))
    };
  },

  getQualityByTaskType: async () => {
    const byType = await Submission.aggregate([
      { $match: { verificationScore: { $ne: null } } },
      {
        $lookup: {
          from: 'tasks',
          localField: 'taskId',
          foreignField: '_id',
          as: 'taskInfo'
        }
      },
      { $unwind: '$taskInfo' },
      {
        $group: {
          _id: '$taskInfo.taskType',
          avgScore: { $avg: '$verificationScore' },
          totalTasks: { $sum: 1 },
          approvedCount: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } }
        }
      },
      { $sort: { totalTasks: -1 } }
    ]);

    return byType.map(b => ({
      taskType: b._id || 'unknown',
      avgScore: parseFloat(b.avgScore.toFixed(2)),
      totalTasks: b.totalTasks,
      approvalRate: b.totalTasks > 0 ? ((b.approvedCount / b.totalTasks) * 100).toFixed(2) : 0
    }));
  },

  getStatusDistribution: async () => {
    const distribution = await Submission.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = distribution.reduce((sum, d) => sum + d.count, 0);

    return distribution.map(d => ({
      status: d._id,
      count: d.count,
      percentage: total > 0 ? ((d.count / total) * 100).toFixed(2) : 0
    }));
  },

  getWorkloadByDataset: async (page = 1, limit = 20) => {
    const skip = (page - 1) * limit;

    const [byDataset, totalDocs] = await Promise.all([
      Submission.aggregate([
        {
          $group: {
            _id: '$datasetId',
            totalTasks: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
            inProgress: { $sum: { $cond: [{ $eq: ['$status', 'under_review'] }, 1, 0] } },
            submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
            verified: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
          }
        },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'datasets',
            localField: '_id',
            foreignField: '_id',
            as: 'datasetInfo'
          }
        }
      ]),
      Submission.distinct('datasetId')
    ]);

    const total = totalDocs;

    return {
      datasets: byDataset.map(d => ({
        datasetID: d._id,
        datasetName: d.datasetInfo[0]?.name || 'Unknown',
        totalTasks: d.totalTasks,
        statusBreakdown: {
          pending: d.pending,
          inProgress: d.inProgress,
          submitted: d.submitted,
          verified: d.verified,
          rejected: d.rejected
        },
        completionRate: d.totalTasks > 0 ? ((d.verified / d.totalTasks) * 100).toFixed(2) : 0
      })),
      page,
      total: total.length,
      pages: Math.ceil(total.length / limit)
    };
  },

  getWorkloadByTaskType: async () => {
    const byType = await Submission.aggregate([
      {
        $lookup: {
          from: 'tasks',
          localField: 'taskId',
          foreignField: '_id',
          as: 'taskInfo'
        }
      },
      { $unwind: '$taskInfo' },
      {
        $group: {
          _id: '$taskInfo.taskType',
          totalTasks: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
          submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
          verified: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } }
        }
      }
    ]);

    return byType.map(b => ({
      taskType: b._id || 'unknown',
      totalTasks: b.totalTasks,
      pending: b.pending,
      submitted: b.submitted,
      verified: b.verified,
      completionRate: b.totalTasks > 0 ? ((b.verified / b.totalTasks) * 100).toFixed(2) : 0
    }));
  },

  getTurnaroundTimeAnalysis: async () => {
    const analysis = await Submission.aggregate([
      { $match: { createdAt: { $exists: true }, 'humanReview.reviewedAt': { $exists: true } } },
      {
        $group: {
          _id: null,
          avgTurnaroundMs: {
            $avg: { $subtract: ['$humanReview.reviewedAt', '$createdAt'] }
          },
          minTurnaroundMs: {
            $min: { $subtract: ['$humanReview.reviewedAt', '$createdAt'] }
          },
          maxTurnaroundMs: {
            $max: { $subtract: ['$humanReview.reviewedAt', '$createdAt'] }
          }
        }
      }
    ]);

    const data = analysis[0] || {};
    const avgMinutes = Math.round((data.avgTurnaroundMs || 0) / (1000 * 60));
    const minMinutes = Math.round((data.minTurnaroundMs || 0) / (1000 * 60));
    const maxMinutes = Math.round((data.maxTurnaroundMs || 0) / (1000 * 60));

    return {
      averageTurnaroundMinutes: avgMinutes,
      fastestReviewMinutes: minMinutes,
      slowestReviewMinutes: maxMinutes
    };
  },

  getDailyProductivity: async (reviewerId, days = 30) => {
    const productivity = await Submission.aggregate([
      {
        $match: {
          'humanReview.reviewedBy': new mongoose.Types.ObjectId(reviewerId),
          'humanReview.reviewedAt': { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$humanReview.reviewedAt' } },
          tasksReviewed: { $sum: 1 },
          avgScore: { $avg: '$verificationScore' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return {
      period: `Last ${days} days`,
      daily: productivity.map(p => ({
        date: p._id,
        tasksReviewed: p.tasksReviewed,
        avgScore: parseFloat(p.avgScore?.toFixed(2)) || 0
      }))
    };
  },

  getWeeklyProductivity: async (reviewerId, weeks = 12) => {
    const productivity = await Submission.aggregate([
      {
        $match: {
          'humanReview.reviewedBy': new mongoose.Types.ObjectId(reviewerId),
          'humanReview.reviewedAt': { $gte: new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$humanReview.reviewedAt' },
            week: { $week: '$humanReview.reviewedAt' }
          },
          tasksReviewed: { $sum: 1 },
          avgScore: { $avg: '$verificationScore' }
        }
      },
      { $sort: { '_id.year': 1, '_id.week': 1 } }
    ]);

    return {
      period: `Last ${weeks} weeks`,
      weekly: productivity.map(p => ({
        year: p._id.year,
        week: p._id.week,
        tasksReviewed: p.tasksReviewed,
        avgScore: parseFloat(p.avgScore?.toFixed(2)) || 0
      }))
    };
  },

  getMonthlyProductivity: async (reviewerId, months = 12) => {
    const productivity = await Submission.aggregate([
      {
        $match: {
          'humanReview.reviewedBy': new mongoose.Types.ObjectId(reviewerId),
          'humanReview.reviewedAt': { $gte: new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$humanReview.reviewedAt' },
            month: { $month: '$humanReview.reviewedAt' }
          },
          tasksReviewed: { $sum: 1 },
          avgScore: { $avg: '$verificationScore' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    return {
      period: `Last ${months} months`,
      monthly: productivity.map(p => ({
        year: p._id.year,
        month: p._id.month,
        tasksReviewed: p.tasksReviewed,
        avgScore: parseFloat(p.avgScore?.toFixed(2)) || 0
      }))
    };
  },

  getPeakReviewTimes: async (reviewerId) => {
    const peaks = await Submission.aggregate([
      {
        $match: { 'humanReview.reviewedBy': new mongoose.Types.ObjectId(reviewerId), 'humanReview.reviewedAt': { $exists: true } }
      },
      {
        $group: {
          _id: { $hour: '$humanReview.reviewedAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return {
      peakHours: peaks.map(p => ({
        hour: p._id,
        tasksReviewed: p.count
      }))
    };
  },

  getReviewerComparison: async (reviewerId) => {
    const allReviewers = await Submission.aggregate([
      { $match: { 'humanReview.reviewedBy': { $exists: true } } },
      {
        $group: {
          _id: '$humanReview.reviewedBy',
          totalReviewed: { $sum: 1 },
          avgScore: { $avg: '$verificationScore' },
          approvedCount: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'reviewers',
          localField: '_id',
          foreignField: '_id',
          as: 'reviewerDoc'
        }
      },
      { $unwind: { path: '$reviewerDoc', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'userveras',
          localField: 'reviewerDoc.reviewerUserId',
          foreignField: '_id',
          as: 'info'
        }
      }
    ]);

    const currentReviewer = allReviewers.find(r => r._id.toString() === reviewerId.toString());

    return {
      currentReviewer: {
        totalReviewed: currentReviewer?.totalReviewed || 0,
        avgScore: parseFloat(currentReviewer?.avgScore?.toFixed(2)) || 0,
        approvalRate: currentReviewer && currentReviewer.totalReviewed > 0
          ? ((currentReviewer.approvedCount / currentReviewer.totalReviewed) * 100).toFixed(2)
          : 0
      },
      teamBenchmarks: {
        avgTeamScore: allReviewers.length > 0 ? (allReviewers.reduce((s, r) => s + r.avgScore, 0) / allReviewers.length).toFixed(2) : 0,
        avgTeamApprovalRate: allReviewers.length > 0 ? (allReviewers.reduce((s, r) => s + r.approvedCount / r.totalReviewed, 0) / allReviewers.length * 100).toFixed(2) : 0,
        topReviewer: allReviewers[0]?.info[0]?.name || 'N/A'
      }
    };
  },

  getLabellerConsistency: async (limit = 15) => {
    const consistency = await Submission.aggregate([
      { $match: { submittedBy: { $exists: true }, verificationScore: { $ne: null } } },
      {
        $group: {
          _id: '$submittedBy',
          avgScore: { $avg: '$verificationScore' },
          stdDev: { $stdDevPop: '$verificationScore' },
          totalTasks: { $sum: 1 }
        }
      },
      { $sort: { stdDev: 1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'labellers',
          localField: '_id',
          foreignField: '_id',
          as: 'labellerDoc'
        }
      },
      { $unwind: { path: '$labellerDoc', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'userveras',
          localField: 'labellerDoc.userId',
          foreignField: '_id',
          as: 'info'
        }
      }
    ]);

    return consistency.map(c => ({
      labellerID: c._id,
      name: c.info[0]?.name || 'Unknown',
      avgScore: parseFloat(c.avgScore.toFixed(2)),
      consistency: c.stdDev ? parseFloat(c.stdDev.toFixed(2)) : 0,
      totalTasks: c.totalTasks,
      consistencyRating: c.stdDev < 0.5 ? 'Very High' : c.stdDev < 1 ? 'High' : 'Moderate'
    }));
  },

  getDatasetQualityScore: async () => {
    const scores = await Submission.aggregate([
      { $match: { verificationScore: { $ne: null } } },
      {
        $group: {
          _id: '$datasetId',
          avgScore: { $avg: '$verificationScore' },
          totalTasks: { $sum: 1 },
          rejectionCount: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
        }
      },
      { $sort: { avgScore: -1 } },
      {
        $lookup: {
          from: 'datasets',
          localField: '_id',
          foreignField: '_id',
          as: 'info'
        }
      }
    ]);

    return scores.map(s => ({
      datasetID: s._id,
      datasetName: s.info[0]?.name || 'Unknown',
      avgQualityScore: parseFloat(s.avgScore.toFixed(2)),
      totalTasks: s.totalTasks,
      rejectionRate: s.totalTasks > 0 ? ((s.rejectionCount / s.totalTasks) * 100).toFixed(2) : 0,
      quality: s.avgScore >= 4.5 ? 'Excellent' : s.avgScore >= 3.5 ? 'Good' : 'Needs Improvement'
    }));
  },

  getDatasetBreakdown: async (datasetId) => {
    const breakdown = await Submission.aggregate([
      { $match: { datasetId: new mongoose.Types.ObjectId(datasetId) } },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalTasks: { $sum: 1 },
                avgScore: { $avg: '$verificationScore' },
                pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
                submittedCount: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
                verifiedCount: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
                rejectedCount: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
              }
            }
          ],
          byType: [
            {
              $lookup: {
                from: 'tasks',
                localField: 'taskId',
                foreignField: '_id',
                as: 'taskInfo'
              }
            },
            { $unwind: '$taskInfo' },
            {
              $group: {
                _id: '$taskInfo.taskType',
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]);

    const overview = breakdown[0].overview[0] || {};
    const byType = breakdown[0].byType || [];

    return {
      datasetID: datasetId,
      overview: {
        totalTasks: overview.totalTasks || 0,
        avgQualityScore: parseFloat(overview.avgScore?.toFixed(2)) || 0,
        statusBreakdown: {
          pending: overview.pendingCount || 0,
          submitted: overview.submittedCount || 0,
          verified: overview.verifiedCount || 0,
          rejected: overview.rejectedCount || 0
        },
        completionRate: overview.totalTasks > 0 ? ((overview.verifiedCount / overview.totalTasks) * 100).toFixed(2) : 0
      },
      byTaskType: byType.map(b => ({
        taskType: b._id,
        count: b.count
      }))
    };
  }
};
