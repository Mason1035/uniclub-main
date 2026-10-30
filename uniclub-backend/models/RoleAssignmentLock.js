const mongoose = require('mongoose');
// A short lease serializes identity changes across server processes. This is not
// a session store and never grants permissions on its own.
const schema = new mongoose.Schema({
  _id: { type: String },
  owner: { type: String, required: true },
  lockedUntil: { type: Date, required: true },
}, { versionKey: false });
module.exports = mongoose.model('RoleAssignmentLock', schema);
