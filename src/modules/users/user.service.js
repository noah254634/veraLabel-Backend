import mongoose from "mongoose";
import UserVera from "./user.model.js";
export const UserService={
    getUserById:async(id)=>{
        const user=await UserVera.findById(id);
        if(!user) throw new Error("User not found");
        return user;
    },
    getUserByEmail:async({email})=>{
        const user=await UserVera.findOne({email})
        if(!user) throw new Error("User not found");
        return user;
    },
    getAllUsers:async()=>{
        const users=await UserVera.find();
        return users;
    },
    updateUser:async(id,data)=>{
        const user=await UserVera.findByIdAndUpdate(id,data,{new:true});
        if(!user) throw new Error("User not found");
        return user;
    },
    getUserByCity:async(city)=>{
       if(!city) throw new Error("City not found");
       const users=await UserVera.find({"userLocation.city":{city}});
       return users;
    },
    getUserByRole:async(role)=>{
        if(!role) throw new Error("Role not found");
        const users=await UserVera.find({role});
        return users;
    },
    getUserByStatus:async(status)=>{
        if(!status) throw new Error("Status not found");
        const users=await UserVera.find({status});
        return users;
    },
    blockUserById:async(id,reason)=>{
      if (!mongoose.Types.ObjectId.isValid(id)) {
  throw new Error('Invalid user id');
}
      if(!id) throw new Error("Id not found");
      if(!reason) throw new Error("Reason not found");
      const user=await UserVera.findByIdAndUpdate(id,{"isBlocked.status":true,"isBlocked.reason":reason},{new:true});
      if(!user) throw new Error("User not found");
      return user;
    },
    blockUserByEmail:async(email)=>{
      if(!email) throw new Error("Email not found");
      const user=await UserVera.findOneAndUpdate({email},{isBlocked:true},{new:true});
      if(!user) throw new Error("User not found");
      return user
    },
    unblockUserById:async(id)=>{
      if(!id) throw new Error("Id not found");
      const user=await UserVera.findByIdAndUpdate(id,{isBlocked:false},{new:true});
      if(!user) throw new Error("User not found");
      return user;
    },
    unblockUserByEmail:async(email)=>{
      if(!email) throw new Error("Email not placed,add Email to perform this action");
      const user=await UserVera.findOneAndUpdate({email},{isBlocked:false},{new:true});
      if(!user) throw new Error("User not found");
      return user;
    },
    suspendUserById:async(id,reason)=>{
      if(!id){
        throw new Error("Id not found");
      }
      if(!reason){
        throw new Error("Reason not found to suspend user");
      }
      const user=await findByIdAndUpdate({id},{"isSuspended.status":true,"isSuspended.reason":reason},{new:true})
      if(!user) throw new Error("User not found are you sure the user exists?");
      return user;
    
    },
    unsuspendUserById:async(id)=>{
      if(!id) throw new Error("Id not found,seems user you are trying to unsuspend is not in database");
      const user=await UserVera.findByIdAndUpdate(id,{"isSuspended.status":false,"isSuspended.reason":""});
      if(!user) throw new Error("User not found are you sure the user exists?");
      return user;
    
    },
    getUserByScore:async(score)=>{
      const users=await UserVera.find({trustScore:{$gte:score}});
      if(!users) throw new Error("No users found with this score");
      return users;
    
    }
        

}