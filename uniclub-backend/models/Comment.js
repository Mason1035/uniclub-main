const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  // Core content
  text: { 
    type: String, 
    required: true,
    maxlength: 2000 // Reasonable comment length limit
  },
  
  // Generic content reference (supports News, Events, Resources, Social Posts)
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  
  contentType: {
    type: String,
    enum: ['news', 'event', 'resource', 'social'],
    required: true
  },
  
  // Legacy field - keep for backwards compatibility
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'News'
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Threading support for replies
  parentCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  
  // Engagement
  likeCount: { type: Number, default: 0 },
  
  // Legacy likes array - keep for backwards compatibility
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Moderation
  status: {
    type: String,
    enum: ['active', 'flagged', 'hidden', 'deleted'],
    default: 'active'
  },
  
  isEdited: {
    type: Boolean,
    default: false
  },
  
  editedAt: {
    type: Date
  }
  
}, { 
  timestamps: true 
});

// Indexes for performance
commentSchema.index({ contentId: 1, contentType: 1, createdAt: -1 }); // Recent comments on content
commentSchema.index({ articleId: 1, createdAt: -1 }); // Legacy article comments
commentSchema.index({ userId: 1, createdAt: -1 }); // User's comments
commentSchema.index({ parentCommentId: 1 }); // Replies to comment
commentSchema.index({ status: 1 }); // Moderation queries


module.exports = mongoose.model('Comment', commentSchema); 