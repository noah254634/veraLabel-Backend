import multer from "multer";
import multerS3 from "multer-s3";
import s3 from "../../config/s3.js"; // the S3 instance above
import path from "path";

// upload middleware
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket:s3.aws_bucket_name,
        acl: "public-read", // or private
        key: function (req, file, cb) {
            const ext = path.extname(file.originalname);
            cb(null, `datasets/${Date.now()}${ext}`);
        }
    })
});

export default upload;
