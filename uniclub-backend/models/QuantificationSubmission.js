const mongoose = require('mongoose');
const { MAX_FILE_BYTES, safeStorageKey } = require('../utils/quantificationPolicy');
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuantificationCollection', required: true },
  upload: { type: mongoose.Schema.Types.ObjectId, ref: 'QuantificationUpload', required: true },
  originalFilename: { type: String, required: true, maxlength: 200 },
  storageKey: { type: String, required: true, validate: safeStorageKey },
  fileSize: { type: Number, required: true, min: 22, max: MAX_FILE_BYTES },
  mimeType: { type: String, default: 'application/zip' },
  etag: { type: String, required: true },
  status: { type: String, enum: ['submitted'], default: 'submitted' },
  version: { type: Number, required: true, min: 1 },
  submittedAt: { type: Date, required: true },
}, { timestamps: true, autoIndex: true });
schema.index({ collectionId: 1, user: 1 }, { unique: true });
module.exports = mongoose.model('QuantificationSubmission', schema);
