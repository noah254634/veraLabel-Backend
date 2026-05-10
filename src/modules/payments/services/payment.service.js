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
    if (!payment) throw new Error("No Payment with that reference was  found");
    const status=payment.status==="completed"?"success":"failed"
    return status
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
   
    const providerResult = await PaymentProvider.verifyPayment(reference);

    const order = await Order.findOne({ reference });
    if (!order) throw new Error("Order not found");
    const payment = await Payment.findOne({ reference });
    if (payment.status !== "pending") throw new Error("Payment already processed");

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
      payment.status =
        providerResult.status === "success" ? "completed" : "payment_failed";
      await payment.save({ session });


      const { order: populatedOrder } = await payment.populate("order");
      if (!populatedOrder) throw new Error("Order not found during verification");


      populatedOrder.status =
        providerResult.status === "success" ? "approved" : "rejected";
      await populatedOrder.save({ session });

      if (payment.purpose === "dataset_request_escrow") {
        const datasetId = populatedOrder.datasetId;
        
        if (providerResult.status === "success") {
          const updatedDataset = await Dataset.findOneAndUpdate(
            { _id: datasetId, type: 'custom' },
            {
              status: "in_progress",
              paidAt: new Date()
            },
            { session, new: true }
          );

          if (updatedDataset) {
            await Invoice.findOneAndUpdate(
              { datasetId: datasetId },
              { status: "completed", paidAt: new Date() },
              { session, new: true, upsert: true }
            );
            logger.info("Dataset status updated to in_progress", {
              datasetId: updatedDataset._id,
              paymentReference: payment.reference
            });
          } else {
            logger.warn("Custom Dataset not found for update", {
              datasetId,
              paymentReference: payment.reference
            });
          }
        } else {
          logger.warn("Payment failed - Dataset status unchanged", {
            datasetId,
            paymentStatus: providerResult.status
          });
        }
      } else if (payment.purpose === "dataset_purchase") {
        if (providerResult.status === "success") {

          const dataset = await Dataset.findById(populatedOrder.datasetId).session(session);
          if (!dataset) throw new Error("Dataset not found");

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

      const payments = await Payment.find({ payerUserId: userId }).sort({ createdAt: -1 }).lean();

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
