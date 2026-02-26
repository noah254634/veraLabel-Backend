import { Schema, model, Types } from "mongoose";

const CartItemSchema = new Schema({
  datasetId: {
    type: Types.ObjectId,
    ref: "Dataset",
    required: true
  },

  titleSnapshot: {
    type: String,
    required: true
  },

  priceSnapshot: {
    type: Number,
    required: true
  },

  quantity: {
    type: Number,
    default: 1,
    min: 1
  },

  licenseType: {
    type: String, 
    required: true
  }
});

const CartSchema = new Schema(
  {
    buyerId: {
      type: Types.ObjectId,
      ref: "UserVera",
      required: true,
      unique: true
    },

    items: [CartItemSchema],

    totalAmount: {
      type: Number,
      default: 0
    },

    currency: {
      type: String,
      default: "USD"
    },

    expiresAt: {
      type: Date 
    }
  },
  { timestamps: true }
);

export default model("Cart", CartSchema);
