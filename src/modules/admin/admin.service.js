import mongoose from "mongoose";
import Dataset from "../datasets/dataset.model.js";
import UserVera from "../users/user.model.js";
export const adminService={
    updateDatasetPrice:async(id,newPrice)=>{
        if(!id) throw new Error("Id not found");
        if(!newPrice) throw new Error("Price not found");
        const dataset=await Dataset.findByIdAndUpdate(id,{price:newPrice},{new:true});
    },
    pendingDatasets: async () => {
        const datasets=await Dataset.find({status:"pending"});
        if(!datasets) throw new Error("No pending datasets found");
        return datasets;
    },
    approvedDatasets: async () => {
        const datasets=await Dataset.find({status:"approved"});
        if(!datasets) throw new Error("No approved datasets found");
        return datasets;
    },
    rejectedDatasets: async () => {
        const datasets=await Dataset.find({status:"rejected"});
        if(!datasets) throw new Error("No rejected datasets found");
        return datasets;
    },
    flaggedDatasets: async () => {
        const datasets=await Dataset.find({"isFlagged.status":true});
        if(!datasets) throw new Error("No flagged datasets found");
        return datasets;
    },
    banUserById: async (id, reason) => {
        if(!id) throw new Error("Id not found");
        if(!reason) throw new Error("Reason not found to permanently ban user")
            const user=await UserVera.findByIdAndUpdate(id,{"isBanned.status":true,"isBanned.reason":reason},{new:true});
            if(!user) throw new Error("User not found");
            return user;

    },
    blockUserById: async (id, reason) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid user id");
    }
    if (!id) throw new Error("Id not found");
    if (!reason) throw new Error("Reason not found");
    const user = await UserVera.findByIdAndUpdate(
      id,
      { "isBlocked.status": true, "isBlocked.reason": reason },
      { new: true },
    );
    if (!user) throw new Error("User not found");
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
      id,
      { "isBlocked.status": false,"isBlocked.reason":"" },
      { new: true },
    );
    if (!user) throw new Error("User not found");
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
    if (!user) throw new Error("User not found");
    return user;
  },
  suspendUserById: async (id, reason) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid user id");
    }
    if (!id) {
      throw new Error("Id not found");
    }
    if (!reason) {
      throw new Error("Reason not found to suspend user");
    }
    const user = await UserVera.findByIdAndUpdate(
      id,
      { "isSuspended.status": true, "isSuspended.reason": reason },
      { new: true },
    );
    if (!user) throw new Error("User not found are you sure the user exists?");
    return user;
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
  deleteUserByEmail: async (email) => {
  },
  getUserByScore: async (score) => {
    const users = await UserVera.find({ trustScore: { $gte: score } });
    if (!users) throw new Error("No users found with this score");
    return users;
  },
     promoteUserById: async (id) => {
       if (!id) throw new Error("Id not required to do this action");
       const user = await UserVera.findByIdAndUpdate(
         id,
         { role: "admin" },{new:true});
       if (!user) throw new Error("User not found");
       return user;
     },
     demoteUserById: async (id) => {
       if(!id) throw new Error("Id not required to do this action");
       if(!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid user id");
       
       const user=await UserVera.findByIdAndUpdate(id,{role:"Labeler"},{new:true});
       if(!user) throw new Error("User not found");
       return user;
     }, 
     flagDatasetById: async (id, reason) => {
        try{
        if(!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid dataset id");
        if(!id) throw new Error("Id not required to do this action");
        if(!reason) throw new Error("Reason required to do this action");
        const dataset=await Dataset.findByIdAndUpdate(id,{"isFlagged.status":true,"isFlagged.reason":reason});
        if(!dataset) throw new Error("Dataset not found");
        return dataset;
        }catch(err){
            return err.message;
        }

     },
     unflagDatasetById: async (id) => {
        try{
            if(!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid dataset id");
            if(!id) throw new Error("Id not required to do this action");   
            const dataset=await Dataset.findByIdAndUpdate(id,{"isFlagged.status":false,"isFlagged.reason":""});
            return dataset;
            
        }catch(err){
            return err.message;

        }
     },
     deleteDatasetById: async (id) => {
        try{
            if(!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid dataset id");
            if(!id) throw new Error("Id  required to do this action");
            const dataset=await Dataset.findByIdAndDelete(id);
            if(!dataset) throw new Error("Dataset not found");
            return dataset;
        }catch(err){
            return err.message;
        }
     },
     approveDatasetById: async (id) => {
    try{
        if(!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid dataset id");
        if(!id) throw new Error("Id not required to do this action");
        const dataset=await Dataset.findByIdAndUpdate(id,{status:"approved"});
        if(!dataset) throw new Error("Dataset not found");
        return dataset;

       }catch(err){
                return err.message;
            }
     },
     rejectDatasetById: async (id) => {
        try{
            if(!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid dataset id");
            if(!id) throw new Error("Id not required to do this action");
            const dataset=await Dataset.findByIdAndUpdate(id,{status:"rejected"});
            if(!dataset) throw new Error("Dataset not found");
            return dataset;
        }catch(err){
            return err.message;
        }
     },




}