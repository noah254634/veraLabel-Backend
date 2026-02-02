import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), 'src', '.env') });

const env = {
    mongo_uri: process.env.MONGO_URI,
    arcjet_api_key: process.env.ARCJET_API_KEY,
    arcjet_api_secret: process.env.ARCJET_API_SECRET,
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    jwt_secret: process.env.JWT_SECRET,
    jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,
    
  
};

export const ENV = () => env;