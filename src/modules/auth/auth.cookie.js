import jwt from "jsonwebtoken";
import {ENV} from "../../config/env.js";


export const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    ENV().jwt_secret,
    { expiresIn: "10m" }
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    ENV().jwt_refresh_secret,
    { expiresIn: "7d" }
  );
};

export const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: ENV().node_env === "production",
    sameSite: "strict",
    maxAge: 10 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: ENV().node_env === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const clearAuthCookies = (res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
};
