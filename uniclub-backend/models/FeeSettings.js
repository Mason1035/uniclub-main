const mongoose = require('mongoose');

const feeSettingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'current', enum: ['current'] },
  paymentQrData: { type: Buffer, select: false },
  paymentQrMimeType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'] },
  paymentQrSize: { type: Number, min: 1, max: 5 * 1024 * 1024 },
}, { timestamps: true, collection: 'fee_settings' });

module.exports = mongoose.model('FeeSettings', feeSettingsSchema);
