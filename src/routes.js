import express from "express";
import authorize from "./middlewares/authorization.middleware.js";
import { paymentRouter } from "./modules/payments/routes/payment.route.js";
import { authRouter } from "./modules/auth/auth.route.js";
import { userRouter } from "./modules/users/user.route.js";
import { checkisBlocked } from "./middlewares/block.middleware.js";
import { protectRoute } from "./middlewares/auth.middleware.js";
import adminRouter from "./modules/admin/admin.route.js";
const router=express.Router();
router.post("/datasets",protectRoute,checkisBlocked,(req,res)=>{
    return res.status(200).json({message:"you just hit this route"})
});
router.use("/auth",authRouter);
router.use("/payments",paymentRouter)
router.use("/users",userRouter);
router.use("/admin",authorize("admin"),adminRouter);
export default router;