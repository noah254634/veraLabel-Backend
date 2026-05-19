import logger from "../../config/logger.js";
import { datasetService } from "./dataset.service.js";
export const datasetController = {
    confirmUpload: async (req, res) => {
        try {
            const { r2Key, datasetId, dataType } = req.body;

            if (!r2Key) {
                return res.status(400).json({ error: "r2Key is required" });
            }
            if (!datasetId) {
                return res.status(400).json({ error: "datasetId is required" });
            }
            if (!dataType) {
                return res.status(400).json({ error: "dataType is required" });
            }

            logger.info("confirmUpload started", { r2Key, datasetId, dataType });
            const result = await datasetService.confirmUpload(r2Key, datasetId, dataType);
            logger.info("confirmUpload completed successfully", { datasetId, status: result.status });
            return res.status(200).json(result);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            const errorStack = err instanceof Error ? err.stack : "No stack trace";
            logger.error("confirmUpload error", { 
                error: errorMsg, 
                stack: errorStack,
                body: req.body,
                type: err?.constructor?.name,
                cause: err?.cause
            });
            return res.status(500).json({ error: errorMsg });
        }
    },
  generateUploadUrl: async (req, res) => {
    try {
      const { fileType } = req.body;
      if (!fileType) throw new Error("fileType is required");

      const userId = req.user.id;
      const { uploadUrl, key } = await datasetService.generateUploadUrl(userId, fileType);
      logger.info("Upload URL generated", { userId, fileType });
      res.json({
        uploadUrl,
        key,
      });
    } catch (error) {
      logger.error("Generate Upload URL Error", { error: error instanceof Error ? error.message : String(error), fileType: req.body?.fileType });
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

  getAllDatasets: async (req, res) => {
    try {
      const userRole = req.user?.role;
      let filter = {};

      if (userRole === "labeler") {
        // Labellers can work on anything that is approved or already active, 
        // even if it's not yet "published" to the marketplace.
        filter = {
          status: { $in: ['approved', 'in_progress', 'processing'] }
        };
      }

      const datasets = await datasetService.getAllDatasets(filter);
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
  createDataset: async (req, res) => {
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
      const response = await datasetService.createDataset(
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
