import { UserService } from "./user.service.js";
import { asyncHandler, AppError } from "../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../helpers/responseHandler.js";
import { getUserIdFromRequest } from "../../helpers/userExtraction.js";
import { validateRequiredFields, validateRequiredParams } from "../../helpers/validationHelpers.js";

export const UserController = {
  getUserDatasets: asyncHandler(async (req, res) => {
    const userId = getUserIdFromRequest(req);
    const datasets = await UserService.getUserDatasets(userId);
    return ResponseHandler.success(res, datasets, "Datasets retrieved successfully");
  }),

  getUsersByCity: asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ["city"]);
    const { city } = req.body;
    const users = await UserService.getUserByCity(city);
    return ResponseHandler.success(res, users, "Users retrieved by city");
  }),

  getUserById: asyncHandler(async (req, res) => {
    validateRequiredParams(req.params, ["id"]);
    const user = await UserService.getUserById(req.params.id);
    return ResponseHandler.success(res, user, "User retrieved successfully");
  }),

  updateUser: asyncHandler(async (req, res) => {
    validateRequiredParams(req.params, ["id"]);
    const user = await UserService.updateUser(req.params.id, req.body);
    return ResponseHandler.success(res, user, "User updated successfully");
  }),

  getAllUsers: asyncHandler(async (req, res) => {
    const users = await UserService.getAllUsers();
    return ResponseHandler.success(res, users, "All users retrieved successfully");
  }),

  getUsersByRole: asyncHandler(async (req, res) => {
    validateRequiredFields(req.query, ["role"]);
    const { role } = req.query;
    const users = await UserService.getUserByRole(role);
    return ResponseHandler.success(res, users, "Users retrieved by role");
  }),

  getUsersByStatus: asyncHandler(async (req, res) => {
    validateRequiredFields(req.query, ["status"]);
    const { status } = req.query;
    const users = await UserService.getUserByStatus(status);
    return ResponseHandler.success(res, users, "Users retrieved by status");
  }),

  getUsersByTrustScore: asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ["score"]);
    const { score } = req.body;
    const users = await UserService.getUserByTrustScore(score);
    return ResponseHandler.success(res, users, "Users retrieved by trust score");
  }),

  suspendUser: asyncHandler(async (req, res) => {
    validateRequiredParams(req.params, ["id"]);
    validateRequiredFields(req.body, ["reason"]);
    const { id } = req.params;
    const { reason } = req.body;
    const user = await UserService.suspendUserById(id, reason);
    return ResponseHandler.success(res, user, "User suspended successfully");
  }),

  unsuspendUser: asyncHandler(async (req, res) => {
    validateRequiredParams(req.params, ["id"]);
    const { id } = req.params;
    const user = await UserService.unsuspendUserById(id);
    return ResponseHandler.success(res, user, "User unsuspended successfully");
  }),

  deleteUser: asyncHandler(async (req, res) => {
    validateRequiredParams(req.params, ["id"]);
    const response = await UserService.deleteUserById(req.params.id);
    return ResponseHandler.success(res, response, "User deleted successfully");
  }),

  getUserByEmail: asyncHandler(async (req, res) => {
    throw new AppError("Not implemented", 501);
  }),

  blockUser: asyncHandler(async (req, res) => {
    validateRequiredParams(req.params, ["id"]);
    validateRequiredFields(req.body, ["reason"]);
    const { id } = req.params;
    const { reason } = req.body;
    const user = await UserService.blockUserById(id, reason);
    return ResponseHandler.success(res, user, "User blocked successfully");
  }),

  unblockUserById: asyncHandler(async (req, res) => {
    validateRequiredParams(req.params, ["id"]);
    const { id } = req.params;
    const user = await UserService.unblockUserById(id);
    return ResponseHandler.success(res, user, "User unblocked successfully");
  }),
};
