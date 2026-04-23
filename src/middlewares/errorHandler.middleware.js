import { sanitizeErrorResponse, AppError } from "../config/errorHandler.js";
import { ENV } from "../config/env.js";
import logger from "../config/logger.js";

/**
 * Async error wrapper - catches errors in route handlers
 * Usage: router.post('/endpoint', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Global error handling middleware
 * Must be added LAST in app.js after all other routes
 */
export const errorHandler = (err, req, res, next) => {
  const isDevelopment = ENV().NODE_ENV !== "production";
  
  // Log request info (without sensitive data)
  logger.error({
    path: req.path,
    method: req.method,
    ip: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString(),
  });

  // Sanitize and send response
  const sanitized = sanitizeErrorResponse(err, isDevelopment);
  
  res.status(sanitized.status).json({
    error: sanitized.message,
    ...(isDevelopment && { stack: err.stack }), // Only in development
  });
};

/**
 * Not Found handler
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: "Resource not found",
  });
};

// Re-export AppError for convenience
export { AppError };

export default {
  asyncHandler,
  errorHandler,
  notFoundHandler,
  AppError,
};
