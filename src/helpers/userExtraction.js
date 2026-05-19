


export const getUserIdFromRequest = (req) => {
  const userId = req.user?._id || req.user?.id || req.params?.userId;
  
  if (!userId) {
    throw new Error("User not found in request");
  }
  
  return userId;
};


export const getUserFromRequest = (req) => {
  if (!req.user) {
    throw new Error("User not authenticated");
  }
  
  return req.user;
};

export const getNormalizedUser = (req) => {
  const user = getUserFromRequest(req);
  return {
    ...user,
    id: user._id || user.id,
  };
};


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
