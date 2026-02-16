import { validateSignup } from "./auth.validation.js";
import { validateLogin } from "./auth.validation.js";
import { createUser,loginUser } from "./auth.service.js";
import mailService from "../mailer/mailService.js";
import { generateAccessToken,generateRefreshToken,setAuthCookies,clearAuthCookies } from "./auth.cookie.js";
import logger from "../../config/logger.js";
export const signUpcontroller = async (req, res) => {
  try {
    logger.info(`Details:${JSON.stringify(req.body)} Signup attempt`);
    const dto = validateSignup(req.body);
    logger.info({ email: dto.email }, "Signup attempt");
    const user = await createUser(dto);
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setAuthCookies(res, accessToken, refreshToken);
    await mailService.sendWelcomeEmail(user.email, user.name);
    return res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
export const loginController = async (req, res) => {
    try{
        const dto = validateLogin(req.body);
        logger.info({ email: dto.email }, "Login attempt");
        const user=await loginUser(dto);
        const accessToken=generateAccessToken(user);
        const refreshToken=generateRefreshToken(user);
        setAuthCookies(res,accessToken,refreshToken);
        await mailService.sendWelcomeEmail(user.email, user.name);
        logger.info(`User ${user.email} logged in successfully`);
        return res.status(200).json({
            message:"User logged in successfully",
            user
        })
    }catch(err){
        return res.status(400).json({error:err.message});
    }
}
  

export const logoutController=(req,res)=>{
    clearAuthCookies(res);
    return res.status(200).json({
        message:"User logged out successfully"
    })

}
export const verifyEmailController=(req,res)=>{

}
export const forgotPasswordController=(req,res)=>{

}
export const resetPasswordController=(req,res)=>{

}
