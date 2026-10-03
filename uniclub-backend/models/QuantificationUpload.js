const mongoose = require('mongoose');
const { MAX_FILE_BYTES, safeStorageKey } = require('../utils/quantificationPolicy');
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuantificationCollection', required: true },
  originalFilename: { type: String, required: true, maxlength: 200 },
  fileSize: { type: Number, required: true, min: 22, max: MAX_FILE_BYTES },
  mimeType: { type: String, default: 'application/zip' },
  stagingKey: { type: String, required: true, validate: safeStorageKey },
  finalKey: { type: String, required: true, validate: safeStorageKey },
  previousKey: { type: String, default: '' },
  sealedKeys: { type: [String], default: [] },
  confirmationId: { type: String, default: '' },
  multipartId: { type: String, default: '' },
  baseVersion: { type: Number, default: 0 },
  state: { type: String, enum: ['pending', 'confirming', 'confirmed', 'aborted', 'expired'], default: 'pending' },
  expiresAt: { type: Date, required: true },
  credentialExpiresAt: { type: Date, default: null },
  confirmLeaseUntil: { type: Date, default: null },
  confirmedAt: { type: Date, default: null },
  cleanupKeys: { type: [String], default: [] },
  cleanupAfter: { type: Date, default: null },
  cleanupLeaseUntil: { type: Date, default: null },
  cleanedAt: { type: Date, default: null },
  cleanupAttempts: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ collectionId: 1, user: 1, createdAt: -1 });
schema.index({ cleanedAt: 1, cleanupAfter: 1, expiresAt: 1 });
// No TTL index: failed cleanup must remain retryable rather than lose its keys.
module.exports = mongoose.model('QuantificationUpload', schema);
