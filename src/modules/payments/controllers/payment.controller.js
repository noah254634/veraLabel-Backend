import { PaymentService } from "../services/payment.service.js";
import { marketplaceService } from "../../marketplace/marketplace.service.js";
import logger from "../../../config/logger.js";
import crypto from "crypto";
import { ENV } from "../../../config/env.js";
import Dataset from "../../datasets/dataset.model.js";
import Invoice from "../../datasets/invoice.model.js";
export const PaymentController = {
  success: async (req, res) => {
    try {
      const reference = req.params.reference;
      if (!reference) throw new Error("reference is required");
      const status = await PaymentService.success(reference);
      return res.status(200).json({ status });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

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
      
      const { isExclusive, datasetId, requestId, amount } = req.body;
      
      // Handle dataset purchase
      if (datasetId && !requestId) {
        if (!datasetId || isExclusive === undefined)
          throw new Error("all fields are required");
        const dataset = await Dataset.findOne({ _id: datasetId });
        if (!dataset) throw new Error("Dataset not found");
        
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
          currency:"USD",
          redirectUrl,
          reference,
          metadata: {},
          provider: "paystack",
          payerUserId: buyerId,
          purpose: "dataset_purchase",
        });
        return res.status(201).json({
          message: "Order created successfully",
          orderNumber: order.orderNumber,
          orderId: order._id,
          payment: result,
          url: result.providerResponse.authorization_url,
        });
      }
      
      // Handle dataset request escrow payment
      if (requestId && !datasetId) {
        if (!requestId || !amount)
          throw new Error("requestId and amount are required");
        
        const redirectUrl =
          "https://insightful-marica-unsenescent.ngrok-free.dev/payment/verify";
        
        // Parse amount - remove currency symbols and convert to number
        const parsedAmount = parseFloat(amount.toString().replace(/[^0-9.-]+/g, ""));
        if (isNaN(parsedAmount)) {
          throw new Error("Invalid amount format");
        }
        
        const buyerId = req.user._id;
        logger.info("Creating order and escrow payment for dataset request");
        
        const order = await marketplaceService.createOrder(
          buyerId,
          requestId, // datasetId
          reference,
          parsedAmount,
        );

        const result = await PaymentService.createPayment({
          order: order._id,
          user: req.user,
          amount: parsedAmount,
          currency:"USD",
          redirectUrl,
          reference,
          metadata: { requestId },
          provider: "paystack",
          payerUserId: buyerId,
          purpose: "dataset_request_escrow",
        });
        
        // Dataset status will be updated upon successful webhook verification
        return res.status(201).json({
          message: "Escrow payment initiated successfully",
          orderNumber: order.orderNumber,
          requestId,
          payment: result,
          url: result.providerResponse.authorization_url,
        });
      }
      
      throw new Error("Either datasetId or requestId must be provided");
    } catch (err) {
      logger.error(`Error creating payment: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },

  handleWebhook: async (req, res) => {
    logger.info(`Webhook received: ${req.method} ${req.originalUrl}`, { headers: req.headers });
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
        logger.info(`Processing Paystack success webhook for reference: ${reference}`);
        const payment = await PaymentService.verifyPayment(reference);
        return res.json(payment);
      }
      return res.sendStatus(200);
    } catch (err) {
      logger.error(`Webhook error: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },

  verifyPayment: async (req, res) => {
    try {
      const { reference } = req.query;
      if (!reference) throw new Error("Reference is required");
      
      const payment = await PaymentService.verifyPayment(reference);
      return res.json(payment);
    } catch (err) {
      logger.error(`Manual verification error: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },

  getPaymentHistory: async (req, res) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized - User not found" });
      }

      const payments = await PaymentService.getPaymentHistory(userId);
      return res.json(payments);
    } catch (err) {
      console.error('Error fetching payment history:', err);
      return res.status(500).json({ message: err.message });
    }
  },
};
