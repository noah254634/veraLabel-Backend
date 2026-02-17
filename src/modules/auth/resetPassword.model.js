import mongoose from "mongoose";
const resetPasswordSchema=new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"UserVera",
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    token:{
        type:String,
        required:true
    },
    expiresAt:{
        type:Date,
        required:true
    }
});
export default mongoose.model("ResetPassword",resetPasswordSchema);