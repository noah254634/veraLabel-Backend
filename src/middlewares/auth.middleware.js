import jwt from "jsonwebtoken";
import UserVera from "../modules/users/user.model.js";
import {ENV} from "../config/env.js";
export const protectRoute=async(req,res,next)=>{
    const token=req.cookies.accessToken;
    if(!token) return res.status(401).json({error:"Unauthorized"});
    const decoded=jwt.verify(token,ENV().jwt_secret);
    if(!decoded) 
        return res.status(401).json({error:"Unauthorized"});
    const findUser=await UserVera.findById(decoded.id);
    if(!findUser) 
        return res.status(401).json({error:"Unauthorized"});
    req.user=findUser;
    next();

}