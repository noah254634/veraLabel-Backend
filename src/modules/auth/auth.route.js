import express from "express";
import { signUpcontroller,loginController, logoutController,forgotPasswordController, verifyEmailController } from "./auth.controller.js";
import { protectRoute } from "../../middlewares/auth.middleware.js";
import  authorize  from "../../middlewares/authorization.middleware.js";
const router=express.Router();
router.post("/signup",signUpcontroller  )
router.post("/login",loginController);
router.post("/logout",protectRoute,logoutController);
router.post("/verifyEmail",verifyEmailController); 
router.post("/forgotPassword",forgotPasswordController);
export const authRouter= router;
