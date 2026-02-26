import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  buyerId: {
    type: ObjectId,
    ref: "User",
    required: true
  },

  type: {
    type: String, // "ORDER_SUCCESS", "PAYMENT_FAILED", etc.
    required: true
  },

  title: String,
  message: String,

  relatedEntityId: ObjectId, // e.g., orderId
  relatedEntityType: String, // "Order", "Dataset"

  isRead: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });
export default mongoose.model("Notification", NotificationSchema);