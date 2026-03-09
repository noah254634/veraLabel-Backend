import { PaymentService } from "../services/payment.service.js";
import { marketplaceService } from "../../marketplace/marketplace.service.js";
import logger from "../../../config/logger.js";
import crypto from "crypto";
import { ENV } from "../../../config/env.js";
import Dataset from "../../datasets/dataset.model.js";
export const PaymentController = {
  //commented it out because i could create order and create payment directly in marketplace module
  createPayment: async (req, res) => {
    try {
      logger.info("Initiating payment creation process");
      logger.info(JSON.stringify(req.body));
      const generateReference = () => {
        return `PAY_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      };
      const reference = generateReference();
      if (req.user.role !== "buyer")
        throw new Error("Unauthorized access  or user not a buyer");
      const {isExclusive, datasetId } = req.body;
      if (!datasetId || isExclusive === undefined) throw new Error("all fields are required");
      const dataset = await Dataset.findOne({ _id: datasetId });
      if (!dataset) throw new Error("Dataset not found")
      //if (dataset.visibility === "private") throw new Error("Dataset is private");
      const redirectUrl =
        "https://insightful-marica-unsenescent.ngrok-free.dev/payment/verify";
      let datasetPrice = 0;
      if (isExclusive) {
        datasetPrice = dataset.exclusivePrice;
      } else {
        datasetPrice = dataset.price;
      }
      if (datasetPrice === 0) {
        console.warn(
          `Dataset ${dataset._id} has no price for ${isExclusive ? "exclusive" : "normal"} purchase`,
        );
        return res
          .status(400)
          .json({ error: "Dataset has no price for purchase" });
      }

      const buyerId = req.user._id;
      logger.info("Creating order");
      const order = await marketplaceService.createOrder(
        buyerId,
        datasetId,
        reference,
        datasetPrice,
      );
      logger.info("Creating payment");
      const result = await PaymentService.createPayment({
        order: order._id,
        user: req.user,
        amount: datasetPrice,
        currency: ENV().payment_currency || "KES",
        redirectUrl,
        reference,
        metadata: {},
        provider: "paystack",
        payerUserId: buyerId,
        purpose: "dataset_purchase",
      });
      return res.status(201).json({
        message: "Order created Successfully",
        order,
        payment: result,
        url: result.providerResponse.authorization_url,
      });
    } catch (err) {
      logger.error(`Error creating payment: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },

  verifyPayment: async (req, res) => {
    try {
      const hash = crypto
        .createHmac("sha512", ENV().paystack_secret_key)
        .update(JSON.stringify(req.body))
        .digest("hex");
      if (hash !== req.headers["x-paystack-signature"])
        throw new Error("Invalid signature");
      const event = req.body;
      if (event.event == "charge.success") {
        const reference = event.data.reference;
        const payment = await PaymentService.verifyPayment(reference);
        return res.json(payment);
      }
      return res.sendStatus(200);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  getPaymentHistory: async (req, res) => {
    try {
      const payments = await PaymentService.getPaymentHistory(req.user._id);
      return res.json(payments);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
};
