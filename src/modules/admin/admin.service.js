import mongoose from "mongoose";
import Dataset from "../datasets/dataset.model.js";
import UserVera from "../users/user.model.js";
import Buyer from "../buyer/buyer.model.js";
import Batch from "../tasks/task.batch.model.js";
import GeoAccessLog from "./models/geoAccessLog.model.js";
import GeoRequestAudit from "./models/geoRequestAudit.model.js";
import { datasetService, calculateDatasetTaskCounts } from "../datasets/dataset.service.js";
import Task from "../tasks/task.model.js";
import Submission from "../tasks/task.submission.model.js";
import { NotificationService } from "../notifications/notification.service.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2 } from "../../config/r2Upload.js";
import logger from "../../config/logger.js";

const enrichDatasetWithTaskCounts = async (datasetDoc) => {
  if (!datasetDoc) return null;
  const dataset = datasetDoc.toObject ? datasetDoc.toObject() : datasetDoc;
  const counts = await calculateDatasetTaskCounts(dataset._id);
  return { ...dataset, ...counts };
};

const GEO_TIME_SLICES = {
  "30m": { fromMs: 0, toMs: 30 * 60 * 1000, label: "last 30 minutes" },
  "1h": { fromMs: 30 * 60 * 1000, toMs: 60 * 60 * 1000, label: "30 minutes to 1 hour ago" },
  "2h": { fromMs: 60 * 60 * 1000, toMs: 2 * 60 * 60 * 1000, label: "1 hour to 2 hours ago" },
  "3h": { fromMs: 2 * 60 * 60 * 1000, toMs: 3 * 60 * 60 * 1000, label: "2 hours to 3 hours ago" },
  "6h": { fromMs: 3 * 60 * 60 * 1000, toMs: 6 * 60 * 60 * 1000, label: "3 hours to 6 hours ago" },
  "12h": { fromMs: 6 * 60 * 60 * 1000, toMs: 12 * 60 * 60 * 1000, label: "6 hours to 12 hours ago" },
  "24h": { fromMs: 12 * 60 * 60 * 1000, toMs: 24 * 60 * 60 * 1000, label: "12 hours to 24 hours ago" },
  "7d": { fromMs: 0, toMs: 7 * 24 * 60 * 60 * 1000, label: "last 7 days" },
};

const resolveGeoTimeSlice = (timeRange) => {
  const normalized = String(timeRange || "7d").trim().toLowerCase();
  return GEO_TIME_SLICES[normalized] || GEO_TIME_SLICES["7d"];
};

const buildGeoTimeMatch = (timeRange, fieldName) => {
  const slice = resolveGeoTimeSlice(timeRange);
  const now = Date.now();
  return {
    [fieldName]: {
      $gte: new Date(now - slice.toMs),
      $lt: new Date(now - slice.fromMs),
    },
  };
};

export const adminService = {
  promoteToReviewerById: async (id) => {
    if (!id) throw new Error("Id  required to do this action");
    const user = await UserVera.findByIdAndUpdate(
      id,
      { role: "reviewer" },
      { new: true },
    );
    if (!user) throw new Error("User not found");
    return user;
  },

  verifyUserById: async (id) => {
    if (!id) throw new Error("Id not found");
    const user = await UserVera.findByIdAndUpdate(
      { _id: id, isVerified: { $ne: true } },
      { isVerified: true },
      { new: true },
    );
    if (!user) {
      const userExists = await UserVera.exists({ _id: id });
      throw new Error(userExists ? "User already verified" : "User not found");
    }
    return user;
  },
  unverifyUserById: async (id) => {
    if (!id) throw new Error("Id not found");
    const user = await UserVera.findByIdAndUpdate(
      { _id: id, isVerified: { $ne: false } },
      { isVerified: false },
      { new: true },
    );
    if (!user) {
      const userExists = await UserVera.exists({ _id: id });
      throw new Error(userExists ? "User already unverified" : "User not found");
    }
    return user;
    },
  rateUser: async (id, rating) => {
    if (!id) throw new Error("Id not found");
    if (!rating) throw new Error("Rating not found");
    const user = await UserVera.findByIdAndUpdate(
      id,
      { trustScore: rating },);
    if (!user) throw new Error("User not found");
    return user;
  },
  unpublishDatasetById: async (id) => {
    if (!id) throw new Error("Id not found");
    const dataset = await Dataset.findByIdAndUpdate(
      id,
      { isPublished: false },
      { new: true },
    );
    if (!dataset) throw new Error("Dataset not found");
    return dataset;
  },
  publishDatasetById: async (id) => {
    if (!id) throw new Error("Id not found");
    const dataset = await Dataset.findById(id);
    if (!dataset) throw new Error("Dataset not found");

    // DATA INTEGRITY GUARD: Ensure all rows are finalized before marketplace injection
    const verifiedTasksCount = await Submission.countDocuments({ datasetId: id, status: "approved" });
    const totalTasksCount = await Task.countDocuments({ datasetId: id });
    const effectiveRows = dataset.rows || totalTasksCount || 0;
    const effectiveCompleted = dataset.rowsCompleted !== undefined && dataset.rowsCompleted !== null && dataset.rowsCompleted > 0 ? dataset.rowsCompleted : verifiedTasksCount;

    if (effectiveRows > 0) {
      if (effectiveCompleted < effectiveRows) {
        throw new Error(`Integrity_Violation: Batch is incomplete (${effectiveCompleted}/${effectiveRows} rows). Wait for ingestion to finish.`);
      }
    }

    dataset.isPublished = true;
    await dataset.save();
    return dataset;
  },
  updateDatasetPrice: async (id, newPrice) => {
    if (!id) throw new Error("Id not found");
    if (newPrice === undefined) throw new Error("Price not found");
    const dataset = await Dataset.findByIdAndUpdate(
      id,
      { price: newPrice },
      { new: true },
    );
    return dataset;
  },
  updateDatasetBatchPrice: async (id, pricePerBatch) => {
    if (!id) throw new Error("Id not found");
    if (pricePerBatch === undefined) throw new Error("Batch price not found");
    const dataset = await Dataset.findByIdAndUpdate(
      id,
      { pricePerBatch },
      { new: true },
    );
    return dataset;
  },
  pendingDatasets: async () => {
    const datasets = await Dataset.find({ status: "pending" }).sort({ createdAt: -1 });
    if (!datasets) throw new Error("No pending datasets found");
    return await Promise.all(datasets.map(enrichDatasetWithTaskCounts));
  },
  approvedDatasets: async () => {
    const datasets = await Dataset.find({ status: "approved" }).sort({ createdAt: -1 });
    if (!datasets) throw new Error("No approved datasets found");
    return await Promise.all(datasets.map(enrichDatasetWithTaskCounts));
  },
  rejectedDatasets: async () => {
    const datasets = await Dataset.find({ status: "rejected" }).sort({ createdAt: -1 });
    if (!datasets) throw new Error("No rejected datasets found");
    return await Promise.all(datasets.map(enrichDatasetWithTaskCounts));
  },
  flaggedDatasets: async () => {
    const datasets = await Dataset.find({ "isFlagged.status": true }).sort({ createdAt: -1 });
    if (!datasets) throw new Error("No flagged datasets found");
    return await Promise.all(datasets.map(enrichDatasetWithTaskCounts));
  },
  banUserById: async (id, reason) => {
    if (!id) throw new Error("Id not found");
    if (!reason) throw new Error("Reason not found to permanently ban user");
    const user = await UserVera.findByIdAndUpdate(
      id,
      { "isBanned.status": true, "isBanned.reason": reason },
      { new: true },
    );
    if (!user) throw new Error("User not found");
    return user;
  },
  blockUserById: async (id, reason) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid user id");
    }
    if (!id) throw new Error("Id not found");
    if (!reason) throw new Error("Reason not found");
    const user = await UserVera.findByIdAndUpdate(
      {_id:id,"isBlocked.status":{$ne:true}},
      { "isBlocked.status": true, "isBlocked.reason": reason },
      { new: true },
    );
    if (!user){ 
      const userExists=await UserVera.exists({_id:id})
      throw new Error(!userExists?"User not found":"User is already blocked")
    }
    return user;
  },
  blockUserByEmail: async (email) => {
    if (!email) throw new Error("Email not found");
    const user = await UserVera.findOneAndUpdate(
      { email },
      { isBlocked: true },
      { new: true },
    );
    if (!user) throw new Error("User not found");
    return user;
  },
  unblockUserById: async (id) => {
    if (!id) throw new Error("Id not found");
    const user = await UserVera.findByIdAndUpdate(
      {_id:id,"isBlocked.status":{$ne:true}},
      { "isBlocked.status": false, "isBlocked.reason": "" },
      { new: true },
    );
    if (!user){
      const userExists=await UserVera.exists({_id:id})
     throw new Error(!userExists?"User not found":"User was NEVER blocked");}
    return user;
  },
  unblockUserByEmail: async (email) => {
    if (!email)
      throw new Error("Email not placed,add Email to perform this action");
    const user = await UserVera.findOneAndUpdate(
      { email },
      { isBlocked: false },
      { new: true },
    );
    if (!user){ 
      const userExists=await UserVera.exists({email})
      throw new Error(!userExists?"User not found":"User was NEVER Blocked");}
    return user;
  },
  suspendUserById: async (id, reason) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid user id");
    }
    if (!id) {
      throw new Error("Id not found");
    }

    const updatedUser = await UserVera.findOneAndUpdate(
      { _id: id, "isSuspended.status": { $ne: true } },
      { $set: { "isSuspended.status": true, "isSuspended.reason": reason } },
      { new: true },
    );

    if (!updatedUser) {
      const userExists = await UserVera.exists({ _id: id });
      throw new Error(
        !userExists ? "User not found" : "User is already suspended",
      );
    }

    return updatedUser;
  },
  unsuspendUserById: async (id) => {
    if (!id)
      throw new Error(
        "Id not found,seems user you are trying to unsuspend is not in database",
      );
    const user = await UserVera.findByIdAndUpdate(id, {
      "isSuspended.status": false,
      "isSuspended.reason": "",
    });
    if (!user) throw new Error("User not found are you sure the user exists?");
    return user;
  },
  deleteUserById: async (id) => {
    if (!id) {
      throw new Error("Id not found to delete user not entered");
    }
    const user = await UserVera.findByIdAndDelete(id);
    if (!user) throw new Error("User not found are you sure the user exists?");
    return user;
  },
  deleteUserByEmail: async (email) => {},
  getUserByScore: async (score) => {
    const users = await UserVera.find({ trustScore: { $gte: score } });
    if (!users) throw new Error("No users found with this score");
    return users;
  },
  promoteUserById: async (id) => {
    if (!id) throw new Error("Id  required to do this action");
    const user = await UserVera.findByIdAndUpdate(
      id,
      { role: "admin" },
      { new: true },
    );
    if (!user) throw new Error("User not found");
    return user;
  },
  

  promoteUserByEmail: async (email) => {
    if (!email) throw new Error("Email required to do this action");
    const user = await UserVera.findOneAndUpdate(
      { email },
      { role: "admin" },
      { new: true },
    );
    if (!user) throw new Error(`User with email ${email} not found`);
    return user;
  },
  
  demoteUserById: async (id) => {
    if (!id) throw new Error("Id required to do this action");
    if (!mongoose.Types.ObjectId.isValid(id))
      throw new Error("Invalid user id");

    const user = await UserVera.findByIdAndUpdate(
      id,
      { role: "labeler" },
      { new: true },
    );
    if (!user) throw new Error("User not found");
    return user;
  },
  flagDatasetById: async (id, reason) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error("Invalid dataset id");
      if (!id) throw new Error("Id required to do this action");
      if (!reason) throw new Error("Reason required to do this action");
      const dataset = await Dataset.findByIdAndUpdate({id,"isFlagged.status":{$ne:true}}, {
        "isFlagged.status": true,
        "isFlagged.reason": reason,
      });
      if (!dataset){
        const datasetExists=await Dataset.exists({_id:id})
        throw new Error(!datasetExists?"Dataset not found":"Dataset is already flagged");
       } return dataset;
    } catch (err) {
      return err.message;
    }
  },
  unflagDatasetById: async (id) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error("Invalid dataset id");
      if (!id) throw new Error("Id not required to do this action");
      const dataset = await Dataset.findByIdAndUpdate({id,"isFlagged.status":{$ne:false}}, {
        "isFlagged.status": false,
        "isFlagged.reason": "",
      });
      if (!dataset){
        const datasetExists=await Dataset.exists({_id:id})
        throw new Error(!datasetExists?"Dataset not found":"Dataset was NEVER flagged");
      }
      return dataset;
    } catch (err) {
      return err.message;
    }
  },
  deleteDatasetById: async (id) => {
    if (!id) throw new Error("Id required to do this action");
    if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid dataset id");
    // Full cascade: tasks, batches, submissions, invoices, labeller profile cleanup
    return await datasetService.deleteDataset(id);
  },
  approveDatasetById: async (id) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error("Invalid dataset id");
      if (!id) throw new Error("Id not required to do this action");
      const dataset = await Dataset.findByIdAndUpdate({id,status:{$ne:"approved"}}, {
        status: "approved",
      });
      if (!dataset){ 
        const datasetExists=await Dataset.exists({id})
        throw new Error(!datasetExists?"Dataset not found":"Dataset is already approved")
      }
      return dataset;
    } catch (err) {
      return err.message;
    }
  },
  rejectDatasetById: async (id) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error("Invalid dataset id");
      if (!id) throw new Error("Id not required to do this action");
      const dataset = await Dataset.findByIdAndUpdate(id, {
        status: "rejected",
      });
      if (!dataset) throw new Error("Dataset not found");
      return dataset;
    } catch (err) {
      return err.message;
    }
  },
  updateDatasetStatus: async (id, status) => {
    if (!id) throw new Error("Dataset ID is required");
    if (!status) throw new Error("Status is required");
    const dataset = await Dataset.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!dataset) throw new Error("Dataset not found");
    return dataset;
  },
  updateDatasetPriority: async (id, priority) => {
    if (!id) throw new Error("Dataset ID is required");
    if (!priority) throw new Error("Priority is required");
    const dataset = await Dataset.findByIdAndUpdate(
      id,
      { priority },
      { new: true }
    );
    if (!dataset) throw new Error("Dataset not found");
    return dataset;
  },
  updateDatasetMaxLabellers: async (id, maxLabellers) => {
    if (!id) throw new Error("Dataset ID is required");
    if (!maxLabellers) throw new Error("Max labellers is required");
    
    const dataset = await Dataset.findByIdAndUpdate(
      id,
      { maxLabellers },
      { new: true }
    );
    if (!dataset) throw new Error("Dataset not found");
    
    await Batch.updateMany(
      { datasetId: dataset._id },
      { $set: { maxLabellers } }
    );

    return dataset;
  },

  getBuyers: async (status) => {
    let query = {};
    if (status) {
      query.verificationStatus = status;
    }
    return await Buyer.find(query).populate('userId', 'name email profilePicture role status').sort({ createdAt: -1 });
  },

  approveBuyer: async (buyerId) => {
    const buyer = await Buyer.findByIdAndUpdate(
      buyerId,
      { verificationStatus: "approved", isActive: true },
      { new: true }
    ).populate('userId', 'name email profilePicture role status');
    if (!buyer) throw new Error("Buyer not found");
    return buyer;
  },

  rejectBuyer: async (buyerId, adminNotes) => {
    const buyer = await Buyer.findByIdAndUpdate(
      buyerId,
      { verificationStatus: "rejected", isActive: false, adminNotes: adminNotes || "" },
      { new: true }
    ).populate('userId', 'name email profilePicture role status');
    if (!buyer) throw new Error("Buyer not found");
    return buyer;
  },

  getGeoAccessLogs: async (timeRange) => {
    return await GeoAccessLog.find(buildGeoTimeMatch(timeRange, "lastAccess")).sort({ lastAccess: -1 });
  },

  getGeoRequestAudits: async (timeRange) => {
    return await GeoRequestAudit.find(buildGeoTimeMatch(timeRange, "timestamp"))
      .populate('userId', 'name email role')
      .sort({ timestamp: -1 })
      .limit(200);
  },

  getGeoAnalytics: async (timeRange) => {
    const match = buildGeoTimeMatch(timeRange, "lastAccess");

    const totalUniqueVisitors = await GeoAccessLog.countDocuments(match);
    
    const countryBreakdown = await GeoAccessLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$country",
          uniqueVisitors: { $sum: 1 },
          totalHits: { $sum: "$hits" }
        }
      },
      { $sort: { uniqueVisitors: -1 } }
    ]);

    const blockStatusBreakdown = await GeoAccessLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$isBlocked",
          uniqueVisitors: { $sum: 1 },
          totalHits: { $sum: "$hits" }
        }
      }
    ]);

    return {
      totalUniqueVisitors,
      countryBreakdown,
      blockStatusBreakdown
    };
  },

  compileDataset: async (datasetId) => {
    if (!datasetId) throw new Error("Dataset ID is required");
    const dataset = await Dataset.findById(datasetId);
    if (!dataset) throw new Error("Dataset not found");

    // 1. Verify completeness
    const totalTasks = await Task.countDocuments({ datasetId });
    const verifiedTasks = await Task.countDocuments({ datasetId, status: "verified" });
    if (totalTasks === 0 || verifiedTasks < totalTasks) {
      throw new Error(`Dataset is not 100% completed and verified yet (${verifiedTasks}/${totalTasks} tasks verified).`);
    }

    // 2. Check submissions per task
    const tasks = await Task.find({ datasetId });
    const requiredSubmissions = dataset.maxLabellers || 1;

    const submissions = await Submission.find({ datasetId, status: "approved" })
      .populate({
        path: "submittedBy",
        populate: { path: "userId", select: "trustScore" }
      });

    // Group submissions by task ID
    const subMap = {};
    for (const sub of submissions) {
      const tId = sub.taskId.toString();
      if (!subMap[tId]) subMap[tId] = [];
      subMap[tId].push(sub);
    }

    // Verify task submission requirements
    for (const task of tasks) {
      const taskSubs = subMap[task._id.toString()] || [];
      if (taskSubs.length < requiredSubmissions) {
        throw new Error(`Task "${task.taskName}" only has ${taskSubs.length}/${requiredSubmissions} approved submissions.`);
      }
    }

    // 3. Build the assembly payload with temporary presigned GET URLs
    const taskItems = [];
    for (const task of tasks) {
      const taskSubs = subMap[task._id.toString()] || [];
      
      // Generate presigned GET URL for the task input file
      const getInputCommand = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: task.r2_input_taskRef
      });
      const inputUrl = await getSignedUrl(r2, getInputCommand, { expiresIn: 3600 }); // 1 hour

      const submissionItems = [];
      for (const sub of taskSubs) {
        // Generate presigned GET URL for the submission annotation file
        const getOutputCommand = new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: sub.r2_output_key
        });
        const outputUrl = await getSignedUrl(r2, getOutputCommand, { expiresIn: 3600 }); // 1 hour

        // Safely extract trust score
        const trustScore = sub.submittedBy?.userId?.trustScore ?? 0.5;

        submissionItems.push({
          submissionId: sub.submissionId,
          outputUrl,
          labellerTrustScore: trustScore,
          ...((dataset.isCollection || sub.collectionMetadata) ? {
            transcription: sub.collectionMetadata?.transcription || null,
            selectedTone: sub.collectionMetadata?.selectedTone || null,
            languageUsed: sub.collectionMetadata?.languageUsed || null,
            codeSwitchingUsed: sub.collectionMetadata?.codeSwitchingUsed || null,
            deviceInfo: sub.collectionMetadata?.deviceInfo || null,
            timezone: sub.collectionMetadata?.timezone || null,
            recordedAt: sub.collectionMetadata?.recordedAt || null,
          } : {})
        });
      }

      taskItems.push({
        taskId: task.taskId,
        taskName: task.taskName,
        split: task.split,
        inputUrl,
        fileName: task.taskName,
        submissions: submissionItems
      });
    }

    const payload = {
      datasetId: dataset._id.toString(),
      datasetName: dataset.name,
      dataType: dataset.datasetType || "text",
      labellingMethod: dataset.labellingMethod || "classification",
      isCollection: dataset.isCollection === true,
      tasks: taskItems
    };

    // 4. Call FastAPI microservice
    const fastApiUrl = `${process.env.SPLITTER_SERVICE_URL}/api/v1/datasets/assemble`;
    const internalSecret = process.env.INTERNAL_SECRET;

    logger.info(`Triggering FastAPI compiler for dataset ${datasetId} at ${fastApiUrl}`);
    
    let response;
    try {
      response = await fetch(fastApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vera-Signature': internalSecret
        },
        body: JSON.stringify(payload)
      });
    } catch (fetchErr) {
      throw new Error(`Network error calling compiler: ${fetchErr.message}`);
    }

    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(`Compiler error: ${responseData.message || JSON.stringify(responseData)}`);
    }

    // 5. Update Dataset
    dataset.downloadUrl = responseData.r2Key;
    dataset.status = "completed";
    await dataset.save({ validateBeforeSave: false });

    // 6. Notify the Buyer
    try {
      const buyer = await Buyer.findById(dataset.buyerId);
      if (buyer && buyer.userId) {
        await NotificationService.sendToUser(buyer.userId, {
          title: "Dataset Compiled and Ready",
          body: `Your dataset "${dataset.name}" has been compiled and is ready for download.`,
          data: { datasetId: dataset._id.toString(), type: "dataset_compiled" }
        });
        logger.info(`Notified buyer ${buyer.userId} of successful compilation of dataset ${dataset.name}`);
      }
    } catch (notifyErr) {
      logger.error(`Failed to notify buyer of dataset compile: ${notifyErr.message}`);
    }

    return {
      success: true,
      message: responseData.message,
      r2Key: responseData.r2Key,
      sizeBytes: responseData.sizeBytes
    };
  },

  evaluateDatasetConsensus: async (datasetId) => {
    if (!datasetId) throw new Error("Dataset ID is required");
    const dataset = await Dataset.findById(datasetId);
    if (!dataset) throw new Error("Dataset not found");

    const tasks = await Task.find({ datasetId });
    const submissions = await Submission.find({ datasetId })
      .populate({
        path: "submittedBy",
        populate: { path: "userId", select: "trustScore" }
      });

    // Group submissions by task ID
    const subMap = {};
    for (const sub of submissions) {
      const tId = sub.taskId.toString();
      if (!subMap[tId]) subMap[tId] = [];
      subMap[tId].push(sub);
    }

    const taskItems = [];
    for (const task of tasks) {
      const taskSubs = subMap[task._id.toString()] || [];
      if (taskSubs.length === 0) continue;

      const submissionItems = [];
      for (const sub of taskSubs) {
        // Generate presigned GET URL for the submission annotation file
        const getOutputCommand = new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: sub.r2_output_key
        });
        const outputUrl = await getSignedUrl(r2, getOutputCommand, { expiresIn: 3600 }); // 1 hour

        const trustScore = sub.submittedBy?.userId?.trustScore ?? 0.5;

        submissionItems.push({
          submissionId: sub.submissionId,
          outputUrl,
          labellerTrustScore: trustScore
        });
      }

      taskItems.push({
        taskId: task.taskId,
        submissions: submissionItems
      });
    }

    if (taskItems.length === 0) {
      throw new Error("No submissions found to evaluate for this dataset.");
    }

    const payload = {
      dataType: dataset.datasetType || "text",
      labellingMethod: dataset.labellingMethod || "classification",
      matchThreshold: 0.5, // Default matching threshold
      tasks: taskItems
    };

    const fastApiUrl = `${process.env.SPLITTER_SERVICE_URL}/api/v1/datasets/consensus/evaluate`;
    const internalSecret = process.env.INTERNAL_SECRET;

    logger.info(`Triggering FastAPI consensus evaluator for dataset ${datasetId} at ${fastApiUrl}`);

    let response;
    try {
      response = await fetch(fastApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vera-Signature': internalSecret
        },
        body: JSON.stringify(payload)
      });
    } catch (fetchErr) {
      throw new Error(`Network error calling consensus evaluator: ${fetchErr.message}`);
    }

    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(`Consensus evaluator error: ${responseData.message || JSON.stringify(responseData)}`);
    }

    // Process the results: update submission verificationScores and flag outliers
    const results = responseData.results || [];
    for (const result of results) {
      const taskDoc = await Task.findOne({ taskId: result.task_id || result.taskId });
      if (!taskDoc) continue;

      const pairwise = result.pairwise_iou || result.pairwiseIoU || {};
      const outliers = result.outliers || [];

      const taskSubs = subMap[taskDoc._id.toString()] || [];
      for (const sub of taskSubs) {
        let scoreSum = 0.0;
        let scoreCount = 0;
        
        for (const [key, val] of Object.entries(pairwise)) {
          if (key.includes(sub.submissionId)) {
            scoreSum += val;
            scoreCount++;
          }
        }
        
        const finalScore = scoreCount > 0 ? (scoreSum / scoreCount) : 1.0;
        sub.verificationScore = parseFloat(finalScore.toFixed(4));
        
        // Flag outlier submissions as under_review
        if (outliers.includes(sub.submissionId)) {
          sub.status = "under_review";
          logger.warn(`Submission ${sub.submissionId} flagged as consensus outlier. Routed to review queue.`);
        }
        
        await sub.save();
      }
    }

    let taskScoreSum = 0.0;
    let taskScoreCount = 0;
    for (const result of results) {
      const cScore = result.consensus_score !== undefined ? result.consensus_score : result.consensusScore;
      if (typeof cScore === 'number') {
        taskScoreSum += cScore;
        taskScoreCount++;
      }
    }
    if (taskScoreCount > 0) {
      dataset.consensusIoU = parseFloat((taskScoreSum / taskScoreCount).toFixed(4));
      await dataset.save();
      logger.info(`Updated dataset ${datasetId} consensusIoU: ${dataset.consensusIoU}`);
    }

    return {
      success: true,
      message: "Consensus evaluation completed and database updated.",
      consensusIoU: dataset.consensusIoU,
      results
    };
  }
};

