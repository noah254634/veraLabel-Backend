import mongoose from "mongoose";

const buyerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserVera",
      required: true,
      unique: true,
    },
    companyName: {
      type: String,
      default: "",
    },
    industry: {
      type: String,
      default: "",
    },
    billingAddress: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      zip: { type: String, default: "" },
      country: { type: String, default: "" },
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: ["unsubmitted", "pending", "approved", "rejected"],
      default: "unsubmitted",
    },
    website: {
      type: String,
      default: "",
    },
    linkedin: {
      type: String,
      default: "",
    },
    companySize: {
      type: String,
      default: "",
    },
    intendedUseCase: {
      type: String,
      default: "",
    },
    adminNotes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Buyer", buyerSchema);
