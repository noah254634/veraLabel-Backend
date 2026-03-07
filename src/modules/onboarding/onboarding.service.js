import TrainingMaterial from "./model/onboarding.articles.js";
import TrainingQuiz from "./model/onboarding.quizzes.js";
import UserVera from "../users/user.model.js";
import Labeller from "./model/onboarding.labeller.js";
import AssessmentAttempt from "./model/assessment.attempt.js";
export const onboardingService = {
  createLabellerProfile: async (
    userId,
    age,
    expertise,
    skillTags,
    gender,
    location,
    annotationExperience,
    languages,
  ) => {
    if (!userId || !age || !expertise || !skillTags || !gender || !location)
      throw new Error("All fields are required");
    const newUser = await Labeller.create({
      userId,
      languages,
      age,
      expertise,
      skillTags,
      gender,
      location,
      annotationExperience,
    });
    return newUser;
  },
  getLabellerProfile: async (userId) => {
    if (!userId) throw new Error("User Id reuired");
    const user = await Labeller.findOne({ userId });
    if (!user)
      throw new Error(
        "User not created,consider creating you labeller account",
      );
    return user;
  },
  updateLabellerProfile: async (
    userId,
    languages,
    age,
    expertise,
    skillTags,
  ) => {
    if (!userId) throw new Error("User ID is required");
    if (!Array.isArray(languages) || languages.length === 0)
      throw new Error("At least one language is required");
    if (!age) throw new Error("Age is required");
    if (!expertise) throw new Error("Expertise is required");
    if (!Array.isArray(skillTags) || skillTags.length === 0)
      throw new Error("At least one skill tag is required");
    const profile = await Labeller.findOne({ userId });
    if (!profile) throw new Error("Profile not found");
    profile.languages = languages;
    profile.age = age;
    profile.expertise = expertise;
    profile.skillTags = skillTags;
    await profile.save();
    return profile;
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

    // Fetch all quiz questions
    const questions = await TrainingQuiz.find({ quizId });
    if (!questions || questions.length === 0) {
      throw new Error("Quiz not found or has no active questions");
    }

    // Calculate score
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

    // Update labeler profile
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

    // Return structured result for frontend
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
};
