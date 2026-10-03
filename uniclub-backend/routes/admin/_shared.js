/**
 * Shared helpers for the /api/admin sub-routers.
 * Kept in one place so every admin module paginates and validates identically.
 */

/** Escape user input before using it inside a RegExp. */
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Mirrors the User / EnrolledUser model validators. */
const EMAIL_PATTERN = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;

const paginationOf = (query, defaultLimit = 20) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

const paged = (page, limit, total) => ({
  page,
  limit,
  total,
  pages: Math.max(1, Math.ceil(total / limit)),
});

/** 校验 dataURL 形式的图片，返回 { contentType, size }；不合法则返回 null。 */
const parseImageDataUrl = (value) => {
  if (typeof value !== 'string') return null;
  const match = /^data:(image\/(?:png|jpeg|jpg|gif|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value.trim());
  if (!match) return null;
  const base64 = match[2];
  // Base64 长度 → 字节数
  const size = Math.floor((base64.length * 3) / 4);
  return { contentType: match[1] === 'image/jpg' ? 'image/jpeg' : match[1], size };
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB，配合 express.json 的 10mb 上限

module.exports = {
  escapeRegex,
  EMAIL_PATTERN,
  paginationOf,
  paged,
  parseImageDataUrl,
  MAX_IMAGE_BYTES,
};
