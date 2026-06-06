import jwt from "jsonwebtoken";
import {ENV} from "../../config/env.js";

const cookieOptions = (res) => {
  const req = res?.req;
  const isSecure = req ? (req.secure || req.headers["x-forwarded-proto"] === "https") : false;
  const useSecure = isSecure || ENV().NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: useSecure,
    sameSite: useSecure ? "none" : "lax",
  };
};


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
    ...cookieOptions(res),
    maxAge: 10 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions(res),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const clearAuthCookies = (res) => {
  res.clearCookie("accessToken", cookieOptions(res));
  res.clearCookie("refreshToken", cookieOptions(res));
};

export const setAccessTokenCookie = (res, accessToken) => {
  res.cookie("accessToken", accessToken, {
    ...cookieOptions(res),
    maxAge: 10 * 60 * 1000,
  });
};
