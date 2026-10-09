const express = require('express');
const rateLimit = require('express-rate-limit');
const authenticateToken = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');
const { activityService, eventDTO } = require('../services/ActivityService');
const { fail } = require('../utils/activityPolicy');
function createEventRouter({ service = activityService, mediaService, mediaRouter } = {}) {
  const router = express.Router();
  // No public or role-claim bypass: every event surface verifies a live account.
  router.use(authenticateToken);
  const writes = rateLimit({ windowMs: 60000, max: 60, keyGenerator: req => req.user.userId,
    handler: (req, res) => res.status(429).json({ error: '操作过于频繁，请稍后重试。', code: 'RATE_LIMITED' }), standardHeaders: true, legacyHeaders: false });
  const wrap = handler => async (req, res) => {
    try { await handler(req, res); }
    catch (error) {
      const status = error.status || (['ValidationError', 'CastError'].includes(error.name) ? 400 : 503);
      res.status(status).json({ success: false, error: error.status ? error.message : status === 400 ? '活动信息不符合要求。' : '活动服务暂时不可用，请稍后重试。', code: error.code || (status === 400 ? 'INVALID_ACTIVITY' : 'ACTIVITY_UNAVAILABLE') });
    }
  };
  const shape = async (raw, userId, admin = false) => {
    const dto = eventDTO(raw, { admin, now: service.now() });
    const media = mediaService === undefined ? require('../services/ActivityMediaService').activityMediaService : mediaService;
    return media ? media.decorateEvent(dto, raw, userId, { thumbnail: true }) : dto;
  };
  router.use(mediaRouter === undefined ? require('./activityMediaRouter') : mediaRouter);
  router.get('/', wrap(async (req, res) => {
    const data = await service.list(req.user.userId, req.query);
    // List metadata stays small. Media URLs are based on the already authorized
    // event rows; album originals are only requested from the media endpoint.
    if (mediaService !== null) {
      const media = mediaService === undefined ? require('../services/ActivityMediaService').activityMediaService : mediaService;
      if (media) data.events = await Promise.all(data.events.map(async (dto, index) => media.decorateEvent(dto, data.rawEvents[index], req.user.userId, { thumbnail: true })));
    }
    res.json(data);
  }));
  // Preserve existing personal/recommendation route contracts through safe DTOs.
  router.get('/user/mine', wrap(async (req, res) => {
    const account = await service.account(req.user.userId);
    const { paginationOf, paged, publicFilter } = require('../utils/activityPolicy');
    const { page, limit, skip } = paginationOf(req.query);
    const filter = { $and: [account.isAdmin ? { deletedAt: null } : publicFilter(service.now()), {
      $or: [{ organizer: req.user.userId }, { 'registrations.userId': req.user.userId }],
    }] };
    const [rows, total] = await Promise.all([service.events.find(filter).select('+mediaRefs').populate('organizer', 'name').sort({ startDate: -1 }).skip(skip).limit(limit).lean(), service.events.countDocuments(filter)]);
    res.json({ success: true, events: await Promise.all(rows.map(row => shape(row, req.user.userId))), pagination: paged(page, limit, total) });
  }));
  router.get('/user/recommended', wrap(async (req, res) => res.json(await service.list(req.user.userId, { ...req.query, view: 'upcoming', limit: req.query.limit || 10 }))));
  router.post('/', requireAdmin, writes, wrap(async (req, res) => {
    const event = await service.create(req.body, req.user.userId);
    res.status(201).json({ success: true, event: await shape(event, req.user.userId, true) });
  }));
  router.get('/:id/admin', requireAdmin, wrap(async (req, res) => {
    const { event, stats } = await service.memberRows(req.params.id, req.user.userId);
    res.json({ success: true, event: await shape(event, req.user.userId, true), stats });
  }));
  router.get('/:id/registrations', requireAdmin, wrap(async (req, res) => res.json(await service.registrations(req.params.id, req.user.userId, req.query))));
  router.post('/:id/registrations/bulk-review', requireAdmin, writes, wrap(async (req, res) => res.json(await service.bulkReview(req.params.id, req.body, req.user.userId))));
  router.post('/:id/registrations/:userId/review', requireAdmin, writes, wrap(async (req, res) => res.json({ success: true, rsvp: await service.review(req.params.id, req.params.userId, req.body, req.user.userId) })));
  router.put('/:id/summary', requireAdmin, writes, wrap(async (req, res) => res.json({ success: true, event: await shape(await service.summary(req.params.id, req.body, req.user.userId), req.user.userId, true) })));
  router.post('/:id/archive', requireAdmin, writes, wrap(async (req, res) => res.json({ success: true, event: await shape(await service.archive(req.params.id, req.user.userId), req.user.userId, true) })));
  router.post('/:id/restore', requireAdmin, writes, wrap(async (req, res) => res.json({ success: true, event: await shape(await service.hide(req.params.id, req.user.userId, true), req.user.userId, true) })));
  router.get('/:id/rsvp', wrap(async (req, res) => res.json({ success: true, rsvp: await service.mine(req.params.id, req.user.userId) })));
  router.post('/:id/rsvp', writes, wrap(async (req, res) => {
    const body = req.body || {};
    if (Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(key => key !== 'status') || (body.status !== undefined && !['PENDING', 'going'].includes(body.status))) throw fail('请提交报名申请；审核结果由管理员决定。');
    res.json({ success: true, rsvp: await service.apply(req.params.id, req.user.userId) });
  }));
  router.delete('/:id/rsvp', writes, wrap(async (req, res) => res.json({ success: true, rsvp: await service.cancel(req.params.id, req.user.userId), message: '报名已取消，历史记录保留。' })));
  // Legacy list/check-in/calendar URLs remain usable with V2 authorization and
  // state. They never write to the preserved legacy RSVP collection.
  router.get('/:id/attendees', requireAdmin, wrap(async (req, res) => {
    const data = await service.registrations(req.params.id, req.user.userId, { ...req.query, filter: 'approved' });
    res.json({ ...data, attendees: data.members });
  }));
  router.post('/:id/calendar', wrap(async (req, res) => {
    const event = await service.readableEvent(req.params.id, req.user.userId);
    res.json({ success: true, calendarData: { title: event.title, description: event.description, start: event.startDate, end: event.endDate,
      location: event.location.type === 'virtual' ? '线上活动' : [event.location.address, event.location.room].filter(Boolean).join(' · '), attendees: [] } });
  }));
  router.post('/:id/checkin/:userId', requireAdmin, writes, wrap(async (req, res) => {
    const result = await service.mutate(req.params.id, event => {
      const row = event.registrations.find(row => String(row.userId) === req.params.userId);
      if (!row || row.status !== 'APPROVED') throw fail('只有已通过报名可以签到。', 409, 'NOT_APPROVED');
      if (row.checkedInAt) return { noop: true, row };
      const at = service.now(); const next = { ...row, checkedInAt: at, version: row.version + 1, updatedAt: at,
        history: [...row.history, { status: row.status, actorId: req.user.userId, at, note: '管理员签到' }] };
      return { ledger: event.registrations.map(item => String(item.userId) === req.params.userId ? next : item), updates: { attendedCount: (event.attendedCount || 0) + 1 }, row: next };
    });
    res.json({ success: true, checkedInAt: result.row.checkedInAt });
  }));
  router.get('/:id', wrap(async (req, res) => {
    const event = await service.readableEvent(req.params.id, req.user.userId);
    const account = await service.account(req.user.userId);
    res.json({ success: true, event: await shape(event, req.user.userId, account.isAdmin) });
  }));
  router.put('/:id', requireAdmin, writes, wrap(async (req, res) => res.json({ success: true, event: await shape(await service.update(req.params.id, req.body, req.user.userId), req.user.userId, true) })));
  router.delete('/:id', requireAdmin, writes, wrap(async (req, res) => res.json({ success: true, event: await shape(await service.hide(req.params.id, req.user.userId), req.user.userId, true), message: '活动已隐藏；报名和照片保留，可恢复。' })));
  router.activityWrites = writes;
  return router;
}
const router = createEventRouter();
module.exports = router;
module.exports.createEventRouter = createEventRouter;
