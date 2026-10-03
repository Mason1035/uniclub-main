const mongoose = require('mongoose');

const commentLikeSchema = new mongoose.Schema({
  // The comment being liked
  commentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    required: true
  },
  
  // User who liked the comment
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // The content this comment belongs to (for easier querying)
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  
  contentType: {
    type: String,
    enum: ['news', 'event', 'resource', 'social'],
    required: true
  }
  
}, { 
  timestamps: true 
});

// Ensure a user can only like a comment once
commentLikeSchema.index({ commentId: 1, userId: 1 }, { unique: true });

// Additional indexes for performance
commentLikeSchema.index({ commentId: 1, createdAt: -1 }); // Likes for a comment
commentLikeSchema.index({ userId: 1, createdAt: -1 }); // User's likes
commentLikeSchema.index({ contentId: 1, contentType: 1, createdAt: -1 }); // Likes on content's comments

module.exports = mongoose.model('CommentLike', commentLikeSchema);
