import logger from "../../config/logger.js";

/**
 * TASK SANITIZATION UTILITY
 * 
 * Ensures tasks are stored with REFERENCES ONLY, not raw content.
 * Raw content is accessed via R2 references when needed.
 * 
 * Pattern:
 * - Store: taskId, r2_input_taskRef, r2_datasetUrl (references)
 * - Store: taskType, split, taskName (attributes/metadata)
 * - DON'T store: raw content, contentPreview, large data
 * - Access: Use r2_input_taskRef with R2 client to fetch content on-demand
 */

export const taskSanitizer = {
  /**
   * Validate incoming task payload has required attributes
   * but no raw content
   */
  validateTaskPayload: (task, index = 0) => {
    if (!task || typeof task !== 'object') {
      throw new Error(`Invalid task at index ${index}: must be an object`);
    }

    const r2Ref = task.key || task.r2_url;
    if (!r2Ref) {
      throw new Error(
        `Invalid task at index ${index}: missing 'key' or 'r2_url'. ` +
        `Use R2 reference paths, not raw content.`
      );
    }

    // Warn if raw content is being sent
    if (task.contentPreview) {
      logger.warn(`Raw content detected at task index ${index}. ` +
        `This should be stored in R2, not sent to backend.`, {
          contentLength: String(task.contentPreview).length,
          contentPreviewStart: String(task.contentPreview).substring(0, 50)
        });
    }

    if (task.content || task.rawData || task.data) {
      logger.warn(`Large raw data detected at task index ${index}. ` +
        `Store in R2 and send only the reference.`);
    }
  },

  /**
   * Sanitize task: keep only attributes/references, strip raw content
   */
  sanitizeTask: (task) => {
    const r2Ref = task.key || task.r2_url;

    // Return ONLY safe attributes and R2 references
    return {
      // REFERENCES (use these to fetch content)
      r2_input_taskRef: r2Ref,

      // ATTRIBUTES (metadata)
      taskType: task.taskType,
      taskId: task.taskId || null,
      split: task.split,
      taskName: task.name || task.taskId || `task-${Date.now()}`,

      // STATUS
      status: "pending",
      isAssigned: false,

      // NOTE: All raw content fields are intentionally EXCLUDED:
      // - contentPreview ❌
      // - content ❌
      // - rawData ❌
      // - data ❌
      // - fileContent ❌
      // These are stored in R2, fetch via r2_input_taskRef when needed
    };
  },

  /**
   * Check if a task object contains raw content that shouldn't be stored
   */
  hasRawContent: (task) => {
    const rawContentFields = [
      'content',
      'rawData',
      'data',
      'fileContent',
      'body',
      'payload',
      'contentPreview'
    ];

    return rawContentFields.some(field => 
      task[field] !== undefined && task[field] !== null
    );
  },

  /**
   * Strip raw content fields from a task object (defensive)
   */
  stripRawContent: (task) => {
    const stripped = { ...task };
    const contentFields = [
      'content',
      'rawData',
      'data',
      'fileContent',
      'body',
      'payload',
      'contentPreview'
    ];

    contentFields.forEach(field => delete stripped[field]);
    return stripped;
  },

  /**
   * Log what fields are being stored (for audit)
   */
  logStoredFields: (task) => {
    const stored = Object.keys(task).filter(key => 
      key.startsWith('r2_') || 
      ['taskId', 'taskType', 'split', 'taskName', 'status', 'isAssigned'].includes(key)
    );

    logger.debug('Task fields being stored', {
      storedFields: stored,
      taskId: task.taskId,
      r2Ref: task.r2_input_taskRef
    });
  }
};
