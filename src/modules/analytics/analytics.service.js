import UserVera  from "../users/user.model.js";
import Order from "../marketplace/order.model.js";
import Dataset from "../datasets/dataset.model.js";
import Payment from "../payments/models/payment.model.js";
const analyticsService = {
  ordersReceived: async () => {
    const [orders,succesfulOrders,failedOrders,pendingOrders]= await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({status:"success"}),
      Order.countDocuments({status:"failed"}),
      Order.countDocuments({status:"pending"})    
    ])
   return {
    orderOverview:{
    total:orders,
    succesful:succesfulOrders,
    failed:failedOrders,
    pending:pendingOrders
   }     
  } 
  },
  veraLabelsWorth:async()=>{
    const worth=await Dataset.aggregate([
      {$match:{isPublished:true},
    $group:{
      _id:null,amount:{$sum:price}}}
    ])
    return worth
  },
  overview: async () => {
       const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1));


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
  },
  getRevenueAnalytics: async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [dailyRevenue, monthlyTrend, categoricalRevenue, currentMonthTotal, lastMonthTotal] = await Promise.all([
      // Daily Revenue (Last 30 Days)
      Payment.aggregate([
        { $match: { status: "completed", verifiedAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$verifiedAt" } },
            revenue: { $sum: "$amount" },
            platformFee: { $sum: "$fees.platformFee" }
          }
        },
        { $sort: { "_id": 1 } },
        { $project: { date: "$_id", revenue: 1, platformFee: 1, _id: 0 } }
      ]),

      // Monthly Trend (Last 6 Months)
      Payment.aggregate([
        { $match: { status: "completed" } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$verifiedAt" } },
            revenue: { $sum: "$amount" }
          }
        },
        { $sort: { "_id": 1 } },
        { $limit: 6 },
        { $project: { month: "$_id", revenue: 1, _id: 0 } }
      ]),

      // Revenue by Purpose
      Payment.aggregate([
        { $match: { status: "completed", verifiedAt: { $gte: startOfCurrentMonth } } },
        {
          $group: {
            _id: "$purpose",
            revenue: { $sum: "$amount" }
          }
        },
        { $project: { product: "$_id", revenue: 1, _id: 0 } }
      ]),

      // Current Month Total
      Payment.aggregate([
        { $match: { status: "completed", verifiedAt: { $gte: startOfCurrentMonth } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),

      // Last Month Total
      Payment.aggregate([
        { $match: { status: "completed", verifiedAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ])
    ]);

    const currentTotal = currentMonthTotal[0]?.total || 0;
    const lastTotal = lastMonthTotal[0]?.total || 0;
    const growth = lastTotal > 0 ? ((currentTotal - lastTotal) / lastTotal) * 100 : 0;

    return {
      stats: {
        thisMonth: currentTotal,
        lastMonth: lastTotal,
        growth: parseFloat(growth.toFixed(2)),
        totalRevenue: (await Payment.aggregate([
          { $match: { status: "completed" } },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ]))[0]?.total || 0,
        totalFees: (await Payment.aggregate([
          { $match: { status: "completed" } },
          { $group: { _id: null, total: { $sum: "$fees.platformFee" } } }
        ]))[0]?.total || 0,
        transactionCount: await Payment.countDocuments({ status: "completed" })
      },
      dailyRevenue,
      monthlyTrend,
      categoricalRevenue
    };
  },
  getDatasetAnalytics: async () => {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

      const [submissionTrend, statusDistribution, approvalTrend] = await Promise.all([
        // Submission Trend (Last 7 Days)
        Dataset.aggregate([
          { $match: { createdAt: { $gte: sevenDaysAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              submissions: { $sum: 1 }
            }
          },
          { $sort: { "_id": 1 } },
          { $project: { date: "$_id", submissions: 1, _id: 0 } }
        ]),

        // Global Status Distribution
        Dataset.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 }
            }
          },
          { $project: { status: { $ifNull: ["$_id", "unknown"] }, count: 1, _id: 0 } }
        ]),

        // Approval Rate Trend (Last 30 Days)
        Dataset.aggregate([
          { $match: { status: { $in: ["approved", "rejected"] }, createdAt: { $gte: thirtyDaysAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%U", date: "$createdAt" } },
              approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
              total: { $sum: 1 }
            }
          },
          {
            $project: {
              date: "$_id",
              rate: {
                $cond: [
                  { $eq: ["$total", 0] },
                  0,
                  { $multiply: [{ $divide: ["$approved", "$total"] }, 100] }
                ]
              },
              _id: 0
            }
          },
          { $sort: { date: 1 } }
        ])
      ]);

      const stats = {
        total: (statusDistribution || []).reduce((acc, curr) => acc + (curr.count || 0), 0),
        pending: statusDistribution.find(s => s.status === "pending")?.count || 0,
        approved: statusDistribution.find(s => s.status === "approved")?.count || 0,
        rejected: statusDistribution.find(s => s.status === "rejected")?.count || 0,
      };

      return {
        stats,
        submissionTrend: submissionTrend || [],
        approvalTrend: approvalTrend || []
      };
    } catch (error) {
      console.error("Dataset Analytics Error:", error);
      throw error;
    }
  }
};

export default analyticsService;
