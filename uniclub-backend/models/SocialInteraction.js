const mongoose = require('mongoose');

/**
 * Social Interactions Model - Track likes, shares, saves, and other user actions
 * This provides detailed per-user tracking while maintaining counter performance
 */
const socialInteractionSchema = new mongoose.Schema({
  // User performing the action
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Target content (polymorphic)
  targetType: {
    type: String,
    enum: ['SocialPost', 'SocialComment', 'Group'],
    required: true
  },
  
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  
  // Action types
  actionType: {
    type: String,
    enum: ['like', 'share', 'save', 'view', 'react'],
    required: true
  },
  
  // For reactions (beyond simple likes)
  reaction: {
    type: String,
    enum: ['like', 'love', 'laugh', 'wow', 'sad', 'angry'],
    default: 'like'
  },
  
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  
  // For tracking interaction sources
  source: {
    type: String,
    enum: ['feed', 'profile', 'group', 'search', 'notification'],
    default: 'feed'
  }
  
}, {
  timestamps: true
});

// Compound indexes for efficient queries
socialInteractionSchema.index({ userId: 1, targetType: 1, targetId: 1, actionType: 1 }, { unique: true });
socialInteractionSchema.index({ targetType: 1, targetId: 1, actionType: 1, isActive: 1 });
socialInteractionSchema.index({ userId: 1, actionType: 1, createdAt: -1 });
socialInteractionSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.model('SocialInteraction', socialInteractionSchema);
