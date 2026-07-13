import { firebaseMessaging, isFirebaseReady } from "../../config/firebase.admin.js";
import UserVera from "../users/user.model.js";
import Notification from "./notification.model.js";
import sendEmail from "../mailer/mailer.js";
import templates from "../mailer/templates.js";

export const NotificationService = {
  /**
   * Persist an FCM token against a user document.
   */
  registerToken: async (userId, token) => {
    if (!userId || !token) throw new Error("userId and token are required");
    const user = await UserVera.findByIdAndUpdate(
      userId,
      { fcmToken: token },
      { new: true }
    );
    if (!user) throw new Error("User not found");
    return { message: "Token registered successfully" };
  },

  /**
   * Send a push notification to a single user by their userId and save to DB.
   */
  sendToUser: async (userId, { title, body, data = {} }) => {
    const user = await UserVera.findById(userId);
    if (!user) throw new Error("User not found");

    // 1. Persist the notification in MongoDB
    const dbNotif = await Notification.create({
      userId,
      title,
      body,
      data,
      read: false,
    });

    // 2. Prepare FCM payload (include DB notification ID in data payload)
    const fcmData = {
      ...data,
      notificationId: dbNotif._id.toString(),
    };

    // 3. Try to dispatch push notification via FCM if user has token and FCM is configured
    if (user.fcmToken && isFirebaseReady()) {
      try {
        const message = {
          token: user.fcmToken,
          notification: { title, body },
          data: fcmData,
          webpush: {
            notification: {
              title,
              body,
              icon: "/apple-touch-icon.png",
            },
          },
        };

        const response = await firebaseMessaging().send(message);
        return { messageId: response, dbNotification: dbNotif };
      } catch (err) {
        console.warn(`[Firebase Admin] Push notification failed: ${err.message}`);
        return { warning: "Push notification failed, saved in database", dbNotification: dbNotif };
      }
    }

    return { message: "Saved in database, skipped push notification", dbNotification: dbNotif };
  },

  /**
   * Send a notification to multiple users and save to DB.
   */
  sendToMany: async (userIds, { title, body, data = {} }) => {
    if (!userIds || !userIds.length) throw new Error("userIds array is required");

    // 1. Persist the notification in MongoDB for all users
    const dbNotifs = await Notification.insertMany(
      userIds.map((userId) => ({
        userId,
        title,
        body,
        data,
        read: false,
      }))
    );

    // 2. Try to dispatch push notification via FCM
    const users = await UserVera.find({
      _id: { $in: userIds },
      fcmToken: { $ne: null },
    });

    if (users.length && isFirebaseReady()) {
      try {
        const tokens = users.map((u) => u.fcmToken);

        const multicastMessage = {
          tokens,
          notification: { title, body },
          data, // DB IDs might not be mapped 1-to-1 in multicast data since it is shared, but that is fine.
          webpush: {
            notification: {
              title,
              body,
              icon: "/apple-touch-icon.png",
            },
          },
        };

        const response = await firebaseMessaging().sendEachForMulticast(multicastMessage);
        return {
          successCount: response.successCount,
          failureCount: response.failureCount,
          dbNotificationsCount: dbNotifs.length,
        };
      } catch (err) {
        console.warn(`[Firebase Admin] Multicast failed: ${err.message}`);
        return {
          warning: "Push notification failed, saved in database",
          dbNotificationsCount: dbNotifs.length,
        };
      }
    }

    return { dbNotificationsCount: dbNotifs.length };
  },

  /**
   * Broadcast a push notification to ALL users and save to DB.
   */
  broadcast: async ({ title, body, data = {} }) => {
    // 1. Get all active/verified users in the system (or just all users?)
    const users = await UserVera.find({ deletedAt: null });
    if (!users.length) throw new Error("No users found");

    // 2. Persist the notification in MongoDB for everyone
    const dbNotifs = await Notification.insertMany(
      users.map((u) => ({
        userId: u._id,
        title,
        body,
        data,
        read: false,
      }))
    );

    // 3. Try to dispatch push notification via FCM to users with a token
    const usersWithTokens = users.filter((u) => u.fcmToken != null);

    if (usersWithTokens.length && isFirebaseReady()) {
      try {
        const tokens = usersWithTokens.map((u) => u.fcmToken);
        const chunks = [];
        for (let i = 0; i < tokens.length; i += 500) {
          chunks.push(tokens.slice(i, i + 500));
        }

        let totalSuccess = 0;
        let totalFailure = 0;

        for (const chunk of chunks) {
          const response = await firebaseMessaging().sendEachForMulticast({
            tokens: chunk,
            notification: { title, body },
            data,
            webpush: { notification: { title, body, icon: "/apple-touch-icon.png" } },
          });
          totalSuccess += response.successCount;
          totalFailure += response.failureCount;
        }

        return {
          successCount: totalSuccess,
          failureCount: totalFailure,
          dbNotificationsCount: dbNotifs.length,
        };
      } catch (err) {
        console.warn(`[Firebase Admin] Broadcast failed: ${err.message}`);
        return {
          warning: "Push notification failed, saved in database",
          dbNotificationsCount: dbNotifs.length,
        };
      }
    }

    return { dbNotificationsCount: dbNotifs.length };
  },

  /**
   * Retrieve notifications for a specific user.
   */
  getNotifications: async (userId) => {
    return await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);
  },

  /**
   * Mark a specific notification as read.
   */
  markRead: async (userId, notificationId) => {
    const notif = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { read: true },
      { new: true }
    );
    if (!notif) throw new Error("Notification not found");
    return notif;
  },

  /**
   * Mark all notifications of a user as read.
   */
  markAllRead: async (userId) => {
    await Notification.updateMany({ userId, read: false }, { read: true });
    return { message: "All notifications marked as read" };
  },

  /**
   * Delete/clear all notifications of a user.
   */
  clearAll: async (userId) => {
    await Notification.deleteMany({ userId });
    return { message: "All notifications cleared" };
  },

  /**
   * Send a custom admin email using the professional base template.
   * Accepts structured data and builds the HTML server-side.
   */
  sendCustomEmail: async ({ to, subject, heading, bodyText, signOff }) => {
    if (!to || !subject || !heading || !bodyText) {
      throw new Error("to, subject, heading, and bodyText are required");
    }
    const html = templates.customAdminEmailTemplate(heading, bodyText, signOff || '');
    await sendEmail({ to, subject, html });
    return { message: "Email sent successfully" };
  },
};
