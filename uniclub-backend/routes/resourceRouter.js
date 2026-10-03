const { authenticateIfPresent, restrictStatusFilter, canReadContent } = require('../middleware/contentAccess');
const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');
const Comment = require('../models/Comment');
const UserEngagement = require('../models/UserEngagement');
const authenticateToken = require('../middleware/auth');
const { isAdminUser } = require('../middleware/admin');
const mongoose = require('mongoose');
const { resourceFields, pickFields } = require('../utils/contentPolicy');
const resourceStatuses = ['pending', 'approved', 'rejected', 'archived'];
const reviewFields = ['isApproved', 'approvedBy', 'approvedAt', 'isFeatured'];

// GET /api/resources - get all resources with filtering and pagination
router.get('/', restrictStatusFilter('approved'), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status = 'approved',
      type,
      category,
      search,
      sortBy = 'downloadCount'
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build match stage for aggregation
    const matchStage = { status };
    
    // Filter by type
    if (type && type !== 'All') {
      matchStage.type = type;
    }
    
    // Filter by category
    if (category && category !== 'All') {
      matchStage.category = category;
    }
    
    // Search in title and description
    if (search) {
      matchStage.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    // Sort options
    let sortOptions = {};
    switch (sortBy) {
      case 'downloadCount':
        sortOptions = { downloadCount: -1 };
        break;
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      case 'title':
        sortOptions = { title: 1 };
        break;
      default:
        sortOptions = { downloadCount: -1 };
    }
    
    const resources = await Resource.find(matchStage)
      .populate('uploadedBy', 'name profile.avatar uniqueId')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Resource.countDocuments(matchStage);
    
    // Get real-time comment counts for all resources
    const resourceIds = resources.map(resource => resource._id);
    const commentCounts = await Comment.aggregate([
      { 
        $match: { 
          contentType: 'resource',
          contentId: { $in: resourceIds }, 
          status: 'active' 
        } 
      },
      { $group: { _id: '$contentId', count: { $sum: 1 } } }
    ]);
    
    const commentCountMap = {};
    commentCounts.forEach(cc => {
      commentCountMap[cc._id.toString()] = cc.count;
    });
    
    // Transform resources to include comment counts
    const transformedResources = resources.map(resource => ({
      ...resource.toObject(),
      commentCount: commentCountMap[resource._id.toString()] || 0,
      discussionCount: commentCountMap[resource._id.toString()] || 0
    }));
    
    res.json({
      success: true,
      resources: transformedResources,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({ error: 'Failed to fetch resources', details: error.message });
  }
});

// GET /api/resources/stats/summary - get resource statistics
// NOTE: must be declared BEFORE '/:id', otherwise Express matches 'stats' as an id
// and the endpoint always answers 400 "Invalid resource ID".
router.get('/stats/summary', async (req, res) => {
  try {
    const totalResources = await Resource.countDocuments({ status: 'approved' });
    const totalDownloads = await Resource.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$downloadCount' } } }
    ]);
    
    const typeStats = await Resource.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    
    const categoryStats = await Resource.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalResources,
        totalDownloads: totalDownloads[0]?.total || 0,
        byType: typeStats,
        byCategory: categoryStats
      }
    });
  } catch (error) {
    console.error('Error fetching resource stats:', error);
    res.status(500).json({ error: 'Failed to fetch resource stats', details: error.message });
  }
});

// GET /api/resources/:id - get specific resource
router.get('/:id', authenticateIfPresent, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid resource ID' });
    }
    
    const resource = await Resource.findById(req.params.id)
      .populate('uploadedBy', 'name profile.avatar uniqueId')
      .populate('approvedBy', 'name profile.avatar uniqueId');
    
    if (!resource || !(await canReadContent(req, resource, 'uploadedBy', 'approved'))) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Note: View count is tracked separately when user actually views the content
    // (see POST /api/resources/:id/view endpoint)
    
    res.json({
      success: true,
      resource
    });
  } catch (error) {
    console.error('Error fetching resource:', error);
    res.status(500).json({ error: 'Failed to fetch resource', details: error.message });
  }
});

// POST /api/resources - create new resource (authenticated users only)
// Member submissions start as 'pending'; an admin creating from the console can
// publish directly by sending status: 'approved'.
router.post('/', authenticateToken, async (req, res) => {
  try {
    const admin = await isAdminUser(req.user.userId);
    if (!admin && ((req.body.status !== undefined && req.body.status !== 'pending') ||
        reviewFields.some((field) => Object.hasOwn(req.body, field)))) {
      return res.status(403).json({ error: 'Only an admin can set resource review fields' });
    }
    const status = admin ? (req.body.status ?? 'pending') : 'pending';
    if (!resourceStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid resource status' });
    }
    const resourceData = {
      ...pickFields(req.body, resourceFields),
      uploadedBy: req.user.userId,
      status,
      isApproved: status === 'approved',
      isFeatured: admin && status === 'approved' && req.body.isFeatured === true,
      ...(status === 'approved' && { approvedBy: req.user.userId, approvedAt: new Date() })
    };
    
    const resource = new Resource(resourceData);
    await resource.save();
    
    await resource.populate('uploadedBy', 'name profile.avatar uniqueId');
    
    res.status(201).json({
      success: true,
      resource
    });
  } catch (error) {
    console.error('Error creating resource:', error);
    res.status(500).json({ error: 'Failed to create resource', details: error.message });
  }
});

// PUT /api/resources/:id - update resource (uploader OR admin)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid resource ID' });
    }
    
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    const admin = await isAdminUser(req.user.userId);
    const isUploader = resource.uploadedBy.toString() === req.user.userId;
    if (!isUploader && !admin) {
      return res.status(403).json({ error: 'Only the uploader or an admin can update this resource' });
    }
    if (!admin && (Object.hasOwn(req.body, 'status') ||
        reviewFields.some((field) => Object.hasOwn(req.body, field)))) {
      return res.status(403).json({ error: 'Only an admin can set resource review fields' });
    }
    const updates = pickFields(req.body, resourceFields);
    if (!Object.keys(updates).length && !Object.hasOwn(req.body, 'status') &&
        !(admin && Object.hasOwn(req.body, 'isFeatured'))) {
      return res.status(400).json({ error: 'No supported fields provided' });
    }
    // Any member edit must be reviewed again before becoming public.
    updates.status = admin ? (req.body.status ?? resource.status) : 'pending';
    if (!resourceStatuses.includes(updates.status)) {
      return res.status(400).json({ error: 'Invalid resource status' });
    }
    updates.isApproved = updates.status === 'approved';
    updates.isFeatured = updates.isApproved && admin &&
      (req.body.isFeatured === undefined ? resource.isFeatured === true : req.body.isFeatured === true);
    const update = { $set: updates };
    if (updates.isApproved && Object.hasOwn(req.body, 'status')) {
      updates.approvedBy = req.user.userId;
      updates.approvedAt = new Date();
    } else if (!updates.isApproved) {
      update.$unset = { approvedBy: '', approvedAt: '' };
    }
    const updatedResource = await Resource.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    ).populate('uploadedBy', 'name profile.avatar uniqueId');
    
    res.json({
      success: true,
      resource: updatedResource
    });
  } catch (error) {
    console.error('Error updating resource:', error);
    res.status(500).json({ error: 'Failed to update resource', details: error.message });
  }
});

// DELETE /api/resources/:id - delete resource (uploader OR admin)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid resource ID' });
    }
    
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    const isUploader = resource.uploadedBy.toString() === req.user.userId;
    if (!isUploader && !(await isAdminUser(req.user.userId))) {
      return res.status(403).json({ error: 'Only the uploader or an admin can delete this resource' });
    }
    
    await Resource.findByIdAndDelete(req.params.id);
    await Comment.deleteMany({ contentType: 'resource', contentId: req.params.id });
    
    res.json({
      success: true,
      message: 'Resource deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting resource:', error);
    res.status(500).json({ error: 'Failed to delete resource', details: error.message });
  }
});

// POST /api/resources/:id/view - increment view count (for Video, Tutorial, Tool)
// ONLY counts once per user - tracks when user clicks the view/open button
router.post('/:id/view', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid resource ID' });
    }
    
    const userId = req.user.userId;
    const resourceId = req.params.id;
    
    // Check if user already viewed this resource
    const existingEngagement = await UserEngagement.findOne({
      user: userId,
      contentType: 'Resource',
      contentId: resourceId
    });
    
    // Only increment if user hasn't viewed before
    if (!existingEngagement || !existingEngagement.viewed) {
      // Update or create engagement record
      await UserEngagement.findOneAndUpdate(
        { user: userId, contentType: 'Resource', contentId: resourceId },
        { 
          user: userId,
          contentType: 'Resource',
          contentId: resourceId,
          viewed: true,
          viewedAt: new Date(),
          lastEngagedAt: new Date()
        },
        { upsert: true, new: true }
      );
      
      // Increment the view count on the resource
      const resource = await Resource.findByIdAndUpdate(
        resourceId,
        { $inc: { views: 1 } },
        { new: true }
      );
      
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      
      res.json({
        success: true,
        message: 'View count updated',
        views: resource.views,
        newView: true
      });
    } else {
      // User already viewed this resource
      const resource = await Resource.findById(resourceId);
      
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      
      res.json({
        success: true,
        message: 'Already viewed',
        views: resource.views,
        newView: false
      });
    }
  } catch (error) {
    console.error('Error updating view count:', error);
    res.status(500).json({ error: 'Failed to update view count', details: error.message });
  }
});

// POST /api/resources/:id/download - increment download count
// ONLY counts once per user - tracks when user clicks the download button
router.post('/:id/download', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid resource ID' });
    }
    
    const userId = req.user.userId;
    const resourceId = req.params.id;
    
    // Check if user already downloaded this resource
    const existingEngagement = await UserEngagement.findOne({
      user: userId,
      contentType: 'Resource',
      contentId: resourceId
    });
    
    // Only increment if user hasn't downloaded before
    if (!existingEngagement || !existingEngagement.downloaded) {
      // Update or create engagement record
      await UserEngagement.findOneAndUpdate(
        { user: userId, contentType: 'Resource', contentId: resourceId },
        { 
          user: userId,
          contentType: 'Resource',
          contentId: resourceId,
          downloaded: true,
          downloadedAt: new Date(),
          lastEngagedAt: new Date()
        },
        { upsert: true, new: true }
      );
      
      // Increment the download count on the resource
      const resource = await Resource.findByIdAndUpdate(
        resourceId,
        { $inc: { downloadCount: 1 } },
        { new: true }
      );
      
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      
      res.json({
        success: true,
        message: 'Download count updated',
        downloadCount: resource.downloadCount,
        newDownload: true
      });
    } else {
      // User already downloaded this resource
      const resource = await Resource.findById(resourceId);
      
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      
      res.json({
        success: true,
        message: 'Already downloaded',
        downloadCount: resource.downloadCount,
        newDownload: false
      });
    }
  } catch (error) {
    console.error('Error updating download count:', error);
    res.status(500).json({ error: 'Failed to update download count', details: error.message });
  }
});

module.exports = router; 