import mongoose from "mongoose";

const pricingSchema = new mongoose.Schema(
  {
    taskType: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      enum: ["rlhf", "images", "videos", "audio", "text", "code"],
      index: true,
    },

    baseRate: {
      type: Number,
      required: true,
      min: [0.01, "Base rate must be greater than 0"],
    },

    tierMultipliers: {
      small: { type: Number, default: 1.0, min: 0, max: 1 },
      medium: { type: Number, default: 0.9, min: 0, max: 1 },
      large: { type: Number, default: 0.8, min: 0, max: 1 },
      enterprise: { type: Number, default: 0.7, min: 0, max: 1 },
    },

    costMultipliers: {
      engineering: { type: Number, default: 0.2, min: 0 },
      platform: { type: Number, default: 0.15, min: 0 },
      maintenance: { type: Number, default: 0.25, min: 0 },
    },

    volumeThresholds: {
      small: { type: Number, default: 100 },
      medium: { type: Number, default: 1000 },
      large: { type: Number, default: 10000 },
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    specialRules: [
      {
        name: String,
        discount: Number,
        minQuantity: Number,
        maxQuantity: Number,
        validFrom: Date,
        validUntil: Date,
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    priceHistory: [
      {
        baseRate: Number,
        tierMultipliers: {
          small: Number,
          medium: Number,
          large: Number,
          enterprise: Number,
        },
        costMultipliers: {
          engineering: Number,
          platform: Number,
          maintenance: Number,
        },
        changedAt: { type: Date, default: Date.now },
        changedBy: mongoose.Schema.Types.ObjectId,
        reason: String,
      },
    ],
  },
  {
    timestamps: true,
    collection: "pricing",
  },
);

// Indexes
pricingSchema.index({ taskType: 1, isActive: 1 });
pricingSchema.index({ updatedAt: -1 });

const Pricing = mongoose.model("Pricing", pricingSchema);

export default Pricing;
