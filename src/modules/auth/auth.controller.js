import { validateSignup } from "./auth.validation.js";
import { validateLogin } from "./auth.validation.js";
import { authService} from "./auth.service.js";
import mailService from "../mailer/mailService.js";
import { generateAccessToken,generateRefreshToken,setAuthCookies,clearAuthCookies, setAccessTokenCookie } from "./auth.cookie.js";
import logger from "../../config/logger.js";
import { asyncHandler, AppError } from "../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../helpers/responseHandler.js";
import { validateRequiredFields } from "../../helpers/validationHelpers.js";

export const authController={
  getMe: asyncHandler(async (req,res)=>{
    const user=req.user;
    if (!user) throw new AppError("User not found", 404);
    return ResponseHandler.success(res, { user }, "User fetched successfully");
  }),
  
  signup: asyncHandler(async (req, res) => {
    const dto = validateSignup(req.body);
    logger.info({ email: dto.email }, "Signup attempt");
    const user = await authService.createUser(dto);
    if (!user) throw new AppError("Failed to create user", 400);
    
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setAuthCookies(res, accessToken, refreshToken);
    return ResponseHandler.created(res, { user }, "User created successfully");
  }),

  login: asyncHandler(async (req, res) => {
    const dto = validateLogin(req.body);
    logger.debug({ email: dto.email }, "Login attempt");
    const user=await authService.loginUser(dto);
    if (!user) throw new AppError("Invalid credentials", 401);
    
    const userResponse = user.toObject ? user.toObject() : user;
    delete userResponse.password;
    
    const accessToken=generateAccessToken(user);
    const refreshToken=generateRefreshToken(user);
    setAuthCookies(res,accessToken,refreshToken);
    return ResponseHandler.success(res, { user: userResponse }, "User logged in successfully");
  }),
  
  refreshToken: asyncHandler(async (req, res) => {
    const { refreshToken } = req.cookies;
    if (!refreshToken) throw new AppError("Refresh token not found", 401);

    const accessToken = await authService.refreshAccessToken(refreshToken);
    if (!accessToken) throw new AppError("Token refresh failed", 401);
    
    setAccessTokenCookie(res, accessToken);
    return ResponseHandler.success(res, null, "Access token refreshed successfully");
  }),

  logout: asyncHandler(async (req,res)=>{
    clearAuthCookies(res);
    return ResponseHandler.success(res, null, "User logged out successfully");
  }),

  verifyEmail: asyncHandler(async (req,res)=>{
    validateRequiredFields(req.body, ['email', 'token']);
    const { email, token } = req.body;
    
    await mailService.verifyEmailAccount(email, token);
    return ResponseHandler.success(res, null, "Email verified successfully");
  }),

  forgotPassword: asyncHandler(async(req,res)=>{
    validateRequiredFields(req.body, ['email']);
    const { email } = req.body;
    
    const result=await authService.forgotPassword(email);
    return ResponseHandler.success(res, result, "Password reset email sent successfully");
  }),

  resetPassword: asyncHandler(async(req,res)=>{
    validateRequiredFields(req.body, ['email', 'token', 'password']);
    const { email,token,password } = req.body;
    
    const result=await authService.resetPassword(email,token,password);
    return ResponseHandler.success(res, result, "Password reset successfully");
  })
}