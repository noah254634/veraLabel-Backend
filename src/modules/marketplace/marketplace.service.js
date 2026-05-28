import mongoose from "mongoose";
import Dataset from "../datasets/dataset.model.js";

export const marketplaceService = {
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

  alldatasets: async () => {
    const datasets = await Dataset.find().sort({ createdAt: -1 });
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
    }).sort({ createdAt: -1 });
    return datasets;
  },
};
