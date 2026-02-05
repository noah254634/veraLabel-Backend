import express from "express";
import cors from "cors";
import {ENV} from "./config/env.js";
import connectDB from "./config/connectingDB.js";
import app from "./app.js";
import mongoose, { set } from "mongoose";


const port=ENV().PORT||3000;
app.use(cors());
const server=app.listen(port,()=>{
    console.log(`server running on http://localhost:${port}`);
    connectDB();

});
//ERROR HANDLING AND CLOSING OF SERVER
const shutdown=async(signal)=>{
    try{
    console.log(`Received ${signal} and shutting down gracefully`);
    server.close(async()=>{
        await mongoose.connection.close()
        process.exit(0)
    })
    }
    catch(err){
    console.log("Shutdown error",err.message);
    process.exit(1)
    }
    setTimeout(()=>{
        console.log("Forcefully shutting down server due to timeout");
        process.exit(1)
    },10000)
}
process.on("SIGTERM",shutdown);
process.on("SIGINT",shutdown);
process.on("unhandledRejection  ",async(err)=>{
    console.log(err.name,err.message);
    await shutdown("unhandledRejection");
})  