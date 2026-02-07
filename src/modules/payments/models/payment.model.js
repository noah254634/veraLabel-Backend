import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    payerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    provider: {
      type: String,
      enum: ['paystack', 'stripe'],
      required: true
    },

    reference: {
      type: String,
      required: true,
      unique: true
    },

    providerIntentId: {
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

    status: {
      type: String,
      enum: ['initialized', 'pending', 'success', 'failed', 'cancelled'],
      default: 'initialized'
    },

    purpose: {
      type: String,
      enum: ['dataset_purchase', 'subscription', 'credits', 'custom_job'],
      default:"dataset_purchase",
      required: true
    },
    redirectUrl:{
      type:String,
      default:""
    },

    metadata: {
      datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset' },
      subscriptionPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
      jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' }
    },

    fees: {
      providerFee: { type: Number, default: 0 },
      platformFee: { type: Number, default: 0 }
    },

    verifiedAt: Date
  },
  { timestamps: true }
);

export default mongoose.model('Payment', paymentSchema);
