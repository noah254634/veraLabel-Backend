import mongoose from "mongoose";
const Schema=mongoose.Schema;
const DatasetSchema=new Schema({
    buyerId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"UserVera",
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
    type:String,
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
    enum: ["pending", "processing", "done","failed"],
    default: "pending"
    },
  isPaid: {
    type: Boolean,
    default: false
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
  }
},{
    timestamps:true
});
export default mongoose.model("DatasetForBuyer",DatasetSchema);