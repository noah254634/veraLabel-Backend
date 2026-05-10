import express from "express";
import { protectRoute } from "../../middlewares/auth.middleware.js";
import authorize from "../../middlewares/authorization.middleware.js";
import { NotificationController } from "./notification.controller.js";

const notificationRouter = express.Router();

// Any authenticated user can register their own token
notificationRouter.post(
  "/register-token",
  protectRoute,
  NotificationController.registerToken
);

// Admin-only: send to a single user
notificationRouter.post(
  "/send",
  protectRoute,
  authorize("admin", "superadmin"),
  NotificationController.sendToUser
);

// Admin-only: send to multiple users
notificationRouter.post(
  "/send-many",
  protectRoute,
  authorize("admin", "superadmin"),
  NotificationController.sendToMany
);

// Admin-only: broadcast to all users
notificationRouter.post(
  "/broadcast",
  protectRoute,
  authorize("admin", "superadmin"),
  NotificationController.broadcast
);

export default notificationRouter;
