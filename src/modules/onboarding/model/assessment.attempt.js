import mongoose from "mongoose";

const AssessmentAttemptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserVera",
    required: true,
  },
  quizId: {
    type: String,
    required: true,
  },
  answers: [
    {
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Quiz",
      },
      selectedAnswer: String,
      isCorrect: Boolean,
    },
  ],
  score: {
    type: Number,
    required: true,
  },
  passed: {
    type: Boolean,
    default: false,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("AssessmentAttempt", AssessmentAttemptSchema);