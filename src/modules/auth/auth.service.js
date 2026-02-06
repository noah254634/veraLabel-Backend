import UserVera from "../users/user.model.js";
import bcrypt from "bcrypt";
import {ENV} from "../../config/env.js";
import jwt from "jsonwebtoken";
import { setAuthCookies } from "./auth.cookie.js";
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
export const sendAccessToken=async(req,res)=>{
    try{
    const refreshToken=req.cookies.refreshToken;
    if(!refreshToken) throw new Error("Refresh token not found consider logging in again");
    const decoded=jwt.verify(refreshToken,ENV().jwt_refresh_secret);
    const user=await UserVera.findById(decoded.id);
    if(!user) throw new Error("User not found");


    const accessToken=jwt.sign({id:user._id,role:user.role},ENV().jwt_secret,{expiresIn:"10m"});
    setAuthCookies(res,accessToken,refreshToken);
    return accessToken;
    }catch(err){
        console.log("An error occurred in sending refreshToken in service",err.message)
        return res.status(401).json({error:err.message})
    }



}