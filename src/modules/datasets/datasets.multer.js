import multer from "multer";
import multerS3 from "multer-s3";
import s3 from "../../config/s3.js"; // the S3 instance above
import path from "path";

// upload middleware

export const Upload = () => {
  if (!process.env.AWS_BUCKET_NAME) {
    console.warn("AWS_BUCKET_NAME not set, using memory storage");
    return multer({ storage: multer.memoryStorage() });
  }
  return multer({
    storage: multerS3({
      s3,
      bucket: process.env.AWS_BUCKET_NAME,
      acl: "private", // IMPORTANT for datasets
      key: function (req, file, cb) {
        const datasetId = req.datasetId || "temp";
        const version = req.datasetVersion || "1"; // set earlier
        const ext = path.extname(file.originalname);

        const key = `datasets/${datasetId}/v${version}/${Date.now()}${ext}`;
        cb(null, key);
      }
    }),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
  });
};

  export const newFile=()=>
    multer({
        storage:multerS3({
            s3,
            bucket:process.env.AWS_BUCKET_NAME,
            acl:"private",
            

        })
    })