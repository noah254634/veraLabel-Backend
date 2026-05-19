import { sanitizeErrorResponse, AppError } from "../config/errorHandler.js";
import { ENV } from "../config/env.js";
import logger from "../config/logger.js";

/**
 * Async error wrapper - catches errors in route handlers
 * Usage: router.post('/endpoint', asyncHandler(async (req, res) => { ... }))
 * Ensures all Promise rejections and thrown errors are caught by the global error handler
 */
export const asyncHandler = (fn) => {
  if (typeof fn !== 'function') {
    throw new TypeError('asyncHandler expects a function');
  }
  
  return (req, res, next) => {
    const fnReturn = fn(req, res, next);
    
    // Handle both Promises and non-async functions
    if (fnReturn && typeof fnReturn.catch === 'function') {
      fnReturn.catch(next);
    } else if (fnReturn instanceof Error) {
      next(fnReturn);
    }
  };
};

/**
 * Global error handling middleware
 * Must be added LAST in app.js after all other routes
 */
export const errorHandler = (err, req, res, next) => {
  const isDevelopment = ENV().NODE_ENV !== "production";
  
  // Log request info (without sensitive data)
  logger.error({
    message: err.message,
    path: req.path,
    method: req.method,
    ip: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString(),
    stack: err.stack,
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
