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
router.get("/", protectRoute,UserController.getAllUsers);
router.post("/suspendUser/:id",protectRoute,authorize,UserController.suspendUser);
router.post("/blockUser/:id",UserController.blockUser);
router.post("/unblockUser/:id",UserController.unblockUserById);
router.post("/unsuspendUser/:id",UserController.unsuspendUser);
router.get("/usersByRole",UserController.getUsersByRole);
router.get("/usersByStatus",UserController.getUsersByStatus);
router.get("/usersByTrustScore",UserController.getUsersByTrustScore);
router.get("/usersByCity",UserController.getUsersByCity);
router.get("/usersbyScore",UserController.getUsersByTrustScore);
router.get("/getUserById/:id",UserController.getUserById);
router.put("/updateUser/:id",UserController.updateUser);
router.delete("/deleteUser/:id",UserController.deleteUser);


export const userRouter= router;