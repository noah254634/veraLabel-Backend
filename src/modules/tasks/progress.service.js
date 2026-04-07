/**
 * Progress Service - Handles dataset processing progress tracking
 * Streams updates from worker to frontend/admin with defensive validation
 */

import logger from '../../config/logger.js';

// In-memory storage for active progress sessions
const activeSessions = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_EVENTS_PER_SESSION = 10000;
const VALID_EVENT_TYPES = new Set(['progress', 'error', 'checkpoint', 'complete', 'warning']);
const VALID_SEVERITIES = new Set(['info', 'warning', 'critical']);

/**
 * Validate session identifiers
 */
const validateSessionIds = (projectId, datasetId) => {
  if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
    throw new Error('projectId is required and must be a non-empty string');
  }
  if (!datasetId || typeof datasetId !== 'string' || datasetId.trim().length === 0) {
    throw new Error('datasetId is required and must be a non-empty string');
  }
  return { projectId: projectId.trim(), datasetId: datasetId.trim() };
};

/**
 * Validate event object structure
 */
const validateEvent = (event) => {
  if (!event || typeof event !== 'object') {
    throw new Error('event must be a valid object');
  }
  if (!VALID_EVENT_TYPES.has(event.type)) {
    throw new Error(`event.type must be one of: ${Array.from(VALID_EVENT_TYPES).join(', ')}`);
  }
  if (event.severity && !VALID_SEVERITIES.has(event.severity)) {
    throw new Error(`event.severity must be one of: ${Array.from(VALID_SEVERITIES).join(', ')}`);
  }
  return event;
};

/**
 * Create or update a progress session with auto-cleanup
 */
export const createSession = (projectId, datasetId) => {
  try {
    const { projectId: pId, datasetId: dId } = validateSessionIds(projectId, datasetId);
    const sessionId = `${pId}:${dId}`;

    if (activeSessions.has(sessionId)) {
      logger.warn('Session already exists, returning existing session', { sessionId });
      return activeSessions.get(sessionId);
    }

    const session = {
      sessionId,
      projectId: pId,
      datasetId: dId,
      startTime: new Date(),
      events: [],
      eventMetrics: {
        processed: 0,
        errors: 0,
        warnings: 0,
        checkpoints: 0,
      },
      status: 'processing',
      lastUpdate: new Date(),
      createdAt: new Date().toISOString(),
    };

    activeSessions.set(sessionId, session);

    // Auto-cleanup after timeout with logging
    const timeoutId = setTimeout(() => {
      const deleted = activeSessions.delete(sessionId);
      if (deleted) {
        logger.info('Session auto-cleaned after timeout', { sessionId, durationMs: SESSION_TIMEOUT });
      }
    }, SESSION_TIMEOUT);

    // Store timeout ID for manual cleanup if needed
    session._timeoutId = timeoutId;

    logger.info('Progress session created', { sessionId, projectId: pId, datasetId: dId });
    return session;
  } catch (error) {
    logger.error('Error creating session', { error: error.message, projectId, datasetId });
    throw error;
  }
};

/**
 * Add an event to a session (creates session if not exists)
 * Enforces event limit to prevent memory issues
 */
export const addEvent = (projectId, datasetId, event) => {
  try {
    const { projectId: pId, datasetId: dId } = validateSessionIds(projectId, datasetId);
    const validatedEvent = validateEvent(event);
    const sessionId = `${pId}:${dId}`;

    let session = activeSessions.get(sessionId);

    // Create session if doesn't exist
    if (!session) {
      session = createSession(pId, dId);
    }

    // Check event limit to prevent memory bloat
    if (session.events.length >= MAX_EVENTS_PER_SESSION) {
      const warning = `Session event limit (${MAX_EVENTS_PER_SESSION}) reached, oldest event removed`;
      logger.warn(warning, { sessionId });
      session.events.shift(); // Remove oldest event
    }

    // Enrich event with server timestamp
    const enrichedEvent = {
      ...validatedEvent,
      serverReceivedAt: new Date().toISOString(),
      eventIndex: session.events.length,
    };

    session.events.push(enrichedEvent);
    session.lastUpdate = new Date();

    // Update event metrics
    session.eventMetrics.processed += 1;
    if (validatedEvent.type === 'error') session.eventMetrics.errors += 1;
    if (validatedEvent.severity === 'warning') session.eventMetrics.warnings += 1;
    if (validatedEvent.type === 'checkpoint') session.eventMetrics.checkpoints += 1;

    // Update session status based on event type with priority
    if (validatedEvent.type === 'error' && validatedEvent.severity === 'critical') {
      session.status = 'failed';
      session.failureReason = validatedEvent.message;
      session.endTime = new Date();
    } else if (validatedEvent.type === 'complete') {
      session.status = 'completed';
      session.endTime = new Date();
      session.completionSummary = validatedEvent.summary || {};
    }

    logger.debug('Event added to session', {
      sessionId,
      eventType: validatedEvent.type,
      eventCount: session.events.length,
    });

    return session;
  } catch (error) {
    logger.error('Error adding event', { error: error.message, projectId, datasetId });
    throw error;
  }
};

/**
 * Get session progress details
 */
export const getSession = (projectId, datasetId) => {
  try {
    const { projectId: pId, datasetId: dId } = validateSessionIds(projectId, datasetId);
    const sessionId = `${pId}:${dId}`;
    const session = activeSessions.get(sessionId);

    if (!session) {
      logger.debug('Session not found', { sessionId });
      return null;
    }

    return session;
  } catch (error) {
    logger.error('Error getting session', { error: error.message, projectId, datasetId });
    throw error;
  }
};

/**
 * Get only recent events (for streaming) with timestamp filtering
 */
export const getRecentEvents = (projectId, datasetId, sinceTimestamp = null) => {
  try {
    const { projectId: pId, datasetId: dId } = validateSessionIds(projectId, datasetId);
    const session = getSession(pId, dId);

    if (!session) return [];

    if (!sinceTimestamp) {
      return session.events;
    }

    const sinceDate = new Date(sinceTimestamp);
    if (isNaN(sinceDate.getTime())) {
      throw new Error('sinceTimestamp must be a valid ISO date string');
    }

    return session.events.filter(event => {
      const eventTime = new Date(event.serverReceivedAt);
      return eventTime > sinceDate;
    });
  } catch (error) {
    logger.error('Error getting recent events', { error: error.message, projectId, datasetId });
    throw error;
  }
};

/**
 * Get comprehensive summary statistics for a session
 */
export const getSummary = (projectId, datasetId) => {
  try {
    const { projectId: pId, datasetId: dId } = validateSessionIds(projectId, datasetId);
    const session = getSession(pId, dId);

    if (!session) return null;

    const duration = new Date() - session.startTime;

    const eventCounts = {
      progress: 0,
      error: 0,
      checkpoint: 0,
      complete: 0,
      warning: 0,
    };

    const errorSummary = [];
    let lastProgressUpdate = null;

    session.events.forEach(event => {
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
      
      if (event.type === 'error') {
        errorSummary.push({
          timestamp: event.timestamp || event.serverReceivedAt,
          message: event.message || 'Unknown error',
          severity: event.severity || 'unknown',
          index: event.eventIndex,
        });
      }

      if (event.type === 'progress' && event.metadata?.count) {
        lastProgressUpdate = event.metadata.count;
      }
    });

    return {
      sessionId: session.sessionId,
      status: session.status,
      projectId: pId,
      datasetId: dId,
      durationMs: duration,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime?.toISOString() || null,
      createdAt: session.createdAt,
      eventCounts,
      eventMetrics: session.eventMetrics,
      errorCount: errorSummary.length,
      errors: errorSummary.slice(0, 100), // Limit error details to latest 100
      lastProgressUpdate,
      failureReason: session.failureReason || null,
      completionSummary: session.completionSummary || null,
      lastUpdate: session.lastUpdate.toISOString(),
    };
  } catch (error) {
    logger.error('Error getting summary', { error: error.message, projectId, datasetId });
    throw error;
  }
};

/**
 * Clear a session and stop its timeout
 */
export const clearSession = (projectId, datasetId) => {
  try {
    const { projectId: pId, datasetId: dId } = validateSessionIds(projectId, datasetId);
    const sessionId = `${pId}:${dId}`;
    const session = activeSessions.get(sessionId);

    if (session && session._timeoutId) {
      clearTimeout(session._timeoutId);
    }

    const deleted = activeSessions.delete(sessionId);
    
    if (deleted) {
      logger.info('Session cleared', { sessionId });
    }

    return deleted;
  } catch (error) {
    logger.error('Error clearing session', { error: error.message, projectId, datasetId });
    throw error;
  }
};

/**
 * Get all active sessions with filtering
 */
export const getAllActiveSessions = (status = null) => {
  try {
    const sessions = [];

    for (const [key, session] of activeSessions) {
      // Filter by status if provided
      if (status && session.status !== status) {
        continue;
      }

      sessions.push({
        sessionId: key,
        projectId: session.projectId,
        datasetId: session.datasetId,
        status: session.status,
        startTime: session.startTime.toISOString(),
        eventCount: session.events.length,
        eventMetrics: session.eventMetrics,
        durationMs: new Date() - session.startTime,
      });
    }

    logger.debug('Retrieved active sessions', { count: sessions.length, filter: status });
    return sessions;
  } catch (error) {
    logger.error('Error getting all sessions', { error: error.message });
    throw error;
  }
};

/**
 * Cleanup expired sessions (call periodically)
 */
export const cleanupExpiredSessions = () => {
  try {
    let cleaned = 0;
    const now = new Date();

    for (const [key, session] of activeSessions) {
      const age = now - session.lastUpdate;
      
      if (age > SESSION_TIMEOUT) {
        if (session._timeoutId) {
          clearTimeout(session._timeoutId);
        }
        activeSessions.delete(key);
        cleaned += 1;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleanup completed', { sessionsRemoved: cleaned, remaining: activeSessions.size });
    }

    return { cleaned, remaining: activeSessions.size };
  } catch (error) {
    logger.error('Error during session cleanup', { error: error.message });
    throw error;
  }
};

/**
 * Get session statistics across all sessions
 */
export const getSystemStats = () => {
  try {
    let totalEvents = 0;
    let totalErrors = 0;
    let completedSessions = 0;
    let failedSessions = 0;

    for (const session of activeSessions.values()) {
      totalEvents += session.events.length;
      totalErrors += session.eventMetrics.errors;
      if (session.status === 'completed') completedSessions += 1;
      if (session.status === 'failed') failedSessions += 1;
    }

    return {
      activeSessions: activeSessions.size,
      totalEvents,
      totalErrors,
      completedSessions,
      failedSessions,
      processingCount: activeSessions.size - completedSessions - failedSessions,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error getting system stats', { error: error.message });
    throw error;
  }
};