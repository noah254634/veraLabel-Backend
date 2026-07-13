import mongoose from "mongoose";

const batchSchema = new mongoose.Schema(
  {
    batchId: { type: String, unique: true },
    datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true },
    tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }], // Array of Task references
    category: { type: String, index: true, default: null }, // category classification e.g. fintech, agriculture
    
    // Progress Tracking
    totalTasks: { type: Number, default: 0 },
    completedTasks: { type: Number, default: 0 },
    
    status: {
      type: String,
      enum: ['available', 'in_progress', 'completed', 'under_review', 'reviewed', 'flagged', 'expired'],
      default: 'available'
    },
    
    // Assignment info
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Labeller' }], // Array of Labeller IDs
    assignedAt: { type: Date },
    expiresAt: { type: Date }, // For auto-revocation logic
    labellerAssignments: [
      {
        labellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Labeller', required: true },
        assignedAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true }
      }
    ],
    completedAt: { type: Date },

    // Review assignment info
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Reviewer', default: null },
    reviewLockedAt: { type: Date, default: null },
    reviewExpiresAt: { type: Date, default: null },
    
    batchType: { type: String }, // primary content modality for the batch
    labellingMethod: {
      type: String,
      enum: ["rlhf", "classification", "annotation", "transcription"],
    },
    priority: { type: Number, default: 0 },
    maxLabellers: { type: Number, default: 1 }
  },
  { timestamps: true }
);

// Indexes for high-performance batch claiming and monitoring
batchSchema.index({ datasetId: 1, status: 1, priority: -1 });
batchSchema.index({ assignedTo: 1, status: 1 });

export default mongoose.model("Batch", batchSchema);