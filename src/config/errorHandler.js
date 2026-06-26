import logger from '../config/logger.js';


export const sanitizeErrorResponse = (error, isDevelopment = false) => {
  const errorType = error.name || error.constructor.name;
  if (isDevelopment) {
    return {
      status: error.statusCode || 500,
      message: error.message,
    };
  }


  switch (errorType) {

    case "AppError":
      return {
        status: error.statusCode || 400,
        message: error.message,
      };
    

    case "MongoError":
    case "MongoServerError":
    case "MongoNetworkError":
      return {
        status: 503,
        message: "Database connection error. Please try again later.",
      };
    

    case "ValidationError":
      return {
        status: 400,
        message: "Invalid input provided.",
      };
    

    case "JsonWebTokenError":
    case "TokenExpiredError":
      return {
        status: 401,
        message: "Authentication failed.",
      };
    

    case "ENOENT":
    case "EACCES":
      return {
        status: 500,
        message: "Internal server error.",
      };
    

    case "ECONNREFUSED":
    case "ETIMEDOUT":
      return {
        status: 503,
        message: "Service temporarily unavailable.",
      };
    

    default:
      return {
        status: error.statusCode || 500,
        message: "An unexpected error occurred.",
      };
  }
};


export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}


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
