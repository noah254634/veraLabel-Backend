import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Buyer",
    required: true
  },

  type: {
    type: String, // "ORDER_SUCCESS", "PAYMENT_FAILED", etc.
    required: true
  },

  title: String,
  message: String,

  relatedEntityId: mongoose.Schema.Types.ObjectId, // e.g., orderId
  relatedEntityType: String, // "Order", "Dataset"

  isRead: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });
export default mongoose.model("Notification", NotificationSchema);