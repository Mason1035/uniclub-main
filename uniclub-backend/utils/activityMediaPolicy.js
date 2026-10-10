const sharp = require('sharp');

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40 * 1000 * 1000;
const MAX_PHOTOS = 200;
const MIME_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const safeMediaKey = value => typeof value === 'string' && /^activity\/[a-f\d]{24}\/(?:cover|photos)\/[a-f\d]{24}(?:-thumb)?\.(?:jpg|png|webp)$/.test(value);
class ActivityMediaError extends Error {
  constructor(status, message, code = 'ACTIVITY_MEDIA_ERROR') { super(message); this.status = status; this.code = code; }
}
const fail = (status, message, code) => { throw new ActivityMediaError(status, message, code); };
const assertFields = (body, fields) => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !fields.includes(key))) fail(400, '请求包含不允许的字段。', 'INVALID_FIELDS');
};
function validateUpload(body) {
  assertFields(body, ['mediaType', 'filename', 'mimeType', 'size']);
  if (!['COVER', 'PHOTO'].includes(body.mediaType)) fail(400, '图片用途无效。', 'INVALID_MEDIA_TYPE');
  if (!Object.hasOwn(MIME_EXTENSIONS, body.mimeType)) fail(400, '仅支持 JPEG、PNG、WebP 图片。', 'INVALID_IMAGE');
  if (typeof body.filename !== 'string' || !body.filename.trim() || body.filename.length > 200 || /[\x00-\x1f\x7f/\\]/.test(body.filename)) fail(400, '图片文件名无效。', 'INVALID_FILENAME');
  if (!Number.isSafeInteger(body.size) || body.size < 12 || body.size > MAX_IMAGE_BYTES) fail(400, '单张图片不能超过 10MB。', 'INVALID_IMAGE_SIZE');
  return { mediaType: body.mediaType, originalFilename: body.filename.trim(), mimeType: body.mimeType, fileSize: body.size };
}
function imageType(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
async function verifyImage(bytes, mimeType) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12 || bytes.length > MAX_IMAGE_BYTES || imageType(bytes) !== mimeType) fail(400, '图片实际内容与类型不一致。', 'INVALID_IMAGE');
  try {
    const options = { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'warning' };
    const metadata = await sharp(bytes, options).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || !metadata.width || !metadata.height || (metadata.pages || 1) !== 1) fail(400, '请选择单张 JPEG、PNG、WebP 图片。', 'INVALID_IMAGE');
    // Rendering a thumbnail decodes the entire input and strips private EXIF.
    const thumbnail = await sharp(bytes, options).rotate().resize({ width: 640, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    const swapsAxes = [5, 6, 7, 8].includes(metadata.orientation);
    return { width: swapsAxes ? metadata.height : metadata.width, height: swapsAxes ? metadata.width : metadata.height, thumbnail };
  } catch (error) {
    if (error instanceof ActivityMediaError) throw error;
    fail(400, '图片内容无法完整解码或尺寸过大，请重新选择。', 'INVALID_IMAGE');
  }
}
module.exports = { MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS, MAX_PHOTOS, MIME_EXTENSIONS, validId, safeMediaKey, ActivityMediaError, fail, assertFields, validateUpload, verifyImage };
