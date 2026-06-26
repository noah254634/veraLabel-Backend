import Payment from "../models/payment.model.js";
import axios from "axios";
import { PaymentProvider } from "../payment.provider.js";
import Dataset from "../../datasets/dataset.model.js";
import Invoice from "../../datasets/invoice.model.js";
import Order from "../../marketplace/order.model.js";
import mongoose from "mongoose";
import logger from "../../../config/logger.js";
import { ENV } from "../../../config/env.js";
import crypto from "crypto";
import UserVera from "../../users/user.model.js";
import Labeller from "../../labeller/labeller.model.js";
import Payout from "../models/payout.model.js";

export const PaymentService = {
  success: async (reference) => {
    const payment = await Payment.findOne({ reference });
    if (!payment) throw new Error("No Payment with that reference was found");
    
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

  requestWithdrawal: async (user, amount, phoneNumber) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // 1. Fetch user to check balance
      const labellerDoc = await Labeller.findOne({ userId: user._id }).session(session);
      
      if (labellerDoc) {
        if ((labellerDoc.earnings?.currentBalance || 0) < amount) {
          throw new Error("Insufficient balance");
        }
        labellerDoc.earnings.currentBalance -= amount;
        labellerDoc.earnings.totalPayouts = (labellerDoc.earnings.totalPayouts || 0) + 1;
        labellerDoc.earnings.lastPayoutDate = new Date();
        await labellerDoc.save({ session });
      } else {
        const userDoc = await UserVera.findById(user._id).session(session);
        if (!userDoc) throw new Error("User not found");
        
        if (userDoc.balance < amount) {
          throw new Error("Insufficient balance");
        }
        userDoc.balance -= amount;
        await userDoc.save({ session });
      }

      // 3. Conversion: Fetch live update for USD to KES
      let conversionRate = 130; // Fallback rate
      try {
        const rateResponse = await axios.get("https://api.exchangerate-api.com/v4/latest/USD");
        if (rateResponse.data && rateResponse.data.rates && rateResponse.data.rates.KES) {
          conversionRate = rateResponse.data.rates.KES;
          logger.info(`Fetched live exchange rate: 1 USD = ${conversionRate} KES`);
        }
      } catch (rateErr) {
        logger.warn(`Failed to fetch live exchange rate, falling back to 130. Error: ${rateErr.message}`);
      }
      const amountKES = amount * conversionRate;

      // Format phone number to standard 10-digit format (07... or 01...) for Paystack M-Pesa
      let formattedPhone = phoneNumber.replace(/\D/g, '');
      if (formattedPhone.startsWith('254')) {
        formattedPhone = '0' + formattedPhone.slice(3);
      }
      
      // 4. Create Paystack Transfer Recipient
      const recipient = await PaymentProvider.createTransferRecipient(user.name, formattedPhone);
      
      const reference = `WD_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      // 5. Initiate Transfer
      const transferResponse = await PaymentProvider.initiateTransfer(
        amountKES,
        recipient.recipient_code,
        reference
      );

      // 6. Create Payout Record
      const payout = await Payout.create([{
        recipientUserId: user._id,
        provider: 'paystack',
        providerTransferId: transferResponse.transfer_code,
        amount: amount, // Keep original USD amount in db, or we could add KES
        currency: 'USD',
        method: 'mobile_money',
        destination: {
          mobileNetwork: 'MPESA',
          phoneNumber: phoneNumber
        },
        status: 'processing', // or 'queued' depending on Paystack response
        reference: reference
      }], { session });

      await session.commitTransaction();
      session.endSession();
      
      return payout[0];
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      logger.error(`Withdrawal error: ${err.message}`);
      throw err;
    }
  },
};
