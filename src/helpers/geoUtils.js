import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import GeoAccessLog from '../modules/admin/models/geoAccessLog.model.js';
import GeoRequestAudit from '../modules/admin/models/geoRequestAudit.model.js';
import logger from '../config/logger.js';

const ALLOWED_COUNTRIES = ['KE', 'UG', 'TZ', 'RW', 'BI', 'SS'];

/**
 * Checks if a route path is labeller-facing.
 * @param {string} url - Request URL path
 * @returns {boolean}
 */
export const isLabellerRoute = (url) => {
  if (!url) return false;
  return (
    url.startsWith('/api/v1/labeller') ||
    url.startsWith('/api/v1/onboarding') ||
    (url.startsWith('/api/v1/tasks') && 
     !url.startsWith('/api/v1/tasks/getTaskSubmissions') &&
     !url.startsWith('/api/v1/tasks/verify') &&
     !url.startsWith('/api/v1/tasks/rejectTask') &&
     !url.startsWith('/api/v1/tasks/deleteTask') &&
     !url.startsWith('/api/v1/tasks/reviewTask') &&
     !url.startsWith('/api/v1/tasks/revoke') &&
     !url.startsWith('/api/v1/tasks/revoke-dataset-batches') &&
     !url.startsWith('/api/v1/tasks/revoke-expired-batches') &&
     !url.startsWith('/api/v1/tasks/generate-missing-embeddings') &&
     !url.startsWith('/api/v1/tasks/auto_assign') &&
     !url.startsWith('/api/v1/tasks/progress') &&
     !url.startsWith('/api/v1/tasks/createTasks') &&
     !url.startsWith('/api/v1/tasks/register'))
  );
};

/**
 * Decodes the JWT token silently to extract userId and userRole for monitoring.
 * @param {object} req - Express request
 * @returns {object|null} { userId, userRole } or null
 */
export const extractUserFromToken = (req) => {
  const token = req.cookies?.accessToken || req.headers?.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, ENV().jwt_secret);
    if (decoded?.id) {
      return { userId: decoded.id, userRole: decoded.role };
    }
  } catch (err) {
    // Silent catch - do not disrupt request routing
  }
  return null;
};

/**
 * Logs geo access aggregates and registers response finish hook for chronological audit trails.
 */
export const logGeoTelemetry = (req, res, { ip, country, city, timezone, coords, isLabellerRoute }) => {
  if (country === 'KE') return;

  const isRestrictedRoute = isLabellerRoute;
  const isBlockedStatus = !ALLOWED_COUNTRIES.includes(country) && isRestrictedRoute;
  
  // Extract user silently
  const user = extractUserFromToken(req);
  const userId = user?.userId || null;
  const userRole = user?.userRole || null;

  // Log to GeoAccessLog (Aggregate statistics)
  GeoAccessLog.findOneAndUpdate(
    { ip },
    {
      $set: {
        country: country || 'Unknown',
        city: city || 'Unknown',
        timezone: timezone || 'Unknown',
        coordinates: coords || [],
        userAgent: req.headers['user-agent'] || 'Unknown',
        lastPath: req.originalUrl || req.path || 'Unknown',
        lastMethod: req.method || 'GET',
        isBlocked: isBlockedStatus,
        lastAccess: new Date()
      },
      $inc: { hits: 1 }
    },
    { upsert: true }
  ).catch((err) => {
    logger.error('Failed to log geo access attempt in helper', { error: err.message });
  });

  // Log to GeoRequestAudit (Chronological timeseries audit log)
  res.on('finish', () => {
    GeoRequestAudit.create({
      ip,
      userId,
      userRole,
      country: country || 'Unknown',
      city: city || 'Unknown',
      timezone: timezone || 'Unknown',
      path: req.originalUrl || req.path || 'Unknown',
      method: req.method || 'GET',
      statusCode: res.statusCode,
      isBlocked: !ALLOWED_COUNTRIES.includes(country) && isRestrictedRoute && res.statusCode === 403,
      userAgent: req.headers['user-agent'] || 'Unknown'
    }).catch((err) => {
      logger.error('Failed to write GeoRequestAudit entry in helper', { error: err.message });
    });
  });
};
