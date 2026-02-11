import Dataset from "../datasets/dataset.model.js";
import UserVera from "../users/user.model.js";
import Order from "./order.model.js";
export const marketplaceService = {
  createOrder: async (buyerId, datasetId, datasetPrice) => {
    const buyerExists = await UserVera.findById(buyerId);
    if (!buyerExists) throw new Error("Unauthorized access");
    const datasetExistsAndPublished = await Dataset.findOne({
      _id: datasetId,
      isPublished: true,
    });
    if (!datasetExistsAndPublished)
      throw new Error("Dataset not found or not published yet");
    const order = await Order.create({
      buyer: buyerId,
      datasetId,
      price: datasetPrice,
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
  },
};
