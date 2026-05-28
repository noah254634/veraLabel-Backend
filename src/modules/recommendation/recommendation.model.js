import mongoose from 'mongoose';

const RecommendationSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  payload: { type: mongoose.Schema.Types.Mixed },
  ttl: { type: Date },
}, { timestamps: true });

export default mongoose.model('Recommendation', RecommendationSchema);
