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
    type:Number,
    required:true
  },
  format:{
    type:String,
    required:true
  },
  sourceLink: {
    type: String
  },
  fileUrl: {
    type: String
  }
});
export default mongoose.model("DatasetForBuyer",DatasetSchema);