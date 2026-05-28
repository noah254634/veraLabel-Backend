import { PaymentService } from "../services/payment.service.js";
import { buyerService } from "../../buyer/buyer.service.js";
import logger from "../../../config/logger.js";
import crypto from "crypto";
import { ENV } from "../../../config/env.js";
import Dataset from "../../datasets/dataset.model.js";
import { asyncHandler, AppError } from "../../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../../helpers/responseHandler.js";

export const PaymentController = {
  success: asyncHandler(async (req, res) => {
    const { reference } = req.params;
    if (!reference) throw new AppError("Reference is required", 400);
    const status = await PaymentService.success(reference);
    return ResponseHandler.success(res, { status }, "Payment successful");
  }),

  createPayment: asyncHandler(async (req, res) => {
    const generateReference = () => `PAY_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const reference = generateReference();

    if (req.user.role !== "buyer") throw new AppError("Unauthorized — user is not a buyer", 403);

    const { isExclusive, datasetId, requestId, amount } = req.body;

    // Dataset purchase
    if (datasetId && !requestId) {
      if (isExclusive === undefined) throw new AppError("All fields are required", 400);
      const dataset = await Dataset.findOne({ _id: datasetId });
      if (!dataset) throw new AppError("Dataset not found", 404);

      const redirectUrl = "https://insightful-marica-unsenescent.ngrok-free.dev/payment/verify";
      const datasetPrice = isExclusive ? dataset.exclusivePrice : dataset.price;
      if (!datasetPrice) throw new AppError("Dataset has no price for this purchase type", 400);

      const order = await buyerService.createOrder(req.buyer._id, datasetId, reference, datasetPrice);
      const result = await PaymentService.createPayment({
        order: order._id, user: req.user, amount: datasetPrice,
        currency: "USD", redirectUrl, reference, metadata: {},
        provider: "paystack", payerUserId: req.user._id, purpose: "dataset_purchase",
      });

      return ResponseHandler.created(res, {
        orderNumber: order.orderNumber,
        orderId: order._id,
        payment: result,
        url: result.providerResponse.authorization_url,
      }, "Order created successfully");
    }

    // Dataset request escrow
    if (requestId && !datasetId) {
      if (!amount) throw new AppError("requestId and amount are required", 400);

      const parsedAmount = parseFloat(amount.toString().replace(/[^0-9.-]+/g, ""));
      if (isNaN(parsedAmount)) throw new AppError("Invalid amount format", 400);

      const redirectUrl = "https://insightful-marica-unsenescent.ngrok-free.dev/payment/verify";
      const order = await buyerService.createOrder(req.buyer._id, requestId, reference, parsedAmount);
      const result = await PaymentService.createPayment({
        order: order._id, user: req.user, amount: parsedAmount,
        currency: "USD", redirectUrl, reference, metadata: { requestId },
        provider: "paystack", payerUserId: req.user._id, purpose: "dataset_request_escrow",
      });

      return ResponseHandler.created(res, {
        orderNumber: order.orderNumber,
        requestId,
        payment: result,
        url: result.providerResponse.authorization_url,
      }, "Escrow payment initiated successfully");
    }

    throw new AppError("Either datasetId or requestId must be provided", 400);
  }),

  // Webhook is intentionally NOT wrapped in asyncHandler — Paystack requires
  // an immediate 200 response. Error handling is done inline.
  handleWebhook: async (req, res) => {
    logger.info(`Webhook received: ${req.method} ${req.originalUrl}`);
    try {
      const hash = crypto
        .createHmac("sha512", ENV().paystack_secret_key)
        .update(JSON.stringify(req.body))
        .digest("hex");

      if (hash !== req.headers["x-paystack-signature"])
        throw new Error("Invalid signature");

      const event = req.body;
      if (event.event === "charge.success") {
        const payment = await PaymentService.verifyPayment(event.data.reference);
        return res.json(payment);
      }
      return res.sendStatus(200);
    } catch (err) {
      logger.error(`Webhook error: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },

  verifyPayment: asyncHandler(async (req, res) => {
    const { reference } = req.query;
    if (!reference) throw new AppError("Reference is required", 400);
    const payment = await PaymentService.verifyPayment(reference);
    return ResponseHandler.success(res, { payment }, "Payment verified");
  }),

  getPaymentHistory: asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) throw new AppError("Unauthorized — user not found", 401);
    const payments = await PaymentService.getPaymentHistory(userId);
    return ResponseHandler.success(res, { payments }, "Payment history fetched");
  }),
};
