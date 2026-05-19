import Labeller from '../modules/labeller/labeller.model.js';
import { AppError } from './errorHandler.middleware.js';

/**
 * Middleware to attach labeller profile to the request object.
 * This should be used after protectRoute.
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
    // Auto-create minimal labeller profile if missing but user has the role
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
      // Re-populate to match expected structure
      labeller = await Labeller.findById(labeller._id).populate('userId', 'name email profilePicture role status');
    }

    if (!labeller) {
      return next(new AppError('Labeller profile not found and auto-creation not permitted for this role.', 404));
    }

    // Attach labeller to request for easy access in controllers
    req.labeller = labeller;

    /**
     * BEST PRACTICE TIP: 
     * Instead of replacing req.user entirely, we keep req.user as the Auth Principal
     * and use req.labeller for the profile. 
     * 
     * However, to satisfy your requirement of using the Labeller ID primarily:
     * We can attach the labeller ID to the user object or just use req.labeller._id.
     */
    
    // If you REALLY want req.user to point to the labeller document:
    // req.user = labeller; 

    next();
  } catch (error) {
    next(error);
  }
};
