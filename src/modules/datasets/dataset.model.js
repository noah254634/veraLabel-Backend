import mongoose from "mongoose";
const datasetSchema = new mongoose.Schema(
  {
    purchaseCount: {
      type: Number,
      default: 0,
    },
    downloadsCount: {
      type: Number,
      default: 0,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    version: {
      type: Number,
      default: 1,
      required: true,
    },
    size: {
      type: Number,
      required: false,
    },
    price: {
      type: Number,
      required: true,
    },
    datasetLabeler: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserVera",
      required: true,
    },
    rating: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
      max: 10,
    },
    saleType: {
      type: String,
      enum: ["normal", "exclusive"],
      default: "normal",
    },
    isSold: {
      type: Boolean,
      default: false,
    },
    exclusiveBuyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserVera",
      default: null,
    },
    exclusivePrice: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    metadata: {
      numRecords: { type: Number, required: true },
      dataType: {
        type: String,
        enum: ["image", "text", "audio", "tabular"],
        required: true,
      },
      labels: { type: [String], required: true },
      sizeMB: { type: Number, required: true },
      collectedAt: { type: String, required: true }, // could be range or year
      features: { type: [String], required: true },
    },
    visibility:{
        type:String,
        enum:["public","private","enterprise"],
        default:"private"
    },
    reviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
    datasetType: {
      type: String,
      enum: ["image", "text", "audio", "video"],
      default: "image",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "taken_down", "rejected"],
      default: "pending",
    },
    datasetFormat: {
      type: String,
      enum: ["csv", "json", "xml", "excel"],
      default: "json",
      required: true,
    },
    isFlagged: {
      flagged: {
        type: Boolean,
        default: false,
      },
      reason: {
        type: String,
        default: "",
      },
    },
    filePath: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  },
);
export default mongoose.model("Dataset", datasetSchema);
