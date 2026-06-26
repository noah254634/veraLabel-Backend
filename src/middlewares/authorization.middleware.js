import logger from "../config/logger.js";

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      const userRole = req.user?.role;
      if (!userRole) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (!allowedRoles.includes(userRole)) {
        logger.debug(`Authorization denied: role '${userRole}' not in [${allowedRoles.join(", ")}]`);
        return res
          .status(403)
          .json({
            error: `Access denied. Only ${allowedRoles.join(", ")} is(are) allowed to perform this action`,
          });
      }
        next();
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }
  };
};
export default authorize;
