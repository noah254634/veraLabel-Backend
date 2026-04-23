import Dataset from "./dataset.model.js";
import { PutObjectCommand, PutBucketCorsCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { r2 } from "../../config/r2Upload.js";
import DatasetRequest from "../marketplace/request.model.js";
import UserVera from "../users/user.model.js";
import ensureCorsConfigured from "../../helpers/r2CorsConfiguration.js";

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
      expiresIn: 60,
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
  createDataset: async (
    name,
    description,
    price,
    datasetLabeler,
    datasetType,
    datasetFormat,
    file,
    id,
  ) => {
    if (
      !name ||
      !description ||
      !price ||
      !datasetLabeler ||
      !datasetType ||
      !datasetFormat ||
      !file
    )
      throw new Error("All fields are required");

    const dataset = await Dataset.findByIdAndUpdate(id, {
      name,
      description,
      price,
      datasetLabeler,
      datasetType,
      datasetFormat,
      filePath: file.location,
      size: file.size,
    });
    return dataset;
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
    const startOfMonth = new Date(Date.UTC(date.getFullYear, date.getMonth, 1));
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
  createDatasetRequest: async (
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
    
    let formatted = "$" + budget.toString();
    const dataset = await DatasetRequest.create({
      domain,
      description: specifications,
      volume,
      budget: formatted,
      format,
      timeline,
      qualityMetrics: qualityMetrics || "",
      buyerId: userId,
      sourceLink: fileUrl,
      fileUrl: fileUrl,
    });
    return dataset;
  },
};
