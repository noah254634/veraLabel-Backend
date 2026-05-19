
export const ResponseHandler = {

  success: (res, data = null, message = "Success", statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  },

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


  paginated: (res, data, pagination, message = "Success", statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      pagination,
      timestamp: new Date().toISOString(),
    });
  },

  created: (res, data, message = "Resource created successfully") => {
    return ResponseHandler.success(res, data, message, 201);
  },

 
  accepted: (res, data, message = "Request accepted") => {
    return ResponseHandler.success(res, data, message, 202);
  },

 
  noContent: (res) => {
    return res.status(204).send();
  },
};

export default ResponseHandler;
