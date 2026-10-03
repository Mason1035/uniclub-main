const mongoose = require('mongoose');

// Centralized user engagement tracking for all content types
const userEngagementSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Content reference (polymorphic)
  contentType: {
    type: String,
    enum: ['News', 'SocialPost', 'Event', 'Comment', 'Resource'],
    required: true
  },
  
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  
  // Engagement types
  liked: { type: Boolean, default: false },
  saved: { type: Boolean, default: false },
  shared: { type: Boolean, default: false },
  viewed: { type: Boolean, default: false },
  downloaded: { type: Boolean, default: false },
  
  // Timestamps for engagement analytics
  likedAt: { type: Date },
  savedAt: { type: Date },
  sharedAt: { type: Date },
  viewedAt: { type: Date },
  downloadedAt: { type: Date },
  lastEngagedAt: { type: Date, default: Date.now }
  
}, { 
  timestamps: true 
});

// Compound indexes for efficient queries
userEngagementSchema.index({ user: 1, contentType: 1, contentId: 1 }, { unique: true });
userEngagementSchema.index({ user: 1, liked: 1 }); // User's liked content
userEngagementSchema.index({ user: 1, saved: 1 }); // User's saved content
userEngagementSchema.index({ contentType: 1, contentId: 1, liked: 1 }); // Content's likes
userEngagementSchema.index({ user: 1, lastEngagedAt: -1 }); // Recent user activity

module.exports = mongoose.model('UserEngagement', userEngagementSchema); 