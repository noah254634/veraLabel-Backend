import mongoose from "mongoose";
const datasetSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    price:{
        type:Number,
        required:true
    },
    datasetLabeler:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:"UserVera",
        required:true
    },
    rating:{
        type:Number,
        default:0,
        required:true,
        min:0,
        max:10
    },
    reviews:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Review"
    }],
    datasetType:{
        type:String,
        enum:["image","text","audio","video"],
        default:"image"
    },
    datasetFormat:{
        type:String,
        enum:["csv","json","xml","excel"],
        default:["json"],
        required:true
    
    }
    
},{
    timestamps:true



});
export default mongoose.model("Dataset",datasetSchema);