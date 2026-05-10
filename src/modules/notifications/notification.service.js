import { firebaseMessaging } from "../../config/firebase.admin.js";
import UserVera from "../users/user.model.js";

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
   * Send a push notification to a single user by their userId.
   */
  sendToUser: async (userId, { title, body, data = {} }) => {
    const user = await UserVera.findById(userId);
    if (!user) throw new Error("User not found");
    if (!user.fcmToken) throw new Error("User has no registered FCM token");

    const message = {
      token: user.fcmToken,
      notification: { title, body },
      data,
      webpush: {
        notification: {
          title,
          body,
          icon: "/apple-touch-icon.png",
        },
      },
    };

    const response = await firebaseMessaging().send(message);
    return { messageId: response };
  },

  /**
   * Send a notification to multiple users by an array of userIds.
   */
  sendToMany: async (userIds, { title, body, data = {} }) => {
    const users = await UserVera.find({
      _id: { $in: userIds },
      fcmToken: { $ne: null },
    });

    if (!users.length) throw new Error("No users with registered tokens found");

    const tokens = users.map((u) => u.fcmToken);

    const multicastMessage = {
      tokens,
      notification: { title, body },
      data,
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
    };
  },

  /**
   * Broadcast a push notification to ALL users with a registered token.
   */
  broadcast: async ({ title, body, data = {} }) => {
    const users = await UserVera.find({ fcmToken: { $ne: null } });
    if (!users.length) throw new Error("No users with registered tokens");

    const tokens = users.map((u) => u.fcmToken);

    // FCM multicast supports up to 500 tokens per call — chunk if needed
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

    return { successCount: totalSuccess, failureCount: totalFailure };
  },
};
