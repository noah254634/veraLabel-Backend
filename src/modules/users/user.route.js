import express from "express";
import { geoMiddleware } from "../../middlewares/geo.middleware.js";
import {protectRoute} from "../../middlewares/auth.middleware.js";
import { UserController} from "./user.controller.js";
import { checkisBlocked } from "../../middlewares/block.middleware.js";
import authorize from "../../middlewares/authorization.middleware.js";
//routes for the users module
const router=express.Router();
router.use(protectRoute);
//router.use(geoMiddleware);
router.get("/",UserController.getAllUsers);
router.get("/usersByStatus",UserController.getUsersByStatus);
router.get("/usersByTrustScore",UserController.getUsersByTrustScore);
router.get("/usersByCity",UserController.getUsersByCity);
router.get("/usersbyScore",UserController.getUsersByTrustScore);
router.get("/getUserById/:id",UserController.getUserById);

export default router;



export const userRouter= router;