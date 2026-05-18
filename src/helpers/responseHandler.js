/**
 * Unified response handler for consistent API response format
 * 
 * Usage:
 * - Success: ResponseHandler.success(res, data, "Resource fetched", 200)
 * - Error: ResponseHandler.error(res, "Invalid input", 400)
 */
export const ResponseHandler = {
  /**
   * Send success response
   * @param {Object} res - Express response object
   * @param {any} data - Response data payload
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code (default: 200)
   */
  success: (res, data = null, message = "Success", statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Send error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 400)
   * @param {any} error - Additional error details (development only)
   */
  error: (res, message = "An error occurred", statusCode = 400, error = null) => {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
    };

    if (error && process.env.NODE_ENV !== "production") {
      response.error = error;
    }

    return res.status(statusCode).json(response);
  },

  /**
   * Send paginated response
   * @param {Object} res - Express response object
   * @param {Array} data - Array of items
   * @param {Object} pagination - {page, limit, total, totalPages}
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code
   */
  paginated: (res, data, pagination, message = "Success", statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      pagination,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Send created response (201)
   * @param {Object} res - Express response object
   * @param {any} data - Created resource data
   * @param {string} message - Success message
   */
  created: (res, data, message = "Resource created successfully") => {
    return ResponseHandler.success(res, data, message, 201);
  },

  /**
   * Send accepted response (202) - for async operations
   * @param {Object} res - Express response object
   * @param {any} data - Response data
   * @param {string} message - Success message
   */
  accepted: (res, data, message = "Request accepted") => {
    return ResponseHandler.success(res, data, message, 202);
  },

  /**
   * Send no content response (204)
   * @param {Object} res - Express response object
   */
  noContent: (res) => {
    return res.status(204).send();
  },
};

export default ResponseHandler;
