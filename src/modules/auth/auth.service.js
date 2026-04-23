import UserVera from "../users/user.model.js";
import bcrypt from "bcrypt";
import { ENV } from "../../config/env.js";
import jwt from "jsonwebtoken";
import mailService from "../mailer/mailService.js";
import { setAuthCookies, setAccessTokenCookie } from "./auth.cookie.js";
import logger from "../../config/logger.js";
import ResetPassword from "./resetPassword.model.js";
import crypto from "crypto";
import { AppError } from "../../config/errorHandler.js";

export const authService = {
  createUser: async ({ email, name, password,UserRole }) => {
    if (!email || !name || !password)
      throw new AppError("All fields are required", 400);
    const existingUser = await UserVera.findOne({ email });
    if (existingUser) throw new AppError("Email already registered", 400);
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new UserVera({ email, name, password: hashedPassword,role:UserRole });
    await user.save();
    return user;
  },
  loginUser: async ({ email, password }) => {
    logger.info(`Login attempt for user: ${email}`);
    if (!email || !password) throw new AppError("All fields are required", 400);
    const user = await UserVera.findOne({ email }).select("+password");
    if (!user) throw new AppError("Invalid credentials", 401);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AppError("Invalid credentials", 401);
    //if(!user.isVerified) throw new AppError("Email not verified. Please verify your email before logging in.", 401);
    return user;
  },
  refreshAccessToken: async (refreshToken) => {
    if (!refreshToken) throw new AppError("Refresh token not found", 401);
    try {
      const decoded = jwt.verify(refreshToken, ENV().jwt_refresh_secret);
      const user = await UserVera.findById(decoded.id);
      if (!user) throw new AppError("User not found", 404);

      return jwt.sign(
        { id: user._id, role: user.role },
        ENV().jwt_secret,
        { expiresIn: "10m" },
      );
    } catch (err) {
      throw new AppError("Token refresh failed", 401);
    }
  },
  resetPassword: async (email, token, password) => {
    if (!email || !token || !password)
      throw new AppError("All fields are required", 400);
    const user = await UserVera.findOne({ email });
    if (!user) throw new AppError("User not found", 404);
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const resetTokenDoc = await ResetPassword.findOne({
      email,
      token: hashedToken,
      expiresAt: { $gt: Date.now() },
    });
    if (!resetTokenDoc) throw new AppError("Invalid or expired token", 400);
    if (resetTokenDoc.userId.toString() !== user._id.toString())
      throw new AppError("Invalid token", 400);
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch)
      throw new AppError("New password must be different", 400);
    user.password = await bcrypt.hash(password, 10);
    await user.save();
    await resetTokenDoc.deleteOne();
    return user;
  },
  forgotPassword: async (email) => {
    if (!email) throw new AppError("Email is required", 400);
    const user = await UserVera.findOne({ email });
    if (!user) throw new AppError("Email not found", 404);
    //call the mailservice to send the reset password email
    logger.info(`Initiating forgot password process for ${email}`);
    const result = await mailService.sendResetPasswordEmail(user);
    return result;
  },
  sendAccessToken: async (req, res) => {
    const refreshTok = req.cookies.refreshToken;
    const accessToken = await authService.refreshAccessToken(refreshTok);
    setAccessTokenCookie(res, accessToken);
  },
};
