const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 5000 },
  startAt: { type: Date, default: null },
  deadline: { type: Date, default: null },
  status: { type: String, enum: ['draft', 'open', 'closed'], default: 'draft', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
module.exports = mongoose.model('QuantificationCollection', schema);
