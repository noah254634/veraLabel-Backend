import mongoose from "mongoose";
import Dataset from "../datasets/dataset.model.js";
import DatasetRequest from "./request.model.js";
import UserVera from "../users/user.model.js";
import { PaymentService } from "../payments/services/payment.service.js";
import Order from "./order.model.js";
export const marketplaceService = {
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
      { $limit: 3 },
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

  createDatasetRequest: async (
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
  createOrder: async (buyerId, items, reference, totalPrice) => {
    const buyerExists = await UserVera.findById(buyerId);
    if (!buyerExists) throw new Error("Unauthorized access");
    for (const item of items) {
      const datasetId = item.datasetId;
      const datasetExistsAndPublished = await Dataset.findOne({
        _id: datasetId,
        isPublished: true,
      });
      if (!datasetExistsAndPublished)
        throw new Error("Dataset not found or not published yet");
    }

    const order = await Order.create({
      reference,
      buyer: buyerId,
      items: items.map((item) => ({
        datasetId: item.datasetId,
        price: item.priceSnapshot,
      })),
      totalPrice: totalPrice,
      reference,
    });
    return order;
  },
  getOrders: async () => {
    const orders = await Order.find();
    return orders;
  },
  alldatasets: async () => {
    const datasets = await Dataset.find();
    return datasets;
  },
  getdatasetById: async (id) => {
    if (!id) throw new Error("id is required");
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
