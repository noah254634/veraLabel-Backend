import cron from "node-cron";
import logger from "../config/logger.js";
import { taskService } from "../modules/tasks/task.service.js";
const startTaskCleanUp = () => {
  logger.info("Starting task clean up");
  cron.schedule("*/30 * * * *", async () => {
    try {
      const { result } = await taskService.revokeExpiredTasks();
      const modified = result?.modifiedCount ?? 0;
      logger.info(`Task cleanup ran. Modified: ${modified}`);
    } catch (err) {
      logger.error(`Task cleanup failed: ${err.message}`);
    }
  });
};
export default startTaskCleanUp;
