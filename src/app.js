import express from "express";
import cors from "cors";
import router from "./routes.js";
import morgan from "morgan";
import {protectRoute} from "./middlewares/auth.middleware.js";
import { arcjetProtectRoute } from "./middlewares/arcjet.middleware.js";
import cookieParser from "cookie-parser";
const app=express();
app.use(morgan("dev"));
app.use(express.json());

app.use(cors());
app.use(cookieParser());
/*app.use(arcjetProtectRoute);*/
app.use("/api/v1",router)
export default app;