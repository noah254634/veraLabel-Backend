import logger from '../config/logger.js';
import { AppError } from './errorHandler.middleware.js';

const SENSITIVE_PATH_REGEX = /\/\.(env|git|svn|hg|vscode|idea)\b|\.(bak|old|sql|zip|tar|gz)$|phpinfo|credentials/i;

export const blockSensitivePaths = (req, res, next) => {
  let decodedPath = '';
  try {
    decodedPath = decodeURIComponent(req.path);
  } catch (err) {
    logger.warn('Malformed URI path detected.', { path: req.path, ip: req.ip });
    return next(new AppError('Bad Request', 400));
  }

  if (SENSITIVE_PATH_REGEX.test(decodedPath)) {
    logger.warn('Sensitive path access attempt blocked.', { 
      path: decodedPath, 
      ip: req.ip,
      userAgent: req.get('User-Agent') 
    });
    
   
    return next(new AppError('Not Found', 404));
  }
  
  next();
};
