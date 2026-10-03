const mongoose = require('mongoose');

const feeSubmissionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  remark: { type: String, maxlength: 200, default: '' },
  proofImageData: { type: Buffer, required: true, select: false },
  proofImageMimeType: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/webp'] },
  proofImageSize: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
  status: { type: String, enum: ['SUBMITTED', 'CONFIRMED'], default: 'SUBMITTED', required: true },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  confirmedAt: { type: Date, default: null },
}, { timestamps: true, collection: 'fee_submissions' });

feeSubmissionSchema.index({ user: 1 }, { unique: true, name: 'fee_user_unique' });
feeSubmissionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('FeeSubmission', feeSubmissionSchema);
