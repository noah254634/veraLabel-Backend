import TrainingMaterial from "./model/onboarding.articles.js";
import TrainingQuiz from "./model/onboarding.quizzes.js";
import UserVera from "../users/user.model.js";
import Labeller from "../labeller/labeller.model.js";
import AssessmentAttempt from "./model/assessment.attempt.js";
import { normalizeLabellerProfilePayload, populateLabellerUser } from "../labeller/labellerProfile.utils.js";
export const onboardingService = {
  createLabellerProfile: async (userId, payload = {}) => {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const normalizedPayload = normalizeLabellerProfilePayload(payload);
    const missingFields = [];
    if (!normalizedPayload.profile?.dateOfBirth) missingFields.push("Date of Birth");
    if (!normalizedPayload.profile?.gender) missingFields.push("Gender");
    if (!normalizedPayload.profile?.location || Object.keys(normalizedPayload.profile.location).length === 0) missingFields.push("Location");

    if (missingFields.length > 0) {
      throw new Error(`The following fields are required: ${missingFields.join(', ')}`);
    }

    const existingLabeller = await Labeller.findOne({ userId });

    if (existingLabeller) {
      const updatedLabeller = await Labeller.findOneAndUpdate(
        { userId },
        { $set: normalizedPayload },
        { new: true, runValidators: true },
      );

      return populateLabellerUser(updatedLabeller);
    }

    const newLabeller = await Labeller.create({
      userId,
      ...normalizedPayload,
    });

    return populateLabellerUser(Labeller.findById(newLabeller._id));
  },
  getLabellerProfile: async (userId) => {
    if (!userId) throw new Error("User Id reuired");
    const user = await populateLabellerUser(Labeller.findOne({ userId }));
    if (!user)
      throw new Error(
        "User not created,consider creating you labeller account",
      );
    return user;
  },
  updateLabellerProfile: async (userId, payload = {}) => {
    if (!userId) throw new Error("User ID is required");
    const normalizedPayload = normalizeLabellerProfilePayload(payload);
    if (Object.keys(normalizedPayload).length === 0) {
      throw new Error("At least one field is required");
    }

    const profile = await Labeller.findOne({ userId });
    if (!profile) throw new Error("Profile not found");
    const updatedProfile = await Labeller.findOneAndUpdate(
      { userId },
      { $set: normalizedPayload },
      { new: true, runValidators: true },
    );
    return populateLabellerUser(updatedProfile);
  },
  createTrainingMaterial: async (title, content, module, createdBy) => {
    if (!title || !content || !module || !createdBy)
      throw new Error("All fields are required");

    const newMaterial = await TrainingMaterial.create({
      title,
      content,
      module,
      createdBy,
    });

    return newMaterial;
  },
  getTrainingMaterial: async (userId) => {
    const user = await Labeller.findOne({ userId });
    if (!user) throw new Error("User not found or not labeller");
    const userLevel = user.difficulty;
    const materials = await TrainingMaterial.find({ difficulty: userLevel });
    return materials;
  },
  updateTrainingMaterial: async (quizId, title, content, difficulty) => {
    if (!quizId) throw new Error("Quiz Id is required");
    if (!title) throw new Error("Title is required");
    if (!content) throw new Error("Content is required");
    if (!difficulty) throw new Error("Difficulty is required");
    const quiz = await TrainingMaterial.findOne({ quizId });
    if (!quiz) throw new Error("Quiz not found");
    quiz.title = title;
    quiz.content = content;
    quiz.difficulty = difficulty;
    await quiz.save();
    return quiz;
  },
  deleteTrainingMaterial: async (id) => {
    if (!id) throw new Error("Id is required");
    const material = await TrainingMaterial.findOne({ _id: id });
    if (!material) throw new Error("Material not found");
    await material.remove();
    return { message: "Material deleted successfully" };
  },
  createTrainingQuiz: async (quizId, difficulty, question, options, correctAnswer) => {
    if (!quizId || !difficulty || !question || !options || !correctAnswer)
      throw new Error("All fields are required");
    const newQuiz = await TrainingQuiz.create({
      quizId,
      difficulty,
      question,
      options,
      correctAnswer,
    });
    return newQuiz;
  },
  getTrainingQuiz: async (userId) => {
    const user = await UserVera.findOne({ userId, role: "labeller" });
    if (!user) throw new Error("User  not found or not labeller");
    const labeller = await Labeller.findOne({ userId: user._id });
    if (!labeller) throw new Error("Labeller not found");
    const findMatchingQuiz = await TrainingQuiz.find({
      difficulty: labeller.difficulty,
    });
    return findMatchingQuiz;
  },
  submitTrainingQuiz: async (userId, quizId, answers) => {
    if (!userId || !quizId || !Array.isArray(answers) || answers.length === 0) {
      throw new Error("Invalid submission");
    }

    const questions = await TrainingQuiz.find({ quizId });
    if (!questions || questions.length === 0) {
      throw new Error("Quiz not found or has no active questions");
    }

    let correctCount = 0;
    const feedback = [];

    for (const question of questions) {
      const userAnswer = answers.find(
        (a) => a.questionId.toString() === question._id.toString(),
      );
      const isCorrect =
        userAnswer && userAnswer.selectedAnswer === question.correctAnswer;
      if (isCorrect) correctCount++;

      feedback.push({
        questionId: question._id,
        correct: isCorrect,
        selectedAnswer: userAnswer?.selectedAnswer || null,
        explanation: question.explanation || "",
      });
    }

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= 70; // Pass threshold

    // Save attempt
    const attempt = await AssessmentAttempt.create({
      userId,
      quizId,
      answers: feedback.map((f) => ({
        questionId: f.questionId,
        selectedAnswer: f.selectedAnswer,
        isCorrect: f.correct,
      })),
      score,
      passed,
      completed: true,
    });

    const profile = await Labeller.findOne({ userId });
    if (!profile) throw new Error("Labeler profile not found");

    if (passed) {
      profile.tier = "Silver"; // initial tier
      profile.reliabilityScore = score;
    } else {
      profile.tier = "Trainee"; // or leave as default, until retry
      profile.reliabilityScore = score;
    }

    await profile.save();

    return {
      score,
      passed,
      tier: profile.tier,
      feedback,
    };
  },
  updateTrainingQuiz: async (
    quizId,
    difficulty,
    question,
    options,
    correctAnswer,
  ) => {
    if (!quizId || !difficulty || !question || !options || !correctAnswer)
      throw new Error("All Fields are required");
    const assasementQuiz = await TrainingQuiz.findOne({ quizId });
    if (!assasementQuiz) throw new Error("No assasement quiz found");
    assasementQuiz.difficulty = difficulty;
    assasementQuiz.options = options;
    assasementQuiz.question = question;
    assasementQuiz.correctAnswer = correctAnswer;
    await assasementQuiz.save();
    return assasementQuiz;
  },
  deleteTrainingQuiz: async (id) => {
    if (!id) throw new Error("Id is required");
    const quiz = await TrainingQuiz.findOne({ _id: id });
    if (!quiz) throw new Error("Quiz not found");
    await quiz.remove();
    return { message: "Quiz deleted successfully" };
  },
  gettingStarted: async () => {
  },
  deleteLabellerProfile: async (userId) => {
    if (!userId) throw new Error("User ID is required");

    const deleted = await Labeller.findOneAndDelete({ userId });
    if (!deleted) throw new Error("Labeller profile not found");

    return { message: "Labeller profile deleted successfully" };
  },
  completeOnboarding: async (userId) => {
    if (!userId) throw new Error("User ID is required");
    const labeller = await Labeller.findOne({ userId });
    if (!labeller) throw new Error("Labeller profile not found");
    
    labeller.isOnboarded = true;
    labeller.tier = 'Bronze'; // Set initial tier after onboarding
    await labeller.save();
    
    return labeller;
  }
};
