const mongoose = require('mongoose');
const { safeMediaKey, MAX_IMAGE_BYTES } = require('../utils/activityMediaPolicy');
const schema = new mongoose.Schema({
  activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  mediaType: { type: String, enum: ['COVER', 'PHOTO'], required: true },
  objectKey: { type: String, required: true, validate: safeMediaKey },
  thumbnailKey: { type: String, required: true, validate: safeMediaKey },
  originalFilename: { type: String, required: true, maxlength: 200 },
  mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
  fileSize: { type: Number, required: true, min: 12, max: MAX_IMAGE_BYTES },
  width: { type: Number, default: null }, height: { type: Number, default: null },
  sortOrder: { type: Number, default: 0, min: 0 },
  caption: { type: String, default: '', maxlength: 200 },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  baseMediaVersion: { type: Number, default: 0, min: 0 },
  state: { type: String, enum: ['UPLOADING', 'READY', 'FAILED'], default: 'UPLOADING' },
  etag: { type: String, default: '' },
  expiresAt: { type: Date, required: true },
  completedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });
schema.index({ objectKey: 1 }, { unique: true });
schema.index({ activityId: 1, state: 1, deletedAt: 1, mediaType: 1, sortOrder: 1, _id: 1 });
schema.index({ uploadedBy: 1, state: 1, expiresAt: 1 });
// No TTL or object deletion: a failed confirmation retains its durable key.
module.exports = mongoose.model('ActivityMedia', schema);
