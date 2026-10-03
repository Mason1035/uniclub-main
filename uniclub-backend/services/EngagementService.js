const UserEngagement = require('../models/UserEngagement');
const News = require('../models/News');
const SocialPost = require('../models/SocialPost');
const Event = require('../models/Event');
const Comment = require('../models/Comment');
const Resource = require('../models/Resource');
const User = require('../models/User');

class EngagementService {
  
  /**
   * Toggle user engagement (like, save, share) for any content type
   * @param {String} userId - User ID
   * @param {String} contentType - 'News', 'SocialPost', 'Event', 'Comment', 'Resource'
   * @param {String} contentId - Content ID
   * @param {String} action - 'like', 'save', 'share', 'view'
   * @param {Boolean} value - true to add, false to remove
   */
  static async toggleEngagement(userId, contentType, contentId, action, value = true) {
    try {
      const mongoose = require('mongoose');
      
      // Convert IDs to ObjectId if they're strings
      const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      const contentObjectId = typeof contentId === 'string' ? new mongoose.Types.ObjectId(contentId) : contentId;
      
      // Find or create engagement record
      let engagement = await UserEngagement.findOneAndUpdate(
        { user: userObjectId, contentType, contentId: contentObjectId },
        { 
          user: userObjectId, 
          contentType, 
          contentId: contentObjectId,
          lastEngagedAt: new Date()
        },
        { upsert: true, new: true }
      );
      
      // Update specific engagement type
      const updateData = {};
      // Map action to correct schema field name
      const fieldName = action === 'like' ? 'liked' : 
                       action === 'save' ? 'saved' : 
                       action === 'share' ? 'shared' : 
                       action === 'view' ? 'viewed' : action;
      
      updateData[fieldName] = value;
      
      if (value) {
        updateData[`${action}At`] = new Date();
      } else {
        updateData[`${action}At`] = null;
      }
      
      engagement = await UserEngagement.findByIdAndUpdate(
        engagement._id,
        updateData,
        { new: true }
      );
      
      // Update counter in the content document
      await this.updateContentCounter(contentType, contentObjectId, action, value ? 1 : -1);
      
      // Update user stats if applicable
      if (action === 'like' && contentType === 'News') {
        await User.findByIdAndUpdate(userObjectId, {
          $inc: { 'socialStats.articlesLiked': value ? 1 : -1 }
        });
      } else if (action === 'save' && contentType === 'News') {
        await User.findByIdAndUpdate(userObjectId, {
          $inc: { 'socialStats.articlesSaved': value ? 1 : -1 }
        });
      }
      
      return engagement;
      
    } catch (error) {
      console.error('Error toggling engagement:', error);
      throw error;
    }
  }
  
  /**
   * Update engagement counters in content documents
   */
  static async updateContentCounter(contentType, contentId, action, increment) {
    try {
      const Model = this.getContentModel(contentType);
      const updateField = this.getCounterField(action, contentType);
      
      if (!updateField) return;
      
      const updateQuery = { $inc: {} };
      updateQuery.$inc[updateField] = increment;
      
      await Model.findByIdAndUpdate(contentId, updateQuery);
      
    } catch (error) {
      console.error('Error updating content counter:', error);
    }
  }
  
  /**
   * Get user's engagement for specific content
   */
  static async getUserEngagement(userId, contentType, contentId) {
    try {
      const mongoose = require('mongoose');
      
      // Convert IDs to ObjectId if they're strings
      const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      const contentObjectId = typeof contentId === 'string' ? new mongoose.Types.ObjectId(contentId) : contentId;
      
      return await UserEngagement.findOne({
        user: userObjectId,
        contentType,
        contentId: contentObjectId
      });
    } catch (error) {
      console.error('Error getting user engagement:', error);
      return null;
    }
  }
  
  /**
   * Get user's engagement for multiple content items
   */
  static async getUserEngagements(userId, contentType, contentIds) {
    try {
      const mongoose = require('mongoose');
      
      // Convert IDs to ObjectId if they're strings
      const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      const contentObjectIds = contentIds.map(id => 
        typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
      );
      
      const engagements = await UserEngagement.find({
        user: userObjectId,
        contentType,
        contentId: { $in: contentObjectIds }
      });
      
      // Convert to map for easy lookup
      const engagementMap = {};
      engagements.forEach(eng => {
        engagementMap[eng.contentId.toString()] = eng;
      });
      
      return engagementMap;
    } catch (error) {
      console.error('Error getting user engagements:', error);
      return {};
    }
  }
  
  /**
   * Get user's liked content of a specific type
   */
  static async getUserLikedContent(userId, contentType, page = 1, limit = 20) {
    try {
      const mongoose = require('mongoose');
      const skip = (page - 1) * limit;
      
      // Convert userId to ObjectId if it's a string
      const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      
      const engagements = await UserEngagement.find({
        user: userObjectId,
        contentType,
        liked: true
      })
      .sort({ likedAt: -1 })
      .skip(skip)
      .limit(limit);
      
      // Get the content IDs
      const contentIds = engagements.map(eng => eng.contentId);
      
      // Get the appropriate model and fetch the actual content
      const Model = this.getContentModel(contentType);
      let query = Model.find({ _id: { $in: contentIds } });
      
      // Populate author for SocialPost
      if (contentType === 'SocialPost') {
        query = query.populate('author', 'name profile');
      }
      
      const content = await query;
      
      // Sort content by the order of liked dates
      const contentMap = {};
      content.forEach(item => {
        contentMap[item._id.toString()] = item;
      });
      
      return engagements.map(eng => contentMap[eng.contentId.toString()]).filter(Boolean);
    } catch (error) {
      console.error('Error getting user liked content:', error);
      return [];
    }
  }
  
  /**
   * Get user's saved content of a specific type
   */
  static async getUserSavedContent(userId, contentType, page = 1, limit = 20) {
    try {
      const mongoose = require('mongoose');
      const skip = (page - 1) * limit;
      
      // Convert userId to ObjectId if it's a string
      const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      
      const engagements = await UserEngagement.find({
        user: userObjectId,
        contentType,
        saved: true
      })
      .sort({ savedAt: -1 })
      .skip(skip)
      .limit(limit);
      
      // Get the content IDs
      const contentIds = engagements.map(eng => eng.contentId);
      
      // Get the appropriate model and fetch the actual content
      const Model = this.getContentModel(contentType);
      let query = Model.find({ _id: { $in: contentIds } });
      
      // Populate author for SocialPost
      if (contentType === 'SocialPost') {
        query = query.populate('author', 'name profile');
      }
      
      // Populate uploadedBy for Resource
      if (contentType === 'Resource') {
        query = query.populate('uploadedBy', 'name profile');
      }
      
      const content = await query;
      
      // Sort content by the order of saved dates
      const contentMap = {};
      content.forEach(item => {
        contentMap[item._id.toString()] = item;
      });
      
      return engagements.map(eng => contentMap[eng.contentId.toString()]).filter(Boolean);
    } catch (error) {
      console.error('Error getting user saved content:', error);
      return [];
    }
  }
  
  /**
   * Get engagement stats for content
   */
  static async getContentEngagementStats(contentType, contentId) {
    try {
      const mongoose = require('mongoose');
      
      // Convert contentId to ObjectId if it's a string
      const objectId = typeof contentId === 'string' ? new mongoose.Types.ObjectId(contentId) : contentId;
      
      console.log('🔍 Getting stats for:', { contentType, contentId, objectId });
      
      const stats = await UserEngagement.aggregate([
        { $match: { contentType, contentId: objectId } },
        {
          $group: {
            _id: null,
            totalLikes: { $sum: { $cond: ['$liked', 1, 0] } },
            totalSaves: { $sum: { $cond: ['$saved', 1, 0] } },
            totalShares: { $sum: { $cond: ['$shared', 1, 0] } },
            totalViews: { $sum: { $cond: ['$viewed', 1, 0] } }
          }
        }
      ]);
      
      console.log('📊 Stats result:', stats);
      
      return stats[0] || { totalLikes: 0, totalSaves: 0, totalShares: 0, totalViews: 0 };
    } catch (error) {
      console.error('Error getting content engagement stats:', error);
      return { totalLikes: 0, totalSaves: 0, totalShares: 0, totalViews: 0 };
    }
  }
  
  /**
   * Helper methods
   */
  static getContentModel(contentType) {
    switch (contentType) {
      case 'News': return News;
      case 'SocialPost': return SocialPost;
      case 'Event': return Event;
      case 'Comment': return Comment;
      case 'Resource': return Resource;
      default: throw new Error(`Unknown content type: ${contentType}`);
    }
  }
  
  static getCounterField(action, contentType = null) {
    // All models now use direct fields (like Resources)
    switch (action) {
      case 'like': return 'likes';
      case 'save': return 'saves';
      case 'share': return 'shares';
      case 'view': 
        // Only Resources have views
        return contentType === 'Resource' ? 'views' : null;
      case 'download': return 'downloadCount'; // Only for Resources
      case 'comment': return 'comments';
      default: return null;
    }
  }
}

module.exports = EngagementService; 