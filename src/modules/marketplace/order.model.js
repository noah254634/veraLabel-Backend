import mongoose from "mongoose"
export const orderSchema=new mongoose.Schema({
    buyer:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"UserVera",
        required:true

    },
    datasetId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Dataset",
        required:true
    },
    status:{
        type:String,
        enum:["pending","approved","rejected"],
        default:"pending"
    },
    totalPrice:{
        type:Number,
        required:true
    }

},{timestamps:true})
export default mongoose.model("Order",orderSchema);