import mongoose from "mongoose";

const Schema = mongoose.Schema;

const taskSchema = new Schema({
  // 1. IDENTITY & REFERENCES (NO RAW CONTENT)
  taskId: {
    type: String,
    required: true,
    unique: true
  },
  split: {
    type: String,
    enum: ["train", "validation", "test"],
    required: true
  },
  taskName: {
    type: String,
    required: true
  },

  /** @deprecated Use contentType — kept in sync for legacy clients */
  taskType: {
    enum: ['text', 'audio', 'video', 'rfhlearning', 'image', 'code', 'document'],
    default: 'text',
    type: String,
    required: true,
  },

  contentType: {
    enum: ['text', 'audio', 'video', 'image', 'code', 'document'],
    default: 'text',
    type: String,
    required: false,
  },

  // R2 STORAGE REFERENCES (use these to fetch content)
  r2_datasetUrl: {
    type: String,
    required: true,
    description: 'Reference path in R2 for the dataset'
  },

  r2_input_taskRef: {
    type: String,
    required: true,
    description: 'Reference path in R2 for the input file'
  },

  // Optional: Pre-signed URL for quick access (expires after TTL)
  r2_presignedUrl: {
    type: String,
    default: null,
    description: 'Temporary pre-signed URL to access content (cache only)'
  },

  r2_presignedUrlExpiresAt: {
    type: Date,
    default: null,
    description: 'When the pre-signed URL expires'
  },

  datasetId: {
    type: Schema.Types.ObjectId,
    ref: "Dataset",
    required: true
  },

  batchId: {
    type: Schema.Types.ObjectId,
    ref: "Batch",
    default: null
  },

  // 2. ASSIGNMENT STATE
  isAssigned: {
    type: Boolean,
    default: false
  },

  assignedTo: [{
    type: Schema.Types.ObjectId,
    ref: "Labeller"
  }],

  assignedAt: Date,

  // 3. WORK STATE
  status: {
    type: String,
    enum: [
      "pending",
      "in_progress",
      "submitted",
      "verified",
      "rejected",
      "flagged"       // Labeller reported issue — goes to admin review queue
    ],
    default: "pending"
  },

  // Labeller flag fields
  flagReason: { type: String, default: null },
  flagDetail: { type: String, default: null },
  flaggedBy: { type: Schema.Types.ObjectId, ref: "UserVera", default: null },
  flaggedAt: { type: Date, default: null },

  startedAt: Date,
  completedAt: Date,

  // 4. RESULT (REFERENCE ONLY, NOT RAW DATA)
  r2_task_resultRef: {
    type: String,
    default: null,
    description: 'Reference path in R2 for the result/annotation'
  },

  // Result metadata (not raw content)
  resultMetadata: {
    size: Number,
    hash: String,
    uploadedAt: Date
  },

  // 5. QUALITY CONTROL
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: "Reviewer",
    default: null
  },

  isAvailable: {
    type: Boolean,
    default: true
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  verificationScore: Number,

  rejectionReason: String,

  // 6. METADATA
  priority: {
    type: Number,
    default: 0
  },

  tags: [String]

}, { timestamps: true });
taskSchema.index({ createdAt: 1 })
taskSchema.index({ updatedAt: 1, status: 1})
taskSchema.index({_id:1,status:1})

export default mongoose.model("Task", taskSchema);
