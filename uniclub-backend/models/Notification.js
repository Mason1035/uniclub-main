const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  type: {
    type: String,
    enum: ['comment_reply', 'comment_like', 'comment_mention'],
    required: true
  },
  
  // The comment that triggered the notification
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    required: true
  },
  
  // Content references - only one should be set based on content type
  article: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'News',
    required: false
  },
  
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: false
  },
  
  resource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource',
    required: false
  },
  
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SocialPost',
    required: false
  },
  
  // The user who triggered the notification (e.g., who replied or liked)
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Whether the notification has been read
  read: {
    type: Boolean,
    default: false
  },
  
  // When the notification was read
  readAt: {
    type: Date
  }
  
}, { 
  timestamps: true 
});

// Indexes for performance
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ read: 1 });
notificationSchema.index({ type: 1 });
// Add compound index for efficient unread queries
notificationSchema.index({ recipient: 1, read: 1 });

// Add pre-save middleware to set readAt when read is set to true
notificationSchema.pre('save', function(next) {
  if (this.isModified('read') && this.read && !this.readAt) {
    this.readAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Notification', notificationSchema); 