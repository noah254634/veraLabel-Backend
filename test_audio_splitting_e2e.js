import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import jwt from "jsonwebtoken";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "./src/config/r2Upload.js";
import Dataset from "./src/modules/datasets/dataset.model.js";
import Task from "./src/modules/tasks/task.model.js";
import Invoice from "./src/modules/datasets/invoice.model.js";
import UserVera from "./src/modules/users/user.model.js";
import { getRecentEvents } from "./src/modules/tasks/progress.service.js";

dotenv.config({ path: "src/.env" });

const MONGO_URI = process.env.MONGO_URI;

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  // 1. Locate/Create a test buyer user
  let buyerUser = await UserVera.findOne({ role: "buyer" });
  if (!buyerUser) {
    console.log("No buyer user found, searching for any user...");
    buyerUser = await UserVera.findOne({});
  }

  if (!buyerUser) {
    console.error("No users found in database to simulate buyer session.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const buyerId = buyerUser._id.toString();
  console.log(`Using user ID: ${buyerId} (Role: ${buyerUser.role})`);

  // 2. Create a new custom dataset in the DB
  const dataset = await Dataset.create({
    name: "E2E WAV Slicing Test Dataset",
    description: "A test dataset for testing pure Python WAV file slicing and chunking",
    price: 0,
    pricePerBatch: 0,
    rating: 0,
    isPublished: false,
    status: "pending",
    type: "custom",
    buyerId: buyerId,
    domain: "Audio Classification",
    labellingMethod: "classification",
    contentType: "audio",
    datasetType: "audio",
    datasetFormat: "wav",
    visibility: "private",
    metadata: {
      labels: ["Speech", "Music", "Noise", "Silence"]
    }
  });

  const datasetId = dataset._id.toString();
  console.log(`Created Dataset request: ID = ${datasetId}`);

  // 3. Upload test_audio.zip to R2
  const zipPath = "test_audio.zip";
  if (!fs.existsSync(zipPath)) {
    console.error("test_audio.zip does not exist. Run create_test_zip.js first.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const zipBuffer = fs.readFileSync(zipPath);
  const r2Key = `datasets/${buyerId}/${datasetId}/test_audio.zip`;

  console.log(`Uploading ${zipPath} to R2 bucket at ${r2Key}...`);
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2Key,
      Body: zipBuffer,
      ContentType: "application/zip",
    })
  );
  console.log("Uploaded successfully to R2.");

  // 4. Generate JWT for the buyer
  const jwtSecret = process.env.JWT_SECRET || "KhaembaNoah.2546";
  const token = jwt.sign(
    { id: buyerId, role: buyerUser.role },
    jwtSecret,
    { expiresIn: "1h" }
  );

  // 5. Trigger the confirmUpload HTTP request
  const url = "http://127.0.0.1:5000/api/v1/datasets/confirmUpload";
  const payload = {
    r2Key: r2Key,
    datasetId: datasetId,
    dataType: "audio"
  };

  console.log("Triggering confirmUpload...");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `accessToken=${token}`
    },
    body: JSON.stringify(payload)
  });

  console.log(`confirmUpload Response Status: ${res.status} ${res.statusText}`);
  const responseBody = await res.json();
  console.log("Response:", JSON.stringify(responseBody, null, 2));

  // 6. Poll for progress logs and verify task creation
  console.log("Polling database for split tasks and pricing calculation...");
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds
  let completed = false;

  while (attempts < maxAttempts && !completed) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;

    // Fetch progress events
    let events = [];
    try {
      events = await getRecentEvents(buyerId, datasetId);
    } catch (e) {
      // Session might not be initialized yet
    }

    if (events.length > 0) {
      console.log(`--- Progress Logs (Attempt ${attempts}/${maxAttempts}) ---`);
      events.forEach((evt) => {
        console.log(`[${evt.type.toUpperCase()}] ${evt.message}`);
        if (evt.type === "complete" || evt.type === "error") {
          completed = true;
        }
      });
    }

    const currentDataset = await Dataset.findById(datasetId).lean();
    if (currentDataset.status === "awaiting_payment" || currentDataset.status === "registration_failed") {
      completed = true;
      console.log(`Dataset status transitioned to: ${currentDataset.status}`);
    }
  }

  // 7. Verify the final result in the database
  const finalTasks = await Task.find({ datasetId }).lean();
  console.log(`\nVerification:`);
  console.log(`Total Tasks generated: ${finalTasks.length}`);
  finalTasks.forEach((t, i) => {
    console.log(`Task ${i + 1}: Name="${t.taskName}", R2Key="${t.r2_input_taskRef}", Split="${t.split}"`);
  });

  const finalInvoice = await Invoice.findOne({ datasetId }).lean();
  if (finalInvoice) {
    console.log(`Invoice found: Total Cost = $${finalInvoice.totalCost}, Rows Count = ${finalInvoice.rowsCount}`);
  } else {
    console.log("No Invoice found in database.");
  }

  const finalDataset = await Dataset.findById(datasetId).lean();
  console.log(`Dataset status: "${finalDataset.status}", Price = $${finalDataset.price}, Rows = ${finalDataset.rows}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
});
