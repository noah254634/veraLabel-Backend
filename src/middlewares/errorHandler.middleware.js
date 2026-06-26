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
 *
 * Log level strategy:
 *   AppError (operational, expected)  → warn for 4xx, error for 5xx
 *   Unexpected errors (bugs, crashes) → error + full stack
 */
export const errorHandler = (err, req, res, next) => {
  const isDevelopment = ENV().NODE_ENV !== "production";
  const isAppError   = err.name === "AppError";
  const statusCode   = err.statusCode || 500;
  const is5xx        = statusCode >= 500;

  const meta = {
    status: statusCode,
    path:   req.path,
    method: req.method,
    ip:     req.ip || req.connection?.remoteAddress,
  };

  if (isAppError) {
    // Operational error — working as designed (auth failures, validation, blocks, etc.)
    // 4xx → warn (expected, no stack needed)
    // 5xx AppErrors → error (shouldn't happen but worth flagging)
    if (is5xx) {
      logger.error(err.message, { ...meta, ...(isDevelopment && { stack: err.stack }) });
    } else {
      logger.warn(err.message, meta);
    }
  } else {
    // Unexpected error — bug or infrastructure failure — always log with stack
    logger.error(err.message, { ...meta, stack: err.stack });
  }

  const sanitized = sanitizeErrorResponse(err, isDevelopment);

  // Always emit the same envelope as ResponseHandler so the frontend
  // reads one consistent shape: { success, message, timestamp }
  return res.status(sanitized.status).json({
    success: false,
    message: sanitized.message,
    timestamp: new Date().toISOString(),
    // Stack only in dev, only for unexpected errors
    ...(isDevelopment && !isAppError && { stack: err.stack }),
  });
};

/**
 * Not Found handler
 */
export const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: "Resource not found",
    timestamp: new Date().toISOString(),
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
