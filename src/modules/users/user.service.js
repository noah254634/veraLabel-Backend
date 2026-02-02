import UserVera from "./user.model.js";
import bcrypt from "bcrypt";

export const createUser = async ({ email, name, password }) => {
  const userExists = await UserVera.findOne({ email });
  if (userExists) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new UserVera({
    email,
    name,
    password: hashedPassword,
  });

  await user.save();
  return user;
};
export const loginUser = async ({ email, password }) => {
  const user = await UserVera.findOne({ email });
  if (!user) throw new Error("User not found");
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error("Invalid password");
  return user;
};

export const getUser = async (email) => {
  const user = await UserVera.findOne({ email });
  if(!user) throw new Error("User not found");
  return user;
};
export const updateUser = async (id, data) => {
  const user = await UserVera.findByIdAndUpdate(id, data, { new: true });
  return user;
};
export const deleteUser = async (id) => {
  const user = await UserVera.findByIdAndDelete(id);
  return user;
};
export const getUserById = async (id) => {
  const user = await UserVera.findById(id);
  return user;
};
export const getAllUsers = async () => {
  const users = await UserVera.find();
  return users;
};

