const sharp = require('sharp');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40 * 1000 * 1000;

class FeeError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function imageType(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

async function prepareImage(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length) throw new FeeError(400, '请选择图片。');
  if (file.buffer.length > MAX_IMAGE_BYTES) throw new FeeError(413, '图片不能超过 5MB。');
  const type = imageType(file.buffer);
  if (!type || type !== file.mimetype) throw new FeeError(400, '仅支持真实的 JPEG、PNG、WebP 图片，文件内容必须与图片类型一致。');
  try {
    const options = { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'warning' };
    const metadata = await sharp(file.buffer, options).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) !== 1) {
      throw new FeeError(400, '请选择单张 JPEG、PNG、WebP 图片。');
    }
    // Decode and re-encode: removes metadata and appended non-image content.
    // PNG preserves QR edges; rotation respects the source orientation.
    const data = await sharp(file.buffer, options).rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 }).toBuffer();
    if (data.length > MAX_IMAGE_BYTES) throw new FeeError(413, '图片处理后仍超过 5MB，请选择较小的图片。');
    return { data, mimeType: 'image/png', size: data.length };
  } catch (error) {
    if (error instanceof FeeError) throw error;
    throw new FeeError(400, '图片内容无法识别或尺寸过大，请重新选择图片。');
  }
}

function parseRemark(body = {}) {
  if (Object.keys(body).some(key => key !== 'remark')) throw new FeeError(400, '提交内容包含不支持的字段。');
  if (body.remark === undefined) return undefined;
  if (typeof body.remark !== 'string' || body.remark.length > 200) throw new FeeError(400, '备注须为不超过 200 字符的文本。');
  return body.remark.trim();
}

module.exports = { FeeError, MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS, prepareImage, parseRemark };
