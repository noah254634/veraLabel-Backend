import Payment from "../models/payment.model.js";
import { PaymentProvider } from "../payment.provider.js";
import Dataset from "../../datasets/dataset.model.js";
import Invoice from "../../datasets/invoice.model.js";
import Order from "../../marketplace/order.model.js";
import mongoose from "mongoose";
import logger from "../../../config/logger.js";
import { ENV } from "../../../config/env.js";
import crypto from "crypto";
export const PaymentService = {
  success: async (reference) => {
    const payment = await Payment.findOne({ reference });
    if (!payment) throw new Error("No Payment with that reference was found");
    
    // Return actual status for more accurate client-side feedback
    return payment.status; 
  },
  createPayment: async ({
    order,
    user,
    amount,
    currency,
    redirectUrl,
    reference,
    metadata,
    payerUserId,
    provider,
    purpose,
  }) => {
    const payerId = payerUserId || user?._id;
    if (!payerId) throw new Error("payerUserId is required");

    // Invalidate any existing pending payments for this order to ensure 
    // only one active payment attempt exists at a time (idempotency).
    await Payment.updateMany(
      { order, status: "pending" },
      { status: "cancelled", metadata: { supersededAt: new Date(), reason: "new_payment_initiated" } }
    );

    const payment = await Payment.create({
      order,
      payerUserId: payerId,
      amount,
      currency,
      provider: provider,
      status: "pending",
      reference,
      purpose: purpose,
      redirectUrl: redirectUrl || "",
      metadata,
    });

    const providerResponse = await PaymentProvider.initiatePayment({
      amount,
      currency,
      user,
      email: user.email,
      reference,
      redirectUrl,
      provider,
    });

    return { payment, providerResponse };
  },

  verifyPayment: async (reference) => {  
    // 1. Check local database first
    const payment = await Payment.findOne({ reference });
    if (!payment) throw new Error("Payment record not found");

    // If already processed, return the record immediately (Idempotency)
    // This saves an external API call to Paystack for duplicate webhooks
    if (payment.status !== "pending") {
      logger.info(`Payment ${reference} already processed. Returning current state.`);
      return payment;
    }

    // 2. Only if pending, verify with the provider
    const providerResult = await PaymentProvider.verifyPayment(reference);

    // 3. Find order linked to this specific payment
    const order = await Order.findById(payment.order);
    if (!order) throw new Error("Order not found");
    
    return await PaymentService.processPaymentPostVerification(
      payment,
      providerResult,
    );
  },


  processPaymentPostVerification: async (payment, providerResult) => {
    logger.info("Processing payment post verification");
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Re-fetch the payment within the session to ensure we have the latest status
      // and prevent race conditions if a webhook and manual verification run simultaneously.
      const paymentDoc = await Payment.findById(payment._id).session(session);
      
      if (!paymentDoc || paymentDoc.status !== "pending") {
        logger.info(`Payment ${payment._id} already processed or missing. Aborting transaction.`);
        await session.commitTransaction();
        return paymentDoc || payment;
      }

      const now = new Date();
      paymentDoc.status = providerResult.status === "success" ? "completed" : "payment_failed";
      paymentDoc.verifiedAt = now;
      await paymentDoc.save({ session });

      // Use the updated document for the rest of the logic
      const { order: populatedOrder } = await paymentDoc.populate("order");
      if (!populatedOrder) throw new Error("Order not found during verification");

      if (providerResult.status === "success") {
        populatedOrder.status = "approved";
        populatedOrder.paidAt = now;
        populatedOrder.paymentId = payment._id;
        await populatedOrder.save({ session });

        // Handle specific purposes
        if (payment.purpose === "dataset_request_escrow") {
          const datasetId = populatedOrder.datasetId;
          
          await Dataset.findOneAndUpdate(
            { _id: datasetId, type: 'custom' },
            { status: "in_progress", paidAt: now },
            { session }
          );

          await Invoice.findOneAndUpdate(
            { datasetId },
            { status: "completed", paidAt: now },
            { session, upsert: true }
          );

          logger.info("Custom Dataset and Invoice finalized", { datasetId });
        } else if (payment.purpose === "dataset_purchase") {
          const dataset = await Dataset.findById(populatedOrder.datasetId).session(session);
          if (dataset) {
            dataset.purchasesCount = (dataset.purchasesCount || 0) + 1;
            if (dataset.isExclusive) {
              dataset.isPublished = false;
              dataset.visibility = "private";
              dataset.exclusiveBuyer = payment.payerUserId;
              dataset.exclusivePrice = payment.amount;
            }
            await dataset.save({ session, validateBeforeSave: false });
          }
        }
      } else {
        populatedOrder.status = "rejected";
        await populatedOrder.save({ session });
      }
      await session.commitTransaction();
      session.endSession();

      return { success: true };
    } catch (err) {
      logger.warn(`Transaction aborted due to:${err.message}`);
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  },

  getPaymentHistory: async (userId) => {
    try {
      if (!userId) {
        throw new Error("User ID is required");
      }

      const payments = await Payment.find({ payerUserId: userId })
        .populate("order", "orderNumber status totalPrice")
        .sort({ createdAt: -1 })
        .lean();

      logger.info('Payment history fetched', {
        userId,
        paymentCount: payments.length
      });

      return payments;
    } catch (error) {
      logger.error('Error fetching payment history', {
        error: error.message,
        userId
      });
      throw error;
    }
  },
};
