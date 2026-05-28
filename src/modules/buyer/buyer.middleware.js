import Buyer from './buyer.model.js';
import { AppError } from '../../middlewares/errorHandler.middleware.js';

/**
 * Middleware to attach buyer profile to the request object.
 */
export const attachBuyer = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    // Find the buyer profile associated with the authenticated user
    let buyer = await Buyer.findOne({ userId: req.user._id })
      .populate('userId', 'name email profilePicture role status');

    if (!buyer && req.user.role === 'buyer') {
      buyer = await Buyer.create({
        userId: req.user._id,
        billingAddress: {
          country: req.user.userLocation?.country || 'Unknown',
          city: req.user.userLocation?.city || 'Unknown',
          state: req.user.userLocation?.state || 'Unknown',
        }
      });
      buyer = await Buyer.findById(buyer._id).populate('userId', 'name email profilePicture role status');
    }

    if (!buyer) {
      return next(new AppError('Buyer profile not found and auto-creation not permitted for this role.', 404));
    }

    req.buyer = buyer;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to restrict access to approved buyers only.
 */
export const requireVerifiedBuyer = (req, res, next) => {
  if (!req.buyer) {
    return next(new AppError('Buyer profile not found.', 404));
  }
  
  if (req.buyer.verificationStatus !== 'approved' || !req.buyer.isActive) {
    return next(new AppError('Your buyer account is not approved yet. Access denied.', 403));
  }
  
  next();
};
