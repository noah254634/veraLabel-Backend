import mongoose from "mongoose"
export const orderSchema=new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true
    },
    reference:{
        type:String,
        required:true,
        unique:true
    },
    paidAt: {
        type: Date
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment"
    },
    buyerId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Buyer",
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
        required:true,
        default:0
    },
    downloadedAt: {
        type: Date,
        default: null
    },
    buyerDownloadsCount: {
        type: Number,
        default: 0
    }

},{timestamps:true})
export default mongoose.model("Order",orderSchema);