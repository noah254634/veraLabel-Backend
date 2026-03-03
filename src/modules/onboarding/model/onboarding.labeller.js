import mongoose from "mongoose";
import UserVera from "../../users/user.model.js"
const LabellerSchema=new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref:"UserVera"
    },
    languages:{
        type:[String],
        required:true
    },
    isOnboarded:{
        type:Boolean,
        default:false
    },
    gender:{
        type:String,
        enum:['male','female','other'],
        default:'male'
    },
    age:{
        type:Number,
        required:true
    },
    expertise:{
        type:[String],
        required:true
    },
    assignedTasks:{
        type:[mongoose.Schema.Types.ObjectId],
        ref:"Task"
    },
    completedTasks:{
        type:[mongoose.Schema.Types.ObjectId],
        ref:"Task"
    },
    skillTags:{
        type:[String],
        required:true
    },
    tier:{
        type:String,
        enum:['Trainee','Bronze','Silver','Gold'],
        default:'Trainee'
    },
    reliabilityScore:{
        type:Number,
        default:0
    },
    difficulty:{
        type:String,
        enum:['beginner','advanced','pro'],
        default:'beginner'
    }
    



})
export default mongoose.model("Labeller",LabellerSchema)