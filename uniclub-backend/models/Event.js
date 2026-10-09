const mongoose = require('mongoose');
const activityMeta = require('../../shared/activity-v2.json');
const registrationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: { type: String, required: true, maxlength: 200 },
  status: { type: String, enum: activityMeta.registrationStatuses, required: true },
  version: { type: Number, default: 1 },
  createdAt: { type: Date, required: true }, updatedAt: { type: Date, required: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  reviewedAt: { type: Date, default: null }, reviewNote: { type: String, maxlength: 500, default: '' },
  legacyStatus: { type: String, default: null },
  checkedInAt: { type: Date, default: null },
  history: [{ status: { type: String, required: true }, actorId: mongoose.Schema.Types.ObjectId, at: Date, note: String }],
}, { _id: true });

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
    enum: [...activityMeta.types, ...activityMeta.legacyTypes].map(item => item.value),
    required: true
  },
  
  legacyEventType: { type: String, default: null },
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
    enum: activityMeta.statuses,
    default: 'draft'
  },
  
  // V2 state lives in this document so standalone MongoDB can atomically
  // review a registration and enforce the approved capacity. Legacy RSVP rows
  // remain untouched. Hidden by default to protect unrelated serializers.
  registrations: { type: [registrationSchema], default: [], select: false },
  registrationVersion: { type: Number, default: 0, select: false },
  registrationSchemaVersion: { type: Number, default: 0, select: false },
  activityV2MigrationBackup: { type: mongoose.Schema.Types.Mixed, select: false },
  summary: { type: String, default: '', maxlength: 10000 },
  coverMediaId: { type: mongoose.Schema.Types.ObjectId, default: null },
  mediaVersion: { type: Number, default: 0 },
  mediaRefs: { type: [{ mediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'ActivityMedia', required: true }, mediaType: { type: String, enum: ['COVER', 'PHOTO'], required: true }, sortOrder: { type: Number, default: 0 } }], default: [], select: false },
  mediaTombstones: { type: [mongoose.Schema.Types.ObjectId], default: [], select: false },
  legacyCoverHidden: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  archivedAt: { type: Date, default: null },
  // Engagement tracking (direct fields like Resources)
  likes: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  rsvpCount: { type: Number, default: 0 },
  approvedCount: { type: Number, default: 0 },
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
eventSchema.index({ deletedAt: 1, status: 1, endDate: -1 });
eventSchema.index({ 'registrations.userId': 1, endDate: -1 });
eventSchema.index({ startDate: 1, status: 1 }); // Upcoming events
eventSchema.index({ organizer: 1, createdAt: -1 }); // Organizer's events
eventSchema.index({ eventType: 1, startDate: 1 }); // Events by type
eventSchema.index({ category: 1, startDate: 1 }); // Events by category
eventSchema.index({ status: 1, startDate: 1 }); // Published events chronologically

module.exports = mongoose.model('Event', eventSchema); 