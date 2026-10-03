const mongoose = require('mongoose');

const NewsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  excerpt: { type: String, required: true },
  content: { type: String, required: true },
  source: { type: String, required: true },
  
  // Author relationship (system user for imported articles)
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Original article information
  originalAuthor: { type: String }, // Author name from news source
  originalUrl: { type: String }, // Source URL for deduplication
  sourceHash: { type: String, unique: true }, // Hash for duplicate detection
  
  // Content management
  status: { 
    type: String, 
    enum: ['draft', 'pending', 'approved', 'archived'],
    default: 'pending'
  },
  
  // Categories matching your frontend and newsConstants.js
  categories: [{
    type: String,
    enum: ['AI/ML', 'Startups', 'Tech Industry', 'Cybersecurity', 'Software Development', 'Gaming', 'Gadgets', 'IoT', 'Mobile Tech', 'Hardware']
  }],
  
  // Media
  imageUrl: { type: String },
  publisherLogo: { type: String }, // Publisher/source logo URL
  
  // Engagement tracking (direct fields like Resources)
  likes: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  
  // Publishing
  publishedAt: { type: Date },
  isFeatured: { type: Boolean, default: false },
  isTrending: { type: Boolean, default: false },
  
  // AI Summary fields
  summary: {
    raw: { type: String }, // Original AI-generated summary
    keyPoints: [{ type: String }], // Extracted key points
    technicalDetails: { type: String }, // Technical aspects
    industryImpact: { type: String }, // Impact on industry
    futureImplications: { type: String }, // Future implications
    quickTake: { type: String }, // One-sentence summary
    whyItMatters: { type: String }, // New field for "Why it matters" section
    quickSummary: { type: String }, // New field for 130-char card summary
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // Internal scoring fields
  _importanceScore: { type: Number, default: 0 } // AI importance score for reference
}, { 
  timestamps: true
});

// Add indexes for performance (sourceHash already unique in schema)
NewsSchema.index({ publishedAt: -1 });
NewsSchema.index({ status: 1 });
NewsSchema.index({ categories: 1 });
NewsSchema.index({ originalUrl: 1 });

module.exports = mongoose.model('News', NewsSchema); 