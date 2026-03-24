import dotenv from "dotenv";
import path from "path";

// Ensure we target the .env file specifically inside the src folder
const envPath = path.resolve(process.cwd(), "src", ".env");
dotenv.config({ path: envPath });

const buildEnv = (processEnv = process.env, options = {}) => {
    const { debug = false } = options;
    
    // Check both plural and singular versions
    const allowedOriginsStr = processEnv.ALLOWED_ORIGINS || processEnv.ALLOWED_ORIGIN;

    if (!allowedOriginsStr) {
        console.error("\n--- ENV DEBUG INFO ---");
        console.error(`[env] Looking for .env at: ${envPath}`);
        console.error(`[env] Current Keys: ${Object.keys(processEnv).slice(0, 5).join(", ")}...`);
        console.error("----------------------\n");
        
        throw new Error("CRITICAL: Missing required environment variable ALLOWED_ORIGINS in src/.env");
    }

    return {
        mongo_uri: processEnv.MONGO_URI,
        arcjet_api_key: processEnv.ARCJET_API_KEY,
        arcjet_api_secret: processEnv.ARCJET_API_SECRET,
        PORT: processEnv.PORT || 5000,
        NODE_ENV: processEnv.NODE_ENV || "development",
        jwt_secret: processEnv.JWT_SECRET,
        jwt_refresh_secret: processEnv.JWT_REFRESH_SECRET,
        flutterwave_key: processEnv.FLUTTERWAVE_KEY,
        flutterwave_secret: processEnv.FLUTTERWAVE_SECRET,
        resend_api_key: processEnv.RESEND_API_KEY,
        email_user: processEnv.EMAIL_USER,
        paystack_public_key: processEnv.PAYSTACK_PUBLIC_KEY,
        paystack_secret_key: processEnv.PAYSTACK_SECRET_KEY,
        payment_currency: processEnv.PAYMENT_CURRENCY,
        server_url: processEnv.SERVER_URL || "http://localhost:5000",
        handshake_url: processEnv.HANDSHAKE_URL,
        Internal_Secret: processEnv.INTERNAL_SECRET,
        allowedOrigins: allowedOriginsStr.split(",").map(origin => origin.trim()),
    };
};

export const ENV = (options = {}) => {
    const { processEnv = process.env, debug = false } = options;
    if (debug) {
        dotenv.config({ path: envPath, debug: true });
    }
    return buildEnv(processEnv, { debug });
};