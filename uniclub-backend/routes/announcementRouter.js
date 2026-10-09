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

module.exports = router;
