import { validateSignup } from "./auth.validation.js";
import { validateLogin } from "./auth.validation.js";
import { authService} from "./auth.service.js";
import mailService from "../mailer/mailService.js";
import { generateAccessToken,generateRefreshToken,setAuthCookies,clearAuthCookies } from "./auth.cookie.js";
import logger from "../../config/logger.js";
export const authController={
signup:async (req, res) => {
  try {
    logger.info(`Details:${JSON.stringify(req.body)} Signup attempt`);
    const dto = validateSignup(req.body);
    logger.info({ email: dto.email }, "Signup attempt");
    const user = await authService.createUser(dto);
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
},
login:async (req, res) => {
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
},
  

logout:async (req,res)=>{
    clearAuthCookies(res);
    return res.status(200).json({
        message:"User logged out successfully"
    })

},
verifyEmail:async (req,res)=>{
  const { email, token } = req.body;
  try {
    await mailService.verifyEmailAccount(email, token);
    return res.status(200).json({ message: "Email verified successfully" });
  } catch (err) {
    logger.error(`Error in email verification: ${err.message}`);
    return res.status(400).json({ error: err.message });
  }

},
forgotPassword:async(req,res)=>{
  try{
  const { email } = req.body;
  const result=await authService.forgotPassword(email);
  return res.status(200).json({message:"Password reset email sent successfully",result});
  }catch(err){
    logger.error(`Error in forgotPassword: ${err.message}`);
    return res.status(400).json({error:err.message});
  }

},
resetPassword:async(req,res)=>{
  try{
  const { email,token,password } = req.body;
  if(!email || !token || !password) return res.status(400).json({error:"All fields are required"});
  const result=await authService.resetPassword(email,token,password);
  return res.status(200).json({message:"Password reset successfully",result});
  }catch(err){
    logger.error(`Error in resetPassword: ${err.message}`);
    return res.status(400).json({error:err.message});
  }
}
}