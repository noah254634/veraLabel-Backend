import { NotificationService } from "./notification.service.js";

export const NotificationController = {
  /**
   * POST /api/v1/notifications/register-token
   * Body: { token: string }
   * Authenticated — saves the browser FCM token for the logged-in user.
   */
  registerToken: async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ message: "token is required" });

      const result = await NotificationService.registerToken(req.user._id, token);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  /**
   * POST /api/v1/notifications/send
   * Body: { userId, title, body, data? }
   * Admin only — send a notification to a specific user.
   */
  sendToUser: async (req, res) => {
    try {
      const { userId, title, body, data } = req.body;
      if (!userId || !title || !body)
        return res.status(400).json({ message: "userId, title and body are required" });

      const result = await NotificationService.sendToUser(userId, { title, body, data });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  /**
   * POST /api/v1/notifications/send-many
   * Body: { userIds: string[], title, body, data? }
   * Admin only — send a notification to multiple users.
   */
  sendToMany: async (req, res) => {
    try {
      const { userIds, title, body, data } = req.body;
      if (!userIds?.length || !title || !body)
        return res.status(400).json({ message: "userIds[], title and body are required" });

      const result = await NotificationService.sendToMany(userIds, { title, body, data });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  /**
   * POST /api/v1/notifications/broadcast
   * Body: { title, body, data? }
   * Admin only — broadcast a notification to every registered user.
   */
  broadcast: async (req, res) => {
    try {
      const { title, body, data } = req.body;
      if (!title || !body)
        return res.status(400).json({ message: "title and body are required" });

      const result = await NotificationService.broadcast({ title, body, data });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  /**
   * GET /api/v1/notifications
   * Authenticated — retrieve notifications for the logged-in user.
   */
  getUserNotifications: async (req, res) => {
    try {
      const result = await NotificationService.getNotifications(req.user._id);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  /**
   * PATCH /api/v1/notifications/:id/read
   * Authenticated — mark a specific notification as read.
   */
  markRead: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await NotificationService.markRead(req.user._id, id);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  /**
   * PATCH /api/v1/notifications/read-all
   * Authenticated — mark all user notifications as read.
   */
  markAllRead: async (req, res) => {
    try {
      const result = await NotificationService.markAllRead(req.user._id);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  /**
   * DELETE /api/v1/notifications
   * Authenticated — clear all notifications of the user.
   */
  clearAll: async (req, res) => {
    try {
      const result = await NotificationService.clearAll(req.user._id);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  /**
   * POST /api/v1/notifications/send-email
   * Admin only — send a custom formatted email to a recipient.
   * Accepts structured fields; the server builds the HTML using the base template.
   */
  sendEmail: async (req, res) => {
    try {
      const { to, subject, heading, bodyText, signOff } = req.body;
      if (!to || !subject || !heading || !bodyText) {
        return res.status(400).json({ message: "to, subject, heading and bodyText are required" });
      }
      const result = await NotificationService.sendCustomEmail({ to, subject, heading, bodyText, signOff });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
};
