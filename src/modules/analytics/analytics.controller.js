import analyticsService from "./analytics.service.js";
import { asyncHandler } from "../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../helpers/responseHandler.js";

const analyticsController = {
  overview: asyncHandler(async (req, res) => {
    const data = await analyticsService.overview();
    return ResponseHandler.success(res, data, "Overview fetched successfully");
  }),

  revenueAnalytics: asyncHandler(async (req, res) => {
    const data = await analyticsService.getRevenueAnalytics();
    return ResponseHandler.success(res, data, "Revenue analytics fetched");
  }),

  datasetAnalytics: asyncHandler(async (req, res) => {
    const data = await analyticsService.getDatasetAnalytics();
    return ResponseHandler.success(res, data, "Dataset analytics fetched");
  }),
};

export default analyticsController;
