import jwt from "jsonwebtoken";
import UserVera from "../modules/users/user.model.js";
import { ENV } from "../config/env.js";
import { setAccessTokenCookie } from "../modules/auth/auth.cookie.js";
import logger from "../config/logger.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    const refreshTok = req.cookies.refreshToken;

    // No access token but refresh token present — silently refresh
    if (!token && refreshTok) {
      const decoded = jwt.verify(refreshTok, ENV().jwt_refresh_secret);
      if (!decoded) return res.status(401).json({ success: false, message: "Unauthorized" });

      const findUser = await UserVera.findById(decoded.id);
      if (!findUser) return res.status(401).json({ success: false, message: "Unauthorized" });

      // Issue a new access token inline (was sendAccessToken)
      const newAccessToken = jwt.sign(
        { id: findUser._id, role: findUser.role },
        ENV().jwt_secret,
        { expiresIn: "10m" },
      );
      setAccessTokenCookie(res, newAccessToken);

      req.user = findUser;
      return next();
    }

    if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });

    const decoded = jwt.verify(token, ENV().jwt_secret);
    if (!decoded) return res.status(401).json({ success: false, message: "Unauthorized" });

    const findUser = await UserVera.findById(decoded.id);
    if (!findUser) return res.status(401).json({ success: false, message: "Unauthorized" });

    req.user = findUser;
    next();
  } catch (err) {
    logger.error(`protectRoute error: ${err.message}`);
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
};
