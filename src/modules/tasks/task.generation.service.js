import TaskGenerationRun from "./task.generation.model.js";
import Task from "./task.model.js";
import Dataset from "../datasets/dataset.model.js";
import { promptBuilderService } from "./prompt.builder.js";
import { taskService } from "./task.service.js";
import { r2ContentFetcher } from "./r2.contentFetcher.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "../../config/r2Upload.js";
import logger from "../../config/logger.js";
import crypto from "crypto";

export const taskGenerationService = {
  /**
   * Starts a task generation run by calling the FastAPI service.
   */
  generateTasks: async ({ category, regionTags, speechLengthTarget, codeSwitchExpected, customInstructions, count = 10, userId }) => {
    const runId = `GEN-${category.toUpperCase().slice(0, 3)}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    
    // 1. Build prompts
    const systemPrompt = promptBuilderService.getSystemTemplate(count);
    const userPrompt = promptBuilderService.compileUserPrompt({
      category,
      regionTags,
      speechLengthTarget,
      codeSwitchExpected,
      customInstructions
    });

    // 2. Create the run record in MongoDB as generating
    const runRecord = await TaskGenerationRun.create({
      runId,
      category,
      regionTags,
      seedParams: {
        speechLengthTarget,
        codeSwitchExpected,
        customInstructions
      },
      countRequested: count,
      systemPromptUsed: systemPrompt,
      userPromptUsed: userPrompt,
      status: "generating",
      createdBy: userId
    });

    // 3. Call FastAPI microservice
    const fastApiUrl = `${process.env.SPLITTER_SERVICE_URL || "https://iamkhaemba-veralabel.hf.space"}/api/v1/datasets/generate-tasks`;
    const internalSecret = process.env.INTERNAL_SECRET;

    logger.info(`Triggering FastAPI task generator at ${fastApiUrl} for run ${runId}`);
    
    try {
      const response = await fetch(fastApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vera-Signature': internalSecret
        },
        body: JSON.stringify({
          runId,
          category,
          count,
          systemPrompt,
          userPrompt
        })
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.message || "Failed calling FastAPI task generator");
      }

      // 4. Save generated tasks as draft tasks (status: pending_review) in MongoDB - metadata only
      if (responseData.success && Array.isArray(responseData.tasks)) {
        const taskDocs = responseData.tasks.map((t, index) => ({
          taskId: `${runId}-T${index + 1}`,
          taskName: t.taskName || `Generated Task ${index + 1}`,
          status: "pending_review",
          runId,
          category,
          split: "train",
          contentType: "audio",
          taskType: "audio",
          r2_datasetUrl: `projects/generated/${runId}`,
          r2_input_taskRef: t.r2Key || `projects/generated/${runId}/task_${index + 1}.json`,
          datasetId: new Dataset()._id // Temporary placeholder dataset id
        }));

        await Task.insertMany(taskDocs);

        // Update run status to review_required
        runRecord.status = "review_required";
        await runRecord.save();

        logger.info(`Successfully generated and saved ${taskDocs.length} task references for run ${runId}`);
        return {
          runId,
          status: runRecord.status,
          count: taskDocs.length
        };
      } else {
        throw new Error("No tasks returned in LLM response payload");
      }
    } catch (err) {
      logger.error(`Task generation process failed for run ${runId}`, { error: err.message });
      runRecord.status = "failed";
      await runRecord.save();
      throw err;
    }
  },

  /**
   * Retrieves all task generation runs.
   */
  getRuns: async () => {
    return TaskGenerationRun.find().sort({ createdAt: -1 });
  },

  /**
   * Retrieves all tasks under a run, pulling instruction text dynamically from Cloudflare R2.
   */
  getTasksForRun: async (runId) => {
    const tasks = await Task.find({ runId }).sort({ taskId: 1 });
    
    // Resolve instructions dynamically from R2
    const enriched = await Promise.all(tasks.map(async (task) => {
      const plain = task.toObject();
      try {
        const buffer = await r2ContentFetcher.fetchTaskContent(task.r2_input_taskRef);
        const content = JSON.parse(buffer.toString('utf-8'));
        plain.instructionText = content.instructionText || "";
        plain.taskName = content.taskName || task.taskName;
      } catch (err) {
        logger.warn(`Failed to fetch instruction content from R2 for task ${task.taskId}`, { error: err.message });
        plain.instructionText = "";
      }
      return plain;
    }));
    
    return enriched;
  },

  /**
   * Modifies the instruction text of a generated draft task and stores it back in Cloudflare R2.
   */
  updateTaskText: async (taskId, instructionText) => {
    const task = await Task.findOne({ taskId, status: "pending_review" });
    if (!task) {
      throw new Error(`Draft task with ID ${taskId} not found or already approved`);
    }

    const updatedContent = {
      taskName: task.taskName,
      instructionText: instructionText
    };
    const bodyString = JSON.stringify(updatedContent);

    // Save update straight back to R2
    const putCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: task.r2_input_taskRef,
      Body: bodyString,
      ContentType: "application/json"
    });
    
    await r2.send(putCommand);
    logger.info(`Successfully updated task instruction in R2 for task ${taskId}`);

    const plain = task.toObject();
    plain.instructionText = instructionText;
    return plain;
  },

  /**
   * Bulk approves the tasks in a run, associates them with a real dataset (either existing or dynamically created), and generates batches.
   */
  approveRunAndBatch: async (runId, { datasetId, datasetName, datasetDescription, price, pricePerBatch }) => {
    const runRecord = await TaskGenerationRun.findOne({ runId });
    if (!runRecord) {
      throw new Error("Task generation run record not found.");
    }

    if (runRecord.status === "completed") {
      throw new Error("This run has already been approved and batched.");
    }

    let targetDatasetId = datasetId;

    if (!targetDatasetId && datasetName) {
      // Dynamic dataset creation
      const newDataset = await Dataset.create({
        name: datasetName,
        description: datasetDescription || `Dynamic dataset generated for category: ${runRecord.category}`,
        price: typeof price === 'number' ? price : 0,
        pricePerBatch: typeof pricePerBatch === 'number' ? pricePerBatch : 0.42, // default price per batch
        datasetType: "audio",
        contentType: "audio",
        labellingMethod: "transcription",
        domain: runRecord.category,
        status: "approved",
        isPublished: true,
        isCollection: true,
        maxLabellers: 1
      });
      targetDatasetId = newDataset._id;
      logger.info(`Dynamically created dataset "${datasetName}" (ID: ${targetDatasetId}) for generation run ${runId}`);
    }

    if (!targetDatasetId) {
      throw new Error("Target dataset ID or dataset creation name is required.");
    }

    const dataset = await Dataset.findById(targetDatasetId);
    if (!dataset) {
      throw new Error("Target dataset node not found.");
    }

    // Determine language from region tags or defaults
    const regionTags = runRecord.regionTags || [];
    let expectedLanguage = "Swahili";
    if (regionTags.some(tag => tag.toLowerCase().includes("english") || tag.toLowerCase().includes("west-africa"))) {
      expectedLanguage = "English";
    }

    const codeSwitchExpected = runRecord.seedParams?.codeSwitchExpected === true;

    // 1. Update the tasks: set status to 'pending' (ready for matching), set actual datasetId, copy constraints
    const result = await Task.updateMany(
      { runId, status: "pending_review" },
      { 
        $set: { 
          status: "pending", 
          datasetId: dataset._id,
          r2_datasetUrl: `projects/${dataset.buyerId || "admin"}/${dataset._id}`,
          expectedLanguage,
          codeSwitchExpected,
          targetTone: "Neutral" // Target scenario prompt will specify contextual speech tone
        } 
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error("No pending tasks found to approve for this generation run.");
    }

    // Update dataset rows telemetry
    dataset.rows = result.modifiedCount;
    if (dataset.metadata) {
      dataset.metadata.numRecords = result.modifiedCount;
    } else {
      dataset.metadata = { numRecords: result.modifiedCount };
    }
    await dataset.save();

    // 2. Run the existing batching logic
    await taskService.createBatchesForDataset(dataset._id);

    // 3. Mark the run as completed
    runRecord.status = "completed";
    await runRecord.save();

    logger.info(`Approved and batched ${result.modifiedCount} tasks from run ${runId} to dataset ${targetDatasetId}`);
    return {
      success: true,
      modifiedCount: result.modifiedCount,
      runStatus: runRecord.status,
      datasetId: targetDatasetId
    };
  }
};
