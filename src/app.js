import express from "express";
import router from "./routes.js";
import morgan from "morgan";
import {ENV} from "./config/env.js";
import {protectRoute} from "./middlewares/auth.middleware.js";
import { arcjetProtectRoute } from "./middlewares/arcjet.middleware.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import pinoHttp from "pino-http";
import logger from "./config/logger.js";
import { v4 as uuidv4 } from "uuid"; // for generating unique request IDs
const app=express();
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
const origins=ENV().allowedOrigins;

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || origins.includes(origin)) {
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
/*app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers["x-request-id"] || uuidv4(), // check header or generate new
  })
);*/
//app.use(arcjetProtectRoute);
app.use("/api/v1",router)
export default app;
