import { buyerService } from "./buyer.service.js";
import { asyncHandler, AppError } from "../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../helpers/responseHandler.js";

export const buyerController = {
  getBuyerProfile: asyncHandler(async (req, res) => {
    return ResponseHandler.success(res, { buyer: req.buyer }, "Buyer profile fetched successfully");
  }),
  submitOnboarding: asyncHandler(async (req, res) => {
    const details = req.body;
    const buyer = await buyerService.submitOnboarding(req.buyer._id, details);
    return ResponseHandler.success(res, { buyer }, "Onboarding profile submitted successfully");
  }),
  getAllBuyers: asyncHandler(async (req, res) => {
    const buyers = await buyerService.getAllBuyers();
    return ResponseHandler.success(res, { buyers }, "Buyers fetched");
  }),
  getOrders: asyncHandler(async (req, res) => {
    const orders = await buyerService.getOrders(req.buyer._id);
    return ResponseHandler.success(res, { orders }, "Orders fetched");
  }),

  getBuyerRequests: asyncHandler(async (req, res) => {
    const { limit } = req.query;
    const { buyerDatasetOrders, stats } = await buyerService.getdatasetOrders(req.buyer._id, limit);
    return ResponseHandler.success(res, { buyerDatasetOrders, stats }, "Buyer requests fetched");
  }),

  createOrder: asyncHandler(async (req, res) => {
    const { datasetId, datasetPrice } = req.body;
    const response = await buyerService.createOrder(req.buyer._id, datasetId, datasetPrice);
    return ResponseHandler.created(res, { response }, "Order created successfully");
  }),

  cancelPayment: asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const response = await buyerService.cancelPayment(orderId, req.buyer._id);
    return ResponseHandler.success(res, { response }, "Payment cancelled successfully");
  }),

  reportIssue: asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { reason } = req.body;
    const response = await buyerService.reportIssue(orderId, req.buyer._id, reason);
    return ResponseHandler.success(res, { response }, "Issue reported successfully");
  }),
};
