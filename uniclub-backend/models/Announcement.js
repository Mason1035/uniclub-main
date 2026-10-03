const mongoose = require('mongoose');

/**
 * 班级公告。
 *
 * 说明：原有的 Notification 模型是「评论回复/点赞」的逐用户通知
 * （type 只能是 comment_*，且 comment 字段必填），无法用来发班级公告，
 * 所以公告单独建模。
 */
const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 120
  },

  body: {
    type: String,
    required: true,
    maxlength: 4000
  },

  // 重要程度，前端用于配色
  level: {
    type: String,
    enum: ['info', 'important', 'urgent'],
    default: 'info'
  },

  // 置顶（列表排序时优先）
  pinned: {
    type: Boolean,
    default: false
  },

  // 可选的相关链接（报名表、会议链接等）
  link: {
    type: String,
    default: ''
  },

  isPublished: {
    type: Boolean,
    default: true
  },

  publishedAt: {
    type: Date,
    default: Date.now
  },

  // 到期后成员端不再展示；null = 长期有效
  expiresAt: {
    type: Date,
    default: null
  },

  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

announcementSchema.index({ isPublished: 1, pinned: -1, publishedAt: -1 });
announcementSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
