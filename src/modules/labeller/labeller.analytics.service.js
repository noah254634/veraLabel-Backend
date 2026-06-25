import Labeller from './labeller.model.js';
import UserVera from '../users/user.model.js';

export const labellerAnalyticsService = {
  getTotalLabellersCount: async () => {
    // Check both specialized profiles and core users to ensure accurate dashboard counts
    const [profileCount, userCount] = await Promise.all([
      Labeller.countDocuments(),
      UserVera.countDocuments({ role: 'labeler' })
    ]);
    return Math.max(profileCount, userCount);
  },

  getActiveLabellerCount: async () => {
    // A labeller is 'active' if their profile is active OR if they are a verified labeler user
    const [activeProfiles, activeUsers] = await Promise.all([
      Labeller.countDocuments({ status: 'active' }),
      UserVera.countDocuments({ role: 'labeler', isActive: true })
    ]);
    return Math.max(activeProfiles, activeUsers);
  },

  getLabellersByStatus: async () => {
    const profileStatuses = await Labeller.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const userStatuses = await UserVera.aggregate([
      { $match: { role: 'labeler' } },
      { $group: { _id: { $cond: ["$isActive", "active", "inactive"] }, count: { $sum: 1 } } }
    ]);

    // Merge logic: Take the max for each status to avoid double counting but catch orphans
    const statusMap = {};
    [...profileStatuses, ...userStatuses].forEach(s => {
      const status = s._id || 'unknown';
      statusMap[status] = Math.max(statusMap[status] || 0, s.count);
    });

    const finalStatuses = Object.entries(statusMap).map(([status, count]) => ({
      status,
      count
    }));

    const total = finalStatuses.reduce((sum, s) => sum + s.count, 0);

    return finalStatuses.map(s => ({
      status: s.status,
      count: s.count,
      percentage: total > 0 ? ((s.count / total) * 100).toFixed(2) : "0.00"
    }));
  },

  getAveragePerformanceMetrics: async () => {
    const metrics = await Labeller.aggregate([
      {
        $match: { status: 'active' }
      },
      {
        $group: {
          _id: null,
          avgQualityScore: { $avg: '$performance.averageQualityScore' },
          avgCompletionRate: { $avg: '$performance.completionRate' },
          avgApprovalRate: { $avg: '$performance.approvalRate' },
          avgReliabilityScore: { $avg: '$performance.reliabilityScore' },
          avgEarnings: { $avg: '$earnings.totalEarned' }
        }
      }
    ]);

    return metrics[0] || {};
  },

  getPerformanceDistribution: async () => {
    const distribution = await Labeller.aggregate([
      {
        $match: { status: 'active' }
      },
      {
        $bucket: {
          groupBy: '$performance.averageQualityScore',
          boundaries: [0, 1, 2, 3, 4, 5],
          default: 'unscored',
          output: { count: { $sum: 1 } }
        }
      }
    ]);

    const scoreLabels = {
      0: 'Poor (0-1)',
      1: 'Fair (1-2)',
      2: 'Good (2-3)',
      3: 'Very Good (3-4)',
      4: 'Excellent (4-5)'
    };

    const total = distribution.reduce((s, d) => s + d.count, 0);

    return distribution.map(d => ({
      scoreRange: scoreLabels[d._id] || d._id,
      count: d.count,
      percentage: ((d.count / total) * 100).toFixed(2)
    }));
  },

  getLabellersByTierWithStats: async () => {
    const byTier = await Labeller.aggregate([
      {
        $match: { status: 'active' }
      },
      {
        $group: {
          _id: '$tier',
          count: { $sum: 1 },
          avgQualityScore: { $avg: '$performance.averageQualityScore' },
          avgReliabilityScore: { $avg: '$performance.reliabilityScore' },
          totalTasksCompleted: { $sum: '$performance.totalTasksCompleted' },
          totalEarnings: { $sum: '$earnings.totalEarned' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    return byTier.map(t => ({
      tier: t._id,
      count: t.count,
      avgQualityScore: parseFloat(t.avgQualityScore?.toFixed(2)) || 0,
      avgReliabilityScore: parseFloat(t.avgReliabilityScore?.toFixed(2)) || 0,
      totalTasksCompleted: t.totalTasksCompleted,
      totalEarnings: t.totalEarnings,
      avgEarningsPerLabeller: (t.totalEarnings / t.count).toFixed(2)
    }));
  },

  getTierPromotionTrend: async (days = 30) => {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const promotions = await Labeller.aggregate([
      {
        $match: {
          'training.completedTiers': { $exists: true, $ne: [] },
          updatedAt: { $gte: fromDate }
        }
      },
      {
        $unwind: '$training.completedTiers'
      },
      {
        $group: {
          _id: '$training.completedTiers',
          count: { $sum: 1 }
        }
      }
    ]);

    return promotions.map(p => ({
      tier: p._id,
      promotionCount: p.count
    }));
  },

  getTotalEarningsPaid: async () => {
    const totals = await Labeller.aggregate([
      {
        $group: {
          _id: null,
          totalEarned: { $sum: '$earnings.totalEarned' },
          totalPaid: { $sum: '$earnings.totalPayouts' },
          totalPending: { $sum: '$earnings.pendingPayment' },
          totalLabellers: { $sum: 1 }
        }
      }
    ]);

    return totals[0] || {};
  },

  getEarningsDistribution: async () => {
    const distribution = await Labeller.aggregate([
      {
        $bucket: {
          groupBy: '$earnings.totalEarned',
          boundaries: [0, 100, 500, 1000, 5000, 10000],
          default: '10000+',
          output: { count: { $sum: 1 } }
        }
      }
    ]);

    const rangeLabels = {
      0: '$0-$100',
      100: '$100-$500',
      500: '$500-$1000',
      1000: '$1000-$5000',
      5000: '$5000-$10000'
    };

    const total = distribution.reduce((s, d) => s + d.count, 0);

    return distribution.map(d => ({
      earningsRange: rangeLabels[d._id] || d._id,
      count: d.count,
      percentage: ((d.count / total) * 100).toFixed(2)
    }));
  },

  getTopEarners: async (limit = 10) => {
    const earners = await Labeller.find({ status: 'active' })
      .sort({ 'earnings.totalEarned': -1 })
      .limit(limit)
      .populate('userId', 'name email')
      .select('userId tier earnings performance')
      .lean();

    return earners.map((e, idx) => ({
      rank: idx + 1,
      labellerName: e.userId?.name || 'Unknown Labeller',
      tier: e.tier,
      totalEarned: e.earnings?.totalEarned || 0,
      tasksCompleted: e.performance?.totalTasksCompleted || 0,
      avgQualityScore: e.performance?.averageQualityScore || 0
    }));
  },

  getActivityMetrics: async () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [active7d, active30d, inactive] = await Promise.all([
      Labeller.countDocuments({
        status: 'active',
        'activityMetrics.lastActiveAt': { $gte: sevenDaysAgo }
      }),
      Labeller.countDocuments({
        status: 'active',
        'activityMetrics.lastActiveAt': { $gte: thirtyDaysAgo }
      }),
      Labeller.countDocuments({
        status: 'active',
        'activityMetrics.lastActiveAt': { $lt: thirtyDaysAgo }
      })
    ]);

    const total = await Labeller.countDocuments({ status: 'active' });

    return {
      activeLast7Days: active7d,
      activeLast30Days: active30d,
      inactive30Plus: inactive,
      totalActive: total,
      activityRate7d: ((active7d / total) * 100).toFixed(2),
      activityRate30d: ((active30d / total) * 100).toFixed(2)
    };
  },

  getTaskCompletionStats: async () => {
    const stats = await Labeller.aggregate([
      {
        $match: { status: 'active' }
      },
      {
        $group: {
          _id: null,
          totalTasksAssigned: { $sum: '$performance.totalTasksAssigned' },
          totalTasksCompleted: { $sum: '$performance.totalTasksCompleted' },
          totalTasksRejected: { $sum: '$performance.totalTasksRejected' }
        }
      }
    ]);

    const data = stats[0] || {};
    const completionRate = data.totalTasksAssigned > 0 
      ? ((data.totalTasksCompleted / data.totalTasksAssigned) * 100).toFixed(2)
      : 0;

    return {
      totalAssigned: data.totalTasksAssigned,
      totalCompleted: data.totalTasksCompleted,
      totalRejected: data.totalTasksRejected,
      completionRate: parseFloat(completionRate),
      rejectionRate: data.totalTasksAssigned > 0
        ? ((data.totalTasksRejected / data.totalTasksAssigned) * 100).toFixed(2)
        : 0
    };
  },

  getAverageRating: async () => {
    const ratings = await Labeller.aggregate([
      {
        $match: { averageRating: { $gt: 0 } }
      },
      {
        $group: {
          _id: null,
          overallAvgRating: { $avg: '$averageRating' },
          ratedLabellers: { $sum: 1 }
        }
      }
    ]);

    return ratings[0] || { overallAvgRating: 0, ratedLabellers: 0 };
  },

  getRatingDistribution: async () => {
    const distribution = await Labeller.aggregate([
      {
        $bucket: {
          groupBy: '$averageRating',
          boundaries: [0, 1, 2, 3, 4, 5],
          default: 'unrated',
          output: { count: { $sum: 1 } }
        }
      }
    ]);

    const ratingLabels = {
      0: '0-1 stars',
      1: '1-2 stars',
      2: '2-3 stars',
      3: '3-4 stars',
      4: '4-5 stars'
    };

    const total = distribution.reduce((s, d) => s + d.count, 0);

    return distribution.map(d => ({
      ratingRange: ratingLabels[d._id] || d._id,
      count: d.count,
      percentage: ((d.count / total) * 100).toFixed(2)
    }));
  }
};
