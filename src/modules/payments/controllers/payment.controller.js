import { PaymentService } from "../services/payment.service.js";
import { buyerService } from "../../buyer/buyer.service.js";
import logger from "../../../config/logger.js";
import crypto from "crypto";
import { ENV } from "../../../config/env.js";
import Dataset from "../../datasets/dataset.model.js";
import { asyncHandler, AppError } from "../../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../../helpers/responseHandler.js";
import Payout from "../models/payout.model.js";
import UserVera from "../../users/user.model.js";
import Labeller from "../../labeller/labeller.model.js";
import Reviewer from "../../reviewer/reviewer.model.js";
import mailService from "../../mailer/mailService.js";
import ResetPassword from "../../auth/resetPassword.model.js";

export const PaymentController = {
  success: asyncHandler(async (req, res) => {
    const { reference } = req.params;
    if (!reference) throw new AppError("Reference is required", 400);
    const status = await PaymentService.success(reference);
    return ResponseHandler.success(res, { status }, "Payment successful");
  }),

  createPayment: asyncHandler(async (req, res) => {
    const generateReference = () => `PAY_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const reference = generateReference();

    if (req.user.role !== "buyer") throw new AppError("Unauthorized — user is not a buyer", 403);

    const { isExclusive, datasetId, requestId, amount } = req.body;

    // Dataset purchase
    if (datasetId && !requestId) {
      if (isExclusive === undefined) throw new AppError("All fields are required", 400);
      const dataset = await Dataset.findOne({ _id: datasetId });
      if (!dataset) throw new AppError("Dataset not found", 404);

      const redirectUrl = `${ENV().frontend_url || 'http://localhost:5173'}/payments/success`;
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

      const redirectUrl = `${ENV().frontend_url || 'http://localhost:5173'}/payments/success`;
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
      // req.body is a raw Buffer when the route uses express.raw()
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));

      const hash = crypto
        .createHmac("sha512", ENV().paystack_secret_key)
        .update(rawBody)
        .digest("hex");

      // Use constant-time comparison to prevent timing attacks
      const sig = req.headers["x-paystack-signature"] || "";
      const hashBuf = Buffer.from(hash, "hex");
      const sigBuf  = Buffer.from(sig, "hex");
      if (
        hashBuf.length !== sigBuf.length ||
        !crypto.timingSafeEqual(hashBuf, sigBuf)
      ) {
        throw new Error("Invalid signature");
      }

      const event = JSON.parse(rawBody.toString());
      
      if (event.event === "charge.success") {
        const payment = await PaymentService.verifyPayment(event.data.reference);
        return res.json(payment);
      }
      
      // Handle transfer events
      if (event.event === "transfer.success" || event.event === "transfer.failed" || event.event === "transfer.reversed") {
        
        const reference = event.data.reference;
        const payout = await Payout.findOne({ reference });
        
        if (payout) {
          if (event.event === "transfer.success") {
            payout.status = 'paid';
            payout.processedAt = new Date();
            await payout.save();
          } else {
            payout.status = 'failed';
            payout.failureReason = event.data.reason || event.event;
            await payout.save();
            
            // Refund the user since the transfer failed
            const labeller = await Labeller.findOne({ userId: payout.recipientUserId });
            const reviewer = await Reviewer.findOne({ reviewerUserId: payout.recipientUserId });
            if (labeller) {
              labeller.earnings.currentBalance += payout.amount;
              await labeller.save();
            } else if (reviewer) {
              reviewer.earnings.pending = Number((reviewer.earnings.pending + payout.amount).toFixed(2));
              reviewer.earnings.paid = Number((reviewer.earnings.paid - payout.amount).toFixed(2));
              await reviewer.save();
            } else {
              const user = await UserVera.findById(payout.recipientUserId);
              if (user) {
                user.balance += payout.amount;
                await user.save();
              }
            }
          }
        }
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

  requestWithdrawalOTP: asyncHandler(async (req, res) => {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      throw new AppError("A valid amount is required", 400);
    }
    await mailService.sendWithdrawalOTPEmail(req.user, amount);
    return ResponseHandler.success(res, null, "Withdrawal OTP sent to your email");
  }),

  withdraw: asyncHandler(async (req, res) => {
    const { amount, phoneNumber, otp } = req.body;
    
    if (!amount || amount <= 0) {
      throw new AppError("A valid amount is required", 400);
    }
    if (!phoneNumber) {
      throw new AppError("Phone number is required for M-Pesa withdrawal", 400);
    }
    if (!otp) {
      throw new AppError("OTP is required to authorize withdrawal", 400);
    }

    // Atomically find and delete the OTP — prevents race conditions where two
    // simultaneous withdrawal requests could both pass the same OTP check.
    const otpDoc = await ResetPassword.findOneAndDelete({
      userId: req.user._id,
      token: crypto.createHash('sha256').update(otp).digest('hex'),
      expiresAt: { $gt: Date.now() },
    });

    if (!otpDoc) {
      throw new AppError("Invalid or expired OTP", 400);
    }

    // OTP verified — now process the withdrawal
    const payout = await PaymentService.requestWithdrawal(req.user, amount, phoneNumber);

    return ResponseHandler.success(res, { payout }, "Withdrawal request submitted successfully");
  }),
};
