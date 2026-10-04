const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');

const allowedTypes = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
]);

function createSocialUpload({ uploadsDir, maxFileSize = 50 * 1024 * 1024 }) {
  const storage = multer.diskStorage({
    destination(req, file, cb) {
      // ECS uses a persistent uploads symlink. Production must create the
      // social subdirectory too; check it when needed so text posts still work.
      fs.mkdir(uploadsDir, { recursive: true }, error => {
        if (error) return cb(error);
        fs.access(uploadsDir, fs.constants.W_OK, accessError => cb(accessError, uploadsDir));
      });
    },
    filename(req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const type = file.mimetype.startsWith('video/') ? 'video' : 'image';
      cb(null, `${type}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });
  const receive = multer({
    storage,
    limits: { fileSize: maxFileSize },
    fileFilter(req, file, cb) {
      if (allowedTypes.has(file.mimetype)) return cb(null, true);
      cb(Object.assign(new Error('Unsupported media type'), { code: 'INVALID_FILE_TYPE' }));
    }
  }).array('media', 5);

  return (req, res, next) => receive(req, res, error => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ code: 'FILE_TOO_LARGE', error: '文件过大，请选择较小的图片或视频。' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ code: 'TOO_MANY_FILES', error: '附件数量过多或上传字段不正确。' });
    }
    if (error.code === 'INVALID_FILE_TYPE') {
      return res.status(400).json({ code: error.code, error: '不支持此图片或视频格式。' });
    }
    // Keep filesystem paths and internal errors out of the browser response.
    console.error('Social media upload failed:', { code: error.code || 'UPLOAD_FAILED' });
    return res.status(500).json({
      code: 'UPLOAD_STORAGE_UNAVAILABLE',
      error: '图片上传服务暂不可用，请联系管理员检查上传目录权限。'
    });
  });
}

module.exports = { createSocialUpload };
