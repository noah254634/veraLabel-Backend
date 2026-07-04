import { taskGenerationService } from "./task.generation.service.js";
import { asyncHandler, AppError } from "../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../helpers/responseHandler.js";

export const taskGenerationController = {

  generateTasks: asyncHandler(async (req, res) => {
    const { category, regionTags, speechLengthTarget, codeSwitchExpected, customInstructions, count } = req.body;

    if (!category) {
      throw new AppError("Category is required for task generation", 400);
    }

    const result = await taskGenerationService.generateTasks({
      category,
      regionTags,
      speechLengthTarget,
      codeSwitchExpected,
      customInstructions,
      count,
      userId: req.user?._id
    });

    return ResponseHandler.success(res, result, "Task generation initiated successfully");
  }),


  getRuns: asyncHandler(async (req, res) => {
    const runs = await taskGenerationService.getRuns();
    return ResponseHandler.success(res, { runs }, "Generation runs fetched successfully");
  }),


  getTasksForRun: asyncHandler(async (req, res) => {
    const { runId } = req.params;
    const tasks = await taskGenerationService.getTasksForRun(runId);
    return ResponseHandler.success(res, { tasks }, "Tasks for generation run fetched successfully");
  }),


  updateTaskText: asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const { instructionText } = req.body;

    if (!instructionText) {
      throw new AppError("Instruction text is required", 400);
    }

    const updatedTask = await taskGenerationService.updateTaskText(taskId, instructionText);
    return ResponseHandler.success(res, { task: updatedTask }, "Draft task instruction updated successfully");
  }),


  approveRunAndBatch: asyncHandler(async (req, res) => {
    const { runId } = req.params;
    const { datasetId, datasetName, datasetDescription } = req.body;

    if (!datasetId && !datasetName) {
      throw new AppError("Target datasetId or a new datasetName is required", 400);
    }

    const result = await taskGenerationService.approveRunAndBatch(runId, {
      datasetId,
      datasetName,
      datasetDescription
    });
    return ResponseHandler.success(res, result, "Generation run approved and batched successfully");
  })
};
