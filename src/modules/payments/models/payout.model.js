
import mongoose from 'mongoose';

const payoutSchema = new mongoose.Schema(
  {
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    provider: {
      type: String,
      enum: ['paystack', 'stripe'],
      required: true
    },

    providerTransferId: {
      type: String
    },

    amount: {
      type: Number,
      required: true
    },

    currency: {
      type: String,
      required: true,
      uppercase: true
    },

    method: {
      type: String,
      enum: ['bank_transfer', 'mobile_money'],
      required: true
    },

    destination: {
      bankName: String,
      accountNumber: String,
      mobileNetwork: {
        type: String,
        enum: ['MPESA', 'AIRTEL']
      },
      phoneNumber: String
    },

    status: {
      type: String,
      enum: ['queued', 'processing', 'paid', 'failed'],
      default: 'queued'
    },

    failureReason: String,

    scheduledFor: Date,
    processedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payout', payoutSchema);
