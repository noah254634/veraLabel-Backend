import mongoose from "mongoose";
import Dataset from "../datasets/dataset.model.js";
import UserVera from "../users/user.model.js";
import Buyer from "../buyer/buyer.model.js";
import Batch from "../tasks/task.batch.model.js";
import GeoAccessLog from "./models/geoAccessLog.model.js";
import { datasetService } from "../datasets/dataset.service.js";

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
    if (dataset.rows && dataset.rowsCompleted !== undefined) {
      if (dataset.rowsCompleted < dataset.rows) {
        throw new Error(`Integrity_Violation: Batch is incomplete (${dataset.rowsCompleted}/${dataset.rows} rows). Wait for ingestion to finish.`);
      }
    }

    dataset.isPublished = true;
    await dataset.save();
    return dataset;
  },
  updateDatasetPrice: async (id, newPrice) => {
    if (!id) throw new Error("Id not found");
    if (!newPrice) throw new Error("Price not found");
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
    return datasets;
  },
  approvedDatasets: async () => {
    const datasets = await Dataset.find({ status: "approved" }).sort({ createdAt: -1 });
    if (!datasets) throw new Error("No approved datasets found");
    return datasets;
  },
  rejectedDatasets: async () => {
    const datasets = await Dataset.find({ status: "rejected" }).sort({ createdAt: -1 });
    if (!datasets) throw new Error("No rejected datasets found");
    return datasets;
  },
  flaggedDatasets: async () => {
    const datasets = await Dataset.find({ "isFlagged.status": true }).sort({ createdAt: -1 });
    if (!datasets) throw new Error("No flagged datasets found");
    return datasets;
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
    
    // Update all related batches
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

  getGeoAccessLogs: async () => {
    return await GeoAccessLog.find().sort({ lastAccess: -1 });
  },

  getGeoAnalytics: async () => {
    const totalUniqueVisitors = await GeoAccessLog.countDocuments();
    
    const countryBreakdown = await GeoAccessLog.aggregate([
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
};
