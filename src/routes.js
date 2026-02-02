import express from "express";
import {userRouter} from "./modules/users/user.route.js";


const router=express.Router();
router.use("/users",userRouter)
router.use("/datasets",()=>{
    console.log("datasets");
});
export default router;