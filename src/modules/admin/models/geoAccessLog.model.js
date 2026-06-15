import mongoose from 'mongoose';

const geoAccessLogSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    country: {
      type: String,
      required: true
    },
    city: {
      type: String,
      default: 'Unknown'
    },
    timezone: {
      type: String,
      default: 'Unknown'
    },
    coordinates: {
      type: [Number],
      default: []
    },
    userAgent: {
      type: String,
      default: 'Unknown'
    },
    lastPath: {
      type: String,
      default: 'Unknown'
    },
    lastMethod: {
      type: String,
      default: 'GET'
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    hits: {
      type: Number,
      default: 1
    },
    lastAccess: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// TTL index to automatically purge entries after 7 days (604800 seconds) of inactivity
geoAccessLogSchema.index({ lastAccess: 1 }, { expireAfterSeconds: 604800 });

export default mongoose.model('GeoAccessLog', geoAccessLogSchema);
