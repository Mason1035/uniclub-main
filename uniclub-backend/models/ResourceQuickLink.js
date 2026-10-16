const mongoose = require('mongoose');
const { normalizeResourceQuickLinkUrl } = require('../utils/resourceQuickLinks');

const resourceQuickLinkSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  url: {
    type: String, required: true, maxlength: 2048, set: normalizeResourceQuickLinkUrl,
    validate: { validator: value => {
      try { return normalizeResourceQuickLinkUrl(value) === value; } catch { return false; }
    }, message: '链接必须是完整的 HTTP 或 HTTPS 地址。' },
  },
  description: { type: String, trim: true, maxlength: 160, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, collection: 'resource_quick_links' });

resourceQuickLinkSchema.index({ url: 1 }, { unique: true, name: 'resource_quick_link_url_unique' });

module.exports = mongoose.model('ResourceQuickLink', resourceQuickLinkSchema);
