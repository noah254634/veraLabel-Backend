import { validateSignup } from "./auth.validation.js";
import { validateLogin } from "./auth.validation.js";
import { authService} from "./auth.service.js";
import mailService from "../mailer/mailService.js";
import { generateAccessToken,generateRefreshToken,setAuthCookies,clearAuthCookies, setAccessTokenCookie } from "./auth.cookie.js";
import logger from "../../config/logger.js";
import { asyncHandler, AppError } from "../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../helpers/responseHandler.js";
import { validateRequiredFields } from "../../helpers/validationHelpers.js";
import UserVera from "../users/user.model.js";

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
    
    await mailService.sendVerificationEmail(user.email, user.name);
    return ResponseHandler.created(res, { user: { email: user.email, name: user.name, role: user.role } }, "User created successfully. Verification code sent to email.");
  }),

  login: asyncHandler(async (req, res) => {
    const dto = validateLogin(req.body);
    logger.debug({ email: dto.email }, "Login attempt");
    const user=await authService.loginUser(dto);
    if (!user) throw new AppError("Invalid credentials", 401);
    
    if (!user.isVerified) {
      throw new AppError("Email not verified", 403);
    }
    
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
    
    await authService.forgotPassword(email);
    // Generic message regardless of whether the email is registered
    return ResponseHandler.success(res, null, "If this email is registered, you will receive a password reset email shortly.");
  }),

  resetPassword: asyncHandler(async(req,res)=>{
    validateRequiredFields(req.body, ['email', 'token', 'password']);
    const { email,token,password } = req.body;
    
    const result=await authService.resetPassword(email,token,password);
    return ResponseHandler.success(res, result, "Password reset successfully");
  }),

  resendVerification: asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ['email']);
    const { email } = req.body;
    const user = await UserVera.findOne({ email });
    // Return the same response whether or not the email exists — prevents enumeration
    if (!user || user.isVerified) {
      return ResponseHandler.success(res, null, "If this email is registered and unverified, a verification code has been sent.");
    }

    await mailService.sendVerificationEmail(email, user.name);
    return ResponseHandler.success(res, null, "If this email is registered and unverified, a verification code has been sent.");
  })
}