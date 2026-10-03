/** Idempotent account-center backfill; defaults also resolve at API read time.
 * Preflight email normalization before writes; never merge accounts or identities.
 */
const { NOTIFICATION_DEFAULTS } = require('../utils/accountSettingsPolicy');
const { PET_DEFAULTS } = require('../utils/petSettingsPolicy');
const asObject = value => ({ $cond: [{ $eq: [{ $type: value }, 'object'] }, value, {}] });
async function migrateAccountSettings(collection) {
  const conflicts = await collection.aggregate([
    { $match: { email: { $type: 'string' } } },
    { $project: { normalized: { $toLower: { $trim: { input: '$email' } } } } },
    { $match: { normalized: { $ne: '' } } },
    { $group: { _id: '$normalized', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }, { $limit: 1 },
  ]).toArray();
  if (conflicts.length) throw new Error('现有邮箱规范化后存在重复，请先处理冲突；未执行账户回填。');
  const result = await collection.updateMany({}, [{ $set: {
    displayName: { $ifNull: ['$displayName', null] },
    emailVerified: { $ifNull: ['$emailVerified', false] },
    lastLoginAt: { $ifNull: ['$lastLoginAt', null] },
    email: { $cond: [{ $eq: [{ $type: '$email' }, 'string'] },
      { $cond: [{ $ne: [{ $trim: { input: '$email' } }, ''] }, { $toLower: { $trim: { input: '$email' } } }, '$$REMOVE'] }, '$$REMOVE'] },
    profile: { $mergeObjects: [{ bio: '' }, asObject('$profile')] },
    settings: { $mergeObjects: [PET_DEFAULTS, asObject('$settings'), {
      notifications: { $mergeObjects: [NOTIFICATION_DEFAULTS, asObject('$settings.notifications')] },
    }] },
  } }]);
  await collection.createIndex({ email: 1 }, { name: 'email_optional_unique', unique: true,
    partialFilterExpression: { email: { $type: 'string' } } });
  return result;
}
if (require.main === module) {
  const path = require('node:path');
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  const mongoose = require('mongoose');
  const User = require('../models/User');
  void (async () => {
    try {
      if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
      await mongoose.connect(process.env.MONGODB_URI);
      const result = await migrateAccountSettings(User.collection);
      console.log(`Account settings migration: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
    } catch (failure) { console.error(failure.message); process.exitCode = 1; }
    finally { await mongoose.disconnect(); }
  })();
}
module.exports = { migrateAccountSettings };
