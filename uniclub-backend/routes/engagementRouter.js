const express = require('express');
const router = express.Router();
const EngagementService = require('../services/EngagementService');
const authenticateToken = require('../middleware/auth');
const mongoose = require('mongoose');

// POST /api/engagement/like/:contentType/:contentId - toggle like
router.post('/like/:contentType/:contentId', authenticateToken, async (req, res) => {
  try {
    console.log('🔥 LIKE REQUEST DEBUG:', {
      contentType: req.params.contentType,
      contentId: req.params.contentId,
      user: req.user,
      headers: req.headers.authorization
    });
    
    const { contentType, contentId } = req.params;
    const userId = req.user.userId;
    
    // Validate contentType
    const validTypes = ['News', 'SocialPost', 'Event', 'Comment', 'Resource'];
    if (!validTypes.includes(contentType)) {
      return res.status(400).json({ error: 'Invalid content type' });
    }
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return res.status(400).json({ error: 'Invalid content ID' });
    }
    
    // Get current engagement status
    console.log('🔍 Getting current engagement status...');
    const currentEngagement = await EngagementService.getUserEngagement(userId, contentType, contentId);
    const isCurrentlyLiked = currentEngagement?.liked || false;
    console.log('🔍 Current engagement:', { currentEngagement, isCurrentlyLiked });
    
    // Toggle like
    console.log('🔍 Toggling like from', isCurrentlyLiked, 'to', !isCurrentlyLiked);
    const engagement = await EngagementService.toggleEngagement(
      userId, 
      contentType, 
      contentId, 
      'like', 
      !isCurrentlyLiked
    );
    console.log('🔍 EngagementService.toggleEngagement returned:', engagement);
    
    const responseData = {
      success: true,
      liked: !isCurrentlyLiked,
      engagement: engagement
    };
    console.log('🔍 Sending like response:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like', details: error.message });
  }
});

// POST /api/engagement/save/:contentType/:contentId - toggle save
router.post('/save/:contentType/:contentId', authenticateToken, async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const userId = req.user.userId;
    
    // Validate contentType
    const validTypes = ['News', 'SocialPost', 'Event', 'Resource'];
    if (!validTypes.includes(contentType)) {
      return res.status(400).json({ error: 'Invalid content type for saving' });
    }
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return res.status(400).json({ error: 'Invalid content ID' });
    }
    
    // Get current engagement status
    const currentEngagement = await EngagementService.getUserEngagement(userId, contentType, contentId);
    const isCurrentlySaved = currentEngagement?.saved || false;
    
    // Toggle save
    const engagement = await EngagementService.toggleEngagement(
      userId, 
      contentType, 
      contentId, 
      'save', 
      !isCurrentlySaved
    );
    
    res.json({
      success: true,
      saved: !isCurrentlySaved,
      engagement: engagement
    });
  } catch (error) {
    console.error('Error toggling save:', error);
    res.status(500).json({ error: 'Failed to toggle save', details: error.message });
  }
});

// POST /api/engagement/share/:contentType/:contentId - record share
router.post('/share/:contentType/:contentId', authenticateToken, async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const userId = req.user.userId;
    
    // Validate contentType
    const validTypes = ['News', 'SocialPost', 'Event', 'Resource'];
    if (!validTypes.includes(contentType)) {
      return res.status(400).json({ error: 'Invalid content type for sharing' });
    }
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return res.status(400).json({ error: 'Invalid content ID' });
    }
    
    // Record share (always increment)
    const engagement = await EngagementService.toggleEngagement(
      userId, 
      contentType, 
      contentId, 
      'share', 
      true
    );
    
    res.json({
      success: true,
      shared: true,
      engagement: engagement
    });
  } catch (error) {
    console.error('Error recording share:', error);
    res.status(500).json({ error: 'Failed to record share', details: error.message });
  }
});

// POST /api/engagement/view/:contentType/:contentId - record view
router.post('/view/:contentType/:contentId', authenticateToken, async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const userId = req.user.userId;
    
    // Validate contentType
    const validTypes = ['News', 'SocialPost', 'Event', 'Comment', 'Resource'];
    if (!validTypes.includes(contentType)) {
      return res.status(400).json({ error: 'Invalid content type' });
    }
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return res.status(400).json({ error: 'Invalid content ID' });
    }
    
    // Check if already viewed to avoid duplicate counts
    const currentEngagement = await EngagementService.getUserEngagement(userId, contentType, contentId);
    if (!currentEngagement?.viewed) {
      // Record view (only if not already viewed)
      const engagement = await EngagementService.toggleEngagement(
        userId, 
        contentType, 
        contentId, 
        'view', 
        true
      );
      
      res.json({
        success: true,
        viewed: true,
        engagement: engagement
      });
    } else {
      res.json({
        success: true,
        viewed: true,
        message: 'Already viewed'
      });
    }
  } catch (error) {
    console.error('Error recording view:', error);
    res.status(500).json({ error: 'Failed to record view', details: error.message });
  }
});

// GET /api/engagement/user/:contentType/:contentId - get user's engagement for specific content
router.get('/user/:contentType/:contentId', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 GET USER ENGAGEMENT DEBUG:', {
      contentType: req.params.contentType,
      contentId: req.params.contentId,
      user: req.user,
      hasAuth: !!req.headers.authorization
    });
    
    const { contentType, contentId } = req.params;
    const userId = req.user.userId;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return res.status(400).json({ error: 'Invalid content ID' });
    }
    
    console.log('🔍 Calling EngagementService.getUserEngagement with:', { userId, contentType, contentId });
    const engagement = await EngagementService.getUserEngagement(userId, contentType, contentId);
    console.log('🔍 EngagementService returned:', engagement);
    
    const responseData = {
      success: true,
      engagement: engagement || {
        liked: false,
        saved: false,
        shared: false,
        viewed: false
      }
    };
    
    console.log('🔍 Sending response:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Error getting user engagement:', error);
    res.status(500).json({ error: 'Failed to get user engagement', details: error.message });
  }
});

// GET /api/engagement/user/liked/:contentType - get user's liked content
router.get('/user/liked/:contentType', authenticateToken, async (req, res) => {
  try {
    const { contentType } = req.params;
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;
    
    const likedContent = await EngagementService.getUserLikedContent(
      userId, 
      contentType, 
      parseInt(page), 
      parseInt(limit)
    );
    
    res.json({
      success: true,
      content: likedContent,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error getting user liked content:', error);
    res.status(500).json({ error: 'Failed to get liked content', details: error.message });
  }
});

// GET /api/engagement/user/saved/:contentType - get user's saved content
router.get('/user/saved/:contentType', authenticateToken, async (req, res) => {
  try {
    const { contentType } = req.params;
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;
    
    const savedContent = await EngagementService.getUserSavedContent(
      userId, 
      contentType, 
      parseInt(page), 
      parseInt(limit)
    );
    
    res.json({
      success: true,
      content: savedContent,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error getting user saved content:', error);
    res.status(500).json({ error: 'Failed to get saved content', details: error.message });
  }
});

// GET /api/engagement/user/saved - get all user's saved content (all types)
router.get('/user/saved', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 50 } = req.query;
    
    // Get saved content for all types
    const [newsContent, eventContent, resourceContent, socialContent] = await Promise.all([
      EngagementService.getUserSavedContent(userId, 'News', 1, parseInt(limit)),
      EngagementService.getUserSavedContent(userId, 'Event', 1, parseInt(limit)),
      EngagementService.getUserSavedContent(userId, 'Resource', 1, parseInt(limit)),
      EngagementService.getUserSavedContent(userId, 'SocialPost', 1, parseInt(limit))
    ]);
    
    res.json({
      success: true,
      content: {
        news: newsContent,
        events: eventContent,
        resources: resourceContent,
        social: socialContent
      },
      totalCount: newsContent.length + eventContent.length + resourceContent.length + socialContent.length
    });
  } catch (error) {
    console.error('Error getting all user saved content:', error);
    res.status(500).json({ error: 'Failed to get saved content', details: error.message });
  }
});

// GET /api/engagement/stats/:contentType/:contentId - get engagement stats for content
router.get('/stats/:contentType/:contentId', async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return res.status(400).json({ error: 'Invalid content ID' });
    }
    
    const stats = await EngagementService.getContentEngagementStats(contentType, contentId);
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error getting engagement stats:', error);
    res.status(500).json({ error: 'Failed to get engagement stats', details: error.message });
  }
});

// GET /api/engagement/batch/:contentType - get user's engagement for multiple content items
router.post('/batch/:contentType', authenticateToken, async (req, res) => {
  try {
    const { contentType } = req.params;
    const { contentIds } = req.body;
    const userId = req.user.userId;
    
    if (!Array.isArray(contentIds)) {
      return res.status(400).json({ error: 'contentIds must be an array' });
    }
    
    // Validate all ObjectIds
    const validIds = contentIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    const engagements = await EngagementService.getUserEngagements(userId, contentType, validIds);
    
    res.json({
      success: true,
      engagements: engagements
    });
  } catch (error) {
    console.error('Error getting batch engagements:', error);
    res.status(500).json({ error: 'Failed to get batch engagements', details: error.message });
  }
});

module.exports = router; 