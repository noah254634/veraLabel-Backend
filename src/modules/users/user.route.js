import express from "express";
import {protectRoute} from "../../middlewares/auth.middleware.js";
const router=express.Router();
import { signUpcontroller,loginController,logoutController,getUserController} from "./user.controller.js";
router.post("/signup",signUpcontroller);
router.post("/login",loginController);
router.post("/logout",protectRoute,logoutController);
router.get("/", protectRoute,getUserController);
export const userRouter= router;