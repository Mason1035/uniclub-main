const MAX_FILE_BYTES = 500 * 1024 * 1024;
const PART_BYTES = 20 * 1024 * 1024;
const ZIP_MIME_TYPES = new Set(['application/zip', 'application/x-zip-compressed', 'application/octet-stream']);

class QuantificationError extends Error {
  constructor(status, message, code = 'QUANTIFICATION_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, message, code) => { throw new QuantificationError(status, message, code); };
const validId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const assertId = (value) => { if (!validId(value)) fail(400, '记录编号无效，请刷新页面后重试。'); };
const assertFields = (body, keys) => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key))) {
    fail(400, '请求包含不允许的字段。');
  }
};
const validateFile = (body) => {
  assertFields(body, ['originalFilename', 'fileSize', 'mimeType']);
  const name = body.originalFilename;
  if (typeof name !== 'string' || !name.trim() || name.length > 200 || /[\x00-\x1f\x7f/\\]/.test(name) || name.includes('..') || !/\.zip$/i.test(name.trim())) {
    fail(400, '只能提交 ZIP 压缩包，文件名不能包含路径或特殊控制字符。', 'INVALID_FILE');
  }
  if (!Number.isSafeInteger(body.fileSize) || body.fileSize < 22 || body.fileSize > MAX_FILE_BYTES) {
    fail(400, 'ZIP 文件必须完整，且大小不能超过 500MB。', 'INVALID_SIZE');
  }
  if (!ZIP_MIME_TYPES.has(body.mimeType)) fail(400, '文件类型不支持，请选择 ZIP 压缩包。', 'INVALID_FILE');
  return { originalFilename: name.trim(), fileSize: body.fileSize, mimeType: 'application/zip' };
};
const availability = (collection, now = new Date()) => {
  if (collection.status === 'draft') return 'draft';
  if (collection.status === 'closed' || (collection.deadline && new Date(collection.deadline) <= now)) return 'closed';
  if (collection.startAt && new Date(collection.startAt) > now) return 'scheduled';
  return 'open';
};
const assertOpen = (collection, now) => {
  if (availability(collection, now) !== 'open') fail(409, '本期收集尚未开放或已经截止，不能提交材料。', 'COLLECTION_CLOSED');
};
const validateCollection = (body, existing = null) => {
  assertFields(body, ['title', 'description', 'startAt', 'deadline', 'status']);
  const result = {};
  for (const key of ['title', 'description']) {
    if (body[key] === undefined && existing) continue;
    const value = body[key] ?? '';
    if (typeof value !== 'string' || value.length > (key === 'title' ? 100 : 5000) || (key === 'title' && !value.trim())) {
      fail(400, key === 'title' ? '收集期标题必填，最多 100 个字符。' : '提交说明最多 5000 个字符。');
    }
    result[key] = value.trim();
  }
  for (const key of ['startAt', 'deadline']) {
    if (body[key] === undefined && existing) continue;
    const value = body[key];
    if (value === null || value === '' || value === undefined) result[key] = null;
    else {
      if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail(400, '开始时间或截止时间无效。');
      result[key] = new Date(value);
    }
  }
  if (body.status !== undefined || !existing) {
    result.status = body.status ?? 'draft';
    if (!['draft', 'open', 'closed'].includes(result.status)) fail(400, '收集期状态无效。');
  }
  const start = result.startAt === undefined ? existing?.startAt : result.startAt;
  const deadline = result.deadline === undefined ? existing?.deadline : result.deadline;
  if (start && deadline && new Date(deadline) <= new Date(start)) fail(400, '截止时间必须晚于开始时间。');
  return result;
};
const safeKey = (key) => typeof key === 'string' && key.length <= 221 && /^(?:[a-zA-Z\d_-]{1,63}\/){1,4}[a-f\d]{24}\/[a-f\d]{24}\/(?:staging|submitted)\/[a-f\d]{24}\.zip$/.test(key);
// The original SCF system stores ZIPs as directory/original-filename.zip.
// Keep native COS's managed-key policy separate from this compatibility format.
const safeMaterialKey = key => typeof key === 'string' && key.length <= 1024 && !safeKey(key) &&
  /^(?:[a-zA-Z\d_-]{1,63}\/){1,4}[^/\\]{1,200}\.zip$/i.test(key) && !/[\x00-\x1f\x7f]/.test(key) && !key.includes('..');
const safeStorageKey = key => safeKey(key) || safeMaterialKey(key);

// Inspect the ZIP directory envelope without decompressing untrusted archives.
// A renamed non-ZIP cannot pass by supplying a MIME type or a four-byte prefix.
async function verifyZip(storage, key, fileSize, etag) {
  const first = await storage.readRange(key, 0, 3, etag);
  if (first.length !== 4 || ![0x04034b50, 0x06054b50].includes(first.readUInt32LE(0))) fail(400, '文件内容不是完整的 ZIP 压缩包。', 'INVALID_ZIP');
  const tailStart = Math.max(0, fileSize - 65557);
  const tail = await storage.readRange(key, tailStart, fileSize - 1, etag);
  let end = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === 0x06054b50 && i + 22 + tail.readUInt16LE(i + 20) === tail.length) { end = i; break; }
  }
  if (end < 0 || tail.readUInt16LE(end + 4) !== 0 || tail.readUInt16LE(end + 6) !== 0) fail(400, 'ZIP 压缩包不完整，或属于不支持的分卷压缩包。', 'INVALID_ZIP');
  let entries = tail.readUInt16LE(end + 10);
  let size = tail.readUInt32LE(end + 12);
  let offset = tail.readUInt32LE(end + 16);
  let endOffset = tailStart + end;
  if (entries === 0xffff || size === 0xffffffff || offset === 0xffffffff) {
    if (end < 20 || tail.readUInt32LE(end - 20) !== 0x07064b50) fail(400, 'ZIP64 目录不完整。', 'INVALID_ZIP');
    const location = Number(tail.readBigUInt64LE(end - 12));
    if (!Number.isSafeInteger(location) || location < 0 || location + 56 > endOffset) fail(400, 'ZIP64 目录位置无效。', 'INVALID_ZIP');
    const directory = await storage.readRange(key, location, location + 55, etag);
    if (directory.length !== 56 || directory.readUInt32LE(0) !== 0x06064b50 || directory.readUInt32LE(16) || directory.readUInt32LE(20)) fail(400, 'ZIP64 目录无效。', 'INVALID_ZIP');
    entries = Number(directory.readBigUInt64LE(32));
    size = Number(directory.readBigUInt64LE(40));
    offset = Number(directory.readBigUInt64LE(48));
    endOffset = location;
  }
  if (![entries, size, offset].every(Number.isSafeInteger) || offset < 0 || size < 0 || offset + size > endOffset) fail(400, 'ZIP 目录超出文件范围。', 'INVALID_ZIP');
  if (entries > 0) {
    if (size < 46) fail(400, 'ZIP 文件目录不完整。', 'INVALID_ZIP');
    const signature = await storage.readRange(key, offset, offset + 3, etag);
    if (signature.length !== 4 || signature.readUInt32LE(0) !== 0x02014b50) fail(400, 'ZIP 文件目录无效。', 'INVALID_ZIP');
  } else if (size !== 0 || offset !== 0 || tailStart + end !== 0 || first.readUInt32LE(0) !== 0x06054b50) fail(400, 'ZIP 空目录无效。', 'INVALID_ZIP');
}

module.exports = { MAX_FILE_BYTES, PART_BYTES, QuantificationError, fail, validId, assertId, assertFields, validateFile, availability, assertOpen, validateCollection, safeKey, safeMaterialKey, safeStorageKey, verifyZip };
