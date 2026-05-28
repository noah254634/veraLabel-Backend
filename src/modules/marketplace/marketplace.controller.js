import { marketplaceService } from "./marketplace.service.js";
import { asyncHandler } from "../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../helpers/responseHandler.js";

export const marketplaceController = {
  unpublishDataset: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const response = await marketplaceService.unpublishDataset(id);
    return ResponseHandler.success(res, { response }, "Dataset unpublished");
  }),

  alldatasets: asyncHandler(async (req, res) => {
    const datasets = await marketplaceService.alldatasets();
    return ResponseHandler.success(res, { datasets }, "All datasets fetched");
  }),

  getVerifiedDataset: asyncHandler(async (req, res) => {
    const datasets = await marketplaceService.getVerifiedDatasets();
    return ResponseHandler.success(res, { datasets }, "Verified datasets fetched");
  }),
};
