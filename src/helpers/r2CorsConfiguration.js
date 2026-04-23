const ensureCorsConfigured = async () => {
  try {
    const command = new PutBucketCorsCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ["*"],
            AllowedMethods: ["PUT", "POST", "GET", "HEAD"],
            AllowedOrigins: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    });
    await r2.send(command);
  } catch (error) {
    if (error.name === 'NoSuchBucket' || error.message?.includes('The specified bucket does not exist')) {
      console.info(`Bucket '${process.env.R2_BUCKET_NAME}' not found. Attempting to create it...`);
      try {
        await r2.send(new CreateBucketCommand({ Bucket: process.env.R2_BUCKET_NAME }));
        console.info(`Bucket '${process.env.R2_BUCKET_NAME}' created successfully.`);
        await ensureCorsConfigured(); 
      } catch (createError) {
        console.error("Failed to create R2 bucket:", createError.message);
      }
    } else {
      console.warn("Warning: Failed to configure R2 CORS:", error.message);
    }
  }
};
export default ensureCorsConfigured;