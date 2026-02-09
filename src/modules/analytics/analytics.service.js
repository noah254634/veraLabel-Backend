import UserVera  from "../users/user.model.js";
import Dataset from "../datasets/dataset.model.js";
import Payment from "../payments/models/payment.model.js";
const analyticsService = {
  overview: async () => {
       const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1));

    // Run in parallel
    const [
      totalUsers,
      newUsersToday,
      newUsersThisMonth,
      totalDatasets,
      approvedDatasets,
      rejectedDatasets,
      pendingDatasets,
      revenueThisMonth
    ] = await Promise.all([
      UserVera.countDocuments(),
      UserVera.countDocuments({ createdAt: { $gte: startOfToday } }),
      UserVera.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Dataset.countDocuments(),
      Dataset.countDocuments({ status: "approved" }),
      Dataset.countDocuments({ status: "rejected" }),
      Dataset.countDocuments({ status: "pending" }),
      Payment.aggregate([
        { $match:
           { status: "success",
             createdAt: { $gte: startOfMonth } }
             },
        { $group: {
           _id: null, 
           total: { $sum: "$amount" } }
           }
      ])
    ]);

    return {
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        newThisMonth: newUsersThisMonth
      },
      datasets: {
        total: totalDatasets,
        pending: pendingDatasets,
        approved: approvedDatasets,
        rejected: rejectedDatasets
      },
      revenue: {
        thisMonth: revenueThisMonth[0]?.total || 0
      }
    };
  }
};

export default analyticsService;
