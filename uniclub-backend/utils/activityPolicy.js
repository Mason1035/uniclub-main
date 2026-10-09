const meta = require('../../shared/activity-v2.json');
const { eventFields, pickFields } = require('./contentPolicy');
const { escapeRegex, paginationOf, paged } = require('../routes/admin/_shared');
const canonicalTypes = meta.types.map(item => item.value);
const fail = (message, status = 400, code = 'INVALID_ACTIVITY') => Object.assign(new Error(message), { status, code });
const phaseOf = (event, now = new Date()) => now >= new Date(event.endDate) ? 'ENDED' : now >= new Date(event.startDate) ? 'ONGOING' : 'UPCOMING';
const registrationRule = (event, now = new Date()) => {
  if (event.deletedAt) return '活动已隐藏。';
  if (event.status !== 'published') return event.status === 'cancelled' ? '活动已取消。' : '活动当前不接受报名。';
  if (now >= new Date(event.endDate)) return '活动已结束，报名已关闭。';
  if (event.rsvpDeadline && now >= new Date(event.rsvpDeadline)) return '报名截止时间已过。';
  return null;
};
const publicFilter = (now = new Date()) => ({ deletedAt: null, $or: [
  { status: 'published' }, { status: { $in: ['completed', 'archived'] }, endDate: { $lte: now } },
] });
const typeLabel = value => [...meta.types, ...meta.legacyTypes].find(type => type.value === value)?.label || `${value}（历史分类）`;
function validateInput(body, previous = null) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail('请提交活动基本信息。');
  const forbidden = ['registrations', 'registrationVersion', 'registrationSchemaVersion', 'rsvpCount', 'approvedCount', 'legacyEventType', 'organizer', 'coverMediaId', 'mediaVersion', 'deletedAt', 'deletedBy', 'summary'];
  if (forbidden.some(field => Object.hasOwn(body, field))) throw fail('包含由服务器管理的字段。');
  const updates = pickFields(body, eventFields.filter(field => field !== 'imageUrl'));
  if (body.imageUrl !== undefined && body.imageUrl !== (previous?.imageUrl || '')) throw fail('请使用活动封面上传功能。');
  if (Object.hasOwn(body, 'status')) updates.status = body.status;
  const merged = { ...previous, ...updates };
  if (!previous || Object.hasOwn(updates, 'title')) {
    if (typeof merged.title !== 'string' || !merged.title.trim() || merged.title.trim().length > 200) throw fail('活动标题须为 1–200 字。');
    updates.title = merged.title.trim();
  }
  if (!previous || Object.hasOwn(updates, 'description')) {
    if (typeof merged.description !== 'string' || !merged.description.trim() || merged.description.length > 2000) throw fail('活动介绍须为 1–2000 字。');
  }
  if (!previous || Object.hasOwn(updates, 'eventType')) {
    if (!canonicalTypes.includes(merged.eventType)) {
      if (previous && merged.eventType === previous.eventType) delete updates.eventType;
      else throw fail('请选择团活动、团建、班会、小组交流或其他。', 400, 'INVALID_TYPE');
    }
  }
  if (merged.status && !meta.statuses.includes(merged.status)) throw fail('活动状态无效。');
  for (const field of ['startDate', 'endDate']) {
    if (!merged[field] || !Number.isFinite(new Date(merged[field]).getTime())) throw fail('活动开始及结束时间必须有效。');
    if (Object.hasOwn(updates, field)) updates[field] = new Date(merged[field]);
  }
  if (new Date(merged.endDate) <= new Date(merged.startDate)) throw fail('结束时间必须晚于开始时间。');
  if (merged.rsvpDeadline != null) {
    if (!Number.isFinite(new Date(merged.rsvpDeadline).getTime())) throw fail('报名截止时间无效。');
    if (new Date(merged.rsvpDeadline) > new Date(merged.endDate)) throw fail('报名截止时间不能晚于活动结束。');
    if (Object.hasOwn(updates, 'rsvpDeadline')) updates.rsvpDeadline = new Date(merged.rsvpDeadline);
  }
  if (merged.maxCapacity != null && (!Number.isInteger(merged.maxCapacity) || merged.maxCapacity < 1 || merged.maxCapacity > 2000)) throw fail('人数限制须为 1–2000 的整数或不限。');
  if (!merged.location || !['physical', 'virtual', 'hybrid'].includes(merged.location.type)) throw fail('请选择有效举办形式。');
  for (const field of ['address', 'room', 'virtualLink']) if (merged.location[field] != null && (typeof merged.location[field] !== 'string' || merged.location[field].length > 2000)) throw fail('活动地点或链接无效。');
  if (merged.location.type !== 'virtual' && !merged.location.address?.trim()) throw fail('线下活动需填写地址。');
  if (merged.location.type !== 'physical' && !validUrl(merged.location.virtualLink)) throw fail('线上活动需填写 http/https 链接。');
  if (merged.rsvpLink && !validUrl(merged.rsvpLink)) throw fail('外部报名链接须为 http/https 地址。');
  return updates;
}
function validUrl(value) { try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; } }
function reviewInput(body) {
  if (!body || !['APPROVED', 'REJECTED'].includes(body.status) || !Number.isInteger(body.version) || body.version < 1) throw fail('审核须提交结果和当前报名版本。');
  if (body.note != null && (typeof body.note !== 'string' || body.note.length > 500)) throw fail('审核说明不能超过 500 字。');
  return { status: body.status, version: body.version, note: body.note?.trim() || '' };
}
module.exports = { meta, canonicalTypes, fail, phaseOf, registrationRule, publicFilter, typeLabel, validateInput, reviewInput, validUrl, escapeRegex, paginationOf, paged };
