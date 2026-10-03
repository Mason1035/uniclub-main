const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  
  // Event scheduling
  startDate: {
    type: Date,
    required: true
  },
  
  endDate: {
    type: Date,
    required: true
  },
  
  // Location details
  location: {
    type: {
      type: String,
      enum: ['physical', 'virtual', 'hybrid'],
      required: true
    },
    address: { type: String }, // For physical/hybrid events
    room: { type: String }, // Room number/name
    virtualLink: { type: String }, // Zoom/Teams link for virtual events
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number }
    }
  },
  
  // Event details
  eventType: {
    type: String,
    enum: ['Workshop', 'Masterclass', 'Tutorial', 'Meetup', 'Hackathon', 'Seminar', 'Social'],
    required: true
  },
  
  category: [{
    type: String,
    enum: ['AI/ML', 'Web Development', 'Mobile Apps', 'Data Science', 'Cybersecurity', 
           'Game Development', 'Hardware', 'Startups', 'Career', 'Social']
  }],
  
  // Capacity and RSVP
  maxCapacity: {
    type: Number,
    default: null // null = unlimited
  },
  
  rsvpDeadline: {
    type: Date,
    default: function() {
      return new Date(this.startDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours before
    }
  },
  
  rsvpLink: {
    type: String,
    default: null // Optional external RSVP link (Google Forms, Eventbrite, etc.)
  },
  
  // Organizer and speakers
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  speakers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: { type: String }, // For external speakers
    bio: { type: String },
    title: { type: String },
    avatar: { type: String }
  }],
  
  // Media
  imageUrl: { type: String },
  attachments: [{
    name: { type: String },
    url: { type: String },
    type: {
      type: String,
      enum: ['document', 'presentation', 'video', 'link']
    }
  }],
  
  // Requirements and tags
  prerequisites: [{ type: String }],
  tags: [{ type: String }],
  skillLevel: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'All Levels'],
    default: 'All Levels'
  },
  
  // Event status
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'draft'
  },
  
  // Engagement tracking (direct fields like Resources)
  likes: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  rsvpCount: { type: Number, default: 0 },
  attendedCount: { type: Number, default: 0 },
  
  // Settings
  allowWaitlist: { type: Boolean, default: true },
  sendReminders: { type: Boolean, default: true },
  isRecurring: { type: Boolean, default: false },
  
  // Recurring event details
  recurrence: {
    pattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'custom']
    },
    interval: { type: Number }, // Every X days/weeks/months
    endDate: { type: Date },
    daysOfWeek: [{ type: Number }] // 0-6 (Sunday-Saturday)
  }
  
}, { 
  timestamps: true 
});

// Indexes for performance
eventSchema.index({ startDate: 1, status: 1 }); // Upcoming events
eventSchema.index({ organizer: 1, createdAt: -1 }); // Organizer's events
eventSchema.index({ eventType: 1, startDate: 1 }); // Events by type
eventSchema.index({ category: 1, startDate: 1 }); // Events by category
eventSchema.index({ status: 1, startDate: 1 }); // Published events chronologically

module.exports = mongoose.model('Event', eventSchema); 