/** Additive, inspect-first Activities V2 compatibility migration.
 * Does not delete/reclassify events, mutate legacy RSVPs, or alter image URLs.
 * CLI defaults to dry-run. Remote databases require the explicit additional
 * --allow-remote switch, only after an authorized production backup/review.
 */
const mongoose = require('mongoose');
const { createHash } = require('crypto');
const { activityService } = require('../services/ActivityService');
async function evidence(service) {
  const rows = await service.events.find({}).select('_id eventType imageUrl').sort({ _id: 1 }).lean();
  const registrations = await service.rsvps.find({}).sort({ _id: 1 }).lean();
  return { events: rows.length, legacyRegistrations: registrations.length,
    legacyCoverReferences: rows.filter(row => row.imageUrl).length,
    eventTypeAndCoverDigest: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    legacyRegistrationDigest: createHash('sha256').update(JSON.stringify(registrations)).digest('hex') };
}
async function migrateActivities({ service = activityService, apply = false } = {}) {
  const before = await evidence(service);
  const candidates = await service.events.find({ registrationSchemaVersion: { $ne: 1 } }).select('_id').lean();
  // Resolve legacy duplicates and storage limits for all events before any write.
  for (const row of candidates) { const raw = await service.rawEvent(row._id); service.assertLedgerSize(await service.legacyLedger(raw)); }
  if (apply) {
    for (const row of candidates) await service.initializeEvent(row._id);
    await service.events.createIndexes();
  }
  const after = await evidence(service);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Migration preservation check failed; original events/type/cover/RSVP evidence changed.');
  return { mode: apply ? 'APPLIED' : 'DRY_RUN', before, after, eventsToInitialize: candidates.length,
    initialized: apply ? candidates.length : 0,
    indexes: apply ? (await service.events.collection.indexes()).map(index => index.name) : [],
    rollback: 'Only imported, untouched ledgers can be removed; after V2 writes rollback refuses data loss. Preserve/export V2 state before application rollback.' };
}
async function rollbackActivities({ service = activityService, apply = false } = {}) {
  const rows = await service.events.find({ registrationSchemaVersion: 1 }).select('+registrationVersion +activityV2MigrationBackup').lean();
  const blocked = rows.filter(row => !row.activityV2MigrationBackup || row.registrationVersion !== 0);
  if (blocked.length) throw new Error(`Rollback refused: ${blocked.length} event(s) contain V2 writes/new records. No data removed; export and review a forward recovery first.`);
  if (apply) for (const row of rows) {
    const set = row.activityV2MigrationBackup.hadRsvpCount ? { rsvpCount: row.activityV2MigrationBackup.rsvpCount } : {};
    const unset = { registrations: '', registrationVersion: '', registrationSchemaVersion: '', activityV2MigrationBackup: '' };
    if (!row.activityV2MigrationBackup.hadRsvpCount) unset.rsvpCount = '';
    if (row.activityV2MigrationBackup.hadApprovedCount) set.approvedCount = row.activityV2MigrationBackup.approvedCount;
    else unset.approvedCount = '';
    const changed = await service.events.updateOne({ _id: row._id, registrationVersion: 0, registrationSchemaVersion: 1 }, { $set: set, $unset: unset }, { timestamps: false });
    if (!changed.matchedCount) throw new Error('Rollback stopped: concurrent V2 write detected. Already preserved records remain intact.');
  }
  return { mode: apply ? 'ROLLED_BACK' : 'DRY_RUN', untouchedLedgers: rows.length, legacyRSVPsUntouched: true, coversUntouched: true, indexesKept: true };
}
if (require.main === module) {
  (async () => {
    const uri = process.env.ACTIVITY_MIGRATION_MONGO_URI;
    if (!uri) throw new Error('Set ACTIVITY_MIGRATION_MONGO_URI explicitly; production dotenv is never loaded.');
    const local = /^mongodb:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\//.test(uri);
    if (!local && !process.argv.includes('--allow-remote')) throw new Error('Remote migration requires reviewed backup and explicit --allow-remote authorization.');
    await mongoose.connect(uri, { autoIndex: false });
    const fn = process.argv.includes('--rollback') ? rollbackActivities : migrateActivities;
    console.log(JSON.stringify(await fn({ apply: process.argv.includes('--apply') }), null, 2));
  })().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
}
module.exports = { migrateActivities, rollbackActivities, evidence };
