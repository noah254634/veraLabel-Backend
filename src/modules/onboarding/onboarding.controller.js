import logger from "../../config/logger.js";
import { onboardingService } from "./onboarding.service.js";
export const onboardingController = {
  createLabellerProfile: async (req, res) => {
    try {
        logger.info(req.body);
        let {age, expertise, skillTags,gender,location,annotationExperience, } = req.body;
        if(location && location.location){
            location=location.location
        }
        if ( !age || !expertise || !skillTags||!gender||!location) {
          throw new Error("All fields are required");
        }
        const userId = req.user._id;
        const response = await onboardingService.createLabellerProfile(
          userId,
          age,
          expertise,
          skillTags,
          gender,
          location,
          annotationExperience,
        );
        return res.status(200).json(response);
    } catch (err) {
      logger.error(err.message);
      return res.status(400).json({ error: err.message });
    }
  },
  getLabellerProfile: async (req, res) => {
    try {
        const response=await onboardingService.getLabellerProfile(req.user._id);
        return res.status(200).json(response);
    }catch(err){
      return res.status(400).json({error:err.message});
    }
  },
  updateLabellerProfile: async (req, res) => {
    try {
        const { languages, age, expertise, skillTags } = req.body;
        let userId = req.user._id;
        if (req.user.role === "admin" && req.body.userId) {
          userId = req.body.userId;
        }
        const response=await onboardingService.updateLabellerProfile(userId,languages,age,expertise,skillTags);
        return res.status(200).json(response);
    }catch(err){
      return res.status(400).json({error:err.message});
    }
  },
  deleteLabellerProfile: async (req, res) => {
    try {
        const response=await onboardingService.deleteLabellerProfile(req.user._id);
        return res.status(200).json(response,{message:"Labeller profile deleted successfully"});
    }catch(err){
      return res.status(400).json({error:err.message});
    }
  },
  createTrainingMaterial: async (req, res) => {
    try {
      const { title, content, module } = req.body;
      if (!title || !content || !module) {
        throw new Error("All fields are required");
      }
      const createdBy = req.user.email;
      const response = await onboardingService.createTrainingMaterial(
        title,
        content,
        module,
        createdBy,
      );
      return res.status(200).json(response);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
  getTrainingMaterial: async (req, res) => {
    try {
      const userId = req.user._id;
      const reponse = await onboardingService.getTrainingMaterial(userId);
      return res.status(200).json(response);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
  updateTrainingMaterial: async (req, res) => {
    const {quizId}=req.params;
    const {title,content,difficulty}=req.body
    const response=await onboardingService.updateTrainingMaterial(quizId,title,content,difficulty);
    return res.status(200).json(response)
  },
  deleteTrainingMaterial: async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) throw new Error("Id is required");
      const response = await onboardingService.deleteTrainingMaterial(id);
      return res.status(200).json(response);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
  createTrainingQuiz: async (req, res) => {
    try {
      const { quizId, difficulty, question, options, correctAnswer } = req.body;
      const createdBy = req.user.email;
      const response = await onboardingService.createTrainingQuiz(
        quizId,
        difficulty,
        question,
        options,
        correctAnswer,
        createdBy,
      );
      return res.status(200).json(response);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
  getTrainingQuiz: async (req, res) => {
    try {
      const userId = req.user._id;
      const response = await onboardingService.getTrainingQuiz(userId);
      return res.status(200).json(response);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
  updateTrainingQuiz: async (req, res) => {
    const {quizId}=req.params;
    const {difficulty,question,options,correctAnswer}=req.body;
    const response=await onboardingService.updateTrainingQuiz(quizId,difficulty,question,options,correctAnswer);
    return res.status(200).json(response)
  },
  deleteTrainingQuiz: async (req, res) => {
    const {QuizId}=req.params;
    const response=await onboardingService.deleteTrainingQuiz(QuizId)
    return res.status(200).json(response)
  },
  submitTrainingQuiz: async (req, res) => {
    try {
      const { quizId, answers } = req.body;
      const userId = req.user._id;
      const response = await onboardingService.submitTrainingQuiz(
        userId,
        quizId,
        answers,
      );
      return res.status(200).json(response);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  gettingStarted: async (req, res) => {
    try {
      const response = await onboardingService.gettingStarted();
      return res.status(200).json(response);
    }catch(err){
      return res.status(400).json({error:err.message});
    }
  },
};
