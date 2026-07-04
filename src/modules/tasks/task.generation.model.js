import mongoose from "mongoose";

const taskGenerationRunSchema = new mongoose.Schema(
  {
    runId: { type: String, unique: true, required: true },
    category: { type: String, required: true }, // e.g. 'fintech', 'transport', 'agriculture'
    regionTags: [{ type: String }],              // e.g. ['East-Africa', 'West-Africa']
    seedParams: {
      speechLengthTarget: { type: Number },     // in seconds, e.g. 15
      codeSwitchExpected: { type: Boolean, default: false },
      customInstructions: { type: String }      // Custom prompt additions from Admin
    },
    countRequested: { type: Number, default: 10 },
    systemPromptUsed: { type: String },         // Snapshot of system prompt at run time
    userPromptUsed: { type: String },           // Snapshot of compiled user prompt at run time
    status: {
      type: String,
      enum: ['generating', 'review_required', 'completed', 'failed'],
      default: 'generating'
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserVera' }
  },
  { timestamps: true }
);

export default mongoose.model("TaskGenerationRun", taskGenerationRunSchema);
