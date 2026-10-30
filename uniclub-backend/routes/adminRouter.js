/**
 * Role-protected API surface for the ClassHub management console.
 *
 * Every route resolves the current role from MongoDB. The frontend never decides permissions on its own.
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../models/User');
const EnrolledUser = require('../models/EnrolledUser');
const Event = require('../models/Event');
const News = require('../models/News');
const Resource = require('../models/Resource');
const requireAdmin = require('../middleware/admin');
const { requireStaff, requireRoleManager } = require('../middleware/admin');
const { ROLES, roleFilter } = require('../utils/roles');
const { RoleAssignmentService, memberDto } = require('../services/RoleAssignmentService');
const roles = new RoleAssignmentService();
const RosterService = require('../services/RosterService');
const { parseRosterText } = require('../utils/rosterPolicy');
const rosterService = new RosterService();
const { escapeRegex, paginationOf, paged } = require('./admin/_shared');

// Business management is shared by committee, teacher and administrator roles.
router.use(requireStaff);
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.use('/quantification', require('./quantificationRouter').adminRouter);
router.use('/fees', require('./feesRouter').adminRouter);
router.use('/resource-quick-links', require('./resourceQuickLinksRouter').adminRouter);

// 其余管理员模块拆到 routes/admin/ 下，挂载点仍是 /api/admin/*
router.use('/announcements', require('./admin/announcements'));
router.use('/past-events', require('./admin/gallery'));
router.use('/ai/daily-news', requireAdmin, require('./admin/dailyNews'));
router.use('/ai', requireAdmin, require('./admin/ai'));
router.use('/feedback', requireAdmin, require('./admin/feedback'));

/* ------------------------------------------------------------------ */
/* GET /api/admin/stats - dashboard counters                           */
/* ------------------------------------------------------------------ */
const { DashboardStatsService } = require('../services/DashboardStatsService');
const dashboardStats = new DashboardStatsService();
router.get('/stats', async (req, res) => {
  if (Object.keys(req.query).some(key => key !== 'days')) return res.status(400).json({ error: '统计接口仅支持 days 时间范围参数。' });
  try { res.json(await dashboardStats.get(req.query.days)); }
  catch (error) {
    if (!error.status) console.error('Dashboard statistics failed:', error.message);
    res.status(error.status || 503).json({ error:error.status ? error.message : '统计数据暂时无法读取，请稍后重试。' });
  }
});

// Unified member directory; roster mutations and role assignments keep their
// existing, independently enforced authorization rules.
const { MemberDirectoryService } = require('../services/MemberDirectoryService');
const memberDirectory = new MemberDirectoryService();
router.get('/members', async (req, res) => {
  try { res.json(await memberDirectory.list(req.query)); }
  catch (error) {
    if (!error.status) console.error('Member directory failed:', error.message);
    res.status(error.status || 503).json({ error: error.status ? error.message : '成员列表暂时无法读取，请稍后重试。' });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/admin/users - member directory                             */
/* ------------------------------------------------------------------ */
router.get('/users', async (req, res) => {
  try {
    const { page, limit, skip } = paginationOf(req.query);
    const { search, role } = req.query;

    const filter = {};
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { uniqueId: rx }];
    }
    const requestedRole = role === 'member' ? 'student' : role;
    if (requestedRole && requestedRole !== 'all' && !ROLES.includes(requestedRole)) return res.status(400).json({ error: '无效的身份筛选。' });
    if (ROLES.includes(requestedRole)) filter.$and = [roleFilter(requestedRole)];

    const [users, total] = await Promise.all([
      User.find(filter)
        // Never select passwordHash. Avatar base64 is far too heavy for a list view,
        // so we only expose whether the user has one.
        .select('name email uniqueId role isAdmin isVerified isEnrolled lastActive createdAt profile.avatar.contentType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const shaped = users.map(memberDto);

    res.json({ success: true, users: shaped, pagination: paged(page, limit, total) });
  } catch (error) {
    console.error('❌ Admin users error:', error);
    res.status(500).json({ error: 'Failed to load members' });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /api/admin/users/:id/admin - grant / revoke admin             */
/* ------------------------------------------------------------------ */
const assignRole = async (req, res) => {
  try {
    const user = await roles.assign(req.user.userId, req.params.id, req.body.role);
    res.json({ success: true, user: memberDto(user) });
  } catch (error) {
    if (!error.status) console.error('Identity assignment failed:', error.message);
    res.status(error.status || 503).json({ error: error.status ? error.message : '身份暂时无法调整，请稍后重试。' });
  }
};
router.patch('/users/:id/role', requireRoleManager, (req, res, next) => {
  if (!req.body || Object.keys(req.body).length !== 1 || !ROLES.includes(req.body.role)) {
    return res.status(400).json({ error: '仅允许提交一个有效的 role 身份字段。' });
  }
  return assignRole(req, res, next);
});
// Compatibility endpoint remains admin-only and uses the same guarded mutation.
router.patch('/users/:id/admin', requireAdmin, (req, res, next) => {
  if (!req.body || Object.keys(req.body).length !== 1 || typeof req.body.isAdmin !== 'boolean') {
    return res.status(400).json({ error: '仅允许提交 isAdmin 布尔字段。' });
  }
  req.body = { role: req.body.isAdmin ? 'admin' : 'student' };
  return assignRole(req, res, next);
});

/* ------------------------------------------------------------------ */
/* GET /api/admin/events - all events regardless of status             */
/* ------------------------------------------------------------------ */
router.get('/events', async (req, res) => {
  try {
    const { activityService } = require('../services/ActivityService');
    const data = await activityService.list(req.user.userId, req.query, { admin: true });
    const { activityMediaService } = require('../services/ActivityMediaService');
    data.events = await Promise.all(data.events.map(async (dto, index) => activityMediaService.decorateEvent(dto,
      data.rawEvents[index], req.user.userId, { thumbnail: true })));
    res.json(data);
  } catch (error) {
    res.status(error.status || 503).json({ success: false, error: error.status ? error.message : '活动列表暂时无法读取。', code: error.code || 'ACTIVITY_UNAVAILABLE' });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/admin/news - all articles regardless of status             */
/* ------------------------------------------------------------------ */
router.get('/news', async (req, res) => {
  try {
    const { page, limit, skip } = paginationOf(req.query);
    const { search, status } = req.query;

    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ title: rx }, { excerpt: rx }, { source: rx }];
    }

    const [articles, total] = await Promise.all([
      News.find(filter)
        .populate('author', 'name email uniqueId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      News.countDocuments(filter),
    ]);

    res.json({
      success: true,
      news: articles.map((article) => ({
        _id: article._id,
        title: article.title,
        excerpt: article.excerpt,
        source: article.source,
        origin: article.origin || 'manual',
        automationDate: article.automationDate,
        automationArchivedAt: article.automationArchivedAt || null,
        categories: article.categories || [],
        status: article.status,
        imageUrl: article.imageUrl || null,
        originalUrl: article.originalUrl || null,
        isFeatured: article.isFeatured === true,
        isTrending: article.isTrending === true,
        likes: article.likes || 0,
        comments: article.comments || 0,
        publishedAt: article.publishedAt || null,
        createdAt: article.createdAt,
        author: article.author,
      })),
      pagination: paged(page, limit, total),
    });
  } catch (error) {
    console.error('❌ Admin news error:', error);
    res.status(500).json({ error: 'Failed to load news' });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/admin/resources - all resources regardless of status       */
/* ------------------------------------------------------------------ */
router.get('/resources', async (req, res) => {
  try {
    const { page, limit, skip } = paginationOf(req.query);
    const { search, status, type, category } = req.query;

    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (type && type !== 'all') filter.type = type;
    if (category && category !== 'all') filter.category = category;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ title: rx }, { description: rx }];
    }

    const [resources, total] = await Promise.all([
      Resource.find(filter)
        .populate('uploadedBy', 'name email uniqueId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Resource.countDocuments(filter),
    ]);

    res.json({
      success: true,
      resources: resources.map((resource) => ({
        _id: resource._id,
        title: resource.title,
        description: resource.description || '',
        type: resource.type,
        category: resource.category,
        status: resource.status,
        linkUrl: resource.linkUrl || (resource.file && resource.file.url) || null,
        thumbnailUrl: resource.thumbnailUrl || null,
        downloadCount: resource.downloadCount || 0,
        views: resource.views || 0,
        tags: resource.tags || [],
        createdAt: resource.createdAt,
        uploadedBy: resource.uploadedBy,
      })),
      pagination: paged(page, limit, total),
    });
  } catch (error) {
    console.error('❌ Admin resources error:', error);
    res.status(500).json({ error: 'Failed to load resources' });
  }
});

/* ------------------------------------------------------------------ */
/* 班级名单 (EnrolledUser)                                             */
/* 按学号维护名单，并自动为新成员开通账号。      */
/* ------------------------------------------------------------------ */

/** GET /api/admin/roster - paginated class roster with account status. */
router.get('/roster', requireAdmin, async (req, res) => {
  try {
    const { page, limit, skip } = paginationOf(req.query);
    const { search } = req.query;

    const filter = {};
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ email: rx }, { name: rx }, { uniqueId: rx }];
    }

    const [entries, total, registeredIds, rosterIds] = await Promise.all([
      EnrolledUser.find(filter).sort({ uniqueId: 1 }).skip(skip).limit(limit).lean(),
      EnrolledUser.countDocuments(filter),
      User.distinct('uniqueId'),
      EnrolledUser.distinct('uniqueId'),
    ]);

    const registeredSet = new Set(registeredIds);

    res.json({
      success: true,
      roster: entries.map((entry) => ({
        id: entry._id,
        email: entry.email || '',
        name: entry.name,
        uniqueId: entry.uniqueId,
        registered: registeredSet.has(entry.uniqueId),
      })),
      summary: {
        total: rosterIds.length,
        registered: rosterIds.filter(id => registeredSet.has(id)).length,
      },
      pagination: paged(page, limit, total),
    });
  } catch (error) {
    console.error('❌ Admin roster error:', error);
    res.status(500).json({ error: 'Failed to load roster' });
  }
});

/** POST /api/admin/roster - add/update a student and provision their account. */
router.post('/roster', requireAdmin, async (req, res) => {
  try {
    const result = await rosterService.upsert(req.body);
    res.status(result.action === 'created' ? 201 : 200).json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to save roster entry' });
  }
});

/** POST /api/admin/roster/bulk - supports Excel paste and CSV. */
router.post('/roster/bulk', requireAdmin, async (req, res) => {
  try {
    const result = await rosterService.import(parseRosterText(req.body?.text));
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to import roster' });
  }
});

/** DELETE /api/admin/roster/:id - remove an entry (registered users keep their account). */
router.delete('/roster/:id', requireAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid roster ID' });
    }
    const removed = await EnrolledUser.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Roster entry not found' });
    res.json({ success: true, message: '已从名单中移除' });
  } catch (error) {
    console.error('❌ Admin roster delete error:', error);
    res.status(500).json({ error: 'Failed to delete roster entry' });
  }
});

module.exports = router;
