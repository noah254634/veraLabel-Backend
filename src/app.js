import express from "express";
import router from "./routes.js";
import {ENV, isLocalNetworkOrigin, isPagesDevOrigin, isTryCloudflareOrigin} from "./config/env.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.middleware.js";
import { geoMiddleware } from "./middlewares/geo.middleware.js";
import { arcjetProtectRoute } from "./middlewares/arcjet.middleware.js";
import morgan from "morgan";

import "./config/firebase.admin.js";
const app=express();
app.set("trust proxy", true);
app.use(morgan("dev"));

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
const configuredOrigins = ENV().allowedOrigins;
const fixedOrigins = [
  "https://veralabel-frontend.pages.dev",
  "https://a1ddb741.veralabel-frontend.pages.dev",
  "https://insightful-marica-unsenescent.ngrok-free.dev",
];
const origins = [...new Set([...configuredOrigins, ...fixedOrigins])];
const isDevelopment = ENV().NODE_ENV === "development";

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return false;
  }

  return (
    origins.includes(origin) ||
    (isDevelopment && isLocalNetworkOrigin(origin)) ||
    isPagesDevOrigin(origin) ||
    isTryCloudflareOrigin(origin)
  );
};

const corsOptions = {
  origin: (origin, callback) => {
    
    if (!origin) {
      return callback(null, true);
    }
    
    
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    
    
    if (isDevelopment && isLocalNetworkOrigin(origin)) {
      return callback(null, true);
    }

    if (isPagesDevOrigin(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "x-paystack-signature", "ngrok-skip-browser-warning"],
  optionsSuccessStatus: 204,
};

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Vary", "Origin");
  }

  next();
});

app.options(/.*/, (req, res, next) => {
  const origin = req.headers.origin;
  const requestHeaders = req.headers["access-control-request-headers"];

  if (!origin) {
    return res.sendStatus(204);
  }

  if (isAllowedOrigin(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", requestHeaders || "Content-Type, Authorization, Cache-Control, x-paystack-signature, ngrok-skip-browser-warning");
    return res.sendStatus(204);
  }

  return next(new Error("Not allowed by CORS"));
});

app.use(cors(corsOptions));


app.use(geoMiddleware);

app.use(arcjetProtectRoute);
app.use("/api/v1",router)


app.use(notFoundHandler);


app.use(errorHandler);

export default app;
