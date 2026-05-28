import mongoose from 'mongoose';

const progressEventSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['progress', 'error', 'checkpoint', 'complete', 'warning'],
    required: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical']
  },
  message: String,
  metadata: mongoose.Schema.Types.Mixed,
  timestamp: Date,
  serverReceivedAt: {
    type: Date,
    default: Date.now
  },
  eventIndex: Number
});

const taskProgressSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  projectId: {
    type: String,
    required: true,
    index: true
  },
  datasetId: {
    type: String,
    required: true,
    index: true
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: Date,
  events: [progressEventSchema],
  eventMetrics: {
    processed: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    checkpoints: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  failureReason: String,
  completionSummary: mongoose.Schema.Types.Mixed,
  lastUpdate: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true
});

export default mongoose.model('TaskProgressSession', taskProgressSessionSchema);
