import express from "express";
import authorize from "../../middlewares/authorization.middleware.js"
import { onboardingController } from "./onboarding.controller.js";

const router = express.Router();
router.use(authorize("labeller","admin"))
router.post("/createLabellerProfile",onboardingController.createLabellerProfile)
router.get("/getLabellerProfile",onboardingController.getLabellerProfile)
router.put("/updateLabellerProfile",onboardingController.updateLabellerProfile)
router.delete("/deleteLabellerProfile",onboardingController.deleteLabellerProfile)
router.post("/createTrainingMaterials",onboardingController.createTrainingMaterial)
router.post("/getTrainingMaterials",onboardingController.getTrainingMaterial)
router.delete("/deleteTrainingMaterials",onboardingController.deleteTrainingMaterial)
router.put("/updateTrainingMaterials",onboardingController.updateTrainingMaterial)
router.post("/createTrainingQuizes",onboardingController.createTrainingQuiz)
router.get("/getTrainingQuizes",onboardingController.getTrainingQuiz)
router.post("/submitTrainingQuiz",onboardingController.submitTrainingQuiz)
router.delete("/deleteTrainingQuizes",onboardingController.deleteTrainingQuiz)
router.put("/updateTrainingQuizes",onboardingController.updateTrainingQuiz)
export default router;