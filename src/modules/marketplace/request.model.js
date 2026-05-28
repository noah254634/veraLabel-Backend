import mongoose from "mongoose";
const Schema=mongoose.Schema;
const DatasetSchema=new Schema({
    buyerId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Buyer",
    required:true
  },
   domain:{
    type:String,
    required:true
  },
  description:{
    type:String,
    required:true
  },
  volume:{
    type:String,
    required:true
  },
  budget:{
    type:Number,
    required:true
  },
  format:{
    type:String,
    required:true
  },
  timeline:{
    type:String,
    enum:["Expedited","Express","Premium","Fast","Standard","Relaxed","Budget","Comprehensive"],
    required:true
  },
  qualityMetrics:{
    type:String,
  },
  sourceLink: {
    type: String
  },
  fileUrl: {
    type: String,
    required:true
  },
  status: {
    type: String,
    enum: ["pending", "awaiting_payment", "in_progress", "completed", "registration_failed", "cancelled"],
    default: "pending"
  },
  paidAt: {
    type: Date
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  invoice: {
    taskType: String,
    description: String,
    rowsCount: Number,
    currency: String,
    tier: String,
    unitRate: Number,
    baseRate: Number,
    tierMultiplier: Number,
    breakdown: {
      items: Number,
      unitRate: Number,
      basePrice: Number,
      discount: Number,
      discountPercent: Number,
      engineering: Number,
      platform: Number,
      maintenance: Number,
    },
    price: Number,
    basePrice: Number,
    engineeringCost: Number,
    platformFee: Number,
    maintenanceCost: Number,
    totalCost: Number,
    calculatedAt: Date,
  },
  itemsCompleted: {
    type: Number,
    default: 0
  },
  assignedLabelerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserVera"
  },
  downloadUrl: {
    type: String
  },
  reportReason: {
    type: String
  },
  canBeCancelled: {
    type: Boolean,
    default: true
  },
  datasetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Dataset"
  }
},{
    timestamps:true
});
export default mongoose.model("DatasetForBuyer",DatasetSchema);