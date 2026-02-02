import express from "express";
import cors from "cors";
import {ENV} from "./config/env.js";
import connectDB from "./config/connectingDB.js";
import app from "./app.js";


const port=ENV().PORT||3000;
app.use(cors());
app.listen(port,()=>{
    console.log(`server running on http://localhost:${port}`);
    connectDB();

})