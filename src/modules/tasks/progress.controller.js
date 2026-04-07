/**
 * Progress Controller - Handles progress update endpoints
 * Implements defensive validation and comprehensive error handling
 */

import { 
  addEvent, 
  getSession, 
  getSummary, 
  getRecentEvents, 
  createSession, 
  clearSession, 
  getAllActiveSessions,
  getSystemStats,
  cleanupExpiredSessions 
} from './progress.service.js';
import logger from '../../config/logger.js';

/**
 * Validate request body contains required fields
 */
const validateProgressRequest = (body) => {
  if (!body) throw new Error('Request body is required');
  if (!body.projectId) throw new Error('projectId is required');
  if (!body.datasetId) throw new Error('datasetId is required');
  if (!Array.isArray(body.events)) throw new Error('events must be an array');
  if (body.events.length === 0) throw new Error('events array cannot be empty');
  return body;
};

export const progressController = {
  /**
   * Receive progress updates from worker
   * POST /tasks/progress
   */
  receiveProgress: async (req, res) => {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    
    try {
      logger.info('Progress update received', {
        requestId,
        body: { ...req.body, events: `[${req.body?.events?.length || 0} events]` },
      });

      const { projectId, datasetId, events, isFinal } = validateProgressRequest(req.body);

      if (!Array.isArray(events)) {
        return res.status(400).json({
          success: false,
          message: 'events must be an array',
          requestId,
        });
      }

      if (events.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'events array cannot be empty',
          requestId,
        });
      }

      // Add all events with detailed logging
      let addedCount = 0;
      const failedEvents = [];

      for (let i = 0; i < events.length; i++) {
        try {
          addEvent(projectId, datasetId, events[i]);
          addedCount += 1;
        } catch (error) {
          logger.warn(`Failed to add event at index ${i}`, {
            error: error.message,
            event: events[i],
            requestId,
          });
          failedEvents.push({ index: i, error: error.message });
        }
      }

      // Get session status after events added
      const session = getSession(projectId, datasetId);

      logger.info('Progress update processed', {
        requestId,
        projectId,
        datasetId,
        eventCount: events.length,
        addedCount,
        failedCount: failedEvents.length,
        isFinal,
        status: session?.status,
      });

      return res.status(200).json({
        success: true,
        message: `Received and processed ${addedCount}/${events.length} events`,
        sessionStatus: session?.status,
        sessionId: session?.sessionId,
        processedCount: addedCount,
        failedCount: failedEvents.length,
        failedEvents: failedEvents.length > 0 ? failedEvents : undefined,
        requestId,
      });
    } catch (error) {
      logger.error('Error receiving progress update', {
        requestId,
        error: error.message,
        stack: error.stack,
        body: req.body,
      });

      const statusCode = error.message.includes('required') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to process progress update',
        error: error.message,
        requestId,
      });
    }
  },

  /**
   * Get session progress details
   * GET /tasks/progress/:projectId/:datasetId
   */
  getProgress: async (req, res) => {
    try {
      const { projectId, datasetId } = req.params;

      if (!projectId || !datasetId) {
        return res.status(400).json({
          success: false,
          message: 'projectId and datasetId are required parameters',
        });
      }

      const session = getSession(projectId, datasetId);

      if (!session) {
        logger.info('Progress session not found', { projectId, datasetId });
        return res.status(404).json({
          success: false,
          message: 'Progress session not found',
        });
      }

      const summary = getSummary(projectId, datasetId);

      logger.info('Progress retrieved', {
        projectId,
        datasetId,
        status: summary?.status,
        eventCount: summary?.eventCounts,
      });

      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Error fetching progress', {
        error: error.message,
        stack: error.stack,
        params: req.params,
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch progress',
        error: error.message,
      });
    }
  },

  /**
   * Stream progress events (for real-time updates)
   * GET /tasks/progress/:projectId/:datasetId/stream
   */
  streamProgress: async (req, res) => {
    const { projectId, datasetId } = req.params;
    const sinceTimestamp = req.query.since || null;

    try {
      if (!projectId || !datasetId) {
        return res.status(400).json({
          success: false,
          message: 'projectId and datasetId are required',
        });
      }

      logger.info('Stream connection initiated', { projectId, datasetId });

      // Set headers for Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Send initial connection message
      res.write('data: {"type": "connected", "message": "Progress stream connected", "timestamp": "' + new Date().toISOString() + '"}\n\n');

      // Get or create session
      let session = getSession(projectId, datasetId);
      if (!session) {
        session = createSession(projectId, datasetId);
      }

      // Send recent events with error handling
      try {
        const recentEvents = getRecentEvents(projectId, datasetId, sinceTimestamp);
        for (const event of recentEvents) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (error) {
        logger.warn('Error sending recent events', { error: error.message, projectId, datasetId });
      }

      // Keep connection open and poll for new events
      const interval = setInterval(() => {
        try {
          const currentSession = getSession(projectId, datasetId);

          if (!currentSession) {
            // Session expired
            res.write(`data: {"type": "session_ended", "message": "Session timed out", "timestamp": "${new Date().toISOString()}"}\n\n`);
            clearInterval(interval);
            res.end();
            logger.info('Stream closed: session expired', { projectId, datasetId });
            return;
          }

          if (currentSession.status === 'completed' || currentSession.status === 'failed') {
            // Send final summary and close
            const summary = getSummary(projectId, datasetId);
            res.write(`data: ${JSON.stringify({ type: 'session_complete', status: currentSession.status, summary })}\n\n`);
            clearInterval(interval);
            res.end();
            logger.info('Stream closed: session complete', { projectId, datasetId, status: currentSession.status });
          }
        } catch (error) {
          logger.error('Error in stream polling', { error: error.message, projectId, datasetId });
          clearInterval(interval);
          res.end();
        }
      }, 5000); // Poll every 5 seconds

      // Handle client disconnect
      req.on('close', () => {
        clearInterval(interval);
        logger.info('Stream connection closed by client', { projectId, datasetId });
      });

      req.on('error', (error) => {
        clearInterval(interval);
        logger.error('Stream connection error', { error: error.message, projectId, datasetId });
      });
    } catch (error) {
      logger.error('Error streaming progress', {
        error: error.message,
        stack: error.stack,
        projectId,
        datasetId,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to stream progress',
        error: error.message,
      });
    }
  },

  /**
   * Get all active progress sessions (admin only)
   * GET /tasks/progress/admin/sessions
   */
  getAllSessions: async (req, res) => {
    try {
      const status = req.query.status || null;
      const sessions = getAllActiveSessions(status);
      const stats = getSystemStats();

      logger.info('Admin retrieved all sessions', {
        count: sessions.length,
        filter: status,
        stats,
      });

      return res.status(200).json({
        success: true,
        data: sessions,
        stats,
        count: sessions.length,
      });
    } catch (error) {
      logger.error('Error fetching all sessions', {
        error: error.message,
        stack: error.stack,
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch sessions',
        error: error.message,
      });
    }
  },

  /**
   * Clear a progress session
   * DELETE /tasks/progress/:projectId/:datasetId
   */
  clearProgress: async (req, res) => {
    try {
      const { projectId, datasetId } = req.params;

      if (!projectId || !datasetId) {
        return res.status(400).json({
          success: false,
          message: 'projectId and datasetId are required',
        });
      }

      const deleted = clearSession(projectId, datasetId);

      if (!deleted) {
        logger.info('Progress session not found for deletion', { projectId, datasetId });
        return res.status(404).json({
          success: false,
          message: 'Progress session not found',
        });
      }

      logger.info('Progress session cleared', { projectId, datasetId });

      return res.status(200).json({
        success: true,
        message: 'Progress session cleared successfully',
      });
    } catch (error) {
      logger.error('Error clearing progress', {
        error: error.message,
        stack: error.stack,
        params: req.params,
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to clear progress',
        error: error.message,
      });
    }
  },

  /**
   * Admin endpoint to trigger cleanup and get system stats
   * GET /tasks/progress/admin/cleanup
   */
  cleanupSessions: async (req, res) => {
    try {
      const cleanupResult = cleanupExpiredSessions();
      const stats = getSystemStats();

      logger.info('Admin triggered session cleanup', { cleanupResult, stats });

      return res.status(200).json({
        success: true,
        message: 'Session cleanup completed',
        cleanupResult,
        stats,
      });
    } catch (error) {
      logger.error('Error during session cleanup', {
        error: error.message,
        stack: error.stack,
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to cleanup sessions',
        error: error.message,
      });
    }
  },

  /**
   * Get system-wide statistics
   * GET /tasks/progress/admin/stats
   */
  getStats: async (req, res) => {
    try {
      const stats = getSystemStats();

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting system stats', {
        error: error.message,
        stack: error.stack,
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to get system stats',
        error: error.message,
      });
    }
  },
};
