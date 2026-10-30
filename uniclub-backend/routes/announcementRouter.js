/**
 * 成员端公告接口（公开读）。
 * 只返回已发布且未过期的公告。
 */
const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');

const shape = (doc) => ({
  _id: doc._id,
  title: doc.title,
  body: doc.body,
  level: doc.level,
  pinned: doc.pinned === true,
  link: doc.link || '',
  publishedAt: doc.publishedAt,
  expiresAt: doc.expiresAt,
});

// GET /api/announcements - 班级公告列表
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    // Reuse the same publication rules and management fields. Query each
    // category independently so an older pinned notice is not lost to a list limit.
    if (req.query.view === 'home-bubbles') {
      const now = new Date();
      const current = {
        isPublished: true, publishedAt: { $lte: now },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      };
      const latest = filter => Announcement.findOne({ ...current, ...filter })
        .sort({ publishedAt: -1, _id: -1 }).lean();
      const notices = await Promise.all([
        latest({ $and: [{ $or: [{ pinned: true }, { level: { $in: ['important', 'urgent'] } }] }] }),
        latest({ pinned: { $ne: true }, level: 'info' }),
      ]);
      return res.json(notices.filter(Boolean).map(shape));
    }

    const docs = await Announcement.find({
      isPublished: true,
      publishedAt: { $lte: new Date() },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    })
      .sort(req.query.sort === 'latest' ? { publishedAt: -1, _id: -1 } : { pinned: -1, publishedAt: -1 })
      .limit(limit)
      .lean();

    res.json(docs.map(shape));
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// A notice's own permalink always checks current publication/expiry rules.
router.get('/:id', async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ error: '公告不存在或已过期' });
  try {
    const now = new Date();
    const doc = await Announcement.findOne({
      _id: req.params.id, isPublished: true, publishedAt: { $lte: now },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).lean();
    if (!doc) return res.status(404).json({ error: '公告不存在或已过期' });
    return res.json(shape(doc));
  } catch (error) {
    console.error('Error fetching announcement:', error);
    return res.status(500).json({ error: '暂时无法读取公告' });
  }
});

module.exports = router;
