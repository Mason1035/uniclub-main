const mongoose = require('mongoose');

/**
 * Follow/Friends Model - Social graph for user connections
 * Supports different relationship types and privacy controls
 */
const followSchema = new mongoose.Schema({
  // User initiating the follow
  followerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // User being followed
  followingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Relationship status
  status: {
    type: String,
    enum: ['pending', 'accepted', 'blocked', 'muted'],
    default: 'accepted' // Auto-accept for public profiles
  },
  
  // Relationship type
  relationshipType: {
    type: String,
    enum: ['follow', 'friend', 'colleague', 'mentor', 'mentee'],
    default: 'follow'
  },
  
  // Privacy settings
  isPrivate: {
    type: Boolean,
    default: false
  },
  
  // Notification preferences
  notifications: {
    posts: { type: Boolean, default: true },
    comments: { type: Boolean, default: false },
    mentions: { type: Boolean, default: true },
    events: { type: Boolean, default: true }
  },
  
  // Connection context
  connectionSource: {
    type: String,
    enum: ['search', 'suggestion', 'group', 'event', 'mutual', 'external'],
    default: 'search'
  },
  
  // Mutual connections count (cached for performance)
  mutualConnectionsCount: {
    type: Number,
    default: 0
  },
  
  // Interaction history
  lastInteraction: {
    type: Date,
    default: Date.now
  },
  
  interactionScore: {
    type: Number,
    default: 0 // Based on likes, comments, shares between users
  },
  
  // Follow-back tracking
  isFollowBack: {
    type: Boolean,
    default: false
  },
  
  // Timestamps for when status changed
  acceptedAt: { type: Date },
  blockedAt: { type: Date },
  mutedAt: { type: Date }
  
}, {
  timestamps: true
});

// Compound indexes for efficient queries
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
followSchema.index({ followerId: 1, status: 1 }); // User's following list
followSchema.index({ followingId: 1, status: 1 }); // User's followers
followSchema.index({ followerId: 1, relationshipType: 1 }); // By relationship type
followSchema.index({ status: 1, createdAt: -1 }); // Pending requests
followSchema.index({ lastInteraction: -1 }); // Recently active connections
followSchema.index({ interactionScore: -1 }); // Strong connections

// Prevent self-following
followSchema.pre('save', function(next) {
  if (this.followerId.equals(this.followingId)) {
    const error = new Error('Users cannot follow themselves');
    return next(error);
  }
  next();
});

// Update timestamps when status changes
followSchema.pre('save', function(next) {
  const now = new Date();
  
  if (this.isModified('status')) {
    switch (this.status) {
      case 'accepted':
        this.acceptedAt = now;
        break;
      case 'blocked':
        this.blockedAt = now;
        break;
      case 'muted':
        this.mutedAt = now;
        break;
    }
  }
  
  next();
});

module.exports = mongoose.model('Follow', followSchema);
