import mongoose from 'mongoose';

const ledgerEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    type: {
      type: String,
      enum: [
        'payment_in',
        'earning',
        'platform_fee',
        'payout_out',
        'adjustment'
      ],
      required: true
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

    relatedModel: {
      type: String,
      enum: ['Payment', 'Payout', 'Job', 'Adjustment'],
      required: true
    },

    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },

    balanceBefore: {
      type: Number,
      required: true
    },

    balanceAfter: {
      type: Number,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
