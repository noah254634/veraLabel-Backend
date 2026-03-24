import mongoose from "mongoose";

const Schema = mongoose.Schema;

const taskSchema = new Schema({
  // 1. IDENTITY
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
  r2_taskUrl: {
    type: String,
    required: true
  },

  taskType: {
    enum:['text','audio','video','rfhlearning','image'],
    default:'text',
    type: String, 
    required: true
  },

  r2_datasetUrl: {
    type: String,
    required: true
  },

  dataset: {
    type: Schema.Types.ObjectId,
    ref: "Dataset",
  },

  r2_input_taskRef: {
    type: String, // pointer to R2 file
    required: true
  },

  // 2. ASSIGNMENT STATE
  isAssigned: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: "UserVera",
    default: null
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: "UserVera",
    default: null
  },

  assignedAt: Date,
  // 3. WORK STATE
  status: {
    type: String,
    enum: [
      "pending",     
      "in_progress",   
      "submitted",     
      "verified",     
      "rejected"       
    ],
    default: "pending"
  },

  startedAt: Date,
  completedAt: Date,

  // 4. OUTPUT 
  r2_task_resultRef: {
    type: String, // pointer to stored output 
    default:null
  },

  // optional inline result
  result: {
    type: Schema.Types.Mixed,
    default: null
  },

  // 5. QUALITY CONTROL
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: "UserVera",
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
