import express from "express";
import router from "./routes.js";
import { randomUUID } from "crypto";
import pinoHttp from "pino-http";
import {ENV, isLocalNetworkOrigin} from "./config/env.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import logger from "./config/logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.middleware.js";
import { geoMiddleware } from "./middlewares/geo.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app=express();
const env = ENV();
console.log("[DEBUG] NODE_ENV:", env.NODE_ENV);

// Using pino-http for request logging instead of morgan
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers["x-request-id"] || randomUUID(), // check header or generate new
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
const origins=ENV().allowedOrigins;
const isDevelopment = ENV().NODE_ENV === "development";

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check against explicitly configured origins
    if (origins.includes(origin)) {
      return callback(null, true);
    }
    
    // In development, allow all local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (isDevelopment && isLocalNetworkOrigin(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Geolocation check - verifies user is in allowed countries (East Africa)
app.use(geoMiddleware);

//app.use(arcjetProtectRoute);
app.use("/api/v1",router)

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Error handling middleware (must be LAST)
app.use(errorHandler);

export default app;
