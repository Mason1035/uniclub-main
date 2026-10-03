/**
 * Admin-only API surface for the ClassHub management console.
 *
 * Every route in this router is protected by requireAdmin, which resolves
 * User.isAdmin from MongoDB. The frontend never decides permissions on its own.
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
const RosterService = require('../services/RosterService');
const { parseRosterText } = require('../utils/rosterPolicy');
const rosterService = new RosterService();
const { escapeRegex, paginationOf, paged } = require('./admin/_shared');

// Every route below requires a verified admin.
router.use(requireAdmin);
router.use('/quantification', require('./quantificationRouter').adminRouter);
router.use('/fees', require('./feesRouter').adminRouter);

// 其余管理员模块拆到 routes/admin/ 下，挂载点仍是 /api/admin/*
router.use('/announcements', require('./admin/announcements'));
router.use('/past-events', require('./admin/gallery'));
router.use('/ai', require('./admin/ai'));

/* ------------------------------------------------------------------ */
/* GET /api/admin/stats - dashboard counters                           */
/* ------------------------------------------------------------------ */
router.get('/stats', async (req, res) => {
  try {
    const [users, events, news, resources, admins, pendingResources, pendingNews] = await Promise.all([
      User.countDocuments({}),
      Event.countDocuments({}),
      News.countDocuments({}),
      Resource.countDocuments({}),
      User.countDocuments({ isAdmin: true }),
      Resource.countDocuments({ status: 'pending' }),
      News.countDocuments({ status: 'pending' }),
    ]);

    res.json({
      users,
      events,
      news,
      resources,
      breakdown: {
        admins,
        pendingResources,
        pendingNews,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Admin stats error:', error);
    res.status(500).json({ error: 'Failed to load statistics' });
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
    if (role === 'admin') filter.isAdmin = true;
    if (role === 'member') filter.isAdmin = { $ne: true };

    const [users, total] = await Promise.all([
      User.find(filter)
        // Never select passwordHash. Avatar base64 is far too heavy for a list view,
        // so we only expose whether the user has one.
        .select('name email uniqueId isAdmin isVerified isEnrolled lastActive createdAt profile.avatar.contentType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const shaped = users.map((user) => ({
      id: user._id,
      name: user.name,
      email: user.email,
      uniqueId: user.uniqueId,
      isAdmin: user.isAdmin === true,
      isVerified: user.isVerified === true,
      isEnrolled: user.isEnrolled === true,
      lastActive: user.lastActive || null,
      createdAt: user.createdAt || null,
      hasAvatar: Boolean(user.profile && user.profile.avatar && user.profile.avatar.contentType),
    }));

    res.json({ success: true, users: shaped, pagination: paged(page, limit, total) });
  } catch (error) {
    console.error('❌ Admin users error:', error);
    res.status(500).json({ error: 'Failed to load members' });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /api/admin/users/:id/admin - grant / revoke admin             */
/* ------------------------------------------------------------------ */
router.patch('/users/:id/admin', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    if (typeof req.body.isAdmin !== 'boolean') {
      return res.status(400).json({ error: 'isAdmin (boolean) is required' });
    }
    // Guard against an admin locking themselves out of the console.
    if (String(req.adminUser._id) === String(id) && req.body.isAdmin === false) {
      return res.status(400).json({ error: 'You cannot revoke your own admin access' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isAdmin: req.body.isAdmin },
      { new: true }
    ).select('name email uniqueId isAdmin isVerified lastActive createdAt');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        uniqueId: user.uniqueId,
        isAdmin: user.isAdmin === true,
        isVerified: user.isVerified === true,
        lastActive: user.lastActive || null,
        createdAt: user.createdAt || null,
        hasAvatar: false,
      },
    });
  } catch (error) {
    console.error('❌ Admin update user error:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/admin/events - all events regardless of status             */
/* ------------------------------------------------------------------ */
router.get('/events', async (req, res) => {
  try {
    const { page, limit, skip } = paginationOf(req.query);
    const { search, status } = req.query;

    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ title: rx }, { description: rx }];
    }

    const [events, total] = await Promise.all([
      Event.find(filter)
        .populate('organizer', 'name email uniqueId')
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Event.countDocuments(filter),
    ]);

    res.json({
      success: true,
      events: events.map((event) => ({
        _id: event._id,
        title: event.title,
        description: event.description,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        eventType: event.eventType,
        category: event.category || [],
        status: event.status,
        imageUrl: event.imageUrl || null,
        maxCapacity: event.maxCapacity,
        rsvpCount: event.rsvpCount || 0,
        organizer: event.organizer,
        createdAt: event.createdAt,
      })),
      pagination: paged(page, limit, total),
    });
  } catch (error) {
    console.error('❌ Admin events error:', error);
    res.status(500).json({ error: 'Failed to load events' });
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
router.get('/roster', async (req, res) => {
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
router.post('/roster', async (req, res) => {
  try {
    const result = await rosterService.upsert(req.body);
    res.status(result.action === 'created' ? 201 : 200).json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to save roster entry' });
  }
});

/** POST /api/admin/roster/bulk - supports Excel paste and CSV. */
router.post('/roster/bulk', async (req, res) => {
  try {
    const result = await rosterService.import(parseRosterText(req.body?.text));
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to import roster' });
  }
});

/** DELETE /api/admin/roster/:id - remove an entry (registered users keep their account). */
router.delete('/roster/:id', async (req, res) => {
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
