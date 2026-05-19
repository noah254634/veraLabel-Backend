import logger from "../../config/logger.js";

export const taskSanitizer = {
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

  sanitizeTask: (task) => {
    const r2Ref = task.key || task.r2_url;

    return {
      r2_input_taskRef: r2Ref,
      taskType: task.taskType,
      taskId: task.taskId || null,
      split: task.split,
      taskName: task.name || task.taskId || `task-${Date.now()}`,
      status: "pending",
      isAssigned: false,
    };
  },

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
