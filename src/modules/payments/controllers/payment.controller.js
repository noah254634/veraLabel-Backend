import { PaymentService } from "../services/payment.service.js";
import { marketplaceService } from "../../marketplace/marketplace.service.js";
import logger from "../../../config/logger.js";
export const PaymentController = {
  //commented it out because i could create order and create payment directly in marketplace module
  createPayment: async (req, res) => {
    try {
      logger.info("Initiating payment creation process");
      const generateReference = () => {
        return `PAY_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      };
      const reference = generateReference();
      const { amount, currency, redirectUrl, datasetPrice,metaData,provider,payerUserId,purpose,datasetId } = req.body;
      const totalPrice = datasetPrice || amount;
      const buyerId = req.user._id;
      logger.info("Creating order");
      const order = await marketplaceService.createOrder(
        buyerId,
        datasetId,
        reference,
        datasetPrice,
        totalPrice,
      );
      const result = await PaymentService.createPayment({
        order: order._id,
        user: req.user,
        amount,
        currency,
        redirectUrl,
        reference,
        metadata: metaData,
        provider,
        payerUserId,
        purpose
      });
      return res.status(201).json({ message:"Order created Successfully", order, payment: result });
    } catch (err) {
        logger.error(`Error creating payment: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },

  verifyPayment: async (req, res) => {
    try {
      const { reference } = req.params;
      const payment = await PaymentService.verifyPayment(reference);
      return res.json(payment);
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
