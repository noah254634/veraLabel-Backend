import mongoose from 'mongoose';

const geoRequestAuditSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserVera',
      default: null,
      index: true
    },
    userRole: {
      type: String,
      default: null
    },
    country: {
      type: String,
      required: true,
      index: true
    },
    city: {
      type: String,
      default: 'Unknown'
    },
    timezone: {
      type: String,
      default: 'Unknown'
    },
    path: {
      type: String,
      required: true
    },
    method: {
      type: String,
      required: true
    },
    statusCode: {
      type: Number,
      default: null
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true
    },
    userAgent: {
      type: String,
      default: 'Unknown'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// TTL index to automatically purge request logs after 7 days (604800 seconds)
geoRequestAuditSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });

export default mongoose.model('GeoRequestAudit', geoRequestAuditSchema);
