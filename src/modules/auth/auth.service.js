import UserVera from "../users/user.model.js";
import bcrypt from "bcrypt";
export const createUser=async({email,name,password})=>{
    if(!email || !name || !password) throw new Error("All fields are required");
    const existingUser=await UserVera.findOne({email});
    if(existingUser) throw new Error("User already exists");
    const hashedPassword=await bcrypt.hash(password,10);
    const user=new UserVera({email,name,password:hashedPassword});
    await user.save();
    return user;

}
export const loginUser=async({email,password})=>{
    if(!email || !password) throw new Error("All fields are required");
    const user=await UserVera.findOne({email});
    if(!user) throw new Error("User not found");
    const isMatch=await bcrypt.compare(password,user.password);
    if(!isMatch) throw new Error("Invalid password");
    return user;
}