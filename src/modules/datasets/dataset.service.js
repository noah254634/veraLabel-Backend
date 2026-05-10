import Dataset from "./dataset.model.js";
import Invoice from "./invoice.model.js";
import { PutObjectCommand, PutBucketCorsCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { r2 } from "../../config/r2Upload.js";
import UserVera from "../users/user.model.js";
import ensureCorsConfigured from "../../helpers/r2CorsConfiguration.js";
import { verifyFileInR2 } from "../../helpers/r2Verify.js";
import { triggerWorker } from "../../helpers/workerTrigger.js";

export const datasetService = {
  generateUploadUrl: async (userId, fileType) => {
  
    await ensureCorsConfigured();
    
    if (!userId) throw new Error("userId is required");
    if (!fileType) throw new Error("fileType is required");
    const folderMap={
      rlhf:"rlhfDatasets",
      images:"imageDatasets",
      general:"generalDatasets",
      datasets:"datasets",
      synthetic:"syntheticDatasets"
    }
    const folder = folderMap[fileType] || "datasets";
    const key = `${folder}/${userId}/${uuidv4()}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(r2, command, {
      expiresIn: 900, // 15 minutes — 60s was too short for real file uploads
    });

    return { uploadUrl, key };
  },
  buyerSideDatasets: async () => {
    const datasets = await Dataset.aggregate([
      {
        $match: {
          //visibility: "public",
          isPublished: true,
          // isVerified: true,
        },
      },
      {
        $project: {
          _id: 1,
          datasetFormat: 1,
          reviews: 1,
          exclusivePrice: 1,
          price: 1,
          isVerified: 1,
          name: 1,
          description: 1,
          version: 1,
          size: 1,
          rating: 1,
        },
      },
    ]);
    return datasets;
  },

  getAllDatasets: async () => {
    return await Dataset.find();
  },
  getDatasetById: async (id) => {
    return await Dataset.findById(id);
  },
  deleteDataset: async (id) => {
    if (!id) throw new Error("id is required");
    const dataset = await Dataset.findById(id);
    if (!dataset) throw new Error("No dataset with that Id in database");
    return await Dataset.findByIdAndDelete(id);
  },
  updateDataset: async (id, data) => {
    return await Dataset.findByIdAndUpdate(id, data, { new: true });
  },
  filterDatasets: async (filters) => {
    const now = new Date();
    const date = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
    const [
      datasetsToday,
      datasetsThiMonth,
      approvedDatasets,
      rejectedDatasets,
    ] = await Promise.all([
      Dataset.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfDay },
          },
        },
      ]),
    ]);
    return await Dataset.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay },
          status: "approved",
        },
      },
    ]);
  },
  createDataset: async (
    domain,
    specifications,
    volume,
    format,
    budget,
    fileUrl,
    timeline,
    qualityMetrics,
    userId,
  ) => {
    const userExists = await UserVera.findOne({ _id: userId, role: "buyer" });
    if (!userExists) throw new Error("Unauthorized access or user not a buyer");
    if (!domain) throw new Error("Domain is required");
    if (!specifications) throw new Error("Specifications is required");
    if (!volume) throw new Error("Volume is required");
    if (!format) throw new Error("Format is required");
    if (!fileUrl) throw new Error("File URL is required - upload file first using /datasets/generateUploadUrl");
    if (!timeline) throw new Error("Timeline/SLA is required");
    
    // Step 1: Create a Dataset with type 'custom'
    const priceValue = parseFloat(budget.toString().replace(/\$|,/g, "")) || 0;

    const dataset = await Dataset.create({
      type: "custom",
      name: specifications.substring(0, 100),
      description: specifications,
      buyerId: userId,
      domain,
      volume,
      budget: priceValue,
      format,
      timeline,
      qualityMetrics: qualityMetrics || "",
      sourceLink: fileUrl,
      fileUrl: fileUrl,
      status: "pending",
      datasetLabeler: userId,
      datasetType: domain || "Tabular",
      datasetFormat: format,
      filePath: fileUrl,
      isPublished: false,
      price: priceValue,
    });

    return {
      datasetId: dataset._id.toString(),
      dataset,
    };
  },

  confirmUpload: async (r2Key, datasetId, dataType) => {
    // Validate inputs
    if (!r2Key) throw new Error("r2Key is required");
    if (!datasetId) throw new Error("datasetId is required");
    if (!dataType) throw new Error("dataType is required");

    // Step 1: Verify file exists in R2
    const fileMetadata = await verifyFileInR2(r2Key);

    // Step 2: Update existing dataset (must already exist from datasetRequest)
    const dataset = await Dataset.findByIdAndUpdate(
      datasetId,
      {
        status: "processing",
        filePath: r2Key,
        size: fileMetadata.size,
      },
      { new: true }
    );

    if (dataset) {
      // Update the Dataset status to 'processing' for the ingestion phase
      await Dataset.findOneAndUpdate(
        { _id: dataset._id },
        { status: "processing" }
      );
    }

    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}. Create dataset request first.`);
    }

    // Map format to worker's supported DATA_TYPES
    const dataTypeMap = {
      'json': 'text',
      'jsonl': 'text',
      'csv': 'text',
      'txt': 'text',
      'jpg': 'media',
      'jpeg': 'media',
      'png': 'media',
      'gif': 'media',
      'mp4': 'media',
      'rlhf': 'rlhf'
    };

    const workerDataType = dataTypeMap[dataset.datasetFormat?.toLowerCase()] || 'text';

    // Step 3: Trigger worker to start splitting
    const projectId = dataset.datasetLabeler?.toString() || "unknown";
    const workerResult = await triggerWorker(r2Key, projectId, dataset._id.toString(), workerDataType);

    return {
      success: true,
      message: workerResult.partialSuccess
        ? "File uploaded successfully. Processing started but some task batches failed to register — they will be retried."
        : "File uploaded and verified successfully, splitting initiated",
      datasetId: dataset._id.toString(),
      status: dataset.status,
      ...(workerResult.partialSuccess && {
        partialSuccess: true,
        failedBatches: workerResult.failedBatches,
        count: workerResult.count,
      }),
    };
  },
};
