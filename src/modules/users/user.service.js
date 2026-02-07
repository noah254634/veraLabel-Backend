import mongoose from "mongoose";
import UserVera from "./user.model.js";
export const UserService = {

  getUserById: async (id) => {
    const user = await UserVera.findById(id);
    if (!user) throw new Error("User not found");
    return user;
  },
  getUserByEmail: async ({ email }) => {
    const user = await UserVera.findOne({ email });
    if (!user) throw new Error("User not found");
    return user;
  },
  getAllUsers: async () => {
    const users = await UserVera.find();
    return users;
  },
  updateUser: async (id, data) => {
    const user = await UserVera.findByIdAndUpdate(id, data, { new: true });
    if (!user) throw new Error("User not found");
    return user;
  },
  getUserByCity: async (city) => {
    if (!city) throw new Error("City not found");
    const users = await UserVera.find({ "userLocation.city": city });
    return users;
  },
  getUserByRole: async (role) => {
    if (!role) throw new Error("Role not found");
    const users = await UserVera.find({ role });
    return users;
  },
  getUserByStatus: async (status) => {
    if (!status) throw new Error("Status not found");
    const users = await UserVera.find({ status });
    return users;
  },
  
};
