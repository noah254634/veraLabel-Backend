import express from "express";
import cors from "cors";
import router from "./routes.js";
import morgan from "morgan";
import {protectRoute} from "./middlewares/auth.middleware.js";
import { arcjetProtectRoute } from "./middlewares/arcjet.middleware.js";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import logger from "./config/logger.js";
import { v4 as uuidv4 } from "uuid"; // for generating unique request IDs
const app=express();
app.use(morgan("dev"));
app.use(express.json());

app.use(cors());
app.use(cookieParser());
/*app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers["x-request-id"] || uuidv4(), // check header or generate new
  })
);*/
//app.use(arcjetProtectRoute);
app.use("/api/v1",router)
export default app;