const mongoose = require('mongoose');

const enrolledUserSchema = new mongoose.Schema({
  // Optional contact address; authentication uses uniqueId.
  email: {
    type: String,
    trim: true,
    lowercase: true,
    set: value => typeof value === 'string' && value.trim() ? value.trim() : undefined,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/, 'Invalid email format']
  },
  name: { type: String, required: true },
  uniqueId: { type: String, required: true, unique: true },
}, {
  collection: 'EnrolledUser' // Force this exact collection name
});

// Multiple students may have no email; real contact addresses remain unique.
enrolledUserSchema.index({ email: 1 }, {
  name: 'email_optional_unique',
  unique: true,
  partialFilterExpression: { email: { $type: 'string' } },
});

// Create the model with explicit collection name
const EnrolledUser = mongoose.model('EnrolledUser', enrolledUserSchema, 'EnrolledUser');

module.exports = EnrolledUser; 