import express from "express";
import router from "./routes.js";
import {ENV, isLocalNetworkOrigin} from "./config/env.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.middleware.js";
import { geoMiddleware } from "./middlewares/geo.middleware.js";
import morgan from "morgan";

import "./config/firebase.admin.js";
const app=express();
app.use(morgan("dev"));

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
const origins=ENV().allowedOrigins;
const isDevelopment = ENV().NODE_ENV === "development";

const corsOptions = {
  origin: (origin, callback) => {
    
    if (!origin) {
      return callback(null, true);
    }
    
    
    if (origins.includes(origin)) {
      return callback(null, true);
    }
    
    
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


app.use(geoMiddleware);

//app.use(arcjetProtectRoute);
app.use("/api/v1",router)


app.use(notFoundHandler);


app.use(errorHandler);

export default app;
