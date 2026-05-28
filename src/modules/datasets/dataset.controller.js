import logger from "../../config/logger.js";
import { datasetService } from "./dataset.service.js";
import { asyncHandler, AppError } from "../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../helpers/responseHandler.js";

export const datasetController = {
  confirmUpload: asyncHandler(async (req, res) => {
    const { r2Key, datasetId, dataType } = req.body;
    if (!r2Key) throw new AppError("r2Key is required", 400);
    if (!datasetId) throw new AppError("datasetId is required", 400);
    if (!dataType) throw new AppError("dataType is required", 400);

    logger.info("confirmUpload started", { r2Key, datasetId, dataType });
    const result = await datasetService.confirmUpload(r2Key, datasetId, dataType);
    logger.info("confirmUpload completed", { datasetId, status: result.status });
    return ResponseHandler.success(res, result, "Upload confirmed");
  }),

  generateUploadUrl: asyncHandler(async (req, res) => {
    const { fileType } = req.body;
    if (!fileType) throw new AppError("fileType is required", 400);
    const userId = req.user.id;
    const { uploadUrl, key } = await datasetService.generateUploadUrl(userId, fileType);
    logger.info("Upload URL generated", { userId, fileType });
    return ResponseHandler.success(res, { uploadUrl, key }, "Upload URL generated");
  }),

  buyerSideDatasets: asyncHandler(async (req, res) => {
    const datasets = await datasetService.buyerSideDatasets();
    return ResponseHandler.success(res, { datasets }, "Datasets fetched");
  }),

  getAllDatasets: asyncHandler(async (req, res) => {
    const userRole = req.user?.role;
    let filter = {};
    if (userRole === "labeler") {
      filter = { status: { $in: ["approved", "in_progress", "processing"] } };
    }
    const datasets = await datasetService.getAllDatasets(filter);
    return ResponseHandler.success(res, { datasets }, "All datasets fetched");
  }),

  getDatasetById: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const dataset = await datasetService.getDatasetById(id);
    if (!dataset) throw new AppError("Dataset not found", 404);
    return ResponseHandler.success(res, { dataset }, "Dataset fetched");
  }),

  updateDataset: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const dataset = await datasetService.updateDataset(id, req.body);
    return ResponseHandler.success(res, { dataset }, "Dataset updated");
  }),

  deleteDataset: asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) throw new AppError("Dataset id is required", 400);
    const result = await datasetService.deleteDataset(id);
    return ResponseHandler.success(res, result, "Dataset and all related data permanently deleted");
  }),

  filterDatasets: asyncHandler(async (req, res) => {
    const datasets = await datasetService.filterDatasets(req.query);
    return ResponseHandler.success(res, { datasets }, "Datasets filtered");
  }),

  createDataset: asyncHandler(async (req, res) => {
    const { name, domain, specifications, volume, format, budget, fileUrl, timeline, qualityMetrics, instructionId, buyerAnswers, labellingMethod, contentType, intent, timelineDays } = req.body;
    const buyerId = req.buyer?._id;
    if (!buyerId) throw new AppError("Unauthorized", 401);
    if (!name) throw new AppError("Dataset name is required", 400);

    logger.info("createDataset request received", {
      name,
      domain,
      labellingMethod,
      contentType,
      volume,
      format,
      budget,
      fileUrl,
      buyerId,
      instructionId,
      intent,
      timelineDays
    });

    const response = await datasetService.createDataset(
      name, domain, specifications, volume, format, budget, fileUrl, timeline, qualityMetrics, buyerId, instructionId, buyerAnswers, labellingMethod, contentType, intent, timelineDays
    );

    logger.info("createDataset completed successfully", {
      datasetId: response.datasetId,
      name: response.dataset?.name,
      buyerId,
    });

    return ResponseHandler.created(res, { response }, "Dataset created successfully");
  }),
};
