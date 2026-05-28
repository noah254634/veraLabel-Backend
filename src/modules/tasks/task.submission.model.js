import mongoose from "mongoose";

const SubmissionSchema = new mongoose.Schema({
  
  submissionId: {
    type: String,
    required: true,
    unique: true
  },

  // Original task reference
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Task",
    required: true,
    index: true
  },

  // Dataset relationship
  datasetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Dataset",
    required: true,
    index: true
  },

  // Batch relationship
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
    required: false,
    index: true
  },

  // Labeller
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Labeller",
    required: true,
    index: true
  },

  // R2 output reference
  r2_output_key: {
    type: String,
    required: true
  },

  // Workflow state
  status: {
    type: String,
    enum: [
      "submitted",
      "under_review",
      "approved",
      "rejected",
      "needs_revision"
    ],
    default: "submitted",
    index: true
  },

  // Quality control score
  verificationScore: {
    type: Number,
    default: null,
    index: true
  },

  // AI review
  aiReview: {
    reviewed: {
      type: Boolean,
      default: false
    },

    modelVersion: String,

    confidenceScore: Number,

    verdict: {
      type: String,
      enum: [
        "approved",
        "rejected",
        "edge_case"
      ]
    },

    reviewedAt: Date
  },

  // Human review
  humanReview: {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    verdict: {
      type: String,
      enum: [
        "approved",
        "rejected",
        "needs_revision"
      ]
    },

    notes: String,

    reviewedAt: Date
  },

  // Export control
  isExportable: {
    type: Boolean,
    default: false,
    index: true
  },

  // Optional metrics
  metrics: {
    timeSpentSeconds: Number,
    attemptNumber: Number
  }

}, {
  timestamps: true
});

export default mongoose.model("Submission", SubmissionSchema);