import express from "express";
import cors from "cors";
import {ENV} from "./config/env.js";
import connectDB from "./config/connectingDB.js";
import app from "./app.js";
import mongoose, { set } from "mongoose";
import logger from "./config/logger.js";


const port=ENV().PORT||3000;
app.use(cors());
const server=app.listen(port,()=>{
    logger.info(`server running on http://localhost:${port}`);
    connectDB();

});
//ERROR HANDLING AND CLOSING OF SERVER
const shutdown=async(signal)=>{
    try{
    logger.info(`Received ${signal} and shutting down gracefully`);
    server.close(async()=>{
        await mongoose.connection.close()
        process.exit(0)
    })
    }
    catch(err){
    logger.error("Shutdown error",err.message);
    process.exit(1)
    }
    setTimeout(()=>{
        logger.info("Forcefully shutting down server due to timeout");
        process.exit(1)
    },10000)
}
process.on("SIGTERM",shutdown);
process.on("SIGINT",shutdown);
process.on("unhandledRejection  ",async(err)=>{
    logger.info(err.name,err.message);
    await shutdown("unhandledRejection");
})  