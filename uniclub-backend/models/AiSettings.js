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
}, {
  timestamps: true,
  collection: 'ai_settings',
  toJSON: { transform: (_doc, ret) => { delete ret.secret; return ret; } },
});

module.exports = mongoose.model('AiSettings', schema);
