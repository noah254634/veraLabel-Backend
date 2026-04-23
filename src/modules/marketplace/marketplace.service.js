import mongoose from "mongoose";
import Dataset from "../datasets/dataset.model.js";
import DatasetRequest from "./request.model.js";
import UserVera from "../users/user.model.js";
import { PaymentService } from "../payments/services/payment.service.js";
import Order from "./order.model.js";
export const marketplaceService = {
  getOrders: async (buyerId) => {
    const orders = await Order.aggregate([
      {
        $match: {
          buyerId: buyerId,
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
      /*{
        $lookup: {
          from: "datasets",
          localField: "datasetId",
          foreignField: "_id",
          as: "dataset",
        },
      },*/
      {
        $project: {
          _id: 0,
        },
      },
    ]);
    return orders;
  },
  getdatasetOrders: async (buyerId) => {
    const userExists = await UserVera.findOne({ _id: buyerId, role: "buyer" });
    if (!userExists) throw new Error("Unauthorized access or user not a buyer");
    
    const datasetOrders = await DatasetRequest.aggregate([
      {
        $match: {
          buyerId: buyerId,
        },
      },
      { $sort: { createdAt: -1 } }, // newest first
      { $limit: 8 },
      {
        $project: {
          _id: 1,
          datasetId: 1,
          createdAt: 1,
          price: 1,
          volume: 1,
          format: 1,
          domain: 1,
          description: 1,
          budget: 1,
          sourceLink: 1,
          fileUrl: 1,
          status: 1,
          timeline: 1,
          qualityMetrics: 1,
          isPaid: 1,
          itemsCompleted: 1,
          assignedLabelerId: 1,
          downloadUrl: 1,
          reportReason: 1,
          canBeCancelled: 1,
        },
      },
    ]);

    return datasetOrders;
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
    const order = await Order.create({
      reference,
      buyerId: buyerId,
      datasetId,
      status: "pending",
      totalPrice: datasetPrice,
      reference,
    });
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
  
  cancelPayment: async (orderId, buyerId) => {
    const order = await DatasetRequest.findOne({ _id: orderId, buyerId });
    if (!order) throw new Error("Order not found or unauthorized");
    if (!order.canBeCancelled) throw new Error("This order cannot be cancelled");
    if (order.status !== "pending") throw new Error("Can only cancel pending orders");
    
    const updatedOrder = await DatasetRequest.findByIdAndUpdate(
      orderId,
      { status: "failed", canBeCancelled: false },
      { new: true }
    );
    return updatedOrder;
  },

  reportIssue: async (orderId, buyerId, reason) => {
    const order = await DatasetRequest.findOne({ _id: orderId, buyerId });
    if (!order) throw new Error("Order not found or unauthorized");
    
    const updatedOrder = await DatasetRequest.findByIdAndUpdate(
      orderId,
      { reportReason: reason },
      { new: true }
    );
    return updatedOrder;
  },
};
