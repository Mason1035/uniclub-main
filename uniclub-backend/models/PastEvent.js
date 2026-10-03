const mongoose = require('mongoose');

const pastEventSchema = new mongoose.Schema({
  // Event Poster/Image - Embedded Base64 (like user avatars)
  poster: {
    data: { type: String, required: true },           // Base64 image data
    contentType: { type: String, required: true },     // MIME type (e.g., 'image/png')
    originalName: { type: String },                     // Original filename
    size: { type: Number },                              // File size in bytes
    uploadedAt: { type: Date, default: Date.now }       // Upload timestamp
  },
  
  // Event Title
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  
  // Event Subtitle
  subtitle: {
    type: String,
    required: true,
    maxlength: 300
  },
  
  // Event Date and Time
  date: {
    type: Date,
    required: true
  },
  
  // Text Body for Multiple Paragraphs
  body: {
    type: String,
    required: true
  },
  
  // Optional fields for better organization
  category: {
    type: String,
    enum: ['Orientation', 'Workshop', 'Masterclass', 'Tutorial', 'Meetup', 'Hackathon', 'Seminar', 'Social', 'Other']
  },
  
  // Attendance/summary
  attendance: {
    type: Number,
    default: 0
  },
  
  // Tags for searchability
  tags: [{ 
    type: String 
  }],
  
  // Recording/Video Link (YouTube, etc.)
  link: {
    type: String,
    validate: {
      validator: function(v) {
        // Optional field - if provided, should be a valid URL
        if (!v) return true;
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Link must be a valid URL'
    }
  },
  
  // Gallery - Multiple images from the event
  gallery: [{
    data: { type: String, required: true },           // Base64 image data
    contentType: { type: String, required: true },     // MIME type (e.g., 'image/png')
    originalName: { type: String },                     // Original filename
    size: { type: Number },                              // File size in bytes
    uploadedAt: { type: Date, default: Date.now },      // Upload timestamp
    caption: { type: String, maxlength: 200 }           // Optional caption for the image
  }]

}, { 
  timestamps: true 
});

// Indexes for performance
pastEventSchema.index({ date: -1 }); // Most recent first
pastEventSchema.index({ category: 1 }); // By category
pastEventSchema.index({ createdAt: -1 }); // Order by creation

module.exports = mongoose.model('PastEvent', pastEventSchema);

