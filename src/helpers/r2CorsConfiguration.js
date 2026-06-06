import { PutBucketCorsCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { r2 } from "../config/r2Upload.js";

import logger from "../config/logger.js";

const ensureCorsConfigured = async () => {
  try {
    // Environment-based CORS configuration
    const isDev = process.env.NODE_ENV !== 'production';
    
    const envOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
    const devOrigins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5174"];
    const allowedOrigins = Array.from(new Set([...devOrigins, ...envOrigins]));
    
    const maxAge = isDev ? 3000 : 86400; // 24 hours in production
    
    const command = new PutBucketCorsCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ["*"],
            AllowedMethods: ["PUT", "POST", "GET", "HEAD"],
            AllowedOrigins: allowedOrigins,
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: maxAge,
          },
        ],
      },
    });
    await r2.send(command);
    logger.info("R2 CORS configured successfully", { bucket: process.env.R2_BUCKET_NAME, isDev, allowedOrigins });
  } catch (error) {
    if (error.name === 'NoSuchBucket' || error.message?.includes('The specified bucket does not exist')) {
      logger.info(`R2 Bucket not found. Creating: ${process.env.R2_BUCKET_NAME}`);
      try {
        await r2.send(new CreateBucketCommand({ Bucket: process.env.R2_BUCKET_NAME }));
        logger.info(`R2 Bucket created: ${process.env.R2_BUCKET_NAME}`);
        await ensureCorsConfigured(); 
      } catch (createError) {
        logger.error("Failed to create R2 bucket", { bucket: process.env.R2_BUCKET_NAME, error: createError instanceof Error ? createError.message : String(createError) });
      }
    } else {
      logger.warn("Failed to configure R2 CORS", { bucket: process.env.R2_BUCKET_NAME, error: error instanceof Error ? error.message : String(error) });
    }
  }
};
export default ensureCorsConfigured;