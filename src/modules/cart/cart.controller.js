import logger from "../../config/logger.js";
import { cartService } from "./cart.service.js";

export const cartController = {
  getCart: async (req, res) => {
    try {
      logger.info("Getting cart");
      const { buyerId } = req.params;
      const cart = await cartService.getCart(buyerId);
      res.status(200).json(cart);
    } catch (err) {
      logger.info(`An. error occurred inside getCart: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  },
  addToCart: async (req, res) => {
    try {
      logger.info("adding cart");
      const { buyerId } = req.params;
      const { datasetId, quantity } = req.body;
      const cart = await cartService.addToCart(buyerId, datasetId, quantity);
      logger.info("Added to cart");
      return res.status(200).json({ cart });
    } catch (err) {
      logger.info(`An error occurred inside addToCart: ${err.message}`);
      return res.status(404).json({ error: err.message });
    }
  },
  updateCart: async (req, res) => {
    try {
        const { buyerId } = req.params;
      const { productId, quantity } = req.body;
      const cart = await cartService.updateCart(buyerId, productId, quantity);
      return res.status(200).json({ cart });
    } catch (err) {
        return res.status(404).json({ error: err.message });
    }
  },
  clearCart: async (req, res) => {
    try {
        const {buyerId} = req.params;
        const {productId} = req.body;
        const cart = await cartService.removeFromCart(buyerId, productId);
        return res.status(200).json({ message:"cart cleared successfully" });
    } catch (err) {
        return res.status(404).json({ error: err.message });
    }
  },
  checkout: async (req, res) => {
    try {
        const {buyerId} = req.params;
        const cart = await cartService.checkout(buyerId);
        return res.status(200).json({ cart });
    }catch(err){
        return res.status(404).json({ error: err.message });
    }
  },
};

export default cartController;
