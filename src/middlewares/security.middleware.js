import logger from '../config/logger.js';
import { AppError } from './errorHandler.middleware.js';

const SENSITIVE_PATH_REGEX = new RegExp(
  [
    // Part 1: Sensitive directory/file names as whole path segments.
    // Blocks `/env`, `/.env`, `/.git`, etc.
    '(^|/)(env|\\.env|\\.git|\\.svn|\\.hg|\\.vscode|\\.idea|node_modules|vendor|wp-admin|phpmyadmin)(/|$)',

    // Part 2: .env file variants (e.g. .env.local, .env.production)
    '(^|/)\\.env\\.',

    // Part 3: Specific sensitive filenames.
    '/(package-lock\\.json|yarn\\.lock|composer\\.lock|docker-compose\\.ya?ml|Dockerfile|secrets\\.yml|database\\.yml|wp-login\\.php|adminer\\.php|access\\.log|error\\.log|\\.htaccess|\\.htpasswd|\\.DS_Store)$',

    // Part 4: Sensitive file extensions.
    '\\.(bak|swp|swo|sql|pem|key|ini|config|old|zip|tar|gz)$',

    // Part 5: Loose keywords that are highly suspicious.
    '\\b(phpinfo|credentials)\\b',
  ].join('|'),
  'i'
);

/**
 * Fully normalizes a URL-encoded path by repeatedly decoding until stable.
 * Protects against double-encoding bypass attacks (e.g. %252Fenv -> %2Fenv -> /env).
 */
function fullyDecode(path) {
  let decoded = path;
  for (let i = 0; i < 5; i++) {
    const next = decodeURIComponent(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

export const blockSensitivePaths = (req, res, next) => {
  let decodedPath = '';
  try {
    decodedPath = fullyDecode(req.path);
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
