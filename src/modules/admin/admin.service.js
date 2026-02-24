import mongoose from "mongoose";
import Dataset from "../datasets/dataset.model.js";
import UserVera from "../users/user.model.js";
export const adminService = {
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
    const dataset = await Dataset.findByIdAndUpdate(
      id,
      { isPublished: true },
      { new: true },
    );
    if (!dataset) throw new Error("Dataset not found");
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
  pendingDatasets: async () => {
    const datasets = await Dataset.find({ status: "pending" });
    if (!datasets) throw new Error("No pending datasets found");
    return datasets;
  },
  approvedDatasets: async () => {
    const datasets = await Dataset.find({ status: "approved" });
    if (!datasets) throw new Error("No approved datasets found");
    return datasets;
  },
  rejectedDatasets: async () => {
    const datasets = await Dataset.find({ status: "rejected" });
    if (!datasets) throw new Error("No rejected datasets found");
    return datasets;
  },
  flaggedDatasets: async () => {
    const datasets = await Dataset.find({ "isFlagged.status": true });
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
    /*if (!reason) {
      throw new Error("Reason not found to suspend user");
    }*/
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
  demoteUserById: async (id) => {
    if (!id) throw new Error("Id required to do this action");
    if (!mongoose.Types.ObjectId.isValid(id))
      throw new Error("Invalid user id");

    const user = await UserVera.findByIdAndUpdate(
      id,
      { role: "Labeler" },
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
    try {
      if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error("Invalid dataset id");
      if (!id) throw new Error("Id  required to do this action");
      const dataset = await Dataset.findByIdAndDelete(id);
      if (!dataset) throw new Error("Dataset not found");
      return dataset;
    } catch (err) {
      return err.message;
    }
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
};
