import express from "express";
import { buyerController } from "./buyer.controller.js";
import { protectRoute } from "../../middlewares/auth.middleware.js";
import { checkisBlocked } from "../../middlewares/block.middleware.js";
import { attachBuyer, requireVerifiedBuyer } from "./buyer.middleware.js";

const router = express.Router();

// Apply auth protection & buyer profile attachment to all endpoints
router.use(protectRoute);
router.use(checkisBlocked);
router.use(attachBuyer);

// Unverified/Pending buyer accessible endpoints
router.get("/me", buyerController.getBuyerProfile);
router.post("/onboarding", buyerController.submitOnboarding);
router.get("/getAllBuyers", buyerController.getAllBuyers);

// Restrict following endpoints to approved buyers only
router.use(requireVerifiedBuyer);

router.get("/orders", buyerController.getOrders);
router.get("/datasetOrders", buyerController.getBuyerRequests);
router.post("/createOrder", buyerController.createOrder);
router.put("/cancelPayment/:orderId", buyerController.cancelPayment);
router.post("/reportIssue/:orderId", buyerController.reportIssue);

export default router;
