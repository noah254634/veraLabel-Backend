/**
 * Validation utilities for request parameters and body validation
 * Centralized validation logic to reduce duplication across controllers
 */

import { AppError } from "../config/errorHandler.js";

/**
 * Validate required fields in request body
 * @param {Object} body - Request body
 * @param {Array<string>} requiredFields - Array of required field names
 * @throws {AppError} if any required field is missing
 */
export const validateRequiredFields = (body, requiredFields = []) => {
  const missing = requiredFields.filter(field => !body[field]);
  
  if (missing.length > 0) {
    throw new AppError(
      `Missing required fields: ${missing.join(", ")}`,
      400
    );
  }
};

/**
 * Validate request parameters
 * @param {Object} params - Request params
 * @param {Array<string>} requiredParams - Array of required param names
 * @throws {AppError} if any required param is missing
 */
export const validateRequiredParams = (params, requiredParams = []) => {
  const missing = requiredParams.filter(param => !params[param]);
  
  if (missing.length > 0) {
    throw new AppError(
      `Missing required parameters: ${missing.join(", ")}`,
      400
    );
  }
};

/**
 * Validate field types
 * @param {Object} data - Object to validate
 * @param {Object} typeMap - Map of fieldName -> expectedType
 * @throws {AppError} if types don't match
 */
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

/**
 * Validate MongoDB ObjectId format
 * @param {string} id - ID to validate
 * @param {string} fieldName - Field name for error message
 * @throws {AppError} if invalid format
 */
export const validateObjectId = (id, fieldName = "ID") => {
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    throw new AppError(`Invalid ${fieldName} format`, 400);
  }
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @throws {AppError} if invalid format
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError("Invalid email format", 400);
  }
};

/**
 * Validate array is not empty
 * @param {Array} arr - Array to validate
 * @param {string} fieldName - Field name for error message
 * @throws {AppError} if array is empty
 */
export const validateNonEmptyArray = (arr, fieldName = "Array") => {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new AppError(`${fieldName} must be a non-empty array`, 400);
  }
};

/**
 * Validate enum value
 * @param {string} value - Value to validate
 * @param {Array} validValues - Array of valid values
 * @param {string} fieldName - Field name for error message
 * @throws {AppError} if value not in enum
 */
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
