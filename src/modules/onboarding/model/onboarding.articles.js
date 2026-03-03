import mongoose from "mongoose";
const Schema=mongoose.Schema;
const TrainingMaterialSchema=new Schema({
    title:{
        type:String,
        required:true
    },
    content:{
        type:String,
        required:true
    },
    difficulty:{
        type:String,
        enum:['beginner','advanced','pro'],
        default:'beginner',
        required:true,
    },

})
export default mongoose.model("TrainingMaterial",TrainingMaterialSchema)