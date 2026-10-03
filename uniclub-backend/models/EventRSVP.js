const mongoose = require('mongoose');

const eventRSVPSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // RSVP status
  status: {
    type: String,
    enum: ['going', 'maybe', 'not_going', 'waitlist'],
    required: true
  },
  
  // Calendar integration
  calendarIntegration: {
    addedToCalendar: { type: Boolean, default: false },
    calendarEventId: { type: String }, // External calendar event ID
    reminderSet: { type: Boolean, default: false },
    reminderSentAt: { type: Date }
  },
  
  // Additional details
  guestCount: {
    type: Number,
    default: 0,
    min: 0,
    max: 5 // Reasonable limit for +1s
  },
  
  dietaryRestrictions: [{ type: String }],
  accessibilityNeeds: [{ type: String }],
  notes: {
    type: String,
    maxlength: 500
  },
  
  // Check-in tracking
  checkedIn: { type: Boolean, default: false },
  checkedInAt: { type: Date },
  checkedInBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Waitlist management
  waitlistPosition: { type: Number },
  waitlistJoinedAt: { type: Date },
  
  // Communication preferences
  notificationPreferences: {
    eventReminders: { type: Boolean, default: true },
    eventUpdates: { type: Boolean, default: true },
    eventCancellation: { type: Boolean, default: true }
  }
  
}, { 
  timestamps: true 
});

// Compound unique index to prevent duplicate RSVPs
eventRSVPSchema.index({ event: 1, user: 1 }, { unique: true });

// Additional indexes for queries
eventRSVPSchema.index({ user: 1, status: 1, createdAt: -1 }); // User's RSVPs
eventRSVPSchema.index({ event: 1, status: 1 }); // Event attendees by status
eventRSVPSchema.index({ event: 1, checkedIn: 1 }); // Event check-ins
eventRSVPSchema.index({ status: 1, 'calendarIntegration.addedToCalendar': 1 }); // Calendar sync queries

module.exports = mongoose.model('EventRSVP', eventRSVPSchema); 