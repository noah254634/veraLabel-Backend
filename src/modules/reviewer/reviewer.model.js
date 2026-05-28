import mongoose from "mongoose";

const ReviewerSchema = new mongoose.Schema({
    reviewerUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserVera",
        required: true,
    },
    expertiseAreas: [String],
    assignedDatasetIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Dataset",
    }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    earnings: {
        total: { type: Number, default: 0 },
        pending: { type: Number, default: 0 },
        paid: { type: Number, default: 0 },
    },
    performanceMetrics: {
        averageRating: { type: Number, default: 0 },
        totalReviews: { type: Number, default: 0 },
        approvalRate: { type: Number, default: 0 },
    },
    tasksreviewed: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "ReviewTask",
    }],
    tier: {
        type: String,
        enum: ["bronze", "silver", "gold", "platinum"],
        default: "bronze",
    },
    languages: [String],
    geoLocations: [{
        country: String,
        region: String,
        city: String,
    }],
    DateOfBirth: {
        type: Date,
    },
    gender: {
        type: String,
        enum: ["male", "female", "other"],
    },
    nationality: {
        type: String,
    },
    educationLevel: {
        type: String,
        enum: ["high_school", "bachelor", "master", "phd", "other"],
    },
    occupation: {
        type: String,
    },
});

export default mongoose.model("Reviewer", ReviewerSchema);