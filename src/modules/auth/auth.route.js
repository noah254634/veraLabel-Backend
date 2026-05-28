import express from "express";
import { protectRoute } from "../../middlewares/auth.middleware.js";
import  authorize  from "../../middlewares/authorization.middleware.js";
import { authController } from "./auth.controller.js";
const router=express.Router();
router.post("/signup",authController.signup);
router.post("/login",authController.login);
router.post("/logout",protectRoute,authController.logout);
router.post("/refresh-token", authController.refreshToken);
router.post("/verifyEmail",authController.verifyEmail); 
router.post("/resend-verification",authController.resendVerification);
router.post("/forgotPassword",authController.forgotPassword);
router.post("/resetPassword",authController.resetPassword);
router.get("/me",protectRoute,authController.getMe)
export const authRouter= router;
