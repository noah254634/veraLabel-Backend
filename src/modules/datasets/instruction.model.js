import mongoose from "mongoose";

const rubricItemSchema = new mongoose.Schema({
  tag: { type: String, required: true },
  type: { type: String, enum: ["reward", "penalty", "neutral"], required: true },
  weight: { type: Number, default: 1.0 },
  severity: { type: String, enum: ["Low", "Medium", "High", "Critical"], default: "Medium" },
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

const scoringAnchorSchema = new mongoose.Schema({
  min: { type: String, default: "Completely fails this dimension" }, // What score 1 means
  max: { type: String, default: "Perfectly meets this dimension" }   // What score 5 means
}, { _id: false });

const scoringConfigSchema = new mongoose.Schema({
  taskTypes: [{ type: String, enum: ["Preference Ranking (A vs B)", "Dimensional Scoring (1-5)"] }],
  scoreDimensions: [{ type: String }], // e.g. ["Fluency", "Helpfulness"]
  dimensionWeights: [{ type: Number }], // Parallel array to scoreDimensions
  scoringAnchors: { type: Map, of: scoringAnchorSchema, default: {} }, // dim → {min, max}
  requireRationale: { type: Boolean, default: true },
  minLength: { type: Number, default: 20 },
  allowTie: { type: Boolean, default: true },
  tieRequiresJustification: { type: Boolean, default: true } // Tie must have written reason
});

const adjudicationPolicySchema = new mongoose.Schema({
  annotationMode: { type: String, enum: ["Single", "Double", "Double + Adjudication"], default: "Double" },
  conflictThreshold: { type: String, default: "If any single dimension score differs by 2+ points between labellers → flag for adjudication" },
  escalateTo: { type: String, enum: ["Senior Annotator", "Admin"], default: "Senior Annotator" },
  conflictResolution: { type: String, enum: ["Keep as Unresolved", "Majority Vote", "Force Adjudication"], default: "Keep as Unresolved" }
});

const labellerConfigSchema = new mongoose.Schema({
  labellerTier: { type: String, enum: ["Any", "Verified", "Senior Only"], default: "Verified" },
  labellerCount: { type: Number, default: 3 },
  timeframeDays: { type: Number, default: 14 }
});

const aiReviewConfigSchema = new mongoose.Schema({
  enableAIReview: { type: Boolean, default: false },
  modelName: { type: String, default: "gpt-4o" },
  temperature: { type: Number, default: 0.1 },
  systemPrompt: {
    type: String,
    default: `You are an expert quality reviewer for Swahili and Sheng RLHF annotation data. You will receive a task containing a prompt, two responses, and a labeller submission.

Evaluate the labeller submission on:
1. Did they correctly identify the register of the prompt?
2. Does their preferred response genuinely match that register?
3. Are their dimensional scores consistent with their rationale?
4. Did they penalize natural code-switching incorrectly?
5. Did they select Tie appropriately or to avoid deciding?

Strictly enforce the following anti-patterns (Explicit "Do Not Do" instructions):
- Do not penalize a response for containing English words — code-switching is natural in Sheng.
- Do not prefer a longer response simply because it feels more thorough.
- Do not select Tie because you are unsure — Tie means genuinely equal quality.
- Do not score Fluency low just because a response uses Sheng you personally don't use — regional variation is valid (e.g. differences between Nairobi Sheng and Coast Sheng).

Return JSON only:
{
  "confidence": 0.0-1.0,
  "winner_agreement": true/false,
  "score_consistency": true/false,
  "language_flags": [],
  "escalate": true/false,
  "reason": "one sentence"
}`
  }
});

// 1. The Master Templates
const instructionTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    version: { type: String, default: "1.0.0" },
    domains: [{ type: String, enum: ["RLHF", "NLP", "Audio", "Image", "Code", "Cultural", "Medical"] }],
    languageRegion: { type: String, default: "Swahili — Nairobi/Sheng" },
    
    buyerVisibleSummary: { type: String, required: true },
    baseDirectives: [{ type: String }], // Array of numbered steps
    antiPatterns: [{ type: String }], // Array of explicitly forbidden actions
    
    labellerConfig: labellerConfigSchema,
    buyerQuestions: [buyerQuestionSchema], 
    scoringConfig: scoringConfigSchema,
    rubrics: [rubricItemSchema], 
    goldenExamples: [goldenExampleSchema],
    edgeCases: [edgeCaseSchema],
    adjudicationPolicy: adjudicationPolicySchema,
    aiReviewConfig: aiReviewConfigSchema,

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
    
    labellerConfig: labellerConfigSchema,
    rubrics: [rubricItemSchema], 
    goldenExamples: [goldenExampleSchema],
    edgeCases: [edgeCaseSchema],
    scoringConfig: scoringConfigSchema,
    adjudicationPolicy: adjudicationPolicySchema,
    aiReviewConfig: aiReviewConfigSchema,
    finalDirectives: [{ type: String }],
    antiPatterns: [{ type: String }],
    
    isApprovedByAdmin: { type: Boolean, default: false },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "UserVera" }
  },
  { timestamps: true }
);

export const InstructionTemplate = mongoose.model("InstructionTemplate", instructionTemplateSchema);
export const DatasetInstruction = mongoose.model("DatasetInstruction", datasetInstructionSchema);
