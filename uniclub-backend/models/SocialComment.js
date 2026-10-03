const mongoose = require('mongoose');

/**
 * Social Comments Model - Threaded comments system for social posts
 * Supports nested replies and engagement tracking
 */
const socialCommentSchema = new mongoose.Schema({
  // Core content
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  
  // Relationships
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SocialPost',
    required: true
  },
  
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Threading support for nested comments
  parentCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SocialComment',
    default: null
  },
  
  // Reply chain depth (for UI rendering optimization)
  depth: {
    type: Number,
    default: 0,
    max: 5 // Limit nesting depth
  },
  
  // Mentions in comments
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Media attachments in comments
  media: [{
    type: {
      type: String,
      enum: ['image', 'gif'],
      required: true
    },
    url: { type: String, required: true },
    filename: { type: String },
    size: { type: Number }
  }],
  
  // Engagement counters (updated by triggers)
  engagement: {
    likeCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 }
  },
  
  // Comment settings
  allowReplies: { type: Boolean, default: true },
  
  // Moderation and status
  status: {
    type: String,
    enum: ['active', 'flagged', 'hidden', 'deleted', 'pending'],
    default: 'active'
  },
  
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date },
  
  // Admin/moderator actions
  moderatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  moderationReason: { type: String }
  
}, {
  timestamps: true
});

// Indexes for performance
socialCommentSchema.index({ postId: 1, status: 1, createdAt: -1 }); // Comments on post
socialCommentSchema.index({ author: 1, createdAt: -1 }); // User's comments
socialCommentSchema.index({ parentCommentId: 1, createdAt: 1 }); // Replies to comment
socialCommentSchema.index({ mentions: 1, createdAt: -1 }); // Mentioned users
socialCommentSchema.index({ status: 1 }); // Moderation queries

// Virtual for reply count calculation
socialCommentSchema.virtual('replies', {
  ref: 'SocialComment',
  localField: '_id',
  foreignField: 'parentCommentId'
});

module.exports = mongoose.model('SocialComment', socialCommentSchema);
