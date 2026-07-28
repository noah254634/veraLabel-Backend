import mongoose from "mongoose";
import Dataset from "../datasets/dataset.model.js";
import Invoice from "../datasets/invoice.model.js";
import UserVera from "../users/user.model.js";
import Buyer from "./buyer.model.js";
import Order from "../marketplace/order.model.js";

export const buyerService = {
  getBuyers: async () => {
    const buyers = await Buyer.find({});
    return buyers;
  },

  getAllBuyers: async () => {
    try {
      const buyers = await Buyer.aggregate([
        {
          $match: {
            isActive: true,
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $limit: 20,
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            companyName: 1,
            industry: 1,
            billingAddress: 1,
            totalSpent: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]);
      return buyers;
    } catch (error) {
      console.error('Error fetching buyers:', error);
      throw new Error(`Failed to fetch buyers: ${error.message}`);
    }
  },

  getOrders: async (buyerId) => {
    try {
      const buyerObjectId = new mongoose.Types.ObjectId(buyerId);

      const orders = await Order.aggregate([
        {
          $match: {
            buyerId: buyerObjectId,
            status: "approved",
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $limit: 20,
        },
        {
          $project: {
            _id: 1,
            orderNumber: 1,
            reference: 1,
            buyerId: 1,
            datasetId: 1,
            status: 1,
            totalPrice: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]);
      return orders;
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw new Error(`Failed to fetch orders: ${error.message}`);
    }
  },

  getdatasetOrders: async (buyerId, limit) => {
    const buyerExists = await Buyer.findById(buyerId);
    if (!buyerExists) throw new Error("Unauthorized access or user not a buyer");
    
    const buyerObjectId = new mongoose.Types.ObjectId(buyerId);

    const [customDatasetsWithOrders, allPurchases, marketplaceDatasets] = await Promise.all([
      Dataset.aggregate([
        { $match: { type: 'custom', buyerId: buyerObjectId } },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: 'orders',
            localField: '_id',
            foreignField: 'datasetId',
            as: 'orderInfo'
          }
        },
        {
          $addFields: {
            orderNumber: { $arrayElemAt: ['$orderInfo.orderNumber', 0] },
            downloadedAt: { $arrayElemAt: ['$orderInfo.downloadedAt', 0] },
            buyerDownloadsCount: { $arrayElemAt: ['$orderInfo.buyerDownloadsCount', 0] }
          }
        }
      ]),
      Order.find({ buyerId: buyerObjectId }).sort({ createdAt: -1 }).lean(),
      Dataset.find({ type: 'marketplace', datasetLabeler: buyerObjectId }).sort({ createdAt: -1 }).lean()
    ]);

    console.log(`[Sync] Found ${customDatasetsWithOrders.length} custom datasets, ${allPurchases.length} purchases, and ${marketplaceDatasets.length} marketplace datasets`);

    const linkedDatasetIds = new Set();
    allPurchases.forEach(p => { if (p.datasetId) linkedDatasetIds.add(p.datasetId.toString()); });

    const normalizedCustom = customDatasetsWithOrders.map(d => ({ ...d, entryType: 'custom' }));

    const rawPurchases = await Promise.all(allPurchases.map(async (p) => {
      const dataset = await Dataset.findById(p.datasetId).lean();
      if (!dataset || dataset.type === 'custom') return null;
      return {
        _id: p._id,
        orderNumber: p.orderNumber,
        datasetId: p.datasetId,
        createdAt: p.createdAt,
        domain: dataset?.datasetType || "Marketplace",
        format: dataset?.datasetFormat || "N/A",
        description: dataset?.description || "Purchased Marketplace Asset",
        volume: dataset?.metadata?.numRecords || "---",
        budget: `$${p.totalPrice || 0}`,
        status: p.status === 'approved' ? "done" : "pending",
        entryType: 'purchase',
        isPaid: true,
        downloadedAt: p.downloadedAt,
        buyerDownloadsCount: p.buyerDownloadsCount || 0,
        itemsCompleted: dataset?.metadata?.numRecords || 0,
        actualRows: dataset?.metadata?.numRecords || 0,
        processingProgress: 100,
        timeline: "Instant",
      };
    }));
    const normalizedPurchases = rawPurchases.filter(Boolean);

    const normalizedMarketplace = marketplaceDatasets
      .filter(d => !linkedDatasetIds.has(d._id.toString()))
      .map(d => ({
        _id: d._id,
        datasetId: d._id,
        createdAt: d.createdAt,
        domain: d.datasetType || "Marketplace",
        format: d.datasetFormat || "RAW",
        description: d.description || "Marketplace Dataset",
        volume: d.metadata?.numRecords || "---",
        budget: `$${d.price || 0}`,
        status: d.status === 'approved' ? "done" : "processing",
        entryType: 'marketplace',
        isPaid: true,
        itemsCompleted: d.metadata?.numRecords || 0,
        actualRows: d.metadata?.numRecords || 0,
        processingProgress: d.status === 'approved' ? 100 : 0,
        timeline: "N/A",
      }));

    const allDataAssets = [...normalizedCustom, ...normalizedPurchases, ...normalizedMarketplace].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const stats = allDataAssets.reduce((acc, item) => {
      let budgetVal = 0;
      if (item.entryType === 'custom') {
        if (['cancelled', 'rejected', 'registration_failed'].includes(item.status)) {
          budgetVal = 0;
        } else if (item.price && item.price > 0) {
          budgetVal = item.price;
        } else {
          budgetVal = parseFloat(String(item.budget || "0").replace(/[^0-9.]/g, "")) || 0;
        }
      } else {
        budgetVal = parseFloat(String(item.budget || "0").replace(/[^0-9.]/g, "")) || 0;
      }

      acc.totalSpent += budgetVal;

      const isActive = item.status === "done" || (item.entryType === 'custom' && ["in_progress", "completed"].includes(item.status));
      const isPending = ["pending", "processing", "curation_requested"].includes(item.status);

      if (isActive) {
        acc.activeAssets += 1;
      } else if (isPending) {
        acc.pendingSync += 1;
      }
      return acc;
    }, { totalSpent: 0, activeAssets: 0, pendingSync: 0 });

    const parsedLimit = (limit === 'all' || limit === -1 || limit === '-1')
      ? allDataAssets.length
      : (limit ? parseInt(limit) : 5);

    const assetsToProcess = allDataAssets.slice(0, parsedLimit);

    const recentOrders = await Promise.all(assetsToProcess.map(async (item) => {
      if (item.entryType !== 'custom') return item;

      let actualRows = item.rows || 0;
      let processingProgress = 0;
      let invoice = null;

      const dataset = await Dataset.findById(item._id).select('metadata.numRecords status price').lean();
      if (dataset) {
        actualRows = dataset.metadata?.numRecords || actualRows;

        const tasksCreated = await mongoose.model('Task').countDocuments({ 
          $or: [{ datasetId: item._id }, { r2_datasetUrl: `projects/${item.buyerId?.toString()}/${item._id.toString()}` }]
        });
        
        const volumeTarget = parseInt(item.volume) || 1;
        processingProgress = ['approved', 'awaiting_payment'].includes(dataset.status) ? 100 : Math.min(Math.round((tasksCreated / volumeTarget) * 100), 100);
      }

      if (['awaiting_payment', 'pending', 'in_progress', 'completed'].includes(item.status)) {
        invoice = await Invoice.findOne({ datasetId: item._id }).lean();
      }

      return {
        ...item,
        actualRows,
        processingProgress,
        invoice,
        budget: (dataset && dataset.price && dataset.price > 0) ? dataset.price : item.budget
      };
    }));

    return { 
      buyerDatasetOrders: recentOrders, 
      stats 
    };
  },

  createOrder: async (buyerId, datasetId, reference, datasetPrice) => {
    const buyerExists = await Buyer.findById(buyerId);
    if (!buyerExists) throw new Error("Unauthorized access");
    
    let order = await Order.findOne({ datasetId, buyerId });

    if (order) {
      if (!order.orderNumber) {
        order.orderNumber = `ORD-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
      }
      order.reference = reference;
      order.totalPrice = datasetPrice;
      await order.save();
    } else {
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
      order = await Order.create({
        orderNumber,
        reference,
        buyerId: buyerId,
        datasetId,
        status: "pending",
        totalPrice: datasetPrice,
      });
    }

    return order;
  },

  cancelPayment: async (datasetId, buyerId) => {
    const dataset = await Dataset.findOne({ _id: datasetId, buyerId, type: 'custom' });
    if (!dataset) throw new Error("Dataset not found or unauthorized");
    if (!dataset.canBeCancelled) throw new Error("This dataset cannot be cancelled");
    if (dataset.status !== "pending") throw new Error("Can only cancel pending datasets");

    const updatedDataset = await Dataset.findByIdAndUpdate(
      datasetId,
      { status: "cancelled", canBeCancelled: false },
      { new: true }
    );
    return updatedDataset;
  },

  reportIssue: async (datasetId, buyerId, reason) => {
    const dataset = await Dataset.findOne({ _id: datasetId, buyerId, type: 'custom' });
    if (!dataset) throw new Error("Dataset not found or unauthorized");

    const updatedDataset = await Dataset.findByIdAndUpdate(
      datasetId,
      { reportReason: reason },
      { new: true }
    );
    return updatedDataset;
  },

  getInvoice: async (datasetId, buyerId) => {
    const dataset = await Dataset.findOne({ _id: datasetId, buyerId, type: 'custom' });
    if (!dataset) throw new Error("Dataset not found or unauthorized");

    const invoice = await Invoice.findOne({ datasetId });
    if (!invoice) throw new Error("Invoice not yet generated. Please ensure all tasks have been registered.");

    return {
      datasetId: dataset._id,
      invoice: invoice,
      status: dataset.status,
      domain: dataset.domain,
      volume: dataset.volume,
      createdAt: dataset.createdAt,
    };
  },

  submitOnboarding: async (buyerId, details) => {
    const updatedBuyer = await Buyer.findByIdAndUpdate(
      buyerId,
      {
        ...details,
        verificationStatus: "pending",
        isActive: false
      },
      { new: true }
    ).populate('userId', 'name email profilePicture role status');
    if (!updatedBuyer) throw new Error("Buyer profile not found");
    return updatedBuyer;
  },
};
