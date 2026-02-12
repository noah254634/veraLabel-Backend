import mongoose from "mongoose";
import { ENV } from "./env.js";
import logger from "./logger.js";
const connectDB = async () => {
  try {
      const conn = await mongoose.connect(ENV().mongo_uri);
      logger.info(`Connected to mongoDB on ${conn.connection.host}`);
   
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
};

export default connectDB;
