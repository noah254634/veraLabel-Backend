import { validateSignup } from "./auth.validation.js";
import { validateLogin } from "./auth.validation.js";
import { authService} from "./auth.service.js";
import mailService from "../mailer/mailService.js";
import { generateAccessToken,generateRefreshToken,setAuthCookies,clearAuthCookies, setAccessTokenCookie } from "./auth.cookie.js";
import logger from "../../config/logger.js";
import { asyncHandler, AppError } from "../../middlewares/errorHandler.middleware.js";

export const authController={
  getMe: asyncHandler(async (req,res)=>{
    const user=req.user;
    if (!user) throw new AppError("User not found", 404);
    return res.status(200).json({
      message:"User fetched successfully",
      user
    })
  }),
  
signup: asyncHandler(async (req, res) => {
    const dto = validateSignup(req.body);
    logger.info({ email: dto.email }, "Signup attempt");
    const user = await authService.createUser(dto);
    if (!user) throw new AppError("Failed to create user", 400);
    
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setAuthCookies(res, accessToken, refreshToken);
    return res.status(201).json({
      message: "User created successfully",
      user,
    });
}),

login: asyncHandler(async (req, res) => {
    const dto = validateLogin(req.body);
    logger.debug({ email: dto.email }, "Login attempt");
    const user=await authService.loginUser(dto);
    if (!user) throw new AppError("Invalid credentials", 401);
    
    // Remove password from user object before sending
    const userResponse = user.toObject ? user.toObject() : user;
    delete userResponse.password;
    
    const accessToken=generateAccessToken(user);
    const refreshToken=generateRefreshToken(user);
    setAuthCookies(res,accessToken,refreshToken);
    return res.status(200).json({
        message:"User logged in successfully",
        user: userResponse
    })
}),
  
refreshToken: asyncHandler(async (req, res) => {
    const { refreshToken } = req.cookies;
    if (!refreshToken) throw new AppError("Refresh token not found", 401);

    const accessToken = await authService.refreshAccessToken(refreshToken);
    if (!accessToken) throw new AppError("Token refresh failed", 401);
    
    setAccessTokenCookie(res, accessToken);
    return res.status(200).json({ message: "Access token refreshed successfully" });
}),

logout: asyncHandler(async (req,res)=>{
    clearAuthCookies(res);
    return res.status(200).json({
        message:"User logged out successfully"
    })
}),

verifyEmail: asyncHandler(async (req,res)=>{
  const { email, token } = req.body;
  if (!email || !token) throw new AppError("Email and token are required", 400);
  
  await mailService.verifyEmailAccount(email, token);
  return res.status(200).json({ message: "Email verified successfully" });
}),

forgotPassword: asyncHandler(async(req,res)=>{
  const { email } = req.body;
  if (!email) throw new AppError("Email is required", 400);
  
  const result=await authService.forgotPassword(email);
  return res.status(200).json({message:"Password reset email sent successfully",result});
}),

resetPassword: asyncHandler(async(req,res)=>{
  const { email,token,password } = req.body;
  if(!email || !token || !password) throw new AppError("All fields are required", 400);
  
  const result=await authService.resetPassword(email,token,password);
  return res.status(200).json({message:"Password reset successfully",result});
})
}