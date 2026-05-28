import UserVera from "../users/user.model.js";
import bcrypt from "bcrypt";
import Buyer from "../buyer/buyer.model.js";
import { ENV } from "../../config/env.js";
import jwt from "jsonwebtoken";
import mailService from "../mailer/mailService.js";

import logger from "../../config/logger.js";
import ResetPassword from "./resetPassword.model.js";
import crypto from "crypto";
import { AppError } from "../../middlewares/errorHandler.middleware.js";

export const authService = {
  createUser: async ({ email, name, password,UserRole }) => {
    if (!email || !name || !password)
      throw new AppError("All fields are required", 400);
    const existingUser = await UserVera.findOne({ email });
    if (existingUser) throw new AppError("Email already registered", 400);
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new UserVera({ email, name, password: hashedPassword,role:UserRole });
    await user.save();
    
    if (UserRole === "buyer") {
      await Buyer.create({
        userId: user._id,
        verificationStatus: "unsubmitted",
        isActive: false
      });
    }
    
    return user;
  },
  loginUser: async ({ email, password }) => {
    if (!email || !password) throw new AppError("All fields are required", 400);
    const user = await UserVera.findOne({ email }).select("+password");
    if (!user) throw new AppError("Invalid credentials", 401);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AppError("Invalid credentials", 401);

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
    const user = await UserVera.findOne({ email }).select("+password");
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
    
    // Reset rate-limiting tracking and token fields on successful password reset
    user.passwordResetAttempts = 0;
    user.lastPasswordResetAttemptAt = null;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    
    await user.save();
    await resetTokenDoc.deleteOne();
    return user;
  },
  forgotPassword: async (email) => {
    if (!email) throw new AppError("Email is required", 400);
    const user = await UserVera.findOne({ email });
    if (!user) throw new AppError("Email not found", 404);

    const now = new Date();
    const COOLDOWN_MS = 60 * 1000; // 1 minute
    const MAX_ATTEMPTS = 5;
    const WINDOW_MS = 60 * 60 * 1000; // 1 hour

    if (user.lastPasswordResetAttemptAt) {
      const timePassed = now - new Date(user.lastPasswordResetAttemptAt);
      
      // 1. Cooldown check (1 minute)
      if (timePassed < COOLDOWN_MS) {
        const secondsLeft = Math.ceil((COOLDOWN_MS - timePassed) / 1000);
        throw new AppError(`Please wait ${secondsLeft} seconds before requesting another password reset.`, 429);
      }

      // 2. Hourly limit check (5 attempts)
      const insideWindow = timePassed < WINDOW_MS;
      if (insideWindow) {
        if (user.passwordResetAttempts >= MAX_ATTEMPTS) {
          throw new AppError("Too many password reset requests. Please try again in an hour.", 429);
        }
        user.passwordResetAttempts += 1;
      } else {
        user.passwordResetAttempts = 1;
      }
    } else {
      user.passwordResetAttempts = 1;
    }

    user.lastPasswordResetAttemptAt = now;
    await user.save();

    logger.info(`Initiating forgot password process for ${email}`);
    const result = await mailService.sendResetPasswordEmail(user);
    return result;
  },
};
