import crypto from "crypto";
import logger from "../../config/logger.js";
import UserVera from "../users/user.model.js";
// middleware/verifyResetToken.js
const verifyResetToken = async (req, res, next) => {
  const { token } = req.query; // token is expected as a query parameter
  logger.info("Verifying reset token");
  if (!token) return res.status(400).json({ message: "Token missing" });

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await UserVera.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) return res.status(400).json({ message: "Invalid or expired token" });

  req.user = user; // attach user to request for next handler
  next();
};

export default verifyResetToken;



const generateResetToken = async (user) => {
  // 1. Create random token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // 2. Hash it before saving to DB for security
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  // 3. Set token and expiry on user
  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save();

  // 4. Return the plain token to send via email
  return resetToken;
};

module.exports = generateResetToken;