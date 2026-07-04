import mongoose from "mongoose";
const datasetSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["custom", "marketplace"],
      default: "marketplace",
    },
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
    pricePerBatch: {
      type: Number,
      default: 0,
    },
    datasetLabeler: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Labeller",
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
      ref: "Buyer",
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
      numRecords: { type: Number, required: false },
      dataType: {
        type: String,
        enum: ["image", "text", "audio", "tabular"],
        required: false,
      },
      labels: { type: [String], required: false },
      sizeMB: { type: Number, required: false },
      collectedAt: { type: String, required: false },
      features: { type: [String], required: false },
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
      enum: ["image", "text", "audio", "video", "RLHF", "NLP", "Audio", "Tabular"],
      default: "image",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "approved", "taken_down", "rejected", "awaiting_payment", "in_progress", "completed", "registration_failed", "cancelled"],
      default: "pending",
    },
    datasetFormat: {
      type: String,
      enum: ["csv", "json", "xml", "excel", "JSONL", "jsonl", "txt", "TXT", "wav", "WAV", "mp3", "MP3", "parquet", "PARQUET"],
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
    rows: {
      type: Number,
      required: false,
    },
    rowsCompleted: {
      type: Number,
      default: 0,
    },
    filePath: {
      type: String,
      required: false,
    },

    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Buyer",
      required: false,
    },
    isCollection: {
      type: Boolean,
      default: false,
    },
    domain: {
      type: String,
      required: false,
    },
    labellingMethod: {
      type: String,
      enum: ["rlhf", "classification", "annotation", "transcription"],
      required: false,
    },
    contentType: {
      type: String,
      enum: ["text", "audio", "video", "image", "code", "document"],
      required: false,
    },
    volume: {
      type: String,
      required: false,
    },
    budget: {
      type: Number,
      required: false,
    },
    format: {
      type: String,
      required: false,
    },
    timeline: {
      type: String,
      enum: ["Expedited", "Express", "Premium", "Fast", "Standard", "Relaxed", "Budget", "Comprehensive"],
      required: false,
    },
    qualityMetrics: {
      type: String,
      required: false,
    },
    sourceLink: {
      type: String,
      required: false,
    },
    fileUrl: {
      type: String,
      required: false,
    },
    paidAt: {
      type: Date,
      required: false,
    },
    startedAt: {
      type: Date,
      required: false,
    },
    completedAt: {
      type: Date,
      required: false,
    },
    itemsCompleted: {
      type: Number,
      default: 0,
    },
    assignedLabelerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Labeller",
      required: false,
    },
    downloadUrl: {
      type: String,
      required: false,
    },
    reportReason: {
      type: String,
      required: false,
    },
    canBeCancelled: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    maxLabellers: {
      type: Number,
      default: 1,
    },
    instructionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DatasetInstruction",
      required: false,
    },
    consensusIoU: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);
export default mongoose.model("Dataset", datasetSchema);
