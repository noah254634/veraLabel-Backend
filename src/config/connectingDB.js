import mongoose from "mongoose";
import { ENV } from "./env.js";
const connectDB = async () => {
  try {
      const conn = await mongoose.connect(ENV().mongo_uri);
      console.log(`Connected to mongoDB on ${conn.connection.host}`);
   
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

export default connectDB;
