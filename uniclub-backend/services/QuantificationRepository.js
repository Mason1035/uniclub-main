const Collection = require('../models/QuantificationCollection');
const Submission = require('../models/QuantificationSubmission');
const Upload = require('../models/QuantificationUpload');
const User = require('../models/User');
const Roster = require('../models/EnrolledUser');

const cleanupFilter = now => ({ cleanedAt: null, $and: [
  { $or: [{ state: { $in: ['confirmed', 'aborted', 'expired'] }, cleanupAfter: { $lte: now } }, { state: { $in: ['pending', 'confirming'] }, expiresAt: { $lt: now }, confirmLeaseUntil: { $not: { $gt: now } } }] },
  { $or: [{ credentialExpiresAt: null }, { credentialExpiresAt: { $lt: now } }] },
  { $or: [{ cleanupLeaseUntil: null }, { cleanupLeaseUntil: { $lt: now } }] },
] });

class QuantificationRepository {
  async hasStorageRecords() { return Boolean(await Submission.exists({}) || await Upload.exists({ cleanedAt: null })); }
  listCollections(admin) { return Collection.find(admin ? {} : { status: { $ne: 'draft' } }).sort({ createdAt: -1 }).lean(); }
  getCollection(id) { return Collection.findById(id).lean(); }
  createCollection(data) { return Collection.create(data); }
  updateCollection(id, data) { return Collection.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean(); }
  getUser(id) { return User.findById(id).select('name email uniqueId isAdmin').lean(); }
  getRoster() { return Roster.find({}).select('name email uniqueId').lean(); }
  getUsers() { return User.find({}).select('name email uniqueId').lean(); }
  getSubmission(user, collection) { return Submission.findOne({ user, collectionId: collection }).lean(); }
  getSubmissionById(id) { return Submission.findById(id).lean(); }
  listSubmissions(collection) { return Submission.find({ collectionId: collection }).lean(); }
  async createUpload(data) { await Submission.init(); return Upload.create(data); }
  getStorageUploads(keys) { return Upload.find({ stagingKey: { $in: keys } }).select('stagingKey finalKey originalFilename state').lean(); }
  getUpload(id) { return Upload.findById(id).lean(); }
  getPendingUpload(user, collection, now) {
    return Upload.findOne({ user, collectionId: collection, state: { $in: ['pending', 'confirming'] }, expiresAt: { $gt: now } }).sort({ createdAt: -1 }).lean();
  }
  updateUpload(id, data) { return Upload.findByIdAndUpdate(id, { $set: data }, { new: true }).lean(); }
  claimUpload(id, now, finalKey, confirmationId) {
    return Upload.findOneAndUpdate({ _id: id, $or: [{ state: 'pending' }, { state: 'confirming', confirmLeaseUntil: { $lt: now } }] },
      { $set: { state: 'confirming', finalKey, confirmationId, confirmLeaseUntil: new Date(now.getTime() + 300000) }, $addToSet: { sealedKeys: finalKey } }, { new: true }).lean();
  }
  releaseUpload(id, confirmationId) { return Upload.updateOne({ _id: id, state: 'confirming', confirmationId }, { $set: { state: 'pending', confirmLeaseUntil: null } }); }
  renewConfirmation(id, confirmationId, now) {
    return Upload.findOneAndUpdate({ _id: id, state: 'confirming', confirmationId, expiresAt: { $gt: now }, confirmLeaseUntil: { $gt: now }, cleanupLeaseUntil: { $not: { $gt: now } } },
      { $set: { confirmLeaseUntil: new Date(now.getTime() + 300000) } }, { new: true }).lean();
  }
  deferCleanup(id, after) { return Upload.updateOne({ _id: id }, { $set: { cleanedAt: null, cleanupAfter: after } }); }
  async saveSubmission(data, baseVersion) {
    try {
      return await Submission.findOneAndUpdate({ user: data.user, collectionId: data.collectionId, version: baseVersion },
        { $set: { ...data, version: baseVersion + 1 } }, { new: true, upsert: baseVersion === 0, runValidators: true }).lean();
    } catch (error) { if (error.code === 11000) return null; throw error; }
  }
  abortUpload(id, data) { return Upload.findOneAndUpdate({ _id: id, state: 'pending' }, { $set: data }, { new: true }).lean(); }
  cleanupCandidates(now) {
    return Upload.find(cleanupFilter(now)).sort({ expiresAt: 1 }).limit(30).lean();
  }
  claimCleanup(id, now) {
    return Upload.findOneAndUpdate({ _id: id, ...cleanupFilter(now) },
      { $set: { cleanupLeaseUntil: new Date(now.getTime() + 180000) }, $inc: { cleanupAttempts: 1 } }, { new: true }).lean();
  }
  isCurrentKey(key) { return Submission.exists({ storageKey: key }); }
}
module.exports = QuantificationRepository;
