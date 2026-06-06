import logger from '../../config/logger.js';
import TaskProgressSession from './task.progress.model.js';

const activeSessions = new Map();
const sessionSubscribers = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000;
const MAX_EVENTS_PER_SESSION = 10000;
const VALID_EVENT_TYPES = new Set(['progress', 'error', 'checkpoint', 'complete', 'warning']);
const VALID_SEVERITIES = new Set(['info', 'warning', 'critical']);


const validateSessionIds = (projectId, datasetId) => {
  if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
    throw new Error('projectId is required and must be a non-empty string');
  }
  if (!datasetId || typeof datasetId !== 'string' || datasetId.trim().length === 0) {
    throw new Error('datasetId is required and must be a non-empty string');
  }
  return { projectId: projectId.trim(), datasetId: datasetId.trim() };
};

const getSessionId = (projectId, datasetId) => {
  const { projectId: pId, datasetId: dId } = validateSessionIds(projectId, datasetId);
  return { projectId: pId, datasetId: dId, sessionId: `${pId}:${dId}` };
};

const getMostRecentSession = async (projectId, datasetId) => {
  const { sessionId } = getSessionId(projectId, datasetId);
  let session = activeSessions.get(sessionId);
  if (!session) {
    // Try to load from MongoDB
    const doc = await TaskProgressSession.findOne({ sessionId }).lean();
    if (doc) {
      session = {
        ...doc,
        startTime: new Date(doc.startTime),
        lastUpdate: new Date(doc.lastUpdate),
        endTime: doc.endTime ? new Date(doc.endTime) : undefined,
      };
      activeSessions.set(sessionId, session);
    }
  }
  return session || null;
};

const notifySessionSubscribers = (session, event) => {
  const subscriptionKey = `${session.projectId}:${session.datasetId}`;
  const subscribers = sessionSubscribers.get(subscriptionKey);

  if (!subscribers || subscribers.size === 0) {
    return;
  }

  for (const subscriber of subscribers) {
    try {
      subscriber(event, session);
    } catch (error) {
      logger.warn('Error notifying progress subscriber', {
        sessionId: session.sessionId,
        error: error.message,
      });
    }
  }
};

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

export const createSession = async (projectId, datasetId) => {
  try {
    const { projectId: pId, datasetId: dId, sessionId } = getSessionId(projectId, datasetId);

    // Clear existing session timeout
    const existing = activeSessions.get(sessionId);
    if (existing && existing._timeoutId) {
      clearTimeout(existing._timeoutId);
    }

    // Delete any old session from MongoDB
    await TaskProgressSession.deleteOne({ sessionId });

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

    // Auto-cleanup in-memory Map
    const timeoutId = setTimeout(async () => {
      const deleted = activeSessions.delete(sessionId);
      if (deleted) {
        logger.info('Session auto-cleaned from memory after timeout', { sessionId, durationMs: SESSION_TIMEOUT });
        // Mark as failed in DB on inactivity timeout if still processing
        await TaskProgressSession.updateOne(
          { sessionId, status: 'processing' },
          { $set: { status: 'failed', failureReason: 'Session timed out due to inactivity', endTime: new Date() } }
        );
      }
    }, SESSION_TIMEOUT);

    session._timeoutId = timeoutId;

    // Persist to MongoDB
    try {
      await TaskProgressSession.create({
        sessionId,
        projectId: pId,
        datasetId: dId,
        startTime: session.startTime,
        events: [],
        eventMetrics: session.eventMetrics,
        status: session.status,
        lastUpdate: session.lastUpdate
      });
    } catch (dbError) {
      if (dbError.code === 11000) {
        logger.info('Progress session already exists (concurrent creation), retrieving existing session', { sessionId });
        const existingDoc = await TaskProgressSession.findOne({ sessionId }).lean();
        if (existingDoc) {
          const existingSession = {
            ...existingDoc,
            startTime: new Date(existingDoc.startTime),
            lastUpdate: new Date(existingDoc.lastUpdate),
            endTime: existingDoc.endTime ? new Date(existingDoc.endTime) : undefined,
          };
          activeSessions.set(sessionId, existingSession);
          return existingSession;
        }
      }
      throw dbError;
    }

    logger.info('Progress session created in DB & Memory', { sessionId, projectId: pId, datasetId: dId });
    return session;
  } catch (error) {
    logger.error('Error creating session', { error: error.message, projectId, datasetId });
    throw error;
  }
};

export const addEvent = async (projectId, datasetId, event) => {
  try {
    const { projectId: pId, datasetId: dId } = validateSessionIds(projectId, datasetId);
    const validatedEvent = validateEvent(event);

    // Find the most recent session
    let session = await getMostRecentSession(pId, dId);

    // Create new session if doesn't exist
    if (!session) {
      session = await createSession(pId, dId);
    }

    // Check event limit
    if (session.events.length >= MAX_EVENTS_PER_SESSION) {
      const warning = `Session event limit (${MAX_EVENTS_PER_SESSION}) reached, oldest event removed`;
      logger.warn(warning, { sessionId: session.sessionId });
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

    // Update MongoDB
    await TaskProgressSession.updateOne(
      { sessionId: session.sessionId },
      {
        $push: { events: enrichedEvent },
        $set: {
          eventMetrics: session.eventMetrics,
          status: session.status,
          lastUpdate: session.lastUpdate,
          endTime: session.endTime,
          failureReason: session.failureReason,
          completionSummary: session.completionSummary
        }
      }
    );

    logger.debug('Event added to session & saved to DB', {
      sessionId: session.sessionId,
      eventType: validatedEvent.type,
      eventCount: session.events.length,
    });

    notifySessionSubscribers(session, enrichedEvent);

    return session;
  } catch (error) {
    logger.error('Error adding event', { error: error.message, projectId, datasetId });
    throw error;
  }
};

export const addEvents = async (projectId, datasetId, events) => {
  try {
    const { projectId: pId, datasetId: dId } = validateSessionIds(projectId, datasetId);

    let session = await getMostRecentSession(pId, dId);
    if (!session) {
      session = await createSession(pId, dId);
    }

    const validatedEvents = [];
    const failedEvents = [];
    const now = new Date();
    let hasFinalEvent = false; // complete or critical error — must be persisted

    for (let i = 0; i < events.length; i++) {
      try {
        const validatedEvent = validateEvent(events[i]);

        if (session.events.length >= MAX_EVENTS_PER_SESSION) {
          session.events.shift();
        }

        const enrichedEvent = {
          ...validatedEvent,
          serverReceivedAt: now.toISOString(),
          eventIndex: session.events.length + validatedEvents.length,
        };

        validatedEvents.push(enrichedEvent);

        session.eventMetrics.processed += 1;
        if (validatedEvent.type === 'error') session.eventMetrics.errors += 1;
        if (validatedEvent.severity === 'warning') session.eventMetrics.warnings += 1;
        if (validatedEvent.type === 'checkpoint') session.eventMetrics.checkpoints += 1;

        if (validatedEvent.type === 'error' && validatedEvent.severity === 'critical') {
          session.status = 'failed';
          session.failureReason = validatedEvent.message;
          session.endTime = now;
          hasFinalEvent = true;
        } else if (validatedEvent.type === 'complete') {
          session.status = 'completed';
          session.endTime = now;
          session.completionSummary = validatedEvent.summary || {};
          hasFinalEvent = true;
        }
      } catch (error) {
        logger.warn(`Failed to process event at index ${i}`, {
          error: error.message,
          event: events[i],
        });
        failedEvents.push({ index: i, error: error.message });
      }
    }

    if (validatedEvents.length > 0) {
      session.events.push(...validatedEvents);
      session.lastUpdate = now;

      // Routine progress events are in-memory only; persist on final state changes.
      if (hasFinalEvent) {
        await TaskProgressSession.updateOne(
          { sessionId: session.sessionId },
          {
            $push: { events: { $each: validatedEvents } },
            $set: {
              eventMetrics: session.eventMetrics,
              status: session.status,
              lastUpdate: session.lastUpdate,
              endTime: session.endTime,
              failureReason: session.failureReason,
              completionSummary: session.completionSummary,
            },
          }
        );
        logger.debug('Final event persisted to DB', {
          sessionId: session.sessionId,
          status: session.status,
        });
      } else {
        // Fire-and-forget lightweight metadata update (no events array push)
        TaskProgressSession.updateOne(
          { sessionId: session.sessionId },
          {
            $set: {
              eventMetrics: session.eventMetrics,
              lastUpdate: session.lastUpdate,
            },
          }
        ).catch(err => logger.warn('Non-critical progress DB update failed', { error: err.message }));
      }

      for (const enrichedEvent of validatedEvents) {
        notifySessionSubscribers(session, enrichedEvent);
      }
    }

    return {
      session,
      addedCount: validatedEvents.length,
      failedEvents,
    };
  } catch (error) {
    logger.error('Error adding events', { error: error.message, projectId, datasetId });
    throw error;
  }
};

export const getSession = async (projectId, datasetId) => {
  try {
    const { projectId: pId, datasetId: dId } = validateSessionIds(projectId, datasetId);
    return await getMostRecentSession(pId, dId);
  } catch (error) {
    logger.error('Error getting session', { error: error.message, projectId, datasetId });
    throw error;
  }
};

export const getRecentEvents = async (projectId, datasetId, sinceTimestamp = null) => {
  try {
    const { projectId: pId, datasetId: dId } = validateSessionIds(projectId, datasetId);
    const session = await getSession(pId, dId);

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

export const getSummary = async (projectId, datasetId) => {
  try {
    const { projectId: pId, datasetId: dId } = validateSessionIds(projectId, datasetId);
    const session = await getSession(pId, dId);

    if (!session) return null;

    const duration = (session.endTime ? new Date(session.endTime) : new Date()) - new Date(session.startTime);

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
      startTime: new Date(session.startTime).toISOString(),
      endTime: session.endTime ? new Date(session.endTime).toISOString() : null,
      createdAt: session.createdAt,
      eventCounts,
      eventMetrics: session.eventMetrics,
      errorCount: errorSummary.length,
      errors: errorSummary.slice(0, 100), // Limit error details to latest 100
      lastProgressUpdate,
      failureReason: session.failureReason || null,
      completionSummary: session.completionSummary || null,
      lastUpdate: new Date(session.lastUpdate).toISOString(),
    };
  } catch (error) {
    logger.error('Error getting summary', { error: error.message, projectId, datasetId });
    throw error;
  }
};

export const clearSession = async (projectId, datasetId) => {
  try {
    const { projectId: pId, datasetId: dId, sessionId } = getSessionId(projectId, datasetId);
    const session = activeSessions.get(sessionId);

    if (session && session._timeoutId) {
      clearTimeout(session._timeoutId);
    }

    const deleted = activeSessions.delete(sessionId);
    sessionSubscribers.delete(sessionId);
    
    // Also delete from MongoDB
    const dbDeleted = await TaskProgressSession.deleteOne({ sessionId });
    
    if (deleted || dbDeleted.deletedCount > 0) {
      logger.info('Session cleared from Memory & DB', { sessionId });
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error clearing session', { error: error.message, projectId, datasetId });
    throw error;
  }
};

export const getAllActiveSessions = async (status = null) => {
  try {
    const query = {};
    if (status) {
      query.status = status;
    }

    const dbSessions = await TaskProgressSession.find(query).sort({ updatedAt: -1 }).lean();

    const sessions = dbSessions.map(session => ({
      sessionId: session.sessionId,
      projectId: session.projectId,
      datasetId: session.datasetId,
      status: session.status,
      startTime: new Date(session.startTime).toISOString(),
      eventCount: session.events.length,
      eventMetrics: session.eventMetrics,
      durationMs: (session.endTime ? new Date(session.endTime) : new Date()) - new Date(session.startTime),
    }));

    logger.debug('Retrieved active sessions from DB', { count: sessions.length, filter: status });
    return sessions;
  } catch (error) {
    logger.error('Error getting all sessions', { error: error.message });
    throw error;
  }
};

export const cleanupExpiredSessions = async () => {
  try {
    let cleaned = 0;
    const now = new Date();

    // Cleanup in-memory Map
    for (const [key, session] of activeSessions) {
      const age = now - session.lastUpdate;
      
      if (age > SESSION_TIMEOUT) {
        if (session._timeoutId) {
          clearTimeout(session._timeoutId);
        }
        activeSessions.delete(key);
        sessionSubscribers.delete(key);
        cleaned += 1;
      }
    }

    // Update MongoDB sessions that timed out
    const timeoutTime = new Date(Date.now() - SESSION_TIMEOUT);
    const dbResult = await TaskProgressSession.updateMany(
      { status: 'processing', lastUpdate: { $lt: timeoutTime } },
      { $set: { status: 'failed', failureReason: 'Session timed out due to inactivity', endTime: new Date() } }
    );

    if (cleaned > 0 || dbResult.modifiedCount > 0) {
      logger.info('Cleanup completed', { 
        inMemoryRemoved: cleaned, 
        dbSessionsTimedOut: dbResult.modifiedCount,
        remainingInMemory: activeSessions.size 
      });
    }

    const totalActive = await TaskProgressSession.countDocuments();
    return { cleaned, remaining: totalActive };
  } catch (error) {
    logger.error('Error during session cleanup', { error: error.message });
    throw error;
  }
};

export const getSystemStats = async () => {
  try {
    const activeSessionsCount = await TaskProgressSession.countDocuments();
    const completedSessionsCount = await TaskProgressSession.countDocuments({ status: 'completed' });
    const failedSessionsCount = await TaskProgressSession.countDocuments({ status: 'failed' });
    const processingCount = await TaskProgressSession.countDocuments({ status: 'processing' });

    // Aggregate totalEvents and totalErrors from metrics
    const statsResult = await TaskProgressSession.aggregate([
      {
        $group: {
          _id: null,
          totalEvents: { $sum: '$eventMetrics.processed' },
          totalErrors: { $sum: '$eventMetrics.errors' }
        }
      }
    ]);

    const totalEvents = statsResult[0]?.totalEvents || 0;
    const totalErrors = statsResult[0]?.totalErrors || 0;

    return {
      activeSessions: activeSessionsCount,
      totalEvents,
      totalErrors,
      completedSessions: completedSessionsCount,
      failedSessions: failedSessionsCount,
      processingCount,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error getting system stats', { error: error.message });
    throw error;
  }
};

export const subscribeToSession = (projectId, datasetId, listener) => {
  if (typeof listener !== 'function') {
    throw new Error('listener must be a function');
  }

  const { projectId: pId, datasetId: dId, sessionId } = getSessionId(projectId, datasetId);
  const subscriptionKey = sessionId;

  if (!sessionSubscribers.has(subscriptionKey)) {
    sessionSubscribers.set(subscriptionKey, new Set());
  }

  sessionSubscribers.get(subscriptionKey).add(listener);

  // We also try to fetch/load the session into activeSessions map if it exists in DB
  getMostRecentSession(pId, dId).catch(err => {
    logger.warn('Error fetching session in subscriber init', { err: err.message, projectId: pId, datasetId: dId });
  });

  return () => {
    const subscribers = sessionSubscribers.get(subscriptionKey);

    if (!subscribers) {
      return;
    }

    subscribers.delete(listener);

    if (subscribers.size === 0) {
      sessionSubscribers.delete(subscriptionKey);
    }
  };
};