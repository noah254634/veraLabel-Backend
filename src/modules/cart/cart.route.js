import express from "express";
import {cartController} from "./cart.controller.js"
const router=express.Router();
//used the routes inside marketplace so i dont put routes everywhere that are related
router.post("/createCart",cartController.addToCart)
router.delete("/clearCart",cartController.clearCart)
router.get("/getCart",cartController.getCart)
router.post("/checkout",cartController.checkout)
router.put("/updateCart",cartController.updateCart)
export default router;