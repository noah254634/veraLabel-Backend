import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    datasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dataset",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    taskType: {
      type: String,
      required: false,
    },
    description: {
      type: String,
      required: false,
    },
    rowsCount: {
      type: Number,
      required: false,
    },
    currency: {
      type: String,
      default: "USD",
    },
    tier: {
      type: String,
      required: false,
    },
    unitRate: {
      type: Number,
      required: false,
    },
    baseRate: {
      type: Number,
      required: false,
    },
    tierMultiplier: {
      type: Number,
      required: false,
    },
    breakdown: {
      items: {
        type: Number,
        required: false,
      },
      unitRate: {
        type: Number,
        required: false,
      },
      basePrice: {
        type: Number,
        required: false,
      },
      discount: {
        type: Number,
        required: false,
      },
      discountPercent: {
        type: Number,
        required: false,
      },
      engineering: {
        type: Number,
        required: false,
      },
      platform: {
        type: Number,
        required: false,
      },
      maintenance: {
        type: Number,
        required: false,
      },
    },
    price: {
      type: Number,
      required: false,
    },
    basePrice: {
      type: Number,
      required: false,
    },
    engineeringCost: {
      type: Number,
      required: false,
    },
    platformFee: {
      type: Number,
      required: false,
    },
    maintenanceCost: {
      type: Number,
      required: false,
    },
    totalCost: {
      type: Number,
      required: false,
    },
    calculatedAt: {
      type: Date,
      required: false,
    },
    paidAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Invoice", invoiceSchema);
