const ScfStorageAdapter = require('./ScfStorageAdapter');
const { cosEndpoint } = require('../QuantificationStorageSettings');
const { safeMediaKey, fail, MAX_IMAGE_BYTES } = require('../../utils/activityMediaPolicy');

class ActivityMediaStorage extends ScfStorageAdapter {
  constructor(env = process.env, dependencies = {}) {
    super(env, dependencies);
    this.directoryPrefix = 'activity/';
    this.serviceSecret = env.CLASSHUB_SCF_AUTH_SECRET || '';
    this.secured = false;
  }
  describe() {
    return { provider: 'scf', configured: super.describe().configured && this.serviceSecret.length >= 32, requiresSecuredScf: true };
  }
  params(key) {
    if (!safeMediaKey(key)) fail(400, '活动图片路径无效。', 'INVALID_MEDIA_KEY');
    return { Bucket: this.config.bucket, Region: this.config.region, Key: key };
  }
  cloudParams(extra = {}) { return { bucket: this.config.bucket, region: this.config.region, prefix: 'activity/', business: 'activity', ...extra }; }
  async runtimeClient() {
    if (!this.describe().configured) fail(503, '活动图片存储尚未完成安全配置，请联系管理员。', 'ACTIVITY_STORAGE_UNCONFIGURED');
    if (this.runtimePending) return this.runtimePending;
    if (this.client && this.runtimeUntil > Date.now() && this.secured) return this.client;
    this.runtimePending = (async () => {
      const data = await this.request(this.tokenEndpoint, this.cloudParams());
      const c = data.credentials;
      if (data.secured !== true || data.business !== 'activity' || data.bucket !== this.config.bucket || data.region !== this.config.region || !c || !['TmpSecretId', 'TmpSecretKey', 'Token'].every(key => typeof c[key] === 'string' && c[key].length > 0 && c[key].length < 16384)) fail(503, '云函数尚未支持受保护的活动图片上传。', 'ACTIVITY_SCF_UPGRADE_REQUIRED');
      this.client = new this.Cos({ SecretId: c.TmpSecretId, SecretKey: c.TmpSecretKey, SecurityToken: c.Token, Timeout: 120000, Protocol: 'https:', Domain: new URL(this.config.endpoint || cosEndpoint(this.config.bucket, this.config.region)).hostname });
      this.runtimeUntil = Date.now() + 15000;
      this.secured = true;
      return this.client;
    })();
    try { return await this.runtimePending; } finally { this.runtimePending = null; }
  }
  async authorizeImage(key, mimeType, uploadId, fileSize) {
    this.params(key);
    if (!Number.isSafeInteger(fileSize) || fileSize < 12 || fileSize > MAX_IMAGE_BYTES) fail(400, '图片上传大小无效。', 'INVALID_IMAGE_SIZE');
    const headers = { 'Content-Type': mimeType, 'x-cos-acl': 'private', 'x-cos-forbid-overwrite': 'true', 'x-cos-meta-classhub-upload': uploadId };
    // XHR sends the known Blob length itself; Content-Length is a forbidden
    // browser-set header, so sign it without asking client code to set it.
    const data = await this.call('getObjectUrl', { ...this.params(key), Method: 'PUT', Sign: true, Expires: 300, Headers: { ...headers, 'Content-Length': String(fileSize) } });
    return { url: this.validateUrl(data.Url, key), method: 'PUT', headers, expiresAt: new Date(Date.now() + 300000) };
  }
  async downloadUrl(key) {
    this.params(key);
    const data = await this.request(`${this.functionUrl}/download`, this.cloudParams({ key }));
    if (data.secured !== true || data.business !== 'activity') fail(503, '云函数尚未支持受保护的活动图片读取。', 'ACTIVITY_SCF_UPGRADE_REQUIRED');
    return this.validateUrl(data.url, key);
  }
  async putThumbnail(key, bytes, uploadId) {
    this.params(key);
    try {
      const existing = await this.headObject(key);
      if (existing.fileSize !== bytes.length || existing.mimeType.split(';')[0] !== 'image/webp' || existing.uploadId !== uploadId) fail(409, '缩略图与上传会话不一致。', 'OBJECT_MISMATCH');
      return;
    } catch (error) { if (error.code !== 'OBJECT_MISSING') throw error; }
    try {
      await this.call('putObject', { ...this.params(key), Body: bytes, ContentType: 'image/webp', ACL: 'private', Headers: { 'x-cos-forbid-overwrite': 'true', 'x-cos-meta-classhub-upload': uploadId } });
    } catch (error) {
      // Concurrent idempotent completion may have written the same thumbnail.
      const existing = await this.headObject(key);
      if (existing.fileSize !== bytes.length || existing.uploadId !== uploadId || existing.mimeType.split(';')[0] !== 'image/webp') throw error;
    }
  }
}
module.exports = ActivityMediaStorage;
