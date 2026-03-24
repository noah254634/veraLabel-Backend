import Task from "./task.model.js";
import UserVera from "../users/user.model.js";
export const taskService = {
  createTask: async ({ datasetId, projectId, tasks }) => {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error("task files are required");
    }

    const datasetRef = `projects/${projectId}/${datasetId}`;

    const taskEntries = tasks.map((task, index) => {
      // Legacy file-style payload support
      if (task && task.key) {
        return {
          r2_datasetUrl: datasetId,
          r2_input_taskRef: task.key,
          r2_taskUrl: task.url || task.key,
          taskType: task.type || "text",
          taskName: task.name || `task-${index + 1}`,
          status: "pending",
          isAssigned: false,
          taskId: task.taskId,
          contentPreview: task.contentPreview,
          split: task.split,

        };
      }

      // Worker payload support: { taskId, r2_url, split, contentPreview }
      if (task && task.r2_url) {
        return {
          r2_datasetUrl: datasetId ? `${datasetRef}` : undefined,
          r2_input_taskRef: task.r2_url,
          r2_taskUrl: task.r2_url,
          taskType: task.taskType || "rfhlearning",
          taskName: task.contentPreview || task.taskId || `task-${index + 1}`,
          status: "pending",
          isAssigned: false,
          taskId: task.taskId,
          contentPreview: task.contentPreview,
          split: task.split,
        };
      }

      throw new Error(`Invalid task payload at index ${index}`);
    });

    await Task.insertMany(taskEntries);
    return {
      message: "Tasks created successfully",
      count: taskEntries.length,
    };
  },
  getTasks: async () => {
    const tasks = await Task.find();
    if (!tasks) throw new Error("No tasks found");
    if (tasks.length === 0) throw new Error("No tasks found");
    return tasks;
  },
  getTaskById: async (id) => {
    const task = await Task.findById(id);
    if (!task) throw new Error("Task not found");

    return task;
  },
  returnTaskToPool: async (id) => {
    const task = await Task.findByIdAndUpdate(id);
    if (!task) throw new Error("Task not found");
    task.status = "pending";
    task.isAssigned = false;
    task.assignedTo = null;
    task.assignedAt = null;
    task.startedAt = null;
    task.completedAt = null;
    await task.save();
    return task;
  },
  assignTask: async (taskId, userId) => {
    const task = await Task.findById(taskId);
    if (!task) throw new Error("Task not found");
    const user = await UserVera.find({ _id: userId, role: "labeler" });
    if (!user) throw new Error("User not found or not a labeler");
    if (task.isAssigned) throw new Error("Task already assigned");
    task.isAssigned = true;
    task.assignedTo = userId;
    task.assignedAt = new Date();
    task.status = "in_progress";
    await task.save();
    return { message: "Task assigned successfully", task };
  },
  submitTask: async (taskId, userId) => {
    if (!taskId) throw new Error("Task id is required");
    if (!userId) throw new Error("User id is required");
    //verification logic will go here by calling the fastAPI Microservices to do the verification and sent the response for verification
  },
  verifyTask: async (taskId, userId) => {
    if (!taskId) throw new Error("Task id is required");
    if (!userId) throw new Error("User id is required");
    const task = await Task.findById(taskId);
    if (!task) throw new Error("Task not found");
    const user = await UserVera.find({
      _id: userId,
      role: "admin" || "reviewer",
    });
    if (!user)
      throw new Error(
        "User not found or not authorized to perform this action",
      );
    if (task.isVerified) throw new Error("Task already verified");
    task.isVerified = true;
    task.verifiedBy = userId;
    task.status = "verified";
    await task.save();
    return { message: "Task verified successfully", task };
  },
  rejectTask: async (taskId, reason) => {
    const task = await Task.findById(taskId);
    if (!task) throw new Error("Task not found");
    task.isVerified = false;
    task.verifiedBy = null;
    task.status = "rejected";
    task.rejectionReason = reason;
    task.verificationScore = 0;
    await taskService.returnTaskToPool(taskId);

    return { message: "Task rejected successfully", task };
  },
  deleteTaskBatch: async () => {

  },
  reviewTask: async (taskId, userId,score) => {
    const task = await Task.findById(taskId);
    if(!task) throw new Error("Task not found");
    const user = await UserVera.findById(userId);
    if(!user) throw new Error("User not found");
    if(task.isVerified) throw new Error("Task already verified");
    task.isVerified=true;
    task.verifiedBy=userId;
    task.status="verified";
    task.verificationScore=score;
    await task.save();
    return { message: "Task verified successfully", task };
  },
  revokeTask: async (taskId) => {
    const task = await Task.findById(taskId);
    if(!task) throw new Error("Task not found");
    if(!task.isAssigned) throw new Error("Task not assigned");
    const newTask = await taskService.returnTaskToPool(taskId);
    return { message: "Task revoked successfully", newTask };
  },
  autoAssignTask: async () => {},
  revokeExpiredTasks:async()=>{
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = await Task.updateMany(
      {
        isAssigned: true,
        status: "in_progress",
        assignedAt: { $lt: twoHoursAgo },
      },
      {
        $set: {
          status: "pending",
          isAssigned: false,
          assignedTo: null,
          assignedAt: null,
          startedAt: null,
          completedAt: null,
        },
      }
    );
    return { message: "Tasks revoked successfully", result };
  },
};
