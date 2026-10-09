const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  jobKey: { type: String, required: true, unique: true },
  date: { type: String, required: true },
  batchId: { type: String, required: true },
  trigger: { type: String, default: 'manual' },
  force: { type: Boolean, default: false },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'searching', 'generating', 'validating', 'publishing', 'success', 'failed'], default: 'pending' },
  attempts: { type: Number, default: 1 },
  startedAt: { type: Date, required: true },
  finishedAt: { type: Date },
  articleCount: { type: Number, default: 0 },
  searchPerformed: { type: Boolean, default: false },
  searchResultCount: { type: Number, default: 0 },
  sourcesUsed: { type: Number, default: 0 },
  searchProvider: { type: String },
  errorCode: { type: String },
  errorMessage: { type: String },
  nextRetryAt: { type: Date },
  ownerToken: { type: String, select: false },
}, { timestamps: true, collection: 'daily_news_jobs' });
schema.index({ startedAt: -1 });
schema.index({ date: 1, status: 1 });
module.exports = mongoose.model('DailyNewsJob', schema);
