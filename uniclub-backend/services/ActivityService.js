const mongoose = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');
const Roster = require('../models/EnrolledUser');
const RSVP = require('../models/EventRSVP');
const policy = require('../utils/activityPolicy');
const LEDGER_SELECT = '+registrations +registrationVersion +registrationSchemaVersion +activityV2MigrationBackup +mediaRefs +mediaTombstones';
const same = (a, b) => String(a) === String(b);
const oid = value => {
  if (!/^[a-fA-F0-9]{24}$/.test(String(value)) || !mongoose.Types.ObjectId.isValid(value)) throw policy.fail('活动或成员 ID 无效。', 400, 'INVALID_ID');
  return new mongoose.Types.ObjectId(String(value));
};
const plain = value => value?.toObject ? value.toObject() : value;
function registrationDTO(row) {
  if (!row) return null;
  return { id: String(row._id), userId: String(row.userId), name: row.name, status: row.status,
    version: row.version, createdAt: row.createdAt, updatedAt: row.updatedAt,
    reviewedBy: row.reviewedBy ? String(row.reviewedBy) : null, reviewedAt: row.reviewedAt || null,
    reviewNote: row.reviewNote || '', legacyStatus: row.legacyStatus || null };
}
function eventDTO(raw, { admin = false, now = new Date() } = {}) {
  const event = plain(raw);
  const rule = policy.registrationRule(event, now);
  const dto = {};
  for (const key of ['title', 'description', 'startDate', 'endDate', 'location', 'eventType', 'category', 'status',
    'maxCapacity', 'rsvpDeadline', 'rsvpLink', 'prerequisites', 'tags', 'skillLevel', 'summary',
    'createdAt', 'updatedAt', 'archivedAt', 'likes', 'shares', 'saves', 'comments', 'rsvpCount', 'attendedCount']) dto[key] = event[key];
  dto._id = String(event._id); dto.id = dto._id;
  dto.eventTypeLabel = policy.typeLabel(event.eventType);
  dto.phase = policy.phaseOf(event, now); dto.registrationOpen = !rule; dto.registrationClosedReason = rule;
  dto.cancellationOpen = !event.deletedAt && event.status === 'published' && dto.phase !== 'ENDED';
  dto.cancellationClosedReason = dto.cancellationOpen ? null : '活动已关闭，历史报名不可取消。';
  dto.approvedCount = Number.isInteger(event.approvedCount) ? event.approvedCount : null;
  dto.imageUrl = event.legacyCoverHidden ? null : event.imageUrl || null;
  dto.coverUrl = dto.imageUrl;
  const organizer = event.organizer;
  dto.organizer = organizer?.name ? { _id: String(organizer._id), name: organizer.name } : { _id: String(organizer || ''), name: '' };
  dto.likeCount = event.likes || 0; dto.shareCount = event.shares || 0; dto.saveCount = event.saves || 0;
  dto.commentCount = event.comments || 0; dto.discussionCount = dto.commentCount;
  if (admin) { dto.deletedAt = event.deletedAt || null; dto.mediaVersion = event.mediaVersion || 0; dto.legacyEventType = event.legacyEventType || null; }
  return dto;
}
class ActivityService {
  constructor({ EventModel = Event, UserModel = User, RosterModel = Roster, RSVPModel = RSVP, now = () => new Date() } = {}) {
    this.events = EventModel; this.users = UserModel; this.roster = RosterModel; this.rsvps = RSVPModel; this.now = now;
  }
  async account(userId, { admin = false, member = false } = {}) {
    const account = await this.users.findById(oid(userId)).select('name uniqueId isAdmin isEnrolled profile.avatar.contentType').lean();
    if (!account) throw policy.fail('登录账号不存在。', 401, 'ACCOUNT_UNAVAILABLE');
    if (admin && account.isAdmin !== true) throw policy.fail('需要管理员权限。', 403, 'ADMIN_REQUIRED');
    if (member || account.isAdmin !== true) {
      const belongs = account.isEnrolled === true && !!await this.roster.exists({ uniqueId: account.uniqueId });
      if (!belongs) throw policy.fail('仅当前班级成员可以访问活动。', 403, 'MEMBERSHIP_REQUIRED');
    }
    return account;
  }
  async rawEvent(id) {
    const event = await this.events.findById(oid(id)).select(LEDGER_SELECT).populate('organizer', 'name').lean();
    if (!event) throw policy.fail('找不到活动。', 404, 'NOT_FOUND');
    return event;
  }
  async readableEvent(id, userId) {
    const account = await this.account(userId);
    const event = await this.rawEvent(id);
    if (account.isAdmin !== true && (event.deletedAt || (event.status !== 'published' && !(['completed', 'archived'].includes(event.status) && policy.phaseOf(event, this.now()) === 'ENDED')))) throw policy.fail('找不到已公开活动。', 404, 'NOT_FOUND');
    if (event.registrationSchemaVersion !== 1) {
      const ledger = await this.legacyLedger(event);
      event.approvedCount = ledger.filter(row => row.status === 'APPROVED').length;
      event.rsvpCount = ledger.filter(row => ['PENDING', 'APPROVED'].includes(row.status)).length;
    }
    return event;
  }
  async legacyLedger(event) {
    if (event.registrationSchemaVersion === 1) return event.registrations || [];
    const legacy = await this.rsvps.find({ event: event._id }).sort({ createdAt: 1 }).lean();
    const ids = [...new Set(legacy.map(row => String(row.user)))];
    const users = await this.users.find({ _id: { $in: ids } }).select('_id name').lean();
    const names = new Map(users.map(user => [String(user._id), user.name]));
    const ledger = new Map();
    for (const row of legacy) {
      const key = String(row.user); const at = row.createdAt || event.createdAt || this.now();
      if (ledger.has(key)) throw policy.fail('历史报名存在重复用户，请先人工核对；原数据未修改。', 409, 'LEGACY_DUPLICATES');
      ledger.set(key, { _id: row._id, userId: row.user, name: names.get(key) || '历史成员（账号已移除）',
        status: policy.meta.legacyRegistrationMap[row.status] || 'PENDING', legacyStatus: row.status,
        version: 1, createdAt: at, updatedAt: row.updatedAt || at, reviewedBy: null, reviewedAt: null, reviewNote: '',
        checkedInAt: row.checkedInAt || null, history: [{ status: row.status, actorId: row.user, at, note: '历史 RSVP 兼容导入；原记录保留，未补造审核。' }] });
    }
    return [...ledger.values()];
  }
  async initializeEvent(id) {
    const event = await this.rawEvent(id);
    if (event.registrationSchemaVersion === 1) return event;
    const ledger = await this.legacyLedger(event); this.assertLedgerSize(ledger);
    await this.events.updateOne({ _id: event._id, registrationSchemaVersion: { $ne: 1 } }, {
      $set: { registrations: ledger, registrationSchemaVersion: 1, registrationVersion: 0,
        rsvpCount: ledger.filter(row => ['PENDING', 'APPROVED'].includes(row.status)).length,
        approvedCount: ledger.filter(row => row.status === 'APPROVED').length,
        activityV2MigrationBackup: { rsvpCount: event.rsvpCount ?? 0, hadRsvpCount: Object.hasOwn(event, 'rsvpCount'), approvedCount: event.approvedCount, hadApprovedCount: Object.hasOwn(event, 'approvedCount'), initializedAt: this.now() } },
    }, { timestamps: false });
    return this.rawEvent(id);
  }
  assertLedgerSize(ledger) {
    if (ledger.length > 2000 || Buffer.byteLength(JSON.stringify(ledger)) > 6 * 1024 * 1024) throw policy.fail('该活动报名档案已达到安全存储上限，请联系维护管理员。', 409, 'LEDGER_LIMIT');
  }
  async mutate(id, operation) {
    await this.initializeEvent(id);
    for (let attempt = 0; attempt < 30; attempt++) {
      const event = await this.rawEvent(id);
      const result = await operation(event);
      if (result.noop) return { event, ...result };
      const updates = { ...result.updates };
      if (result.ledger) {
        this.assertLedgerSize(result.ledger); updates.registrations = result.ledger;
        updates.rsvpCount = result.ledger.filter(row => ['PENDING', 'APPROVED'].includes(row.status)).length;
        updates.approvedCount = result.ledger.filter(row => row.status === 'APPROVED').length;
      }
      const saved = await this.events.findOneAndUpdate({ _id: event._id, registrationVersion: event.registrationVersion || 0 }, {
        $set: { ...updates, updatedAt: this.now() }, $inc: { registrationVersion: 1 },
      }, { new: true, runValidators: true }).select(LEDGER_SELECT).populate('organizer', 'name').lean();
      if (saved) return { event: saved, ...result };
    }
    throw policy.fail('活动正在被其他管理员更新，请刷新后重试。', 409, 'VERSION_CONFLICT');
  }
  async list(userId, query = {}, { admin = false } = {}) {
    const account = await this.account(userId, { admin });
    if (!admin && query.status && !['all', 'published', 'completed', 'archived'].includes(query.status)) {
      if (!account.isAdmin) throw policy.fail('需要管理员权限。', 403, 'ADMIN_REQUIRED');
      admin = true;
    }
    const now = this.now(); const { page, limit, skip } = policy.paginationOf(query);
    const base = admin ? (query.includeDeleted === 'true' ? {} : { deletedAt: null }) : policy.publicFilter(now);
    const and = [base]; const view = query.view || (query.upcoming === 'false' ? 'calendar' : 'upcoming');
    if (!admin || query.view) {
      if (!['upcoming', 'ongoing', 'past', 'calendar'].includes(view)) throw policy.fail('活动视图无效。');
      if (view === 'upcoming') and.push({ startDate: { $gt: now } });
      if (view === 'ongoing') and.push({ startDate: { $lte: now }, endDate: { $gt: now } });
      if (view === 'past') and.push({ endDate: { $lte: now } });
    }
    if (query.status && query.status !== 'all') {
      if (!admin && !['published', 'completed', 'archived'].includes(query.status)) throw policy.fail('需要管理员权限。', 403, 'ADMIN_REQUIRED');
      if (!policy.meta.statuses.includes(query.status)) throw policy.fail('活动状态无效。');
      and.push({ status: query.status });
    }
    const type = query.eventType || query.type;
    if (type) { if (typeof type !== 'string' || type.length > 100) throw policy.fail('活动类型无效。'); and.push({ eventType: type }); }
    if (query.year) {
      const year = Number(query.year);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) throw policy.fail('年份无效。');
      and.push({ startDate: { $gte: new Date(`${year}-01-01T00:00:00+08:00`), $lt: new Date(`${year + 1}-01-01T00:00:00+08:00`) } });
    }
    if (query.from || query.to) {
      if (!query.from || !query.to || !Number.isFinite(new Date(query.from).getTime()) || !Number.isFinite(new Date(query.to).getTime()) || new Date(query.to) <= new Date(query.from) || new Date(query.to) - new Date(query.from) > 370 * 86400000) throw policy.fail('日历时间范围无效。');
      and.push({ startDate: { $lt: new Date(query.to) }, endDate: { $gte: new Date(query.from) } });
    }
    if (query.search) {
      if (typeof query.search !== 'string' || query.search.length > 200) throw policy.fail('搜索词不能超过 200 字。');
      const regex = new RegExp(policy.escapeRegex(query.search), 'i'); and.push({ $or: [{ title: regex }, { description: regex }] });
    }
    const filter = { $and: and };
    const [events, total, facets] = await Promise.all([
      this.events.find(filter).select('+mediaRefs').populate('organizer', 'name').sort(query.sort === 'latest' ? { createdAt: -1, _id: -1 } : admin || view === 'past' ? { startDate: -1, _id: -1 } : { startDate: 1, _id: 1 }).skip(skip).limit(limit).lean(),
      this.events.countDocuments(filter),
      this.events.aggregate([{ $match: base }, { $group: { _id: null, years: { $addToSet: { $year: { date: '$startDate', timezone: 'Asia/Shanghai' } } }, types: { $addToSet: '$eventType' } } }]),
    ]);
    const encountered = facets[0]?.types || [];
    const result = { success: true, events: events.map(event => eventDTO(event, { admin, now })), pagination: policy.paged(page, limit, total),
      years: (facets[0]?.years || []).sort((a, b) => b - a),
      types: [...policy.meta.types, ...encountered.filter(type => !policy.canonicalTypes.includes(type)).map(value => ({ value, label: policy.typeLabel(value), legacy: true }))] };
    Object.defineProperty(result, 'rawEvents', { value: events, enumerable: false });
    return result;
  }
  async create(body, userId) {
    await this.account(userId, { admin: true });
    const data = policy.validateInput(body);
    const event = await this.events.create({ ...data, organizer: oid(userId), status: data.status || 'draft', rsvpDeadline: data.rsvpDeadline ?? null, registrationSchemaVersion: 1 });
    return this.rawEvent(event._id);
  }
  async update(id, body, userId) {
    await this.account(userId, { admin: true });
    const { event } = await this.mutate(id, event => {
      if (event.deletedAt) throw policy.fail('请先恢复已隐藏活动。', 409, 'ACTIVITY_HIDDEN');
      const updates = policy.validateInput(body, event);
      if (updates.eventType && updates.eventType !== event.eventType && !policy.canonicalTypes.includes(event.eventType)) updates.legacyEventType = event.legacyEventType || event.eventType;
      if (!Object.keys(updates).length) throw policy.fail('没有可修改的活动字段。');
      const capacity = Object.hasOwn(updates, 'maxCapacity') ? updates.maxCapacity : event.maxCapacity;
      const approved = (event.registrations || []).filter(row => row.status === 'APPROVED').length;
      if (capacity != null && capacity < approved) throw policy.fail('人数限制不能少于已通过人数。', 409, 'CAPACITY_TOO_LOW');
      if (updates.status === 'completed' || updates.status === 'archived') {
        if (policy.phaseOf({ ...event, ...updates }, this.now()) !== 'ENDED') throw policy.fail('活动结束后才可标记完成或归档。', 409, 'ACTIVITY_NOT_ENDED');
        if (updates.status === 'archived') updates.archivedAt = this.now();
      }
      return { updates };
    });
    return event;
  }
  async mine(id, userId) {
    const event = await this.readableEvent(id, userId);
    return registrationDTO((await this.legacyLedger(event)).find(row => same(row.userId, userId)));
  }
  async apply(id, userId) {
    const account = await this.account(userId, { member: true });
    const readable = await this.readableEvent(id, userId);
    const closed = policy.registrationRule(readable, this.now());
    if (closed) throw policy.fail(closed, 409, 'REGISTRATION_CLOSED');
    const result = await this.mutate(id, event => {
      const closed = policy.registrationRule(event, this.now()); if (closed) throw policy.fail(closed, 409, 'REGISTRATION_CLOSED');
      const ledger = event.registrations || []; const existing = ledger.find(row => same(row.userId, userId));
      if (existing && ['PENDING', 'APPROVED'].includes(existing.status)) return { noop: true, row: existing };
      const at = this.now();
      const row = existing ? { ...existing, name: account.name, status: 'PENDING', version: existing.version + 1, updatedAt: at, reviewedBy: null, reviewedAt: null, reviewNote: '',
        history: [...(existing.history || []), { status: 'PENDING', actorId: oid(userId), at, note: '重新申请' }] } : {
        _id: new mongoose.Types.ObjectId(), userId: oid(userId), name: account.name, status: 'PENDING', version: 1, createdAt: at, updatedAt: at,
        reviewedBy: null, reviewedAt: null, reviewNote: '', legacyStatus: null, history: [{ status: 'PENDING', actorId: oid(userId), at, note: '提交报名' }],
      };
      return { ledger: existing ? ledger.map(item => same(item.userId, userId) ? row : item) : [...ledger, row], row };
    });
    return registrationDTO(result.row);
  }
  async cancel(id, userId) {
    await this.account(userId, { member: true });
    const result = await this.mutate(id, event => {
      const row = event.registrations.find(row => same(row.userId, userId));
      if (!row || row.status === 'CANCELLED') return { noop: true, row: row || null };
      if (event.deletedAt || event.status !== 'published' || policy.phaseOf(event, this.now()) === 'ENDED') throw policy.fail('活动已关闭，历史报名不可取消。', 409, 'REGISTRATION_CLOSED');
      const at = this.now(); const next = { ...row, status: 'CANCELLED', version: row.version + 1, updatedAt: at,
        history: [...(row.history || []), { status: 'CANCELLED', actorId: oid(userId), at, note: '本人取消报名' }] };
      return { ledger: event.registrations.map(item => same(item.userId, userId) ? next : item), row: next };
    });
    return registrationDTO(result.row);
  }
  async review(id, userId, body, adminId) {
    await this.account(adminId, { admin: true }); oid(userId); const input = policy.reviewInput(body);
    const result = await this.mutate(id, event => {
      if (event.deletedAt) throw policy.fail('已隐藏活动不可审核。', 409, 'ACTIVITY_HIDDEN');
      const row = event.registrations.find(row => same(row.userId, userId));
      if (!row) throw policy.fail('找不到报名记录。', 404, 'NOT_FOUND');
      // A retried response after a successful transition keeps actor/time unchanged.
      if (row.status === input.status && row.version === input.version + 1) return { noop: true, row };
      if (row.version !== input.version || row.status !== 'PENDING') throw policy.fail('报名已发生变化，请刷新后审核。', 409, 'VERSION_CONFLICT');
      if (input.status === 'APPROVED') {
        if (event.status !== 'published' || policy.phaseOf(event, this.now()) === 'ENDED') throw policy.fail('仅可批准仍在开展的已发布活动报名。', 409, 'REGISTRATION_CLOSED');
        const count = event.registrations.filter(item => item.status === 'APPROVED').length;
        if (event.maxCapacity != null && count >= event.maxCapacity) throw policy.fail('已通过人数已达到活动上限。', 409, 'CAPACITY_FULL');
      }
      const at = this.now(); const next = { ...row, status: input.status, version: row.version + 1, updatedAt: at,
        reviewedBy: oid(adminId), reviewedAt: at, reviewNote: input.note,
        history: [...(row.history || []), { status: input.status, actorId: oid(adminId), at, note: input.note }] };
      return { ledger: event.registrations.map(item => same(item.userId, userId) ? next : item), row: next };
    });
    return registrationDTO(result.row);
  }
  async memberRows(id, adminId) {
    await this.account(adminId, { admin: true });
    const event = await this.rawEvent(id); const ledger = await this.legacyLedger(event);
    const roster = await this.roster.find({}).select('_id name uniqueId').lean();
    const users = await this.users.find({ uniqueId: { $in: roster.map(row => row.uniqueId) }, isEnrolled: true }).select('_id name uniqueId profile.avatar.contentType').lean();
    const byStudent = new Map(users.map(user => [user.uniqueId, user]));
    const byUser = new Map(ledger.map(row => [String(row.userId), row]));
    const seen = new Set(); const members = [];
    for (const row of roster) {
      const user = byStudent.get(row.uniqueId); const key = user ? String(user._id) : `roster:${row._id}`;
      if (seen.has(key)) continue; seen.add(key);
      const registration = user ? byUser.get(String(user._id)) : null;
      members.push({ id: key, userId: user ? String(user._id) : null, name: user?.name || row.name, uniqueId: row.uniqueId,
        avatar: user?.profile?.avatar?.contentType ? `/api/users/avatar/${user._id}` : null,
        status: registration?.status || 'UNREGISTERED', registration: registrationDTO(registration), currentMember: true });
    }
    // Departed / deleted accounts stay readable as historical applications.
    for (const registration of ledger) if (!seen.has(String(registration.userId))) members.push({
      id: String(registration.userId), userId: String(registration.userId), name: registration.name, avatar: null,
      status: registration.status, registration: registrationDTO(registration), currentMember: false,
    });
    const current = members.filter(row => row.currentMember);
    const count = status => ledger.filter(row => row.status === status).length;
    const stats = { totalMembers: current.length, registered: ledger.filter(row => row.status !== 'CANCELLED').length,
      pending: count('PENDING'), approved: count('APPROVED'), rejected: count('REJECTED'), cancelled: count('CANCELLED'),
      unregistered: current.filter(row => row.status === 'UNREGISTERED').length };
    return { event, members, stats };
  }
  async registrations(id, adminId, query = {}) {
    const data = await this.memberRows(id, adminId); const { page, limit, skip } = policy.paginationOf(query);
    const filter = query.filter || 'all';
    const valid = ['all', 'registered', 'pending', 'approved', 'rejected', 'cancelled', 'unregistered'];
    if (!valid.includes(filter)) throw policy.fail('报名筛选无效。');
    if (query.search && (typeof query.search !== 'string' || query.search.length > 100)) throw policy.fail('姓名搜索不能超过 100 字。');
    const keyword = String(query.search || '').toLocaleLowerCase();
    const filtered = data.members.filter(row => (filter === 'all' || (filter === 'registered' ? !!row.registration && row.status !== 'CANCELLED' : row.status.toLowerCase() === filter)) && row.name.toLocaleLowerCase().includes(keyword));
    return { success: true, members: filtered.slice(skip, skip + limit), stats: data.stats, pagination: policy.paged(page, limit, filtered.length) };
  }
  async bulkReview(id, body, adminId) {
    await this.account(adminId, { admin: true });
    if (!body || !['APPROVED', 'REJECTED'].includes(body.status) || !Array.isArray(body.registrations) || !body.registrations.length || body.registrations.length > 100) throw policy.fail('批量审核每次须为 1–100 条。');
    const seen = new Set(); for (const row of body.registrations) { oid(row.userId); policy.reviewInput({ ...row, status: body.status, note: body.note }); if (seen.has(String(row.userId))) throw policy.fail('批量审核不能包含重复成员。'); seen.add(String(row.userId)); }
    const results = [];
    for (const row of body.registrations) {
      try { results.push({ userId: row.userId, success: true, rsvp: await this.review(id, row.userId, { ...row, status: body.status, note: body.note }, adminId) }); }
      catch (error) { if (!error.status) throw error; results.push({ userId: row.userId, success: false, error: error.message, code: error.code }); }
    }
    const { stats } = await this.memberRows(id, adminId);
    return { success: true, results, stats, succeeded: results.filter(row => row.success).length, failed: results.filter(row => !row.success).length };
  }
  async summary(id, body, adminId) {
    await this.account(adminId, { admin: true });
    if (!body || Object.keys(body).some(key => key !== 'summary') || typeof body.summary !== 'string' || body.summary.length > 10000) throw policy.fail('活动总结不能超过 10000 字。');
    const { event } = await this.mutate(id, event => {
      if (event.deletedAt) throw policy.fail('请先恢复已隐藏活动。', 409, 'ACTIVITY_HIDDEN');
      return { updates: { summary: body.summary } };
    }); return event;
  }
  async archive(id, adminId) {
    await this.account(adminId, { admin: true });
    const { event } = await this.mutate(id, event => {
      if (event.deletedAt) throw policy.fail('请先恢复已隐藏活动。', 409, 'ACTIVITY_HIDDEN');
      if (event.status === 'draft' || event.status === 'cancelled') throw policy.fail('草稿或取消活动不能作为公开档案归档。', 409, 'INVALID_TRANSITION');
      if (policy.phaseOf(event, this.now()) !== 'ENDED') throw policy.fail('活动结束后才可归档。', 409, 'ACTIVITY_NOT_ENDED');
      if (event.status === 'archived') return { noop: true };
      return { updates: { status: 'archived', archivedAt: this.now() } };
    }); return event;
  }
  async hide(id, adminId, restore = false) {
    await this.account(adminId, { admin: true });
    const { event } = await this.mutate(id, event => ({ updates: { deletedAt: restore ? null : event.deletedAt || this.now(), deletedBy: restore ? null : oid(adminId) } })); return event;
  }
}
const activityService = new ActivityService();
module.exports = { ActivityService, activityService, eventDTO, registrationDTO, LEDGER_SELECT };
