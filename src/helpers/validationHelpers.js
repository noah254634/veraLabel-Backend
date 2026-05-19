

import { AppError } from "../config/errorHandler.js";


export const validateRequiredFields = (body, requiredFields = []) => {
  const missing = requiredFields.filter(field => !body[field]);
  
  if (missing.length > 0) {
    throw new AppError(
      `Missing required fields: ${missing.join(", ")}`,
      400
    );
  }
};


export const validateRequiredParams = (params, requiredParams = []) => {
  const missing = requiredParams.filter(param => !params[param]);
  
  if (missing.length > 0) {
    throw new AppError(
      `Missing required parameters: ${missing.join(", ")}`,
      400
    );
  }
};


export const validateFieldTypes = (data, typeMap = {}) => {
  const errors = [];
  
  Object.entries(typeMap).forEach(([field, expectedType]) => {
    if (field in data) {
      const actualType = Array.isArray(data[field]) ? "array" : typeof data[field];
      if (actualType !== expectedType) {
        errors.push(`${field} must be ${expectedType}, got ${actualType}`);
      }
    }
  });
  
  if (errors.length > 0) {
    throw new AppError(errors.join("; "), 400);
  }
};


export const validateObjectId = (id, fieldName = "ID") => {
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    throw new AppError(`Invalid ${fieldName} format`, 400);
  }
};


export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError("Invalid email format", 400);
  }
};


export const validateNonEmptyArray = (arr, fieldName = "Array") => {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new AppError(`${fieldName} must be a non-empty array`, 400);
  }
};

export const validateEnum = (value, validValues = [], fieldName = "Value") => {
  if (!validValues.includes(value)) {
    throw new AppError(
      `${fieldName} must be one of: ${validValues.join(", ")}`,
      400
    );
  }
};

export default {
  validateRequiredFields,
  validateRequiredParams,
  validateFieldTypes,
  validateObjectId,
  validateEmail,
  validateNonEmptyArray,
  validateEnum,
};
