/**
 * User extraction utilities
 * Centralized methods to extract user information from requests
 */

/**
 * Get user ID from request
 * Checks multiple possible locations for user ID
 * @param {Object} req - Express request object
 * @returns {string} User ID
 * @throws {Error} if user not found
 */
export const getUserIdFromRequest = (req) => {
  const userId = req.user?._id || req.user?.id || req.params?.userId;
  
  if (!userId) {
    throw new Error("User not found in request");
  }
  
  return userId;
};

/**
 * Get full user object from request
 * @param {Object} req - Express request object
 * @returns {Object} User object
 * @throws {Error} if user not found
 */
export const getUserFromRequest = (req) => {
  if (!req.user) {
    throw new Error("User not authenticated");
  }
  
  return req.user;
};

/**
 * Get user with guaranteed fields
 * @param {Object} req - Express request object
 * @returns {Object} User object with id field normalized
 */
export const getNormalizedUser = (req) => {
  const user = getUserFromRequest(req);
  return {
    ...user,
    id: user._id || user.id,
  };
};

/**
 * Safe user extraction (returns null instead of throwing)
 * @param {Object} req - Express request object
 * @returns {Object|null} User object or null
 */
export const getUserSafely = (req) => {
  try {
    return getUserFromRequest(req);
  } catch {
    return null;
  }
};

export default {
  getUserIdFromRequest,
  getUserFromRequest,
  getNormalizedUser,
  getUserSafely,
};
