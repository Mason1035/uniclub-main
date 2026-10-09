const mongoose = require('mongoose');

// Singleton configuration. The master encryption key lives only in server env.
const secretSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  ciphertext: { type: String, required: true },
  iv: { type: String, required: true },
  authTag: { type: String, required: true },
}, { _id: false });

const schema = new mongoose.Schema({
  _id: { type: String, default: 'deepseek' },
  configured: { type: Boolean, default: false },
  secret: { type: secretSchema, select: false },
  last4: { type: String, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Daily News follows this same provider and encrypted key. There is no
  // second provider configuration or credential in these product settings.
  dailyAiNews: {
    enabled: { type: Boolean, default: true },
    time: { type: String, default: '19:00' },
    timezone: { type: String, default: 'Asia/Shanghai', enum: ['Asia/Shanghai'] },
    articleCount: { type: Number, default: 2, min: 1, max: 5 },
    categories: { type: [String], default: ['ai', 'technology', 'software', 'science', 'education'] },
    webSearch: { type: Boolean, default: true },
    reasoning: { type: String, enum: ['auto', 'high'], default: 'auto' },
  },
  dailyNewsRuntime: {
    activeBatchId: { type: String, default: null },
    activeDate: { type: String, default: null },
    activeArticleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'News' }],
    lastSuccessDate: { type: String, default: null },
    successfulDates: { type: [String], default: [] },
    committedBatches: { type: [String], default: [] },
    lease: {
      ownerToken: String, batchId: String, date: String,
      expiresAt: Date, heartbeatAt: Date,
    },
  },
}, {
  timestamps: true,
  collection: 'ai_settings',
  toJSON: { transform: (_doc, ret) => { delete ret.secret; return ret; } },
});

module.exports = mongoose.model('AiSettings', schema);
