import mongoose from "mongoose";
import dotenv from "dotenv";
import Dataset from "./src/modules/datasets/dataset.model.js";
import Task from "./src/modules/tasks/task.model.js";
import Invoice from "./src/modules/datasets/invoice.model.js";
import { taskService } from "./src/modules/tasks/task.service.js";
import { invoiceService } from "./src/helpers/priceCalculator.js";
import logger from "./src/config/logger.js";

// Load environment variables from src/.env
dotenv.config({ path: "src/.env" });

const datasetId = process.argv[2] || "6a207af71bac1b8ec3937869";

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI not found in environment variables.");
    process.exit(1);
  }

  console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:([^@]+)@/, ":*****@")}`);
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB.");

  console.log(`Locating dataset with ID: ${datasetId}`);
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) {
    console.error(`Dataset with ID ${datasetId} not found in database.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Found Dataset: "${dataset.name}" (Status: "${dataset.status}", ContentType: "${dataset.contentType}", LabellingMethod: "${dataset.labellingMethod}")`);

  const datasetRef = `projects/${dataset.buyerId}/${datasetId}`;

  // Count total tasks registered for this dataset
  const totalTasks = await Task.countDocuments({
    $or: [{ datasetId }, { r2_datasetUrl: datasetRef }]
  });

  console.log(`Total tasks found for this dataset: ${totalTasks}`);

  if (totalTasks === 0) {
    console.error("Cannot finalize a dataset with 0 tasks.");
    await mongoose.disconnect();
    process.exit(1);
  }

  // Get task type for invoice mapping
  const sampleTask = await Task.findOne({
    $or: [{ datasetId }, { r2_datasetUrl: datasetRef }]
  }).lean();

  const rawContentType = sampleTask?.contentType || sampleTask?.taskType || dataset.contentType;
  
  // Normalization logic mimicking normalizeTaskTypeForInvoice
  let invoiceTaskType = "text";
  if (dataset.labellingMethod === "rlhf") {
    invoiceTaskType = "rlhf";
  } else {
    const normalizedType = String(rawContentType || "").trim().toLowerCase();
    if (normalizedType === "image") invoiceTaskType = "images";
    else if (normalizedType === "video") invoiceTaskType = "videos";
    else if (normalizedType === "audio") invoiceTaskType = "audio";
    else if (normalizedType === "code") invoiceTaskType = "code";
    else invoiceTaskType = normalizedType || "text";
  }

  console.log(`Determined invoice task type: "${invoiceTaskType}"`);

  // Generate invoice
  console.log("Generating invoice...");
  const invoice = await invoiceService.generateInvoice(invoiceTaskType, totalTasks);
  console.log(`Invoice generated successfully. Total cost: $${invoice.totalCost}`);

  // Update Dataset
  console.log("Updating dataset status, price, and record counts...");
  await Dataset.findByIdAndUpdate(
    datasetId,
    {
      status: "awaiting_payment",
      price: invoice.totalCost,
      rows: totalTasks,
      "metadata.numRecords": totalTasks
    }
  );
  console.log("Dataset updated successfully.");

  // Create Invoice in DB
  console.log("Creating invoice document in database...");
  await Invoice.findOneAndUpdate(
    { datasetId },
    {
      status: "pending",
      taskType: invoiceTaskType,
      rowsCount: totalTasks,
      ...invoice
    },
    { upsert: true, new: true }
  );
  console.log("Invoice document created/updated successfully.");

  // Create batches for dataset
  console.log("Generating batches for dataset tasks...");
  const batchResult = await taskService.createBatchesForDataset(datasetId);
  console.log(`Batches generated successfully: ${batchResult.created} batches created.`);

  console.log("Dataset finalization complete.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Error finalizing dataset:", error);
  await mongoose.disconnect();
  process.exit(1);
});
