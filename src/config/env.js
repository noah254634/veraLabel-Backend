import dotenv from "dotenv";
import path from "path";


const envPath = path.resolve(process.cwd(), "src", ".env");
dotenv.config({ path: envPath });


export const isLocalNetworkOrigin = (origin) => {
    if (!origin) return false;
    
    try {
        const url = new URL(origin);
        const hostname = url.hostname;
        

        const localNetworkRegex = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;
        return localNetworkRegex.test(hostname);
    } catch {
        return false;
    }
};

export const isPagesDevOrigin = (origin) => {
    if (!origin) return false;

    try {
        const url = new URL(origin);
        // Only allow the specific veralabel-frontend project — NOT all *.pages.dev
        // Any Cloudflare Pages deployment by anyone else would otherwise be a valid CORS origin.
        return (
            url.protocol === "https:" &&
            (
                url.hostname === "veralabel-frontend.pages.dev" ||
                url.hostname.endsWith(".veralabel-frontend.pages.dev")
            )
        );
    } catch {
        return false;
    }
};

export const isTryCloudflareOrigin = (origin) => {
    if (!origin) return false;

    try {
        const url = new URL(origin);
        return url.protocol === "https:" && url.hostname.endsWith(".trycloudflare.com");
    } catch {
        return false;
    }
};

const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, "");

const parseBoolean = (value, defaultValue = false) => {
    if (value == null || value === "") {
        return defaultValue;
    }

    return ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
};

const buildEnv = (processEnv = process.env, options = {}) => {
    const { debug = false } = options;
    

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
        emails_enabled: parseBoolean(processEnv.EMAILS_ENABLED, true),
        email_user: processEnv.EMAIL_USER,
        paystack_public_key: processEnv.PAYSTACK_PUBLIC_KEY,
        paystack_secret_key: processEnv.PAYSTACK_SECRET_KEY,
        payment_currency: processEnv.PAYMENT_CURRENCY,
        server_url: processEnv.SERVER_URL || "http://localhost:5000",
        handshake_url: processEnv.HANDSHAKE_URL,
        Internal_Secret: processEnv.INTERNAL_SECRET,
        allowedOrigins: allowedOriginsStr
            .split(",")
            .map(normalizeOrigin)
            .filter(Boolean),

        firebase_service_account_key: processEnv.FIREBASE_SERVICE_ACCOUNT_KEY,
        firebase_vapid_key: processEnv.FIREBASE_VAPID_KEY,
        frontend_url: processEnv.FRONTEND_URL || "http://localhost:5173",
    };
};

export const ENV = (options = {}) => {
    const { processEnv = process.env, debug = false } = options;
    if (debug) {
        dotenv.config({ path: envPath, debug: true });
    }
    return buildEnv(processEnv, { debug });
};