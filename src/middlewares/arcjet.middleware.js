import { aj } from '../config/arcjet.js';
export const arcjetProtectRoute = async (req, res, next) => {
  try {
    const decision = await aj.protect(req);
    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return res
          .status(429)
          .json({ error: 'Too many requests - Arcjet rate limit exceeded' });
      }
      else if (decision.reason.isBot()) {
        return res
          .status(403)
          .json({ error: 'Access denied - Bot traffic detected by Arcjet' });
      }
      else {
        return res
          .status(403)
          .json({ error: 'Access denied - Arcjet protection triggered' });
      }
    }
    
    next();
  } catch (err) {
    console.error('Error in arcjetProtectRoute middleware:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
