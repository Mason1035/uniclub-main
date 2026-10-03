const express = require('express');
const router = express.Router();
const SocialPost = require('../models/SocialPost');
const SocialComment = require('../models/SocialComment');
const Comment = require('../models/Comment');
const SocialInteraction = require('../models/SocialInteraction');
const Follow = require('../models/Follow');
const User = require('../models/User');
const EngagementService = require('../services/EngagementService');
const SocialFeedService = require('../services/SocialFeedService');
const CacheService = require('../services/CacheService');
const authenticateToken = require('../middleware/auth');
const { 
  createPostLimit, 
  createCommentLimit, 
  interactionLimit, 
  followLimit 
} = require('../middleware/rateLimit');
const { 
  validateContent, 
  validateMediaFiles, 
  sanitizeContent 
} = require('../middleware/contentValidation');
const { 
  checkPostPrivacy, 
  checkUserProfilePrivacy, 
  requireClubMembership,
  blockUnauthorizedActions
} = require('../middleware/privacy');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Set up media uploads directory
const uploadsDir = path.join(__dirname, '../public/uploads/social');
console.log('📁 Uploads directory path:', uploadsDir);

// Only check/create directory in local development (not in serverless)
if (process.env.NODE_ENV !== 'production') {
  console.log('📁 Directory exists:', fs.existsSync(uploadsDir));
  
  if (!fs.existsSync(uploadsDir)) {
    console.log('📁 Creating uploads directory...');
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Directory created successfully');
  }
} else {
  console.log('📁 Running in production - skipping file system checks');
}

// Enhanced multer configuration for images and videos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileType = file.mimetype.startsWith('video/') ? 'video' : 'image';
    cb(null, `${fileType}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  
  if (allowedImageTypes.includes(file.mimetype) || allowedVideoTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024 // 50MB for videos
  },
  fileFilter: fileFilter
});

// ==================== FEED ENDPOINTS ====================

// GET /api/social/feed - Get personalized social feed
router.get('/feed', authenticateToken, requireClubMembership, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      algorithm = 'chronological',
      includeGroups = 'true',
      includeFollowing = 'true',
      cursor = null
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      algorithm,
      includeGroups: includeGroups === 'true',
      includeFollowing: includeFollowing === 'true',
      cursor
    };

    const feedData = await SocialFeedService.generatePersonalizedFeed(
      req.user.userId,
      options
    );

    res.json({
      success: true,
      ...feedData
    });
  } catch (error) {
    console.error('Error fetching social feed:', error);
    res.status(500).json({ error: 'Failed to fetch social feed', details: error.message });
  }
});


// GET /api/social/suggested - Get suggested posts for discovery
router.get('/suggested', authenticateToken, requireClubMembership, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const suggestedPosts = await SocialFeedService.getSuggestedPosts(
      req.user.userId,
      { limit: parseInt(limit) }
    );

    res.json({
      success: true,
      posts: suggestedPosts
    });
  } catch (error) {
    console.error('Error fetching suggested posts:', error);
    res.status(500).json({ error: 'Failed to fetch suggested posts', details: error.message });
  }
});

// ==================== POST MANAGEMENT ====================

// POST /api/social/posts - Create a new social post with optional media
router.post('/posts', authenticateToken, requireClubMembership, createPostLimit, upload.array('media', 5), validateMediaFiles, sanitizeContent, validateContent, async (req, res) => {
  try {
    const { 
      content, 
      mentions, 
      visibility = 'club-members',
      postType = 'text',
      pollData,
      projectData
    } = req.body;
    
    if (!content && !req.files?.length) {
      return res.status(400).json({ error: 'Content or media is required' });
    }
    
    // Process uploaded media
    const media = [];
    console.log('🔍 Processing uploaded files:', {
      hasFiles: !!req.files,
      fileCount: req.files?.length || 0,
      files: req.files?.map(f => ({ name: f.originalname, size: f.size, mimetype: f.mimetype, filename: f.filename }))
    });
    
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Get base URL from environment or default to localhost:5000
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
        
        const mediaItem = {
          type: file.mimetype.startsWith('video/') ? 'video' : 'image',
          url: `${baseUrl}/uploads/social/${file.filename}`,
          filename: file.filename,
          size: file.size
        };
        
        console.log('📁 Created media item:', mediaItem);
        
        // For videos, you might want to generate thumbnails here
        // This is a placeholder - in production, use ffmpeg or similar
        if (mediaItem.type === 'video') {
          mediaItem.thumbnail = `/uploads/social/thumb-${file.filename}.jpg`;
          // TODO: Generate video thumbnail
        }
        
        media.push(mediaItem);
      }
    }
    
    console.log('📦 Final media array:', media);
    
    // Parse mentions and hashtags (hashtags are now part of content, not separate)
    const parsedHashtags = []; // Hashtags are extracted from content automatically
    const parsedMentions = mentions ? JSON.parse(mentions) : [];
    
    
    // Create post object
    const postData = {
      content,
      media,
      hashtags: parsedHashtags,
      mentions: parsedMentions,
      visibility,
      postType,
      author: req.user.userId
    };
    
    // Add optional fields
    if (pollData) postData.poll = JSON.parse(pollData);
    if (projectData) postData.projectData = JSON.parse(projectData);
    
    const post = new SocialPost(postData);
    
    console.log('💾 Saving post with data:', {
      content: postData.content,
      mediaCount: postData.media.length,
      media: postData.media,
      postType: postData.postType
    });
    
    await post.save();
    console.log('✅ Post saved successfully with ID:', post._id);
    
    await post.populate('author', 'name uniqueId profile.avatar');
    await post.populate('mentions', 'name uniqueId profile.avatar');
    
    // Update user's post count
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: { 'socialStats.postsCreated': 1 }
    });

    // Invalidate feed caches
    CacheService.invalidatePattern(`feed:${req.user.userId}`);
    
    res.status(201).json({
      success: true,
      post
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post', details: error.message });
  }
});

// GET /api/social/posts - List all social posts (most recent first)
router.get('/posts', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      type, 
      userId, 
      hashtag 
    } = req.query;
    
    let query = { status: 'active' };
    
    // Apply filters
    if (type) query.postType = type;
    if (userId) query.author = userId;
    if (hashtag) query.hashtags = hashtag;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const posts = await SocialPost.find(query)
      .populate('author', 'name uniqueId profile.avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
      
    const total = await SocialPost.countDocuments(query);
    
    // Get real-time comment counts for all posts using unified Comment system
    const postIds = posts.map(post => post._id);
    const commentCounts = await Comment.aggregate([
      { 
        $match: { 
          contentType: 'social',
          contentId: { $in: postIds }, 
          status: 'active' 
        } 
      },
      { $group: { _id: '$contentId', count: { $sum: 1 } } }
    ]);
    
    const commentCountMap = {};
    commentCounts.forEach(cc => {
      commentCountMap[cc._id.toString()] = cc.count;
    });
    
    // Transform posts to include engagement data in the expected format
    const transformedPosts = posts.map(post => ({
      ...post,
      // Include direct engagement stats for InteractionButtons
      likeCount: post.likes || 0,
      shareCount: post.shares || 0,
      saveCount: post.saves || 0,
      commentCount: commentCountMap[post._id.toString()] || 0,
      // Also keep the original engagement object structure for compatibility
      engagement: {
        likeCount: post.likes || 0,
        shareCount: post.shares || 0,
        saveCount: post.saves || 0,
        commentCount: commentCountMap[post._id.toString()] || 0,
        views: 0 // Social posts don't track views yet
      }
    }));
    
    console.log('📱 Social posts API returning:', transformedPosts.slice(0, 2).map(p => ({
      content: p.content?.substring(0, 30) + '...',
      likes: p.likes,
      likeCount: p.likeCount,
      engagement: p.engagement
    })));
    
    res.json({
      success: true,
      posts: transformedPosts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + posts.length < total
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts', details: error.message });
  }
});

// PUT /api/social/posts/:id - Update a social post
router.put('/posts/:id', authenticateToken, upload.array('media', 5), validateMediaFiles, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, postType, imagesToDelete } = req.body;
    
    console.log('📝 Updating post:', { id, content, postType, imagesToDelete });
    
    // Find the post and check ownership
    const post = await SocialPost.findById(id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check if the current user is the author of the post
    if (post.author.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to edit this post' });
    }
    
    // Start with existing media
    let media = [...(post.media || [])];
    
    // Remove images marked for deletion
    if (imagesToDelete && imagesToDelete.length > 0) {
      console.log('🗑️ Removing images:', imagesToDelete);
      
      // Parse imagesToDelete if it's a JSON string
      let imagesToRemove = imagesToDelete;
      if (typeof imagesToDelete === 'string') {
        try {
          imagesToRemove = JSON.parse(imagesToDelete);
        } catch (e) {
          console.error('Error parsing imagesToDelete:', e);
          imagesToRemove = [];
        }
      }
      
      // Filter out images that are marked for deletion
      media = media.filter(mediaItem => !imagesToRemove.includes(mediaItem.url));
      console.log('✅ Images after removal:', media.length);
    }
    
    // Process new media files if any
    if (req.files && req.files.length > 0) {
      console.log('📁 Adding new media files:', req.files.length);
      
      // Get base URL from environment or default to localhost:5000
      const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      
      for (const file of req.files) {
        const mediaItem = {
          type: file.mimetype.startsWith('video/') ? 'video' : 'image',
          url: `${baseUrl}/uploads/social/${file.filename}`,
          filename: file.filename,
          size: file.size
        };
        media.push(mediaItem);
      }
    }
    
    console.log('📊 Final media array:', media.length, 'items');
    
    // Update the post
    const updatedPost = await SocialPost.findByIdAndUpdate(
      id,
      {
        content,
        postType: postType || 'text',
        media,
        updatedAt: new Date(),
        isEdited: true,
        editedAt: new Date()
      },
      { new: true }
    ).populate('author', 'name uniqueId profile.avatar');
    
    // Invalidate feed caches
    CacheService.invalidatePattern(`feed:${req.user.userId}`);
    
    res.json({
      success: true,
      message: 'Post updated successfully',
      post: updatedPost
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post', details: error.message });
  }
});

// DELETE /api/social/posts/:id - Delete a social post
router.delete('/posts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the post and check ownership
    const post = await SocialPost.findById(id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check if the current user is the author of the post
    if (post.author.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }
    
    // Soft delete by setting status to 'deleted'
    await SocialPost.findByIdAndUpdate(id, { 
      status: 'deleted',
      deletedAt: new Date()
    });
    
    // Invalidate feed caches
    CacheService.invalidatePattern(`feed:${req.user.userId}`);
    
    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post', details: error.message });
  }
});

// GET /api/social/posts/:id - Get a specific post with comments
router.get('/posts/:id', authenticateToken, checkPostPrivacy, async (req, res) => {
  try {
    console.log('🎯 SOCIAL POST ENDPOINT CALLED:', req.params.id);
    
    // Post is already validated and attached by checkPostPrivacy middleware
    const post = req.post;
    
    console.log('📄 POST DATA:', {
      id: post._id,
      content: post.content?.substring(0, 50) + '...',
      author: post.author ? {
        id: post.author._id,
        name: post.author.name,
        email: post.author.email
      } : 'NO AUTHOR',
      createdAt: post.createdAt
    });
    
    // Get top-level comments using unified Comment model
    const comments = await Comment.find({
      contentType: 'social',
      contentId: req.params.id,
      parentCommentId: null,
      status: 'active'
    })
    .populate('userId', 'name uniqueId profile.avatar')
    .sort({ createdAt: -1 })
    .limit(20);
    
    console.log('✅ SOCIAL POST SUCCESS:', { postId: req.params.id, commentsCount: comments.length });
    
    res.json({
      success: true,
      post,
      comments
    });
  } catch (error) {
    console.error('❌ GET SOCIAL POST ERROR:', error);
    res.status(500).json({ error: 'Failed to fetch post', details: error.message });
  }
});

// DELETE /api/social/posts/:id - Delete a social post (author or admin only)
router.delete('/posts/:id', authenticateToken, async (req, res) => {
  try {
    const post = await SocialPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (post.author.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }
    post.status = 'deleted';
    await post.save();
    res.json({ 
      success: true,
      message: 'Post deleted successfully' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete post', details: error.message });
  }
});

// ==================== INTERACTIONS ====================

// POST /api/social/posts/:id/like - DEPRECATED - Use /api/engagement/like/SocialPost/:id instead
router.post('/posts/:id/like', authenticateToken, requireClubMembership, interactionLimit, checkPostPrivacy, async (req, res) => {
  console.warn('⚠️ DEPRECATED: /api/social/posts/:id/like - Use /api/engagement/like/SocialPost/:id instead');
  res.status(410).json({
    deprecated: true,
    message: 'This endpoint is deprecated',
    use: `/api/engagement/like/SocialPost/${req.params.id}`,
    method: 'POST'
  });
});

// POST /api/social/posts/:id/save - DEPRECATED - Use /api/engagement/save/SocialPost/:id instead
router.post('/posts/:id/save', authenticateToken, requireClubMembership, interactionLimit, checkPostPrivacy, async (req, res) => {
  console.warn('⚠️ DEPRECATED: /api/social/posts/:id/save - Use /api/engagement/save/SocialPost/:id instead');
  res.status(410).json({
    deprecated: true,
    message: 'This endpoint is deprecated',
    use: `/api/engagement/save/SocialPost/${req.params.id}`,
    method: 'POST'
  });
});

// POST /api/social/posts/:id/share - DEPRECATED - Use /api/engagement/share/SocialPost/:id instead
router.post('/posts/:id/share', authenticateToken, async (req, res) => {
  console.warn('⚠️ DEPRECATED: /api/social/posts/:id/share - Use /api/engagement/share/SocialPost/:id instead');
  res.status(410).json({
    deprecated: true,
    message: 'This endpoint is deprecated',
    use: `/api/engagement/share/SocialPost/${req.params.id}`,
    method: 'POST'
  });
});

// PUT /api/social/posts/:id/view - DEPRECATED - Use /api/engagement/view/SocialPost/:id instead
router.put('/posts/:id/view', authenticateToken, async (req, res) => {
  console.warn('⚠️ DEPRECATED: PUT /api/social/posts/:id/view - Use POST /api/engagement/view/SocialPost/:id instead');
  res.status(410).json({
    deprecated: true,
    message: 'This endpoint is deprecated',
    use: `/api/engagement/view/SocialPost/${req.params.id}`,
    method: 'POST'
  });
});

// ==================== COMMENTS ====================

// GET /api/social/posts/:id/comments - Get comments for a post
router.get('/posts/:id/comments', async (req, res) => {
  try {
    const { page = 1, limit = 20, parentId = null } = req.query;
    const postId = req.params.id;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = {
      postId,
      status: 'active'
    };
    
    // Get top-level comments or replies to a specific comment
    if (parentId) {
      query.parentCommentId = parentId;
    } else {
      query.parentCommentId = null;
    }
    
    const comments = await SocialComment.find(query)
      .populate('author', 'name uniqueId profile.avatar')
      .populate('mentions', 'name uniqueId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get reply counts for each comment
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replyCount = await SocialComment.countDocuments({
          parentCommentId: comment._id,
          status: 'active'
        });
        
        return {
          ...comment.toObject(),
          replyCount
        };
      })
    );
    
    const total = await SocialComment.countDocuments(query);
    
    res.json({
      success: true,
      comments: commentsWithReplies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore: skip + comments.length < total
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch comments', details: error.message });
  }
});

// POST /api/social/posts/:id/comments - Add a comment to a post
router.post('/posts/:id/comments', authenticateToken, requireClubMembership, createCommentLimit, sanitizeContent, validateContent, checkPostPrivacy, async (req, res) => {
  try {
    const { content, parentCommentId, mentions } = req.body;
    const postId = req.params.id;
    const userId = req.user.userId;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    // Verify post exists
    const post = await SocialPost.findById(postId);
    if (!post || post.status !== 'active') {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check if comments are allowed
    if (!post.allowComments) {
      return res.status(403).json({ error: 'Comments are not allowed on this post' });
    }
    
    // Calculate depth for nested comments
    let depth = 0;
    if (parentCommentId) {
      const parentComment = await SocialComment.findById(parentCommentId);
      if (parentComment) {
        depth = parentComment.depth + 1;
        if (depth > 5) {
          return res.status(400).json({ error: 'Maximum nesting depth reached' });
        }
      }
    }
    
    // Create comment
    const comment = new SocialComment({
      content,
      postId,
      author: userId,
      parentCommentId: parentCommentId || null,
      depth,
      mentions: mentions ? JSON.parse(mentions) : []
    });
    
    await comment.save();
    await comment.populate('author', 'name uniqueId profile.avatar');
    await comment.populate('mentions', 'name uniqueId');
    
    // Update post comment count
    await SocialPost.findByIdAndUpdate(postId, {
      $inc: { 'engagement.commentCount': 1 }
    });
    
    // Update user stats
    await User.findByIdAndUpdate(userId, {
      $inc: { 'socialStats.commentsPosted': 1 }
    });
    
    res.status(201).json({
      success: true,
      comment
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment', details: error.message });
  }
});

// DELETE /api/social/comments/:id - Delete a comment
router.delete('/comments/:id', authenticateToken, async (req, res) => {
  try {
    const comment = await SocialComment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    if (comment.author.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }
    
    comment.status = 'deleted';
    await comment.save();
    
    // Update post comment count
    await SocialPost.findByIdAndUpdate(comment.postId, {
      $inc: { 'engagement.commentCount': -1 }
    });
    
    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete comment', details: error.message });
  }
});

// ==================== FOLLOWS ====================

// POST /api/social/follow/:userId - Follow/unfollow a user
router.post('/follow/:userId', authenticateToken, requireClubMembership, followLimit, blockUnauthorizedActions, async (req, res) => {
  try {
    const followingId = req.params.userId;
    const followerId = req.user.userId;
    
    if (followerId === followingId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }
    
    // Check if user exists
    const userToFollow = await User.findById(followingId);
    if (!userToFollow) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check existing follow relationship
    const existingFollow = await Follow.findOne({
      followerId,
      followingId
    });
    
    if (existingFollow) {
      // Toggle follow status
      if (existingFollow.status === 'accepted') {
        existingFollow.status = 'blocked'; // Unfollow
      } else {
        existingFollow.status = 'accepted'; // Re-follow
        existingFollow.lastInteraction = new Date();
      }
      await existingFollow.save();
      
      res.json({
        success: true,
        following: existingFollow.status === 'accepted',
        status: existingFollow.status
      });
    } else {
      // Create new follow relationship
      const newFollow = new Follow({
        followerId,
        followingId,
        status: userToFollow.settings?.profileVisibility === 'private' ? 'pending' : 'accepted'
      });
      
      await newFollow.save();
      
      res.json({
        success: true,
        following: newFollow.status === 'accepted',
        status: newFollow.status
      });
    }
  } catch (error) {
    console.error('Error toggling follow:', error);
    res.status(500).json({ error: 'Failed to toggle follow' });
  }
});

// GET /api/social/users/:userId/followers - Get user's followers
router.get('/users/:userId/followers', authenticateToken, checkUserProfilePrivacy, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.params.userId;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const followers = await Follow.find({
      followingId: userId,
      status: 'accepted'
    })
    .populate('followerId', 'name uniqueId profile.avatar socialStats')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
    
    const total = await Follow.countDocuments({
      followingId: userId,
      status: 'accepted'
    });
    
    res.json({
      success: true,
      followers: followers.map(f => f.followerId),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore: skip + followers.length < total
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch followers', details: error.message });
  }
});

// GET /api/social/users/:userId/following - Get users that this user follows
router.get('/users/:userId/following', authenticateToken, checkUserProfilePrivacy, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.params.userId;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const following = await Follow.find({
      followerId: userId,
      status: 'accepted'
    })
    .populate('followingId', 'name uniqueId profile.avatar socialStats')
    .sort({ lastInteraction: -1 })
    .skip(skip)
    .limit(parseInt(limit));
    
    const total = await Follow.countDocuments({
      followerId: userId,
      status: 'accepted'
    });
    
    res.json({
      success: true,
      following: following.map(f => f.followingId),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore: skip + following.length < total
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch following', details: error.message });
  }
});

module.exports = router; 