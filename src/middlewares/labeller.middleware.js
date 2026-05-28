import Labeller from '../modules/labeller/labeller.model.js';
import { AppError } from './errorHandler.middleware.js';

/**
 * Middleware to attach labeller profile to the request object.
 */
export const attachLabeller = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    // Find the labeller profile associated with the authenticated user
    let labeller = await Labeller.findOne({ userId: req.user._id })
      .populate('userId', 'name email profilePicture role status');
    if(!req.geo){
      res.status(400).json({message:"User location not attached"})
    }
    if (!labeller && req.user.role === 'labeler') {
      labeller = await Labeller.create({
        userId: req.user._id,
        tier: 'Trainee',
        isOnboarded: false,
        status: 'active',
        UserLocation:{
          country:req.geo?.country || 'Unknown',
          city:req.geo?.city || 'Unknown',
          state:req.geo?.state || 'Unknown',
        }


      });
      labeller = await Labeller.findById(labeller._id).populate('userId', 'name email profilePicture role status');
    }

    if (!labeller) {
      return next(new AppError('Labeller profile not found and auto-creation not permitted for this role.', 404));
    }

    req.labeller = labeller;

    next();
  } catch (error) {
    next(error);
  }
};
