import mongoose from "mongoose";
import Article from "./onboarding.articles.js";
const Schema=mongoose.Schema;
const QuizSchema=new Schema({
    quizId: {
        type: String,
        required: true
    },
    difficulty:{
        type:String,
        enum:['beginner','advanced','pro'],
        default:'beginner',
        required:true
          
    },
    question:{
        type:String,
        required:true
    },
    options:{
        type:[String],
        required:true
    },
    correctAnswer:{
        type:String,
        required:true
    },


})
export default mongoose.model("Quiz",QuizSchema)