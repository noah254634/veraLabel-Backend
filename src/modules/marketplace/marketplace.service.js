import mongoose from "mongoose";
import Dataset from "../datasets/dataset.model.js";
import Invoice from "../datasets/invoice.model.js";
import UserVera from "../users/user.model.js";
import { PaymentService } from "../payments/services/payment.service.js";
import Order from "./order.model.js";
export const marketplaceService = {
  getOrders: async (buyerId) => {
    try {
      // Convert buyerId to ObjectId for proper MongoDB matching
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
  getdatasetOrders: async (buyerId) => {
    const userExists = await UserVera.findOne({ _id: buyerId });
    if (!userExists) throw new Error("Unauthorized access or user not a buyer");
    
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
            orderNumber: { $arrayElemAt: ['$orderInfo.orderNumber', 0] }
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
      const budgetValue = parseFloat(String(item.budget || "0").replace(/[^0-9.]/g, "")) || 0;
      
      acc.totalSpent += budgetValue;
      if (item.status === "done") {
        acc.activeAssets += 1;
      } else if (["pending", "processing"].includes(item.status)) {
        acc.pendingSync += 1;
      }
      return acc;
    }, { totalSpent: 0, activeAssets: 0, pendingSync: 0 });

    const recentOrders = await Promise.all(allDataAssets.map(async (item) => {
      if (item.entryType !== 'custom') return item;

      // Special tracking for active requests
      let actualRows = item.rows || 0;
      let processingProgress = 0;
      let invoice = null;

      const dataset = await Dataset.findById(item._id).select('metadata.numRecords status').lean();
      if (dataset) {
        actualRows = dataset.metadata?.numRecords || actualRows;

        const tasksCreated = await mongoose.model('Task').countDocuments({ 
          $or: [{ datasetId: item._id }, { r2_datasetUrl: `projects/${item.buyerId?.toString()}/${item._id.toString()}` }]
        });
        
        const volumeTarget = parseInt(item.volume) || 1;
        processingProgress = ['approved', 'awaiting_payment'].includes(dataset.status) ? 100 : Math.min(Math.round((tasksCreated / volumeTarget) * 100), 100);
      }

      if (['awaiting_payment', 'pending'].includes(item.status)) {
        invoice = await Invoice.findOne({ datasetId: item._id }).lean();
      }

      return {
        ...item,
        actualRows,
        processingProgress,
        invoice
      };
    }));

    return { 
      buyerDatasetOrders: recentOrders, 
      stats 
    };
  },
  unpublishDataset: async (id) => {
    if (!id) throw new Error("Id not found");
    if (!mongoose.Types.ObjectId.isValid(id))
      throw new Error("Invalid dataset id");

    const dataset = await Dataset.findByIdAndUpdate(
      id,
      { isPublished: false },
      { new: true },
    );
    if (!dataset) throw new Error("No dataset with that Id in database");
    return dataset;
  },
  createOrder: async (buyerId, datasetId, reference, datasetPrice) => {
    const buyerExists = await UserVera.findById(buyerId);
    if (!buyerExists) throw new Error("Unauthorized access");
    
    // Check if an order already exists for this dataset (e.g. from a custom request)
    let order = await Order.findOne({ datasetId, buyerId });

    if (order) {
      // Heal legacy orders: generate an orderNumber if missing
      if (!order.orderNumber) {
        order.orderNumber = `ORD-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
      }
      
      // Update existing order with new payment reference and amount
      order.reference = reference;
      order.totalPrice = datasetPrice;
      await order.save();
    } else {
      // Create new order for marketplace purchases
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
  alldatasets: async () => {
    const datasets = await Dataset.find();
    return datasets;
  },
  getdatasetById: async (id) => {
    if (!id) throw new Error("id is required");
    if (!mongoose.Types.ObjectId.isValid(id))
      throw new Error("Invalid dataset id");
    const dataset = await Dataset.findById(id);
    return dataset;
  },
  getVerifiedDatasets: async () => {
    const datasets = await Dataset.find({
      isVerified: true,
      isPublished: true,
    });
    return datasets;
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
};
