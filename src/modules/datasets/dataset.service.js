import Dataset from "./dataset.model.js";

export const datasetService = {
  createDataset: async (
    name,
    description,
    price,
    datasetLabeler,
    datasetType,
    datasetFormat,
    file,
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
      const id=req.datasetId;

    const dataset = await Dataset.findByIdAndUpdate(id,{
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
    return await Dataset.findByIdAndDelete(id);
  },
  updateDataset: async (id, data) => {
    return await Dataset.findByIdAndUpdate(id, data, { new: true });
  },
  filterDatasets: async (filters) => {
    const now=new Date();
    const date=new Date();
    const startOfDay=new Date(now.setHours(0,0,0,0));
    const startOfMonth=new Date(Date.UTC(date.getFullYear,date.getMonth,1))
    const [datasetsToday,datasetsThiMonth,approvedDatasets,rejectedDatasets]=await Promise.all([
      Dataset.aggregate([{
        $match:{
          createdAt:{$gte:startOfDay}
        }
      }])
    ]

    )
    return await Dataset.aggregate([{
      $match:{
      createdAt:{$gte:startOfDay},
      status:"approved"
   } }]);
  },
};
