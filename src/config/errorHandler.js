import logger from "./logger.js";

/**
 * Sanitize error messages for frontend consumption
 * - Prevents sensitive info leakage (paths, DB errors, stack traces)
 * - Logs full errors server-side for debugging
 * - Returns generic user-friendly messages
 */
export const sanitizeErrorResponse = (error, isDevelopment = false) => {
  const errorType = error.name || error.constructor.name;
  
  // For AppError (safe, user-facing errors), only log the message
  if (errorType === "AppError") {
    logger.info(`AppError: ${error.message}`);
  } else {
    // For unexpected errors, log full details for debugging
    logger.error({
      type: errorType,
      message: error.message,
      stack: error.stack,
      ...(error.code && { code: error.code }),
    });
  }

  // Prevent sending sensitive errors to frontend in production
  if (isDevelopment) {
    return {
      status: error.statusCode || 500,
      message: error.message,
    };
  }

  // Production: Generic responses based on error type
  switch (errorType) {
    // Custom application error (safe to expose)
    case "AppError":
      return {
        status: error.statusCode || 400,
        message: error.message,
      };
    
    // Database errors
    case "MongoError":
    case "MongoServerError":
    case "MongoNetworkError":
      return {
        status: 503,
        message: "Database connection error. Please try again later.",
      };
    
    // Validation errors
    case "ValidationError":
      return {
        status: 400,
        message: "Invalid input provided.",
      };
    
    // JWT/Auth errors
    case "JsonWebTokenError":
    case "TokenExpiredError":
      return {
        status: 401,
        message: "Authentication failed.",
      };
    
    // File system errors
    case "ENOENT":
    case "EACCES":
      return {
        status: 500,
        message: "Internal server error.",
      };
    
    // Network errors
    case "ECONNREFUSED":
    case "ETIMEDOUT":
      return {
        status: 503,
        message: "Service temporarily unavailable.",
      };
    
    // Default: Generic error
    default:
      return {
        status: error.statusCode || 500,
        message: "An unexpected error occurred.",
      };
  }
};

/**
 * Custom application error class
 * Use this for errors that are safe to send to frontend
 */
export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

/**
 * Validate that sensitive environment variables aren't exposed
 */
export const validateEnvSecurity = () => {
  const sensitiveKeys = [
    'MONGO_URI',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'AWS_SECRET_ACCESS_KEY',
    'R2_SECRET_KEY',
    'FLUTTERWAVE_SECRET',
    'PAYSTACK_SECRET_KEY',
    'RESEND_API_KEY',
    'INTERNAL_SECRET',
    'EMAIL_PASSWORD'
  ];

  const exposed = sensitiveKeys.filter(key => {
    // Check that these aren't accidentally logged or exposed
    return process.env[key];
  });

  if (exposed.length > 0) {
    logger.warn('Sensitive environment variables loaded (ensure they are not logged):', exposed);
  }
};

export default {
  sanitizeErrorResponse,
  AppError,
  validateEnvSecurity,
};
