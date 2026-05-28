import logger from "../../config/logger.js";
import { onboardingService } from "./onboarding.service.js";
import { asyncHandler, AppError } from "../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../helpers/responseHandler.js";

export const onboardingController = {
  createLabellerProfile: asyncHandler(async (req, res) => {
    const response = await onboardingService.createLabellerProfile(req.user._id, req.body);
    return ResponseHandler.created(res, response, "Labeller profile created");
  }),

  getLabellerProfile: asyncHandler(async (req, res) => {
    const response = await onboardingService.getLabellerProfile(req.user._id);
    return ResponseHandler.success(res, response, "Profile fetched");
  }),

  updateLabellerProfile: asyncHandler(async (req, res) => {
    const userId = req.user.role === "admin" && req.body.userId ? req.body.userId : req.user._id;
    const response = await onboardingService.updateLabellerProfile(userId, req.body);
    return ResponseHandler.success(res, response, "Profile updated");
  }),

  deleteLabellerProfile: asyncHandler(async (req, res) => {
    const response = await onboardingService.deleteLabellerProfile(req.user._id);
    return ResponseHandler.success(res, response, "Profile deleted");
  }),

  createTrainingMaterial: asyncHandler(async (req, res) => {
    const { title, content, module } = req.body;
    if (!title || !content || !module) throw new AppError("All fields are required", 400);
    const response = await onboardingService.createTrainingMaterial(title, content, module, req.user.email);
    return ResponseHandler.created(res, response, "Training material created");
  }),

  getTrainingMaterial: asyncHandler(async (req, res) => {
    const response = await onboardingService.getTrainingMaterial(req.user._id);
    return ResponseHandler.success(res, response, "Training material fetched");
  }),

  updateTrainingMaterial: asyncHandler(async (req, res) => {
    const { quizId } = req.params;
    const { title, content, difficulty } = req.body;
    const response = await onboardingService.updateTrainingMaterial(quizId, title, content, difficulty);
    return ResponseHandler.success(res, response, "Training material updated");
  }),

  deleteTrainingMaterial: asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) throw new AppError("Id is required", 400);
    const response = await onboardingService.deleteTrainingMaterial(id);
    return ResponseHandler.success(res, response, "Training material deleted");
  }),

  createTrainingQuiz: asyncHandler(async (req, res) => {
    const { quizId, difficulty, question, options, correctAnswer } = req.body;
    const response = await onboardingService.createTrainingQuiz(
      quizId, difficulty, question, options, correctAnswer, req.user.email,
    );
    return ResponseHandler.created(res, response, "Quiz created");
  }),

  getTrainingQuiz: asyncHandler(async (req, res) => {
    const response = await onboardingService.getTrainingQuiz(req.user._id);
    return ResponseHandler.success(res, response, "Quiz fetched");
  }),

  updateTrainingQuiz: asyncHandler(async (req, res) => {
    const { quizId } = req.params;
    const { difficulty, question, options, correctAnswer } = req.body;
    const response = await onboardingService.updateTrainingQuiz(quizId, difficulty, question, options, correctAnswer);
    return ResponseHandler.success(res, response, "Quiz updated");
  }),

  deleteTrainingQuiz: asyncHandler(async (req, res) => {
    const { QuizId } = req.params;
    const response = await onboardingService.deleteTrainingQuiz(QuizId);
    return ResponseHandler.success(res, response, "Quiz deleted");
  }),

  submitTrainingQuiz: asyncHandler(async (req, res) => {
    const { quizId, answers } = req.body;
    const response = await onboardingService.submitTrainingQuiz(req.user._id, quizId, answers);
    return ResponseHandler.success(res, response, "Quiz submitted");
  }),

  gettingStarted: asyncHandler(async (req, res) => {
    const response = await onboardingService.gettingStarted();
    return ResponseHandler.success(res, response, "Getting started data fetched");
  }),

  completeOnboarding: asyncHandler(async (req, res) => {
    const response = await onboardingService.completeOnboarding(req.user._id);
    return ResponseHandler.success(res, response, "Onboarding completed");
  }),
};
