import mongoose from "mongoose";
import { ENV } from "./env.js";
import logger from "./logger.js";
import GeoAccessLog from "../modules/admin/models/geoAccessLog.model.js";
import GeoRequestAudit from "../modules/admin/models/geoRequestAudit.model.js";

const connectDB = async () => {
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const mongo_uri = ENV().mongo_uri;
      if (!mongo_uri) {
        throw new Error("MONGO_URI not found in environment variables");
      }

      const conn = await mongoose.connect(mongo_uri, {
        serverSelectionTimeoutMS: 30000, // Increased to 30s for unstable networks
        socketTimeoutMS: 45000,
        maxPoolSize: 200,
        minPoolSize: 20,
        retryWrites: true,
        w: "majority",
        family: 4,                       // Use IPv4
        ssl: true,
        authSource: "admin"
      });
      
      logger.info(`Connected to mongoDB on ${conn.connection.host}`);
      
      // Explicitly sync indexes to ensure TTL indexes are built properly
      try {
        await GeoAccessLog.syncIndexes();
        await GeoRequestAudit.syncIndexes();
        logger.info("Successfully synchronized database indexes");
      } catch (idxErr) {
        logger.error(`Database index synchronization failed: ${idxErr.message}`);
      }
      
      return;
     
    } catch (err) {
      retries++;
      logger.error({
        attempt: `${retries}/${maxRetries}`,
        message: err.message,
        code: err.code,
        reason: err.reason,
        errmsg: err.errmsg,
        mongoError: err.name,
        fullError: err
      }, `MongoDB Connection Error (Attempt ${retries}/${maxRetries})`);
      
      if (retries < maxRetries) {
        logger.info(`Retrying in 3 seconds... (Attempt ${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        logger.error("Failed to connect to MongoDB after maximum retries");
        throw err;
      }
    }
  }
};

export default connectDB;
