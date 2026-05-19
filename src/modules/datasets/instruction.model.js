import mongoose from "mongoose";

const rubricItemSchema = new mongoose.Schema({
  tag: { type: String, required: true },
  type: { type: String, enum: ["reward", "penalty", "neutral"], required: true },
  weight: { type: Number, default: 1.0 },
  description: { type: String, required: true },
  positiveExample: { type: String },
  negativeExample: { type: String },
  required: { type: Boolean, default: true },
  conditional: { type: Boolean, default: false }
});

const buyerQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  type: { type: String, enum: ["text", "textarea", "select", "multiselect"], default: "select" },
  options: [{ type: String }],
  activatesRubric: { type: String }, // Links to a rubric tag if conditional
  required: { type: Boolean, default: true }
});

const goldenExampleSchema = new mongoose.Schema({
  promptContext: { type: String, required: true },
  responseA: { type: String },
  responseB: { type: String },
  correctPreference: { type: String, enum: ["A", "B", "Tie"] },
  explanation: { type: String, required: true }
});

const edgeCaseSchema = new mongoose.Schema({
  trigger: { type: String, required: true },
  guidance: { type: String, required: true },
  type: { type: String, enum: ["Warning", "Hard Block"], default: "Warning" }
});

const scoringConfigSchema = new mongoose.Schema({
  taskTypes: [{ type: String, enum: ["Preference Ranking (A vs B)", "Dimensional Scoring (1-5)"] }],
  scoreDimensions: [{ type: String }], // e.g. ["Fluency", "Helpfulness"]
  requireRationale: { type: Boolean, default: true },
  minLength: { type: Number, default: 20 },
  allowTie: { type: Boolean, default: true }
});

const adjudicationPolicySchema = new mongoose.Schema({
  annotationMode: { type: String, enum: ["Single", "Double", "Double + Adjudication"], default: "Double" },
  conflictThreshold: { type: String, default: "2 point score gap triggers flag" },
  escalateTo: { type: String, enum: ["Senior Annotator", "Admin"], default: "Senior Annotator" },
  conflictResolution: { type: String, enum: ["Keep as Unresolved", "Majority Vote", "Force Adjudication"], default: "Keep as Unresolved" }
});

// 1. The Master Templates
const instructionTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    version: { type: String, default: "1.0.0" },
    domains: [{ type: String, enum: ["RLHF", "NLP", "Audio", "Image", "Code", "Cultural"] }],
    languageRegion: { type: String, default: "Swahili — Nairobi/Sheng" },
    labellerTier: { type: String, enum: ["Any", "Verified", "Senior Only"], default: "Verified" },
    
    buyerVisibleSummary: { type: String, required: true },
    baseDirectives: [{ type: String }], // Array of numbered steps
    
    buyerQuestions: [buyerQuestionSchema], 
    scoringConfig: scoringConfigSchema,
    rubrics: [rubricItemSchema], 
    goldenExamples: [goldenExampleSchema],
    edgeCases: [edgeCaseSchema],
    adjudicationPolicy: adjudicationPolicySchema,

    status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "UserVera" }
  },
  { timestamps: true }
);

// Auto-increment version on edit logic can be handled in controller

// 2. The Specific Dataset Instructions
const datasetInstructionSchema = new mongoose.Schema(
  {
    datasetId: { type: mongoose.Schema.Types.ObjectId, ref: "Dataset", required: true, unique: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "InstructionTemplate" },
    version: { type: String }, // Snapshot of template version
    
    buyerAnswers: [{
      question: { type: String },
      answer: { type: String }
    }],
    
    rubrics: [rubricItemSchema], 
    goldenExamples: [goldenExampleSchema],
    edgeCases: [edgeCaseSchema],
    scoringConfig: scoringConfigSchema,
    adjudicationPolicy: adjudicationPolicySchema,
    finalDirectives: [{ type: String }],
    
    isApprovedByAdmin: { type: Boolean, default: false },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "UserVera" }
  },
  { timestamps: true }
);

export const InstructionTemplate = mongoose.model("InstructionTemplate", instructionTemplateSchema);
export const DatasetInstruction = mongoose.model("DatasetInstruction", datasetInstructionSchema);
