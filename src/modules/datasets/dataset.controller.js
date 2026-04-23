import logger from "../../config/logger.js";
import { datasetService } from "./dataset.service.js";
export const datasetController = {
    confirmUpload: async (req, res) => {
        try {
            res.status(200).json({message:"success"})
        }catch(err){
            logger.error(err.message);
            return res.status(500).json({message:err.message})
        }
    },
  generateUploadUrl: async (req, res) => {
    try {
        console.log(req.body);
      const { fileType } = req.body;
      if (!fileType) throw new Error("fileType is required");

      const userId = req.user.id;
      const { uploadUrl, key } = await datasetService.generateUploadUrl(userId, fileType);
      res.json({
        uploadUrl,
        key,
      });
    } catch (error) {
      console.error("Generate Upload URL Error:", error);
      res.status(500).json({ error: `Failed to generate upload URL: ${error.message}` });
    }
  },
  buyerSideDatasets: async (req, res) => {
    try {
      const datasets = await datasetService.buyerSideDatasets();
      return res.json(datasets);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
  createDataset: async (req, res) => {
    try {
      console.log("here is the body:", req.body);
      const { intent, description,volume,budget, datasetType, format } = req.body;
      const datasetLabeler = req.user._id;
      const file = req.file;
      if (!file) return res.status(401).json({ message: "File is required" });
      const datasetId = req.datasetId;
      const dataset = await datasetService.createDataset(
        intent ,
        description,
        volume,
        budget,
        datasetLabeler,
        datasetType,
        format,
        file,
        datasetId,
      );
      return res.json(dataset);
    } catch (err) {
      return res
        .status(401)
        .json({
          error: `an error occurred while creating file try again later ${err.message}`,
        });
    }
  },
  getAllDatasets: async (req, res) => {
    try {
      const datasets = await datasetService.getAllDatasets();
      return res.json(datasets);
    } catch (err) {
      return res
        .status(401)
        .json({
          error: `an error occurred in getting all the datasets ${err.message}`,
        });
    }
  },
  getDatasetById: async (req, res) => {
    try {
      const { id } = req.params;
      const dataset = await datasetService.getDatasetById(id);
      return res.json(dataset);
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  },
  updateDataset: async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const dataset = await datasetService.updateDataset(id, data);
      return res.json(dataset);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
  deleteDataset: async (req, res) => {
    try {
      const { id } = req.params;
      const dataset = await datasetService.deleteDataset(id);
      logger.info(dataset);
      return res.json(dataset);
    } catch (err) {
      logger.error(err.message);
      return res.status(400).json({ message: err.message });
    }
  },
  filterDatasets: async (req, res) => {
    try {
      const datasets = await datasetService.filterDatasets(req.query);
      return res.json(datasets);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
  createDatasetRequest: async (req, res) => {
    try {
      const body = req.body;
      logger.info(JSON.stringify(body));
      const {
        domain,
        specifications,
        volume,
        format,
        budget,
        fileUrl,
        timeline,
        qualityMetrics,
      } = body;
     
      const userId = req.user?._id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const response = await datasetService.createDatasetRequest(
        domain,
        specifications,    
        volume,
        format,
        budget,
        fileUrl,
        timeline,
        qualityMetrics,
        userId,
      );
      return res.status(200).json({ response });
    } catch (err) {
      logger.error(err.message);
      return res.status(500).json({ message: err.message });
    }
  },
};
