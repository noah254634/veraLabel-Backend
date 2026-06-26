import mongoose from "mongoose";

const videoJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    datasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dataset",
      required: true,
      index: true,
    },

    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "propagating", "completed", "failed"],
      default: "pending",
      index: true,
    },

    totalFrames: {
      type: Number,
      required: true,
    },

    seedFrameIndices: {
      type: [Number],
      default: [],
    },

    propagatedFrameKeys: {
      type: [String],
      default: [],
    },

    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserVera",
      required: true,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    errorMessage: {
      type: String,
      default: null,
    },

    framesCompleted: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

videoJobSchema.index({ datasetId: 1, status: 1 });

export default mongoose.model("VideoJob", videoJobSchema);
