const { ROLES, roleInfo } = require('../utils/roles');
const { memberDto } = require('./RoleAssignmentService');
const fail = message => Object.assign(new Error(message), { status: 400 });
const MEMBERSHIP = ['all', 'enrolled', 'outside', 'pending'];

// Join by student ID rather than email: many students have no contact email.
// The roster remains the source of class membership, and accounts retain their
// independent login/role lifecycle. This view performs no data migration.
function directoryPage(accounts, roster, params = {}) {
  const role = params.role || 'all';
  const membership = params.membership || 'all';
  if (!['all', ...ROLES].includes(role)) throw fail('无效的身份筛选。');
  if (!MEMBERSHIP.includes(membership)) throw fail('无效的名单状态筛选。');
  if (params.search !== undefined && (typeof params.search !== 'string' || params.search.length > 200)) throw fail('搜索内容最多 200 字。');
  const term = (params.search || '').trim().toLocaleLowerCase();
  const byStudentId = new Map(roster.map(entry => [entry.uniqueId, entry]));
  const registeredIds = new Set(accounts.map(user => user.uniqueId));
  const members = accounts.map(account => {
    const entry = byStudentId.get(account.uniqueId);
    return { ...memberDto(account), id: String(account._id), accountId: String(account._id),
      rosterId: entry ? String(entry._id) : null, registered: true, inRoster: Boolean(entry),
      rosterName: entry?.name || '', rosterEmail: entry?.email || '' };
  });
  for (const entry of roster) if (!registeredIds.has(entry.uniqueId)) members.push({
    id: `roster:${entry._id}`, accountId: null, rosterId: String(entry._id),
    name: entry.name, email: entry.email || '', uniqueId: entry.uniqueId,
    ...roleInfo({ role: 'student' }), registered: false, inRoster: true,
    isVerified: false, isEnrolled: false, lastActive: null, createdAt: null, hasAvatar: false,
    rosterName: entry.name, rosterEmail: entry.email || '',
  });
  const registeredRoster = roster.filter(entry => registeredIds.has(entry.uniqueId)).length;
  const summary = { total: members.length, accounts: accounts.length, roster: roster.length,
    registeredRoster, pending: roster.length - registeredRoster,
    outside: accounts.filter(account => !byStudentId.has(account.uniqueId)).length };
  const filtered = members.filter(member => (role === 'all' || member.role === role) &&
    (membership === 'all' || membership === 'enrolled' && member.inRoster ||
      membership === 'outside' && !member.inRoster || membership === 'pending' && !member.registered) &&
    (!term || [member.name, member.email, member.uniqueId, member.rosterName, member.rosterEmail]
      .some(value => String(value || '').toLocaleLowerCase().includes(term))))
    .sort((a, b) => a.uniqueId.localeCompare(b.uniqueId, 'zh-CN', { numeric: true }) || a.id.localeCompare(b.id));
  const limit = Math.min(100, Math.max(1, parseInt(params.limit, 10) || 20));
  const total = filtered.length, pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(pages, Math.max(1, parseInt(params.page, 10) || 1));
  return { success: true, members: filtered.slice((page - 1) * limit, page * limit), summary,
    pagination: { page, limit, total, pages } };
}
class MemberDirectoryService {
  constructor({ UserModel = require('../models/User'), RosterModel = require('../models/EnrolledUser') } = {}) {
    this.users = UserModel; this.roster = RosterModel;
  }
  async list(params) {
    const [accounts, roster] = await Promise.all([
      this.users.find({}).select('name email uniqueId role isAdmin isVerified isEnrolled lastActive createdAt profile.avatar.contentType').lean(),
      this.roster.find({}).select('name email uniqueId').lean(),
    ]);
    return directoryPage(accounts, roster, params);
  }
}
module.exports = { directoryPage, MemberDirectoryService };
