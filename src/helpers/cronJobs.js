import cron from "node-cron";
import logger from "../config/logger.js";
import { taskService } from "../modules/tasks/task.service.js";
const startTaskCleanUp = () => {
  logger.info("Starting task clean up scheduler");
  cron.schedule("*/5 * * * *", async () => {
    try {
      // 1. Revoke and release expired batches (this handles resetting the tasks inside them, unassigning labellers, and updating metrics)
      const batchResult = await taskService.revokeExpiredBatches();
      const batchesRevoked = batchResult?.revoked ?? 0;
      const tasksResetFromBatches = batchResult?.tasksReset ?? 0;

      // 2. Revoke and release any remaining legacy unbatched tasks
      const { result: taskResult } = await taskService.revokeExpiredTasks();
      const tasksResetFromTasks = taskResult?.modifiedCount ?? 0;

      logger.info(
        `Session cleanup completed. Revoked batches: ${batchesRevoked}, Reset tasks from batches: ${tasksResetFromBatches}, Reset legacy tasks: ${tasksResetFromTasks}`
      );
    } catch (err) {
      logger.error(`Session cleanup failed: ${err.message}`);
    }
  });
};
export default startTaskCleanUp;
