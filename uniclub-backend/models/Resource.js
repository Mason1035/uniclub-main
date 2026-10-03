const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  
  description: {
    type: String,
    maxlength: 1000
  },
  
  // 资源形态：文档 / 教程 / 工具 / 视频
  type: {
    type: String,
    enum: ['Document', 'Tutorial', 'Tool', 'Video'],
    required: true
  },

  // 业务分类：ClassHub 的资源按用途归类
  category: {
    type: String,
    enum: ['AI工具', 'GitHub项目', '比赛', '证书', '学习网站', '开发工具'],
    required: true
  },
  
  // File information
  fileSize: {
    type: String
  },
  
  fileUrl: {
    type: String
  },
  
  linkUrl: {
    type: String
  },
  
  thumbnailUrl: {
    type: String
  },
  
  // New flexible file field - supports both uploads and links
  file: {
    type: {
      type: String,
      enum: ['upload', 'link'],
      required: false
    },
    url: {
      type: String,
      required: false
    },
    originalName: {
      type: String,
      required: false
    },
    mimeType: {
      type: String,
      required: false
    },
    size: {
      type: Number,
      required: false
    }
  },
  
  // Author/uploader
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Approval system
  isApproved: {
    type: Boolean,
    default: false
  },
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  approvedAt: {
    type: Date
  },
  
  // Engagement tracking
  downloadCount: {
    type: Number,
    default: 0
  },
  
  views: {
    type: Number,
    default: 0
  },
  
  likes: {
    type: Number,
    default: 0
  },
  
  comments: {
    type: Number,
    default: 0
  },
  
  saves: {
    type: Number,
    default: 0
  },
  
  shares: {
    type: Number,
    default: 0
  },
  
  // Tags for better searchability
  tags: [{
    type: String
  }],
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'archived'],
    default: 'pending'
  },
  
  // Featured content
  isFeatured: {
    type: Boolean,
    default: false
  }
  
}, {
  timestamps: true
});

// Indexes
resourceSchema.index({ type: 1, category: 1 });
resourceSchema.index({ isApproved: 1, status: 1 });
resourceSchema.index({ downloadCount: -1 });
resourceSchema.index({ tags: 1 });

module.exports = mongoose.model('Resource', resourceSchema); 