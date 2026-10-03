/**
 * 相册管理 —— 往期活动（PastEvent）及其相册图片。
 * 挂载在 /api/admin/past-events，父路由已套 requireAdmin。
 *
 * 图片以 Base64 存在数据库里（沿用原项目设计），因此列表接口
 * **绝不返回图片数据**，只返回计数与可直接用于 <img src> 的相对地址。
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const PastEvent = require('../../models/PastEvent');
const {
  escapeRegex,
  paginationOf,
  paged,
  parseImageDataUrl,
  MAX_IMAGE_BYTES,
} = require('./_shared');

const CATEGORIES = [
  'Orientation', 'Workshop', 'Masterclass', 'Tutorial',
  'Meetup', 'Hackathon', 'Seminar', 'Social', 'Other',
];

const posterUrlOf = (id) => `/api/past-events/${id}/poster`;
const galleryUrlOf = (id, index) => `/api/past-events/${id}/gallery/${index}`;

const shapeListItem = (doc) => ({
  id: doc._id,
  title: doc.title,
  subtitle: doc.subtitle,
  date: doc.date,
  category: doc.category || '',
  attendance: doc.attendance || 0,
  tags: doc.tags || [],
  link: doc.link || '',
  galleryCount: (doc.gallery || []).length,
  hasPoster: Boolean(doc.poster && doc.poster.contentType),
  posterUrl: posterUrlOf(doc._id),
  createdAt: doc.createdAt,
});

const shapeDetail = (doc) => ({
  ...shapeListItem(doc),
  body: doc.body,
  gallery: (doc.gallery || []).map((image, index) => ({
    index,
    caption: image.caption || '',
    size: image.size || 0,
    contentType: image.contentType,
    originalName: image.originalName || '',
    uploadedAt: image.uploadedAt,
    url: galleryUrlOf(doc._id, index),
  })),
});

/* ------------------------------------------------------------------ */
/* GET / - 往期活动列表                                                 */
/* ------------------------------------------------------------------ */
router.get('/', async (req, res) => {
  try {
    const { page, limit, skip } = paginationOf(req.query);
    const { search, category } = req.query;

    const filter = {};
    if (category && category !== 'all') filter.category = category;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ title: rx }, { subtitle: rx }];
    }

    const [docs, total] = await Promise.all([
      // 明确排除 Base64 大字段，否则列表响应会有几十 MB
      PastEvent.find(filter)
        .select('-poster.data -gallery.data')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PastEvent.countDocuments(filter),
    ]);

    res.json({
      success: true,
      pastEvents: docs.map(shapeListItem),
      categories: CATEGORIES,
      pagination: paged(page, limit, total),
    });
  } catch (error) {
    console.error('❌ Admin past events list error:', error);
    res.status(500).json({ error: 'Failed to load past events' });
  }
});

/* ------------------------------------------------------------------ */
/* GET /:id - 单个往期活动（含相册元数据，不含图片数据）                 */
/* ------------------------------------------------------------------ */
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid past event ID' });
    }
    const doc = await PastEvent.findById(req.params.id).select('-poster.data -gallery.data');
    if (!doc) return res.status(404).json({ error: 'Past event not found' });
    res.json({ success: true, pastEvent: shapeDetail(doc) });
  } catch (error) {
    console.error('❌ Admin past event detail error:', error);
    res.status(500).json({ error: 'Failed to load past event' });
  }
});

/* ------------------------------------------------------------------ */
/* POST / - 新建往期活动（海报必填）                                     */
/* ------------------------------------------------------------------ */
router.post('/', async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const subtitle = String(req.body.subtitle || '').trim();
    const body = String(req.body.body || '').trim();
    const date = req.body.date ? new Date(req.body.date) : null;
    const poster = parseImageDataUrl(req.body.poster);

    if (!title) return res.status(400).json({ error: '标题不能为空' });
    if (!subtitle) return res.status(400).json({ error: '副标题不能为空' });
    if (!body) return res.status(400).json({ error: '正文不能为空' });
    if (!date || Number.isNaN(date.getTime())) return res.status(400).json({ error: '活动日期无效' });
    if (!poster) return res.status(400).json({ error: '请上传活动海报（PNG/JPEG/WebP/GIF）' });
    if (poster.size > MAX_IMAGE_BYTES) return res.status(400).json({ error: '海报不能超过 4MB' });

    const doc = await PastEvent.create({
      poster: { data: req.body.poster, contentType: poster.contentType, size: poster.size, uploadedAt: new Date() },
      title,
      subtitle,
      body,
      date,
      category: CATEGORIES.includes(req.body.category) ? req.body.category : 'Other',
      attendance: Number(req.body.attendance) || 0,
      tags: Array.isArray(req.body.tags) ? req.body.tags.map((t) => String(t).trim()).filter(Boolean) : [],
      link: String(req.body.link || '').trim(),
      gallery: [],
    });

    res.status(201).json({ success: true, pastEvent: shapeDetail(doc) });
  } catch (error) {
    console.error('❌ Admin past event create error:', error);
    res.status(500).json({ error: 'Failed to create past event' });
  }
});

/* ------------------------------------------------------------------ */
/* PUT /:id - 编辑往期活动基础信息（不动物图片）                          */
/* ------------------------------------------------------------------ */
router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid past event ID' });
    }

    const updates = {};
    if (typeof req.body.title === 'string') updates.title = req.body.title.trim();
    if (typeof req.body.subtitle === 'string') updates.subtitle = req.body.subtitle.trim();
    if (typeof req.body.body === 'string') updates.body = req.body.body.trim();
    if (req.body.date) {
      const date = new Date(req.body.date);
      if (Number.isNaN(date.getTime())) return res.status(400).json({ error: '活动日期无效' });
      updates.date = date;
    }
    if (CATEGORIES.includes(req.body.category)) updates.category = req.body.category;
    if (req.body.attendance !== undefined) updates.attendance = Number(req.body.attendance) || 0;
    if (Array.isArray(req.body.tags)) {
      updates.tags = req.body.tags.map((t) => String(t).trim()).filter(Boolean);
    }
    if (typeof req.body.link === 'string') updates.link = req.body.link.trim();

    if (req.body.poster !== undefined) {
      const poster = parseImageDataUrl(req.body.poster);
      if (!poster) return res.status(400).json({ error: '海报格式不支持' });
      if (poster.size > MAX_IMAGE_BYTES) return res.status(400).json({ error: '海报不能超过 4MB' });
      updates.poster = {
        data: req.body.poster,
        contentType: poster.contentType,
        size: poster.size,
        uploadedAt: new Date(),
      };
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' });
    }

    const doc = await PastEvent.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).select('-poster.data -gallery.data');

    if (!doc) return res.status(404).json({ error: 'Past event not found' });
    res.json({ success: true, pastEvent: shapeDetail(doc) });
  } catch (error) {
    console.error('❌ Admin past event update error:', error);
    res.status(500).json({ error: 'Failed to update past event' });
  }
});

/* ------------------------------------------------------------------ */
/* DELETE /:id - 删除往期活动（连同相册）                                */
/* ------------------------------------------------------------------ */
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid past event ID' });
    }
    const doc = await PastEvent.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Past event not found' });
    res.json({ success: true, message: '往期活动已删除' });
  } catch (error) {
    console.error('❌ Admin past event delete error:', error);
    res.status(500).json({ error: 'Failed to delete past event' });
  }
});

/* ------------------------------------------------------------------ */
/* POST /:id/gallery - 往相册里加一张图                                  */
/* ------------------------------------------------------------------ */
router.post('/:id/gallery', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid past event ID' });
    }
    const image = parseImageDataUrl(req.body.data);
    if (!image) return res.status(400).json({ error: '图片格式不支持（PNG/JPEG/WebP/GIF）' });
    if (image.size > MAX_IMAGE_BYTES) return res.status(400).json({ error: '单张图片不能超过 4MB' });

    const doc = await PastEvent.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Past event not found' });

    doc.gallery.push({
      data: req.body.data,
      contentType: image.contentType,
      originalName: String(req.body.originalName || '').trim(),
      size: image.size,
      uploadedAt: new Date(),
      caption: String(req.body.caption || '').trim().slice(0, 200),
    });
    await doc.save();

    const saved = await PastEvent.findById(req.params.id).select('-poster.data -gallery.data');
    res.status(201).json({ success: true, pastEvent: shapeDetail(saved) });
  } catch (error) {
    console.error('❌ Admin gallery upload error:', error);
    res.status(500).json({ error: 'Failed to upload gallery image' });
  }
});

/* ------------------------------------------------------------------ */
/* DELETE /:id/gallery/:index - 删除相册里的某张图                       */
/* ------------------------------------------------------------------ */
router.delete('/:id/gallery/:index', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid past event ID' });
    }
    const index = parseInt(req.params.index, 10);
    if (Number.isNaN(index) || index < 0) {
      return res.status(400).json({ error: 'Invalid image index' });
    }

    const doc = await PastEvent.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Past event not found' });
    if (index >= doc.gallery.length) {
      return res.status(404).json({ error: 'Image not found in gallery' });
    }

    doc.gallery.splice(index, 1);
    await doc.save();

    const saved = await PastEvent.findById(req.params.id).select('-poster.data -gallery.data');
    res.json({ success: true, pastEvent: shapeDetail(saved) });
  } catch (error) {
    console.error('❌ Admin gallery delete error:', error);
    res.status(500).json({ error: 'Failed to delete gallery image' });
  }
});

module.exports = router;
