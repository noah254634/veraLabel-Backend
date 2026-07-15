import express from "express";
import multer from "multer";
import { protectRoute } from "../../middlewares/auth.middleware.js";
import authorize from "../../middlewares/authorization.middleware.js";
import { NotificationController } from "./notification.controller.js";

const notificationRouter = express.Router();

// Multer with memory storage for email attachments (max 5 files, 10MB each)
const emailAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

// Any authenticated user can register their own token
notificationRouter.post(
  "/register-token",
  protectRoute,
  NotificationController.registerToken
);

notificationRouter.get(
  "/",
  protectRoute,
  NotificationController.getUserNotifications
);

// Mark all notifications as read (Must be defined before "/:id/read" to prevent wildcard conflicts)
notificationRouter.patch(
  "/read-all",
  protectRoute,
  NotificationController.markAllRead
);

// Mark a specific notification as read
notificationRouter.patch(
  "/:id/read",
  protectRoute,
  NotificationController.markRead
);

// Clear all notifications for the authenticated user
notificationRouter.delete(
  "/",
  protectRoute,
  NotificationController.clearAll
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

// Admin-only: send a custom formatted email (with optional file attachments)
notificationRouter.post(
  "/send-email",
  protectRoute,
  authorize("admin", "superadmin"),
  emailAttachmentUpload.array("attachments", 5),
  NotificationController.sendEmail
);

export default notificationRouter;
