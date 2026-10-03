const mongoose = require('mongoose');
const { petSchemaFields } = require('../utils/petSettingsPolicy');
const { EMAIL_PATTERN, NOTIFICATION_DEFAULTS } = require('../utils/accountSettingsPolicy');

const userSchema = new mongoose.Schema({
  // Authentication & Basic Info
  // Optional contact address; authentication uses uniqueId.
  email: {
    type: String,
    trim: true,
    lowercase: true,
    set: value => typeof value === 'string' && value.trim() ? value.trim() : undefined,
    maxlength: 254,
    match: [EMAIL_PATTERN, 'Invalid email format']
  },
  name: { type: String, required: true },
  displayName: { type: String, default: null, trim: true, maxlength: 30 },
  emailVerified: { type: Boolean, default: false },
  lastLoginAt: { type: Date, default: null },
  uniqueId: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  tokenVersion: { type: Number, default: 0 },
  isEnrolled: { type: Boolean, default: false },
  
  // Social Profile Features
  profile: {
    bio: { type: String, default: '', maxlength: 200 },
    location: { type: String, default: '' },
    website: { type: String, default: '' },
    interests: [String],
    socialLinks: {
      linkedin: String,
      twitter: String,
      github: String
    },
    avatar: {
      data: String,
      contentType: String,
      originalName: String,
      size: Number,
      uploadedAt: { type: Date, default: Date.now }
    },
    preferences: {
      notifications: { type: Boolean, default: true },
      privacy: { type: String, enum: ['public', 'friends', 'private'], default: 'public' }
    }
  },
  
  // Social Stats
  socialStats: {
    articlesLiked: { type: Number, default: 0 },
    articlesSaved: { type: Number, default: 0 },
    commentsPosted: { type: Number, default: 0 },
    chatInteractions: { type: Number, default: 0 },
    postsCreated: { type: Number, default: 0 },
    eventsCreated: { type: Number, default: 0 },
    eventsAttended: { type: Number, default: 0 }
  },
  
  // Privacy & Settings
  settings: {
    ...petSchemaFields,
    notifications: Object.fromEntries(Object.entries(NOTIFICATION_DEFAULTS).map(([key, value]) => [key, { type: Boolean, default: value }])),
    profileVisibility: {
      type: String,
      enum: ['public', 'club-members', 'private'],
      default: 'club-members'
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    commentNotifications: {
      type: Boolean,
      default: true
    }
  },
  
  // Account Status
  lastActive: {
    type: Date,
    default: Date.now
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Admin privileges
  isAdmin: {
    type: Boolean,
    default: false
  }
  
}, { timestamps: true });

// Multiple students may have no email; real contact addresses remain unique.
userSchema.index({ email: 1 }, {
  name: 'email_optional_unique',
  unique: true,
  partialFilterExpression: { email: { $type: 'string' } },
});

// Indexes for performance
userSchema.index({ isEnrolled: 1 });
userSchema.index({ lastActive: -1 });

// Add indexing for avatar queries
userSchema.index({ 'profile.avatar.uploadedAt': 1 });

module.exports = mongoose.model('User', userSchema); 
