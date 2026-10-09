const express = require('express');
const router = express.Router();
router.use(require('../middleware/activityReadAccess').createActivityReadAccess().content);
const Comment = require('../models/Comment');
// REMOVED CommentLike - comment likes disabled
const News = require('../models/News');
const Event = require('../models/Event');
const Resource = require('../models/Resource');
const SocialPost = require('../models/SocialPost');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { createUserNotification } = require('../utils/notificationPreferences');
const NewsCurationService = require('../services/NewsCurationService');
const jwt = require('jsonwebtoken');
const authenticateToken = require('../middleware/auth');
const { getCommentFilter } = require('../utils/commentFilter');

// Get comments for an article
router.get('/article/:articleId', async (req, res) => {
  try {
    const { articleId } = req.params;
    const { limit = 20, page = 1, sort = 'newest' } = req.query;
    
    // Define sort options
    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      mostLiked: { 'likes.length': -1, createdAt: -1 },
      mostReplied: { replyCount: -1, createdAt: -1 }
    };
    
    // Get top-level comments (no parent)
    const comments = await Comment.find({ 
      articleId, 
      parentCommentId: null, 
      status: 'active' 
    })
      .populate('userId', 'name profile.avatar uniqueId')
      .sort(sortOptions[sort] || sortOptions.newest)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    // Extract user ID if authenticated
    const userId = req.user?.userId;
    
    // Get replies for each comment
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await Comment.find({ 
          parentCommentId: comment._id, 
          status: 'active' 
        })
          .populate('userId', 'name profile.avatar uniqueId')
          .sort({ createdAt: 1 })
          .limit(5); // Limit replies shown initially
        
        // Add user engagement status for replies
        const repliesWithEngagement = replies.map(reply => ({
          ...reply.toObject(),
          userHasLiked: userId ? reply.likes.includes(userId) : false
        }));
        
        return {
          ...comment.toObject(),
          replies: repliesWithEngagement,
          replyCount: await Comment.countDocuments({ 
            parentCommentId: comment._id, 
            status: 'active' 
          }),
          userHasLiked: userId ? comment.likes.includes(userId) : false
        };
      })
    );
    
    const totalComments = await Comment.countDocuments({ 
      articleId, 
      parentCommentId: null, 
      status: 'active' 
    });
    
    res.json({
      comments: commentsWithReplies,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalComments / parseInt(limit)),
        totalComments,
        hasMore: parseInt(page) * parseInt(limit) < totalComments
      }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Create a new comment
router.post('/article/:articleId', authenticateToken, async (req, res) => {
  try {
    const { articleId } = req.params;
    const { content } = req.body; // REMOVED parentComment - no replies allowed
    const userId = req.user.userId;
    
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Verify article exists
    const article = await News.findById(articleId);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create comment
    const comment = new Comment({
      text: content,
      contentId: articleId,
      contentType: 'news',
      articleId,
      userId: userId,
      parentCommentId: parentComment || null
    });
    
    await comment.save();
    
    // Update user's comment count
    await User.findByIdAndUpdate(userId, {
      $inc: { 'socialStats.commentsPosted': 1 }
    });
    
    // Create notification for article author if it's not the same user
    if (article.author.toString() !== userId) {
      await createUserNotification({
        recipient: article.author,
        type: 'comment_reply',
        comment: comment._id,
        article: articleId,
        actor: userId
      });
    }
    
    // NO REPLY NOTIFICATIONS - replies removed
    
    // Populate author info for response
    await comment.populate('userId', 'name profile.avatar uniqueId');
    
    // Trigger throttled engagement ranking update
    NewsCurationService.updateEngagementRanking(false).catch(error => {
      console.error('❌ Error updating engagement ranking:', error);
    });
    
    res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// COMMENT LIKE FUNCTIONALITY REMOVED

// Get replies for a specific comment
router.get('/:commentId/replies', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { limit = 10, page = 1 } = req.query;
    
    const replies = await Comment.find({ 
      parentCommentId: commentId, 
      status: 'active' 
    })
      .populate('userId', 'name profile.avatar uniqueId')
      .sort({ createdAt: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const totalReplies = await Comment.countDocuments({ 
      parentCommentId: commentId, 
      status: 'active' 
    });
    
    res.json({
      replies,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalReplies / parseInt(limit)),
        totalReplies,
        hasMore: parseInt(page) * parseInt(limit) < totalReplies
      }
    });
  } catch (error) {
    console.error('Error fetching replies:', error);
    res.status(500).json({ error: 'Failed to fetch replies' });
  }
});

// Update a comment (edit)
router.put('/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;
    
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    // Check if user is the author
    if (comment.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }
    
    // Update comment
    comment.text = content;
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();
    
    // Populate author info for response
    await comment.populate('userId', 'name profile.avatar uniqueId');
    
    res.json(comment);
  } catch (error) {
    console.error('Error editing comment:', error);
    res.status(500).json({ error: 'Failed to edit comment' });
  }
});

// Delete a comment (hard delete - permanent removal)
router.delete('/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    // Check if user is the author
    if (comment.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }
    
    // Get content type for content counter update
    const { contentId, contentType } = comment;
    
    // Hard delete the comment and all its replies
    await Comment.deleteMany({
      $or: [
        { _id: commentId },
        { parentCommentId: commentId }
      ]
    });
    
    // NO COMMENT LIKES TO DELETE - likes removed
    
    // Decrease user's comment count
    await User.findByIdAndUpdate(userId, {
      $inc: { 'socialStats.commentsPosted': -1 }
    });
    
    // Update content item's comment count
    let ModelRef = null;
    switch (contentType) {
      case 'news':
        ModelRef = News;
        break;
      case 'event':
        ModelRef = Event;
        break;
      case 'resource':
        ModelRef = Resource;
        break;
      case 'social':
        ModelRef = SocialPost;
        break;
    }
    
    if (ModelRef) {
      await ModelRef.findByIdAndUpdate(contentId, {
        $inc: { comments: -1 }
      });
    }
    
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Track comment view
router.put('/:commentId/view', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    // For view tracking, increment views counter directly
    comment.views = (comment.views || 0) + 1;
    
    await comment.save();
    
    res.json({ views: comment.views });
  } catch (error) {
    console.error('Error tracking comment view:', error);
    res.status(500).json({ error: 'Failed to track comment view' });
  }
});

// Generic routes for multiple content types

// Get comments for any content type
router.get('/:contentType/:contentId', async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const { limit = 20, page = 1, sort = 'newest' } = req.query;
    
    // Validate contentType
    if (!['news', 'event', 'resource', 'social'].includes(contentType)) {
      return res.status(400).json({ error: 'Invalid content type' });
    }
    
    // Define sort options
    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      mostLiked: { likeCount: -1, createdAt: -1 }
    };
    
        // Get top-level comments (no parent) using shared filter
    const comments = await Comment.find(
      getCommentFilter(contentId, contentType, { topLevelOnly: true })
    )
      .populate('userId', 'name profile.avatar uniqueId')
      .sort(sortOptions[sort] || sortOptions.newest)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    // Extract user ID if authenticated
    const userId = req.user?.userId;
    
    // Return comments as-is (NO LIKES, NO REPLIES - ULTRA SIMPLIFIED)
    const simpleComments = comments.map(comment => comment.toObject());
    
    const totalComments = await Comment.countDocuments({ 
      contentId, 
      contentType,
      parentCommentId: null, 
      status: 'active' 
    });
    
    res.json({
      comments: simpleComments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalComments / parseInt(limit)),
        totalComments,
        hasMore: parseInt(page) * parseInt(limit) < totalComments
      }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Get comment count for any content type
router.get('/:contentType/:contentId/count', async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    
    // Validate contentType
    if (!['news', 'event', 'resource', 'social'].includes(contentType)) {
      return res.status(400).json({ error: 'Invalid content type' });
    }
    
    // DEBUG: For social posts, log what we're counting
    if (contentType === 'social') {
      const allComments = await Comment.find(getCommentFilter(contentId, contentType)).populate('userId', 'name');
      console.log(`\n🔍 COMMENT COUNT DEBUG for ${contentType}:${contentId}`);
      console.log(`📝 All comments found: ${allComments.length}`);
      allComments.forEach((c, i) => {
        console.log(`  ${i+1}. "${c.content}" by ${c.userId?.name || 'Unknown'} - Parent: ${c.parentCommentId || 'None'}`);
      });
    }
    
    // Count ONLY top-level comments (NO REPLIES)
    const commentCount = await Comment.countDocuments(
      getCommentFilter(contentId, contentType, { topLevelOnly: true })
    );
    
    console.log(`📊 Count result for ${contentType}:${contentId} - Comments: ${commentCount}`);
    
    res.json({ 
      count: commentCount,
      topLevelCount: commentCount,
      totalCount: commentCount  // All same - no replies
    });
  } catch (error) {
    console.error('Error fetching comment count:', error);
    res.status(500).json({ error: 'Failed to fetch comment count' });
  }
});

// Create a new comment for any content type
router.post('/:contentType/:contentId', authenticateToken, async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const { content } = req.body; // REMOVED parentComment - no replies allowed
    const userId = req.user.userId;
    
    // Validate contentType
    if (!['news', 'event', 'resource', 'social'].includes(contentType)) {
      return res.status(400).json({ error: 'Invalid content type' });
    }
    
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Verify content exists based on type
    let contentItem = null;
    let ModelRef = null;
    switch (contentType) {
      case 'news':
        ModelRef = News;
        break;
      case 'event':
        ModelRef = Event;
        break;
      case 'resource':
        ModelRef = Resource;
        break;
      case 'social':
        ModelRef = SocialPost;
        break;
    }
    
    contentItem = await ModelRef.findById(contentId);
    if (!contentItem) {
      return res.status(404).json({ error: `${contentType} not found` });
    }
    
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create comment
    const comment = new Comment({
      text: content,
      contentId,
      contentType,
      userId: userId,
      parentCommentId: null, // NO REPLIES - always top-level
      // Set legacy articleId for backwards compatibility
      articleId: contentType === 'news' ? contentId : undefined
    });
    
    await comment.save();
    
    // Update user's comment count
    await User.findByIdAndUpdate(userId, {
      $inc: { 'socialStats.commentsPosted': 1 }
    });
    
    // Update content item's comment count
    const updateField = {};
    updateField.comments = (contentItem.comments || 0) + 1;
    await ModelRef.findByIdAndUpdate(contentId, { $inc: updateField });
    
    // Create notification for content author if it's not the same user
    const authorField = contentItem.author || contentItem.organizer || contentItem.uploadedBy;
    if (authorField && authorField.toString() !== userId) {
      const notificationData = {
        recipient: authorField,
        type: 'comment_reply',
        comment: comment._id,
        actor: userId
      };
      
      // Add content-specific fields based on contentType
      switch (contentType) {
        case 'news':
          notificationData.article = contentId;
          break;
        case 'event':
          notificationData.event = contentId;
          break;
        case 'resource':
          notificationData.resource = contentId;
          break;
        case 'social':
          notificationData.post = contentId;
          break;
      }
      
      await createUserNotification(notificationData);
    }
    
    // NO REPLY NOTIFICATIONS - replies removed
    
    // Populate author info for response
    await comment.populate('userId', 'name profile.avatar uniqueId');
    
    // Trigger engagement ranking update for news
    if (contentType === 'news') {
      NewsCurationService.updateEngagementRanking(false).catch(error => {
        console.error('❌ Error updating engagement ranking:', error);
      });
    }
    
    res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// Delete a comment - only the author can delete their own comment
router.delete('/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;

    console.log(`🗑️ DELETE COMMENT REQUEST: commentId=${commentId}, userId=${userId}`);

    // Find the comment first to verify ownership
    const comment = await Comment.findById(commentId);
    if (!comment) {
      console.log('❌ Comment not found');
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if the user is the author of the comment
    if (comment.userId.toString() !== userId) {
      console.log('❌ Unauthorized: User is not the comment author');
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    console.log('✅ User authorized to delete comment');

    // Get content type and ID for updating comment count
    const contentType = comment.contentType;
    const contentId = comment.contentId;

    // Delete the comment
    await Comment.findByIdAndDelete(commentId);
    console.log('✅ Comment deleted from database');

    // Update the comment count on the parent content
    const ModelRef = getModelReference(contentType);
    if (ModelRef) {
      await ModelRef.findByIdAndUpdate(contentId, { 
        $inc: { comments: -1 } 
      });
      console.log(`✅ Decremented comment count for ${contentType}:${contentId}`);
    }

    // Update user's comment count
    await User.findByIdAndUpdate(userId, {
      $inc: { 'socialStats.commentsPosted': -1 }
    });
    console.log('✅ Decremented user comment count');

    // TODO: Optionally delete related notifications
    // await Notification.deleteMany({ comment: commentId });

    res.status(200).json({ 
      success: true, 
      message: 'Comment deleted successfully',
      deletedCommentId: commentId
    });

  } catch (error) {
    console.error('❌ Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
