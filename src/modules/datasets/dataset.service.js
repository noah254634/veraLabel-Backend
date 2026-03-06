import Dataset from "./dataset.model.js";

export const datasetService = {
  buyerSideDatasets: async () => {
    const datasets = await Dataset.aggregate([
      {
        $match: {
          //visibility: "public",
          isPublished: true,
         // isVerified: true,
        },
      },
      {
        $project: {
          _id: 1,
          datasetFormat: 1,
          reviews: 1,
          exclusivePrice: 1,
          price: 1,
          isVerified: 1,
          name: 1,
          description: 1,
          version: 1,
          size: 1,
          rating: 1,
        },
      },
    ]);
    return datasets;
  },
  createDataset: async (
    name,
    description,
    price,
    datasetLabeler,
    datasetType,
    datasetFormat,
    file,
    id,
  ) => {
    if (
      !name ||
      !description ||
      !price ||
      !datasetLabeler ||
      !datasetType ||
      !datasetFormat ||
      !file
    )
      throw new Error("All fields are required");

    const dataset = await Dataset.findByIdAndUpdate(id, {
      name,
      description,
      price,
      datasetLabeler,
      datasetType,
      datasetFormat,
      filePath: file.location,
      size: file.size,
    });
    return dataset;
  },
  getAllDatasets: async () => {
    return await Dataset.find();
  },
  getDatasetById: async (id) => {
    return await Dataset.findById(id);
  },
  deleteDataset: async (id) => {
    if (!id) throw new Error("id is required");
    const dataset = await Dataset.findById(id);
    if (!dataset) throw new Error("No dataset with that Id in database");
    return await Dataset.findByIdAndDelete(id);
  },
  updateDataset: async (id, data) => {
    return await Dataset.findByIdAndUpdate(id, data, { new: true });
  },
  filterDatasets: async (filters) => {
    const now = new Date();
    const date = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(Date.UTC(date.getFullYear, date.getMonth, 1));
    const [
      datasetsToday,
      datasetsThiMonth,
      approvedDatasets,
      rejectedDatasets,
    ] = await Promise.all([
      Dataset.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfDay },
          },
        },
      ]),
    ]);
    return await Dataset.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay },
          status: "approved",
        },
      },
    ]);
  },
};
