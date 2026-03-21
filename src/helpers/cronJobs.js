import cron from "node-cron";
import { taskService } from "../modules/tasks/task.service.js";
const startTaskCleanUp=()=>{
    cron.schedule('*/30 * * * *',taskService.revokeExpiredTasks)
}
export default startTaskCleanUp;