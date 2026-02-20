import UserVera from "../users/user.model.js";
import bcrypt from "bcrypt";
import { ENV } from "../../config/env.js";
import jwt from "jsonwebtoken";
import mailService from "../mailer/mailService.js";
import { setAuthCookies } from "./auth.cookie.js";
import logger from "../../config/logger.js";
import ResetPassword from "./resetPassword.model.js";
export const authService = {
  createUser: async ({ email, name, password }) => {
    if (!email || !name || !password)
      throw new Error("All fields are required");
    const existingUser = await UserVera.findOne({ email });
    if (existingUser) throw new Error("User already exists");
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new UserVera({ email, name, password: hashedPassword });
    await user.save();
    return user;
  },
  loginUser: async ({ email, password }) => {
    logger.info(`Login attempt for user: ${email}`);
    if (!email || !password) throw new Error(`All fields are required `);
    const user = await UserVera.findOne({ email }).select("+password");
    if (!user) throw new Error("User not found");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Invalid password");
    //if(!user.isVerified) throw new Error("Email not verified. Please verify your email before logging in.");
    return user;
  },
  sendAccessToken: async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken)
        throw new Error("Refresh token not found consider logging in again");
      const decoded = jwt.verify(refreshToken, ENV().jwt_refresh_secret);
      const user = await UserVera.findById(decoded.id);
      if (!user) throw new Error("User not found");

      const accessToken = jwt.sign(
        { id: user._id, role: user.role },
        ENV().jwt_secret,
        { expiresIn: "10m" },
      );
      const newAccessCookie = () => {
        res.cookie("accessToken", accessToken, {
          sameSite: "strict",
          httpOnly: true,
          secure: ENV().node_env === "production",
          maxAge: 10 * 60 * 1000,
        });
      };
      //setAuthCookies(res,accessToken,refreshToken);
      return newAccessCookie();
    } catch (err) {
      console.log(
        "An error occurred in sending refreshToken in service",
        err.message,
      );
      return res.status(401).json({ error: err.message });
    }
  },
  resetPassword: async (email, token, password) => {
    if (!email || !token || !password)
      throw new Error("All fields are required");
    const user = await UserVera.findOne({ email });
    if (!user) throw new Error("User not found");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const resetTokenDoc = await ResetPassword.findOne({
      email,
      token: hashedToken,
      expiresAt: { $gt: Date.now() },
    });
    if (!resetTokenDoc) throw new Error("Invalid or expired token");
    if (resetTokenDoc.userId.toString() !== user._id.toString())
      throw new Error("Invalid token for this user");
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch)
      throw new Error("New password cannot be the same as the old password");
    user.password = await bcrypt.hash(password, 10);
    await user.save();
    await resetTokenDoc.deleteOne();
    return user;
  },
  forgotPassword: async (email) => {
    if (!email) throw new Error("Email is required");
    const user = await UserVera.findOne({ email });
    if (!user) throw new Error("User not found");
    //call the mailservice to send the reset password email
    logger.info(`Initiating forgot password process for ${email}`);
    const result = await mailService.sendResetPasswordEmail(user);
    return result;
  },
};
