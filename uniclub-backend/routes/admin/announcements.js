/**
 * 通知管理 —— 班级公告 CRUD + 站内通知概览。
 * 挂载在 /api/admin/announcements，父路由已套 requireAdmin。
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Announcement = require('../../models/Announcement');
const Notification = require('../../models/Notification');
const { escapeRegex, paginationOf, paged } = require('./_shared');

const LEVELS = ['info', 'important', 'urgent'];

const shape = (doc) => ({
  id: doc._id,
  title: doc.title,
  body: doc.body,
  level: doc.level,
  pinned: doc.pinned === true,
  link: doc.link || '',
  isPublished: doc.isPublished === true,
  publishedAt: doc.publishedAt,
  expiresAt: doc.expiresAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  author: doc.author && doc.author.name ? { name: doc.author.name, email: doc.author.email } : undefined,
});

/* ------------------------------------------------------------------ */
/* GET /overview - 通知概览（必须在 /:id 之前声明）                     */
/* ------------------------------------------------------------------ */
router.get('/overview', async (req, res) => {
  try {
    const [total, published, pinned, urgent, notifications, unread] = await Promise.all([
      Announcement.countDocuments({}),
      Announcement.countDocuments({ isPublished: true }),
      Announcement.countDocuments({ pinned: true }),
      Announcement.countDocuments({ level: 'urgent' }),
      Notification.countDocuments({}),
      Notification.countDocuments({ read: false }),
    ]);

    res.json({
      success: true,
      overview: {
        announcements: { total, published, draft: total - published, pinned, urgent },
        notifications: { total: notifications, unread },
      },
    });
  } catch (error) {
    console.error('❌ Admin announcement overview error:', error);
    res.status(500).json({ error: 'Failed to load overview' });
  }
});

/* ------------------------------------------------------------------ */
/* GET / - 公告列表                                                     */
/* ------------------------------------------------------------------ */
router.get('/', async (req, res) => {
  try {
    const { page, limit, skip } = paginationOf(req.query);
    const { search, level, status } = req.query;

    const filter = {};
    if (level && level !== 'all') filter.level = level;
    if (status === 'published') filter.isPublished = true;
    if (status === 'draft') filter.isPublished = false;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ title: rx }, { body: rx }];
    }

    const [docs, total] = await Promise.all([
      Announcement.find(filter)
        .populate('author', 'name email')
        .sort({ pinned: -1, publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Announcement.countDocuments(filter),
    ]);

    res.json({
      success: true,
      announcements: docs.map(shape),
      pagination: paged(page, limit, total),
    });
  } catch (error) {
    console.error('❌ Admin announcement list error:', error);
    res.status(500).json({ error: 'Failed to load announcements' });
  }
});

/* ------------------------------------------------------------------ */
/* POST / - 新建公告                                                    */
/* ------------------------------------------------------------------ */
router.post('/', async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const body = String(req.body.body || '').trim();
    const level = LEVELS.includes(req.body.level) ? req.body.level : 'info';

    if (!title) return res.status(400).json({ error: '标题不能为空' });
    if (!body) return res.status(400).json({ error: '内容不能为空' });

    const doc = await Announcement.create({
      title,
      body,
      level,
      pinned: req.body.pinned === true,
      link: String(req.body.link || '').trim(),
      isPublished: req.body.isPublished !== false,
      publishedAt: req.body.publishedAt ? new Date(req.body.publishedAt) : new Date(),
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      author: req.adminUser._id,
    });

    await doc.populate('author', 'name email');
    res.status(201).json({ success: true, announcement: shape(doc) });
  } catch (error) {
    console.error('❌ Admin announcement create error:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

/* ------------------------------------------------------------------ */
/* PUT /:id - 编辑公告                                                  */
/* ------------------------------------------------------------------ */
router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    const updates = {};
    if (typeof req.body.title === 'string') {
      const title = req.body.title.trim();
      if (!title) return res.status(400).json({ error: '标题不能为空' });
      updates.title = title;
    }
    if (typeof req.body.body === 'string') {
      const body = req.body.body.trim();
      if (!body) return res.status(400).json({ error: '内容不能为空' });
      updates.body = body;
    }
    if (LEVELS.includes(req.body.level)) updates.level = req.body.level;
    if (typeof req.body.pinned === 'boolean') updates.pinned = req.body.pinned;
    if (typeof req.body.isPublished === 'boolean') updates.isPublished = req.body.isPublished;
    if (typeof req.body.link === 'string') updates.link = req.body.link.trim();
    if (req.body.expiresAt !== undefined) {
      updates.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' });
    }

    const doc = await Announcement.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate('author', 'name email');

    if (!doc) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ success: true, announcement: shape(doc) });
  } catch (error) {
    console.error('❌ Admin announcement update error:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

/* ------------------------------------------------------------------ */
/* DELETE /:id - 删除公告                                               */
/* ------------------------------------------------------------------ */
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }
    const doc = await Announcement.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ success: true, message: '公告已删除' });
  } catch (error) {
    console.error('❌ Admin announcement delete error:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

module.exports = router;
