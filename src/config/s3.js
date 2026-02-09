import AWS from "aws-sdk";
import dotenv from "dotenv";
dotenv.config();

// Configure AWS SDK

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    aws_bucket_name: process.env.AWS_BUCKET_NAME,
});

export default s3;
