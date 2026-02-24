import { all } from "axios";
import logger from "../config/logger.js";

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      logger.info("Authorizing user for roles: " + allowedRoles.join(", "));
      const userRole = req.user.role;
      logger.info("User role: " + userRole);
      if (!userRole) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (!allowedRoles.includes(userRole)) {
        logger.info("User not authorized for role: " + userRole);
        return res
          .status(403)
          .json({
            error: `Access denied only ${allowedRoles.join(",")} is(are) allowed to perform this action`,
          });
      } 

        req.user.role = userRole;
        logger.info("User authorized for role: " + userRole);

        next();
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }
  };
};
export default authorize;
