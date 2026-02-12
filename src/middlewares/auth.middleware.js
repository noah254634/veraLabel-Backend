import jwt from "jsonwebtoken";
import UserVera from "../modules/users/user.model.js";
import { sendAccessToken } from "../modules/auth/auth.service.js";
import { ENV } from "../config/env.js";
import logger from "../config/logger.js";
export const protectRoute = async (req, res, next) => {
  try{
    logger.info("Protecting route, verifying user authentication");
  const token = req.cookies.accessToken;
  const refreshTok = req.cookies.refreshToken;
  if (!token && refreshTok) {
     const decoded = jwt.verify(refreshTok, ENV().jwt_refresh_secret);
    if (!decoded) return res.status(401).json({ error: "Unauthorized" });
    const findUser = await UserVera.findById(decoded.id);
    if (!findUser) return res.status(401).json({ error: "Unauthorized" });
    await sendAccessToken(req, res);
    req.user = findUser;
    next();
   return;
  }
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const decoded = jwt.verify(token, ENV().jwt_secret);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });
  const findUser = await UserVera.findById(decoded.id);
  if (!findUser) return res.status(401).json({ error: "Unauthorized" });

  req.user = findUser;
  next();
}catch(err){
  return res.status(401).json({error:err.message});
}
};
