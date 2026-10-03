const bcrypt = require('bcryptjs');
const { normalizeEntry, validateEntries, error } = require('../utils/rosterPolicy');

class RosterService {
  constructor({ UserModel = require('../models/User'), RosterModel = require('../models/EnrolledUser'), hashPassword = password => bcrypt.hash(password, 10) } = {}) {
    this.users = UserModel; this.roster = RosterModel; this.hashPassword = hashPassword;
  }
  async inspect(input) {
    const entry = normalizeEntry(input);
    const [account, existing] = await Promise.all([this.users.findOne({ uniqueId: entry.uniqueId }), this.roster.findOne({ uniqueId: entry.uniqueId })]);
    if (entry.email) {
      const owners = await Promise.all([this.users.findOne({ email: entry.email }), this.roster.findOne({ email: entry.email })]);
      if (owners.some(owner => owner && owner.uniqueId !== entry.uniqueId)) throw error('联系邮箱已被其他学号使用，请核对名单。', 409);
    }
    return { entry, account, existing };
  }
  async upsert(input, { dryRun = false } = {}) {
    let { entry, account, existing } = await this.inspect(input);
    let accountCreated = false;
    if (dryRun) return { action: existing ? 'updated' : 'created', accountCreated: !account };
    if (!account) {
      try {
        account = await this.users.create({ ...entry, passwordHash: await this.hashPassword(entry.uniqueId), isEnrolled: true, isAdmin: false });
        accountCreated = true;
      } catch (e) {
        if (e.code !== 11000) throw e;
        account = await this.users.findOne({ uniqueId: entry.uniqueId });
        if (!account) throw error('学号或联系邮箱已被使用，请核对名单。', 409);
      }
    }
    // Reimports preserve existing passwords, token versions, roles and profiles.
    if (account.isEnrolled !== true) await this.users.updateOne({ _id: account._id }, { $set: { isEnrolled: true } });
    const row = await this.roster.findOneAndUpdate({ uniqueId: entry.uniqueId }, { $set: entry }, { upsert: true, new: true, runValidators: true });
    return { action: existing ? 'updated' : 'created', accountCreated, entry: { id: row._id, uniqueId: row.uniqueId, name: row.name, email: row.email || '' } };
  }
  async import(input, options = {}) {
    const entries = validateEntries(input);
    // Resolve conflicts before creating any accounts.
    for (const entry of entries) await this.inspect(entry);
    const result = { created: 0, updated: 0, accountsCreated: 0, accountsExisting: 0, failed: 0, errors: [] };
    for (const [index, entry] of entries.entries()) {
      try {
        const saved = await this.upsert(entry, options);
        result[saved.action]++;
        result[saved.accountCreated ? 'accountsCreated' : 'accountsExisting']++;
      } catch (e) {
        result.failed++;
        if (result.errors.length < 20) result.errors.push(`第 ${index + 1} 条：${e.status ? e.message : '保存失败，请稍后重试。'}`);
      }
    }
    result.total = await this.roster.countDocuments({});
    return result;
  }
}

module.exports = RosterService;
