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
    flutterwave_key: process.env.FLUTTERWAVE_KEY,
    flutterwave_secret: process.env.FLUTTERWAVE_SECRET,
    resend_api_key: process.env.RESEND_API_KEY,
    email_user: process.env.EMAIL_USER,
    paystack_public_key: process.env.PAYSTACK_PUBLIC_KEY,
    paystack_secret_key: process.env.PAYSTACK_SECRET_KEY,
    payment_currency: process.env.PAYMENT_CURRENCY,
    server_url: process.env.SERVER_URL || "http://localhost:5000",

  
};

export const ENV = () => env;