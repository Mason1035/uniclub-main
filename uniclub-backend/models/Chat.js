const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // Optional metadata keeps existing conversations readable without migration.
  sources: { type: [{ title: String, url: String, _id: false }], default: undefined },
  warning: { type: String, default: undefined },
  reasoning: { type: Boolean, default: undefined }
});

const chatSchema = new mongoose.Schema({
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'News',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  messages: [messageSchema],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Compound index to efficiently query chats by article and user
chatSchema.index({ articleId: 1, userId: 1 });

module.exports = mongoose.model('Chat', chatSchema);
