const SocialPost = require('../models/SocialPost');
const Follow = require('../models/Follow');
const SocialInteraction = require('../models/SocialInteraction');
const CacheService = require('./CacheService');

/**
 * Social Feed Service - Handles personalized feed generation with caching
 * Implements multiple feed algorithms and optimization strategies
 */
class SocialFeedService {
  
  /**
   * Generate personalized feed for a user
   * @param {string} userId - User ID
   * @param {Object} options - Feed options
   * @returns {Promise<Object>} Feed data with posts and metadata
   */
  async generatePersonalizedFeed(userId, options = {}) {
    const {
      page = 1,
      limit = 10,
      algorithm = 'chronological', // 'chronological', 'engagement', 'mixed'
      includeGroups = true,
      includeFollowing = true,
      cursor = null
    } = options;

    // Generate cache key
    const cacheKey = CacheService.generateFeedKey(userId, algorithm, cursor || 'initial');
    
    // Try to get from cache first
    const cached = CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      let query = { status: 'active' };
      let sort = {};
      
      // Get user's social connections
      const [following, groupMemberships] = await Promise.all([
        includeFollowing ? this.getUserFollowing(userId) : [],
        includeGroups ? this.getUserGroups(userId) : []
      ]);
      
      // Build content sources
      const contentSources = [];
      
      if (includeFollowing && following.length > 0) {
        contentSources.push({ author: { $in: following } });
      }
      
      if (includeGroups && groupMemberships.length > 0) {
        contentSources.push({ groupId: { $in: groupMemberships } });
      }
      
      // Include user's own posts
      contentSources.push({ author: userId });
      
      // Include public posts from club members
      contentSources.push({ 
        visibility: { $in: ['public', 'club-members'] },
        author: { $ne: userId }
      });
      
      if (contentSources.length > 0) {
        query.$or = contentSources;
      }
      
      // Apply algorithm-specific sorting
      switch (algorithm) {
        case 'engagement':
          sort = { 
            likes: -1, 
            comments: -1,
            createdAt: -1 
          };
          break;
        case 'mixed':
          // Boost recent posts with good engagement
          query.$expr = {
            $gt: [
              {
                $add: [
                  { $multiply: ['$likes', 2] },
                  { $multiply: ['$comments', 3] },
                  { $multiply: ['$shares', 1] }
                ]
              },
              0
            ]
          };
          sort = { createdAt: -1 };
          break;
        default: // chronological
          sort = { createdAt: -1 };
      }
      
      // Cursor-based pagination for infinite scroll
      if (cursor) {
        query.createdAt = { $lt: new Date(cursor) };
      }
      
      // Execute query with population
      const posts = await SocialPost.find(query)
        .populate('author', 'name uniqueId profile.avatar socialStats')
        .populate('mentions', 'name uniqueId profile.avatar')
        .populate('groupId', 'name slug coverImage')
        .sort(sort)
        .limit(limit)
        .lean();
      
      // Enhance posts with user interaction data
      const enhancedPosts = await this.enhancePostsWithUserData(posts, userId);
      
      // Calculate next cursor
      const nextCursor = posts.length > 0 ? posts[posts.length - 1].createdAt : null;
      
      const result = {
        posts: enhancedPosts,
        pagination: {
          hasMore: posts.length === limit,
          nextCursor,
          algorithm
        },
        metadata: {
          totalSources: contentSources.length,
          followingCount: following.length,
          groupsCount: groupMemberships.length
        }
      };

      // Cache the result for 2 minutes
      CacheService.set(cacheKey, result, 2 * 60 * 1000);
      
      return result;
      
    } catch (error) {
      console.error('Error generating personalized feed:', error);
      throw new Error('Failed to generate feed');
    }
  }
  
  /**
   * Get trending posts based on recent engagement
   * @param {Object} options - Options for trending calculation
   * @returns {Promise<Array>} Trending posts
   */
  async getTrendingPosts(options = {}) {
    const {
      timeframe = 24, // hours
      limit = 20,
      minEngagement = 5
    } = options;
    
    // Check cache first
    const cacheKey = CacheService.generateTrendingKey(timeframe, limit);
    const cached = CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const since = new Date(Date.now() - timeframe * 60 * 60 * 1000);
    
    const posts = await SocialPost.find({
      status: 'active',
      createdAt: { $gte: since },
      $expr: {
        $gte: [
          {
            $add: [
              '$likes',
              { $multiply: ['$comments', 2] },
              { $multiply: ['$shares', 3] }
            ]
          },
          minEngagement
        ]
      }
    })
    .populate('author', 'name uniqueId profile.avatar')
    .populate('groupId', 'name slug')
    .sort({
      likes: -1,
      comments: -1,
      createdAt: -1
    })
    .limit(limit)
    .lean();

    // Transform posts to include engagement data in expected format
    const transformedPosts = posts.map(post => ({
      ...post,
      // Include direct engagement stats for InteractionButtons
      likeCount: post.likes || 0,
      shareCount: post.shares || 0,
      saveCount: post.saves || 0,
      commentCount: post.comments || 0,
      // Also keep the original engagement object structure for compatibility
      engagement: {
        likeCount: post.likes || 0,
        shareCount: post.shares || 0,
        saveCount: post.saves || 0,
        commentCount: post.comments || 0,
        views: 0
      }
    }));

    // Cache for 5 minutes
    CacheService.set(cacheKey, transformedPosts, 5 * 60 * 1000);
    
    return transformedPosts;
  }
  
  /**
   * Get group-specific feed
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID (for permissions)
   * @param {Object} options - Feed options
   * @returns {Promise<Object>} Group feed
   */
  async getGroupFeed(groupId, userId, options = {}) {
    const { page = 1, limit = 10, cursor = null } = options;
    
    // Check user's membership
    const membership = await GroupMembership.findOne({
      groupId,
      userId,
      status: 'active'
    });
    
    if (!membership) {
      throw new Error('User is not a member of this group');
    }
    
    let query = {
      groupId,
      status: 'active'
    };
    
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }
    
    const posts = await SocialPost.find(query)
      .populate('author', 'name uniqueId profile.avatar')
      .populate('mentions', 'name uniqueId')
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(limit);
    
    const enhancedPosts = await this.enhancePostsWithUserData(posts, userId);
    const nextCursor = posts.length > 0 ? posts[posts.length - 1].createdAt : null;
    
    return {
      posts: enhancedPosts,
      pagination: {
        hasMore: posts.length === limit,
        nextCursor
      },
      group: await Group.findById(groupId).select('name description memberCount')
    };
  }
  
  /**
   * Get user's following list
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of user IDs
   */
  async getUserFollowing(userId) {
    const follows = await Follow.find({
      followerId: userId,
      status: 'accepted'
    }).select('followingId').lean();
    
    return follows.map(f => f.followingId);
  }
  
  /**
   * Get user's group memberships
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of group IDs
   */
  async getUserGroups(userId) {
    const memberships = await GroupMembership.find({
      userId,
      status: 'active'
    }).select('groupId').lean();
    
    return memberships.map(m => m.groupId);
  }
  
  /**
   * Enhance posts with user-specific interaction data
   * @param {Array} posts - Array of posts
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Enhanced posts
   */
  async enhancePostsWithUserData(posts, userId) {
    if (!posts.length) return posts;
    
    const postIds = posts.map(p => p._id);
    
    // Get user's interactions with these posts
    const interactions = await SocialInteraction.find({
      userId,
      targetId: { $in: postIds },
      targetType: 'SocialPost',
      isActive: true
    }).lean();
    
    // Create interaction lookup map
    const interactionMap = {};
    interactions.forEach(interaction => {
      const key = `${interaction.targetId}_${interaction.actionType}`;
      interactionMap[key] = interaction;
    });
    
    // Enhance posts with user interaction flags and engagement data
    return posts.map(post => ({
      ...post,
      // Pass engagement data correctly to frontend (direct fields)
      likeCount: post.likes || 0,
      commentCount: post.comments || 0,
      shareCount: post.shares || 0,
      saveCount: post.saves || 0,
      userInteractions: {
        liked: !!interactionMap[`${post._id}_like`],
        saved: !!interactionMap[`${post._id}_save`],
        shared: !!interactionMap[`${post._id}_share`]
      }
    }));
  }
  
  /**
   * Get suggested posts for discovery
   * @param {string} userId - User ID
   * @param {Object} options - Options
   * @returns {Promise<Array>} Suggested posts
   */
  async getSuggestedPosts(userId, options = {}) {
    const { limit = 10 } = options;
    
    // Get user's interests and interaction history
    const userInteractions = await SocialInteraction.find({
      userId,
      actionType: 'like',
      isActive: true
    }).populate('targetId').limit(100);
    
    // Extract hashtags from liked posts
    const likedHashtags = [];
    userInteractions.forEach(interaction => {
      if (interaction.targetId && interaction.targetId.hashtags) {
        likedHashtags.push(...interaction.targetId.hashtags);
      }
    });
    
    // Find posts with similar hashtags that user hasn't interacted with
    const suggestedPosts = await SocialPost.find({
      status: 'active',
      visibility: { $in: ['public', 'club-members'] },
      hashtags: { $in: likedHashtags },
      author: { $ne: userId },
      _id: { $nin: userInteractions.map(i => i.targetId) }
    })
    .populate('author', 'name uniqueId profile.avatar')
    .sort({ likes: -1, createdAt: -1 })
    .limit(limit);
    
    return suggestedPosts;
  }
}

module.exports = new SocialFeedService();
