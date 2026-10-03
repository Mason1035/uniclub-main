const FeeSettings = require('../models/FeeSettings');
const FeeSubmission = require('../models/FeeSubmission');

const SETTINGS_META = '_id paymentQrMimeType paymentQrSize createdAt updatedAt';
const SUBMISSION_META = '_id user remark proofImageMimeType proofImageSize status confirmedBy confirmedAt createdAt updatedAt';

class FeeRepository {
  settings() { return FeeSettings.findById('current').select(SETTINGS_META).lean(); }
  qr() { return FeeSettings.findById('current').select('paymentQrMimeType +paymentQrData'); }
  mine(user) { return FeeSubmission.findOne({ user }).select(SUBMISSION_META).lean(); }
  submission(id) { return FeeSubmission.findById(id).select(SUBMISSION_META).lean(); }
  proof(id) { return FeeSubmission.findById(id).select('proofImageMimeType +proofImageData'); }

  async saveQr(image) {
    const update = { paymentQrData: image.data, paymentQrMimeType: image.mimeType, paymentQrSize: image.size };
    const write = upsert => FeeSettings.findOneAndUpdate({ _id: 'current' }, { $set: update },
      { upsert, new: true, runValidators: true }).select(SETTINGS_META).lean();
    try { return await write(true); } catch (error) {
      if (error.code !== 11000) throw error;
      return write(false);
    }
  }

  async submit(user, update, create) {
    await FeeSubmission.init();
    const filter = { user, status: 'SUBMITTED' };
    const write = upsert => FeeSubmission.findOneAndUpdate(filter,
      { $set: update, ...(upsert ? { $setOnInsert: { user, status: 'SUBMITTED' } } : {}) },
      { upsert, new: true, runValidators: true }).select(SUBMISSION_META).lean();
    try { return await write(create); } catch (error) {
      // A simultaneous first submit or an already confirmed row hits the user
      // unique index. Retry only against a still-pending row; never unlock it.
      if (!create || error.code !== 11000) throw error;
      return write(false);
    }
  }

  async confirm(id, admin, at) {
    const changed = await FeeSubmission.findOneAndUpdate({ _id: id, status: 'SUBMITTED' },
      { $set: { status: 'CONFIRMED', confirmedBy: admin, confirmedAt: at } },
      { new: true, runValidators: true }).select(SUBMISSION_META).lean();
    return changed || this.submission(id);
  }

  async list({ status, skip, limit }) {
    const filter = status ? { status } : {};
    const [items, total] = await Promise.all([
      FeeSubmission.find(filter).select(SUBMISSION_META).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit)
        .populate('user', 'name uniqueId').populate('confirmedBy', 'name uniqueId').lean(),
      FeeSubmission.countDocuments(filter),
    ]);
    return { items, total };
  }
}

module.exports = FeeRepository;
