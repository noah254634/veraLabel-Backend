import logger from "../../config/logger.js";
import { adminService } from "./admin.service.js";
import { asyncHandler, AppError } from "../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../helpers/responseHandler.js";

export const adminController = {
  verifyUser: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await adminService.verifyUserById(id);
    return ResponseHandler.success(res, { user }, "User verified successfully");
  }),

  unverifyUser: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await adminService.unverifyUserById(id);
    return ResponseHandler.success(res, { user }, "User unverified successfully");
  }),

  deleteUser: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await adminService.deleteUserById(id);
    return ResponseHandler.success(res, { user }, "User deleted successfully");
  }),

  rateUser: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rate } = req.body;
    if (!rate) throw new AppError("Rate is required", 400);
    const user = await adminService.rateUser(id, parseInt(rate));
    return ResponseHandler.success(res, { user }, "User rated successfully");
  }),

  unpublishDataset: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const dataset = await adminService.unpublishDatasetById(id);
    return ResponseHandler.success(res, { dataset }, "Dataset unpublished successfully");
  }),

  publishDataset: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const dataset = await adminService.publishDatasetById(id);
    return ResponseHandler.success(res, { dataset }, "Dataset published successfully");
  }),

  updateDatasetPrice: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { price } = req.body;
    if (!price) throw new AppError("Price not found", 400);
    const dataset = await adminService.updateDatasetPrice(id, parseInt(price));
    return ResponseHandler.success(res, { dataset }, "Dataset price updated");
  }),

  updateDatasetBatchPrice: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { pricePerBatch } = req.body;
    if (pricePerBatch === undefined) throw new AppError("Batch price not found", 400);
    const dataset = await adminService.updateDatasetBatchPrice(id, parseFloat(pricePerBatch));
    return ResponseHandler.success(res, { dataset }, "Batch price updated");
  }),

  pendingDatasets: asyncHandler(async (req, res) => {
    const datasets = await adminService.pendingDatasets();
    return ResponseHandler.success(res, { datasets }, "Pending datasets fetched");
  }),

  approvedDatasets: asyncHandler(async (req, res) => {
    const datasets = await adminService.approvedDatasets();
    return ResponseHandler.success(res, { datasets }, "Approved datasets fetched");
  }),

  rejectedDatasets: asyncHandler(async (req, res) => {
    const datasets = await adminService.rejectedDatasets();
    return ResponseHandler.success(res, { datasets }, "Rejected datasets fetched");
  }),

  flaggedDatasets: asyncHandler(async (req, res) => {
    const datasets = await adminService.flaggedDatasets();
    return ResponseHandler.success(res, { datasets }, "Flagged datasets fetched");
  }),

  banUser: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const user = await adminService.banUserById(id, reason);
    return ResponseHandler.success(res, { user }, "User banned successfully");
  }),

  promoteToReviewer: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await adminService.promoteToReviewerById(id);
    return ResponseHandler.success(res, { user }, "User promoted to reviewer");
  }),

  promoteUser: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await adminService.promoteUserById(id);
    return ResponseHandler.success(res, { user }, "User promoted to admin");
  }),

  demoteUser: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await adminService.demoteUserById(id);
    return ResponseHandler.success(res, { user }, "User demoted successfully");
  }),

  blockUser: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const user = await adminService.blockUserById(id, reason);
    return ResponseHandler.success(res, { user }, "User blocked successfully");
  }),

  unblockUser: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await adminService.unblockUserById(id);
    return ResponseHandler.success(res, { user }, "User unblocked successfully");
  }),

  suspendUser: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const user = await adminService.suspendUserById(id, reason);
    return ResponseHandler.success(res, { user }, "User suspended successfully");
  }),

  unsuspendUser: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await adminService.unsuspendUserById(id);
    return ResponseHandler.success(res, { user }, "User unsuspended successfully");
  }),

  flagDataset: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const dataset = await adminService.flagDatasetById(id, reason);
    return ResponseHandler.success(res, { dataset }, "Dataset flagged");
  }),

  unflagDataset: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const dataset = await adminService.unflagDatasetById(id);
    return ResponseHandler.success(res, { dataset }, "Dataset unflagged");
  }),

  deleteDataset: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const dataset = await adminService.deleteDatasetById(id);
    return ResponseHandler.success(res, { dataset }, "Dataset deleted");
  }),

  approveDataset: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const dataset = await adminService.approveDatasetById(id);
    return ResponseHandler.success(res, { dataset }, "Dataset approved");
  }),

  rejectDataset: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const dataset = await adminService.rejectDatasetById(id);
    return ResponseHandler.success(res, { dataset }, "Dataset rejected");
  }),

  updateDatasetStatus: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) throw new AppError("Status is required", 400);
    const dataset = await adminService.updateDatasetStatus(id, status);
    return ResponseHandler.success(res, { dataset }, "Dataset status updated");
  }),

  updateDatasetPriority: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { priority } = req.body;
    if (!priority) throw new AppError("Priority is required", 400);
    const dataset = await adminService.updateDatasetPriority(id, priority);
    return ResponseHandler.success(res, { dataset }, "Dataset priority updated");
  }),

  updateDatasetMaxLabellers: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { maxLabellers } = req.body;
    if (!maxLabellers) throw new AppError("Max labellers is required", 400);
    const dataset = await adminService.updateDatasetMaxLabellers(id, parseInt(maxLabellers, 10));
    return ResponseHandler.success(res, { dataset }, "Max labellers updated");
  }),

  getBuyers: asyncHandler(async (req, res) => {
    const { status } = req.query;
    const buyers = await adminService.getBuyers(status);
    return ResponseHandler.success(res, { buyers }, "Buyers fetched successfully");
  }),

  approveBuyer: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const buyer = await adminService.approveBuyer(id);
    return ResponseHandler.success(res, { buyer }, "Buyer approved successfully");
  }),

  rejectBuyer: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const buyer = await adminService.rejectBuyer(id, adminNotes);
    return ResponseHandler.success(res, { buyer }, "Buyer rejected successfully");
  }),
};
