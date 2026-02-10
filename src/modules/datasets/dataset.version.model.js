import mongoose from "mongoose";
const versionSchema=new mongoose.Schema({
    dataset:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Dataset",
        required:true,
    },
    uploadedBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"UserVera",
        required:true,
    },
    // `timestamps: true` already manages updatedAt/createdAt.
    fileUrl:{
        type:String,
        required:true,
    
    },
    fileSize:{
        type:Number,
        required:true,
    
    },
    version:{
        type:Number,
        required:true,
    
    
    }

},{timestamps:true})
export default mongoose.model("Version",versionSchema);
