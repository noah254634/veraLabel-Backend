import logger from '../config/logger.js';
import { AppError } from './errorHandler.middleware.js';

const SENSITIVE_PATH_REGEX = new RegExp(
  [
    // Part 1: Sensitive directory/file names as whole path segments.
    // This part is key to blocking `/env` and `/.env` correctly.
    // It looks for a slash (or start of string), then the pattern, then a slash or end of string.
    '(^|/)(env|\\.env|\\.git|\\.svn|\\.hg|\\.vscode|\\.idea|node_modules|vendor|wp-admin|phpmyadmin)(/|$)',

    // Part 2: Specific sensitive filenames that could be at the root or in a subdirectory.
    '/(package-lock\\.json|yarn\\.lock|composer\\.lock|docker-compose\\.yml|secrets\\.yml|database\\.yml|wp-login\\.php|adminer\\.php|access\\.log|error\\.log)$',

    // Part 3: Sensitive file extensions.
    '\\.(bak|swp|swo|sql|pem|key|ini|config|old|zip|tar|gz)$',

    // Part 4: Loose keywords that are highly suspicious.
    // Using word boundaries `\b` to avoid matching substrings in valid paths.
    '\\b(phpinfo|credentials)\\b',
  ].join('|'),
  'i'
);

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
    
   
    return res.status(403).json({ error: 'Access denied. Please contact support and we know about this pattern.' });
    next(new AppError('Not Found', 404));
  }
  
  next();
};
