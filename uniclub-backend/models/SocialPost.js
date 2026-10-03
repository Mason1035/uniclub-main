const mongoose = require('mongoose');

const socialPostSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Enhanced media support
  media: [{
    type: {
      type: String,
      enum: ['image', 'video'],
      required: true
    },
    url: { type: String, required: true },
    filename: { type: String },
    size: { type: Number }, // File size in bytes
    duration: { type: Number }, // Video duration in seconds
    thumbnail: { type: String }, // Video thumbnail URL
    altText: { type: String } // Accessibility description
  }],
  
  // Legacy support (will be migrated)
  imageUrl: { type: String },
  
  // Post metadata
  hashtags: [{ type: String }],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Post type for different content formats
  postType: {
    type: String,
    enum: ['text', 'image', 'video', 'poll', 'event', 'project', 'question'],
    default: 'text'
  },
  
  
  // Poll data (when postType is 'poll')
  poll: {
    question: { type: String },
    options: [{
      text: { type: String, required: true },
      votes: { type: Number, default: 0 },
      voters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }],
    allowMultipleVotes: { type: Boolean, default: false },
    expiresAt: { type: Date }
  },
  
  // Project/resource links (when postType is 'project')
  projectData: {
    title: { type: String },
    description: { type: String },
    githubUrl: { type: String },
    demoUrl: { type: String },
    technologies: [{ type: String }]
  },
  
  // Engagement tracking (direct fields like Resources)
  likes: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  
  // Post settings
  visibility: {
    type: String,
    enum: ['public', 'club-members', 'friends', 'private'],
    default: 'club-members'
  },
  
  allowComments: { type: Boolean, default: true },
  allowShares: { type: Boolean, default: true },
  
  // Moderation
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted', 'flagged', 'pending'],
    default: 'active'
  },
  
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date },
  
  // Featured/Pinned posts
  isPinned: { type: Boolean, default: false },
  pinnedAt: { type: Date }
  
}, {
  timestamps: true
});

// Indexes for performance
socialPostSchema.index({ author: 1, createdAt: -1 }); // User's posts chronologically
socialPostSchema.index({ status: 1, createdAt: -1 }); // Active posts chronologically
socialPostSchema.index({ hashtags: 1 }); // Posts by hashtag
socialPostSchema.index({ mentions: 1 }); // Posts mentioning users
socialPostSchema.index({ isPinned: 1, pinnedAt: -1 }); // Pinned posts
socialPostSchema.index({ visibility: 1, status: 1, createdAt: -1 }); // Public/visible posts
socialPostSchema.index({ postType: 1, status: 1, createdAt: -1 }); // Posts by type
socialPostSchema.index({ likes: -1 }); // Popular posts
socialPostSchema.index({ createdAt: -1, status: 1 }); // Recent active posts for feed

module.exports = mongoose.model('SocialPost', socialPostSchema); 