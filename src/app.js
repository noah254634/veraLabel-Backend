import express from "express";
import router from "./routes.js";
import morgan from "morgan";
import {ENV} from "./config/env.js";
import cookieParser from "cookie-parser";
import cors from "cors";
const app=express();
if (ENV().NODE_ENV !== "production") {
  app.use(morgan("dev"));
}
app.use(express.json({ limit: "1mb" }));
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
