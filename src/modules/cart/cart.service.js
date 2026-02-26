import UserVera from "../users/user.model.js";
import Cart from "./cart.model.js";
import Dataset from "../datasets/dataset.model.js";
import { marketplaceService } from "../marketplace/marketplace.service.js";

export const cartService = {
  getCart: async (buyerId) => {
    if (!buyerId) throw new Error("Buyer Id is required ");
    const buyerExists = await UserVera.findById(buyerId);
    if (!buyerExists) throw new Error("Buyer does not exist");
    const cart = await Cart.findOne({ buyerId });
    if (!cart) throw new Error("Cart does not exist");
    return cart;
  },
  addToCart: async (buyerId, datasetId, quantity) => {
    if (!quantity) throw new Error("Quantity is required ");
    if (!datasetId) throw new Error("Dataset Id is required ");
    if (!buyerId) throw new Error("Buyer Id is required ");
    const buyerExists = await UserVera.findById(buyerId);
    if (!buyerExists) throw new Error("Buyer does not exist");
    const cart = await Cart.findOne({ buyerId });
    if (!cart) throw new Error("Cart does not exist");
    const dataset = await Dataset.findById(datasetId);
    if (!dataset) throw new Error("Dataset does not exist");
    const cartItem = {
      datasetId,
      titleSnapshot: dataset.title,
      priceSnapshot: dataset.price,
      quantity,
      licenseType: dataset.licenseType,
    };
    cart.items.push(cartItem);
    cart.totalAmount += dataset.price * quantity;
    await cart.save();
    return cart;
  },
  removeFromCart: async (buyerId, datasetId) => {
    if (!datasetId) throw new Error("Dataset Id is required ");
    if (!buyerId) throw new Error("Buyer Id is required ");
    const buyerCart = await Cart.findOne({ buyerId });
    if (!buyerCart) throw new Error("Cart does not exist");
    const datasetExists = await Dataset.findById(datasetId);
    if (!datasetExists) throw new Error("Dataset does not exist");
    const datasetInCart = buyerCart.items.find(
      (item) => item.datasetId.toString() === datasetId,
    );
    if (!datasetInCart) throw new Error("Dataset does not exist in cart");
    const index = buyerCart.items.indexOf(datasetInCart);
    buyerCart.items.splice(index, 1);
    buyerCart.totalAmount -=
      datasetInCart.priceSnapshot * datasetInCart.quantity;
    await buyerCart.save();
    return buyerCart;
  },
  updateCart: async (buyerId, productId, quantity) => {
    if (!buyerId || !productId || !quantity)
      throw new Error("All fields are required");
    const buyerCart = await Cart.findOne({ buyerId });
    if (!buyerCart) throw new Error("Cart does not exist");
    const dataset = await Dataset.findById(productId);
    if (!dataset) throw new Error("Dataset does not exist");
    if (dataset.isPrivate) {
      throw new Error("Dataset already bought");
    }
    const datasetInCart = buyerCart.items.find(
      (item) => item.datasetId.toString() === productId,
    );
    if (datasetInCart) {
      throw new Error("Dataset already in cart");
    }
    const cartItem = {
      datasetId: dataset._id,
      titleSnapshot: dataset.title,
      priceSnapshot: dataset.price,
      quantity,
      licenseType: dataset.licenseType,
    };
    buyerCart.items.push(cartItem);
    buyerCart.totalAmount += cartItem.priceSnapshot * cartItem.quantity;
    await buyerCart.save();
    return buyerCart;
  },

  clearCart: async (buyerId) => {
    const buyerCart = await Cart.findOne({ buyerId });
    if (!buyerCart) throw new Error("Cart does not exist");
    await Cart.deleteOne({ buyerId });
    return;
  },
  checkout: async (buyerId) => {
    if (!buyerId) throw new Error("Buyer Id is required ");
    const buyerInCart = await Cart.findOne({ buyerId });
    if (!buyerInCart) throw new Error("Cart does not exist");
    const buyer = await UserVera.findById(buyerId);
    if (!buyer) throw new Error("Unauthorized access");
    const items = buyerInCart.items;
    const reference = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const order = await marketplaceService.createOrder(
      buyerId,
      items,
      reference,
      buyerInCart.totalAmount,
    );
    await Cart.deleteOne({ buyerId });
    return order;
  },
};

export default cartService;
