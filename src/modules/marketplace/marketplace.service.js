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
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const datasetOrders = await DatasetRequest.aggregate([
      {
        $match: {
          buyerId: buyerId,
          //status: "done",
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      { $sort: { createdAt: -1 } }, // newest first
      { $limit: 8 },
      {
        $project: {
          _id: 0,
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
        },
      },
    ]);

    return datasetOrders;
  },

  DatasetRequest: async (
    domain,
    specifications,
    volume,
    format,
    budget,
    sourceLink,
    uploadedFile,
    userId,
  ) => {
    const userExists = await UserVera.findOne({ _id: userId, role: "buyer" });
    if (!userExists) throw new Error("Unauthorized access or user not a buyer");
    if (!domain) throw new Error("Domain is required");
    if (!specifications) throw new Error("Specifications is required");
    if (!volume) throw new Error("Volume is required");
    if (!budget) throw new Error("Budget is required");
    if (!format) throw new Error("Format is required");
    if (!sourceLink && !uploadedFile)
      throw new Error("Source link or uploaded file is required");
    let formatted = "$" + budget.toString();
    const dataset = await DatasetRequest.create({
      domain,
      description: specifications,
      volume,
      budget: formatted,
      format,
      buyerId: userId,
      sourceLink,
      fileUrl: uploadedFile ? uploadedFile.location : null,
    });
    return dataset;
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
};
