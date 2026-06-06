import express from "express";
import authorize from "../../middlewares/authorization.middleware.js"
import { onboardingController } from "./onboarding.controller.js";
import { attachLabeller } from "../../middlewares/labeller.middleware.js";
const router = express.Router();
router.use(authorize("labeller", "labeler", "admin"))
router.post("/createLabellerProfile", attachLabeller, onboardingController.createLabellerProfile)
router.get("/getLabellerProfile", attachLabeller, onboardingController.getLabellerProfile)
router.put("/updateLabellerProfile", attachLabeller, onboardingController.updateLabellerProfile)
router.delete("/deleteLabellerProfile", attachLabeller, onboardingController.deleteLabellerProfile)
router.post("/createTrainingMaterials", attachLabeller, onboardingController.createTrainingMaterial)
router.post("/getTrainingMaterials", attachLabeller, onboardingController.getTrainingMaterial)
router.delete("/deleteTrainingMaterials", attachLabeller, onboardingController.deleteTrainingMaterial)
router.put("/updateTrainingMaterials", attachLabeller, onboardingController.updateTrainingMaterial)
router.post("/createTrainingQuizes", attachLabeller, onboardingController.createTrainingQuiz)
router.get("/getTrainingQuizes", attachLabeller, onboardingController.getTrainingQuiz)
router.post("/submitTrainingQuiz", attachLabeller, onboardingController.submitTrainingQuiz)
router.post("/completeOnboarding", attachLabeller, onboardingController.completeOnboarding)
router.delete("/deleteTrainingQuizes", attachLabeller, onboardingController.deleteTrainingQuiz)
router.put("/updateTrainingQuizes", attachLabeller, onboardingController.updateTrainingQuiz)
export default router;