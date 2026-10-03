const CosStorageAdapter = require('./CosStorageAdapter');
const ScfStorageAdapter = require('./ScfStorageAdapter');
const { fail } = require('../../utils/quantificationPolicy');

function createStorageAdapter(env = process.env) {
  const provider = env.OBJECT_STORAGE_PROVIDER || 'cos';
  if (provider === 'scf') return new ScfStorageAdapter(env);
  if (provider === 'cos') return new CosStorageAdapter(env);
  // OSS can be added here without changing routes, models or business logic.
  return { describe: () => ({ provider, configured: false }), credentials: () => fail(503, '当前存储服务尚未接入，请联系管理员。', 'STORAGE_UNSUPPORTED') };
}
module.exports = createStorageAdapter;
