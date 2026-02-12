import Payment from "../models/payment.model.js";
import { PaymentProvider } from "../payment.provider.js";
import Dataset from "../../datasets/dataset.model.js";
import Order from "../../marketplace/order.model.js";
import mongoose from "mongoose";
import logger from "../../../config/logger.js";
export const PaymentService = {
  createPayment: async ({
    order,
    user,
    amount,
    currency,
    redirectUrl,
    reference,
    metadata,
    provider,
    payerUserId,
    purpose,
  }) => {
    const payerId = payerUserId || user?._id;
    if (!payerId) throw new Error("payerUserId is required");

    const payment = await Payment.create({
      order,
      payerUserId: payerId,
      amount,
      currency,
      provider: provider || "flutterwave",
      status: "pending",
      reference,
      purpose: purpose || "dataset_purchase",
      redirectUrl: redirectUrl || "",
      metadata,
    });

    const providerResponse = await PaymentProvider.initiatePayment({
      amount,
      currency,
      user,
      redirectUrl,
    });

    return { payment, providerResponse };
  },

  verifyPayment: async (reference) => {
    const providerResult = await PaymentProvider.verifyPayment(reference);

    const payment = await Payment.findOne({ reference });
    if (!payment) throw new Error("Payment not found");
    
      return await PaymentService.processPaymentPostVerification(payment, providerResult);
  },
// Called after provider confirms payment
processPaymentPostVerification: async (payment, providerResult) => {
  logger.info("Processing payment post verification");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Update payment
    payment.status = providerResult.status === "successful" ? "completed" : "payment_failed";
    await payment.save({ session });

    // Populate order
    const { order: populatedOrder } = await payment.populate('order');

    // Update order
    populatedOrder.status = providerResult.status === "successful" ? "approved" : "rejected";
    await populatedOrder.save({ session });

    // Update dataset
    const dataset = await Dataset.findById(populatedOrder.datasetId).session(session);
    if (!dataset) throw new Error("Dataset not found");

    if (providerResult.status === "successful") {
      dataset.purchasesCount = (dataset.purchasesCount || 0) + 1;

      if (dataset.isExclusive) {
        dataset.isPublished = false;
        dataset.visibility = "private";
        dataset.exclusiveBuyer = payment.payerUserId;
        dataset.exclusivePrice = payment.amount;
      }

      await dataset.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return { success: true };
  } catch (err) {
    logger.warn( `Transaction aborted due to:${err.message}`)
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
},

  getPaymentHistory: async (userId) => {
    return Payment.find({ payerUserId: userId }).sort({ createdAt: -1 });
  },
};
