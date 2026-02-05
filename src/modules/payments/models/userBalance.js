import mongoose from 'mongoose';


const userBalanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      required: true
    },

    pendingBalance: {
      type: Number,
      default: 0
    },

    availableBalance: {
      type: Number,
      default: 0
    },

    lifetimeEarnings: {
      type: Number,
      default: 0
    },

    currency: {
      type: String,
      required: true,
      uppercase: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserBalance', userBalanceSchema);
