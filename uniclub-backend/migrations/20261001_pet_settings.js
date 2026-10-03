/** Optional, idempotent backfill; the API also resolves defaults for old users.
 * Preserves every existing setting and never writes device-local positions.
 */
const { PET_DEFAULTS, PET_KEYS } = require('../utils/petSettingsPolicy');

async function migratePetSettings(collection) {
  return collection.updateMany(
    { $or: PET_KEYS.map(key => ({ [`settings.${key}`]: { $exists: false } })) },
    [{ $set: { settings: { $mergeObjects: [PET_DEFAULTS, {
      $cond: [{ $eq: [{ $type: '$settings' }, 'object'] }, '$settings', {}],
    }] } } }],
  );
}

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
  const mongoose = require('mongoose');
  const User = require('../models/User');
  void (async () => {
    try {
      if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
      await mongoose.connect(process.env.MONGODB_URI);
      const result = await migratePetSettings(User.collection);
      console.log(`Pet settings migration: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
    } catch (error) {
      console.error('Pet settings migration failed:', error.message);
      process.exitCode = 1;
    } finally { await mongoose.disconnect(); }
  })();
}

module.exports = { migratePetSettings };
