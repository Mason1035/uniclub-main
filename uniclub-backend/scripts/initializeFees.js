const path = require('path');
const mongoose = require('mongoose');
const FeeSettings = require('../models/FeeSettings');
const FeeSubmission = require('../models/FeeSubmission');

// Additive, repeatable initialization: never drops existing collections/indexes.
async function initializeFees() {
  for (const model of [FeeSettings, FeeSubmission]) {
    await model.createCollection();
    await model.createIndexes();
  }
  const at = new Date();
  await FeeSettings.updateOne({ _id: 'current' }, { $setOnInsert: { _id: 'current', createdAt: at, updatedAt: at } }, { upsert: true, timestamps: false });
  return {
    settings: await FeeSettings.countDocuments(),
    submissions: await FeeSubmission.countDocuments(),
    userUniqueIndex: (await FeeSubmission.collection.indexes()).some(index => index.name === 'fee_user_unique' && index.unique),
  };
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  (async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is required');
    await mongoose.connect(uri, { autoIndex: false });
    console.log('Fees database initialized:', await initializeFees());
  })().catch(() => { console.error('Fees initialization failed; check MongoDB connectivity and index permissions.'); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}

module.exports = initializeFees;
