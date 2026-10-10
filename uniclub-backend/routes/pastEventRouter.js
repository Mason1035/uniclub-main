const express = require('express');
const router = express.Router();
const PastEvent = require('../models/PastEvent');
const requireAdmin = require('../middleware/admin');

/**
 * 图片以 Base64 存在库里，一条往期活动的「海报 + 相册」可能有几十 MB。
 * 列表/详情一律用 .select() 排除这些大字段，只回可直接用于 <img src> 的相对地址，
 * 真正的字节由 /:id/poster 与 /:id/gallery/:index 两个端点按需返回。
 */
const LIST_EXCLUDE = '-poster.data -gallery.data';

const posterUrlOf = (id) => `/api/past-events/${id}/poster`;
const galleryUrlOf = (id, index) => `/api/past-events/${id}/gallery/${index}`;

const shapeListItem = (event) => ({
  _id: event._id,
  title: event.title,
  subtitle: event.subtitle,
  date: event.date,
  category: event.category || '',
  attendance: event.attendance || 0,
  tags: event.tags || [],
  link: event.link || '',
  hasPoster: Boolean(event.poster && event.poster.contentType),
  posterUrl: posterUrlOf(event._id),
  galleryCount: (event.gallery || []).length,
  createdAt: event.createdAt,
});

const shapeDetail = (event) => ({
  ...shapeListItem(event),
  body: event.body,
  gallery: (event.gallery || []).map((image, index) => ({
    index,
    caption: image.caption || '',
    contentType: image.contentType,
    originalName: image.originalName || '',
    size: image.size || 0,
    uploadedAt: image.uploadedAt,
    url: galleryUrlOf(event._id, index),
  })),
});

// GET /api/past-events - Get all past events（不含 Base64 图片数据）
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const page = Math.min(10000, Math.max(1, parseInt(req.query.page, 10) || 1));
    const total = await PastEvent.countDocuments({});
    const pastEvents = await PastEvent.find({})
      .select(LIST_EXCLUDE)
      .sort({ date: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ success: true, data: pastEvents.map(shapeListItem), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    console.error('Error fetching past events:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch past events' });
  }
});

// POST /api/past-events - Create a new past event (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { poster, title, subtitle, date, body, category, attendance, tags, link, gallery } = req.body;
    
    if (!poster || !title || !subtitle || !date || !body) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: poster, title, subtitle, date, and body are required' 
      });
    }
    
    const pastEvent = new PastEvent({
      poster,
      title,
      subtitle,
      date,
      body,
      category,
      attendance,
      tags,
      link,
      gallery
    });
    
    await pastEvent.save();
    res.json({ success: true, data: pastEvent });
  } catch (error) {
    console.error('Error creating past event:', error);
    res.status(500).json({ success: false, error: 'Failed to create past event' });
  }
});

// Test endpoint to verify collection exists (must come before /:id)
// 管理员专用：会暴露集合名与文档数量，普通成员不需要知道这些。
router.get('/test/connection', requireAdmin, async (req, res) => {
  try {
    const count = await PastEvent.countDocuments();
    res.json({ 
      success: true, 
      message: 'PastEvent collection is accessible',
      documentCount: count,
      collectionName: 'pastevents'
    });
  } catch (error) {
    console.error('Error testing PastEvent collection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/past-events/:id/poster - Serve poster (must come before /:id)
router.get('/:id/poster', async (req, res) => {
  try {
    const pastEvent = await PastEvent.findById(req.params.id).select('poster');
    
    if (!pastEvent || !pastEvent.poster || !pastEvent.poster.data) {
      return res.status(404).json({ error: 'Poster not found' });
    }

    // Extract base64 data (remove data:image/png;base64, prefix)
    const base64Data = pastEvent.poster.data.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    
    res.set('Content-Type', pastEvent.poster.contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
    
  } catch (error) {
    console.error('Poster serve error:', error);
    res.status(500).json({ error: 'Failed to retrieve poster' });
  }
});

// GET /api/past-events/:id/gallery/:imageIndex - Serve gallery image by index
router.get('/:id/gallery/:imageIndex', async (req, res) => {
  try {
    const pastEvent = await PastEvent.findById(req.params.id).select('gallery');
    const imageIndex = parseInt(req.params.imageIndex);
    
    if (!pastEvent || !pastEvent.gallery || pastEvent.gallery.length === 0) {
      return res.status(404).json({ error: 'Gallery not found' });
    }
    
    if (imageIndex < 0 || imageIndex >= pastEvent.gallery.length) {
      return res.status(404).json({ error: 'Image not found in gallery' });
    }
    
    const image = pastEvent.gallery[imageIndex];
    
    if (!image || !image.data) {
      return res.status(404).json({ error: 'Image data not found' });
    }

    // Extract base64 data (remove data:image/png;base64, prefix)
    const base64Data = image.data.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    
    res.set('Content-Type', image.contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
    
  } catch (error) {
    console.error('Gallery image serve error:', error);
    res.status(500).json({ error: 'Failed to retrieve gallery image' });
  }
});

// GET /api/past-events/:id - Get a specific past event（不含 Base64 图片数据）
router.get('/:id', async (req, res) => {
  try {
    const pastEvent = await PastEvent.findById(req.params.id).select(LIST_EXCLUDE);
    if (!pastEvent) {
      return res.status(404).json({ success: false, error: 'Past event not found' });
    }
    res.json({ success: true, data: shapeDetail(pastEvent) });
  } catch (error) {
    console.error('Error fetching past event:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch past event' });
  }
});

// PUT /api/past-events/:id - Update a past event (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { poster, title, subtitle, date, body, category, attendance, tags, link, gallery } = req.body;
    
    const pastEvent = await PastEvent.findByIdAndUpdate(
      req.params.id,
      { poster, title, subtitle, date, body, category, attendance, tags, link, gallery },
      { new: true, runValidators: true }
    );
    
    if (!pastEvent) {
      return res.status(404).json({ success: false, error: 'Past event not found' });
    }
    
    res.json({ success: true, data: pastEvent });
  } catch (error) {
    console.error('Error updating past event:', error);
    res.status(500).json({ success: false, error: 'Failed to update past event' });
  }
});

// DELETE /api/past-events/:id - Delete a past event (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const pastEvent = await PastEvent.findByIdAndDelete(req.params.id);
    if (!pastEvent) {
      return res.status(404).json({ success: false, error: 'Past event not found' });
    }
    res.json({ success: true, message: 'Past event deleted successfully' });
  } catch (error) {
    console.error('Error deleting past event:', error);
    res.status(500).json({ success: false, error: 'Failed to delete past event' });
  }
});

module.exports = router;

