const axios = require('axios');
const CosStorageAdapter = require('./CosStorageAdapter');
const { MAX_FILE_BYTES, fail, safeKey, safeMaterialKey, safeStorageKey, QuantificationError } = require('../../utils/quantificationPolicy');
const { functionEndpoint, validPrefix, cosEndpoint } = require('../QuantificationStorageSettings');

// Upload-role credentials sign writes only. Reads use the download function's
// signed COS URLs, matching the two separate roles of the original SCF system.
class ScfStorageAdapter extends CosStorageAdapter {
  constructor(env, dependencies = {}) {
    super(env, dependencies);
    this.config.endpoint = env.COS_ENDPOINT || cosEndpoint(this.config.bucket, this.config.region);
    this.directoryPrefix = env.COS_UPLOAD_DIRECTORY || 'quantification/';
    this.tokenEndpoint = functionEndpoint(env.SCF_TOKEN_ENDPOINT);
    this.functionUrl = functionEndpoint(env.SCF_FUNCTION_URL);
    this.http = dependencies.http || axios;
    this.readUrls = new Map();
    this.retainObjects = true;
  }
  describe() {
    const c = this.config;
    return { provider: 'scf', configured: /^[a-z\d-]+-\d+$/.test(c.bucket) && /^ap-[a-z\d-]+$/.test(c.region) && c.endpoint === cosEndpoint(c.bucket, c.region) && validPrefix(this.directoryPrefix) && Boolean(this.tokenEndpoint && this.functionUrl) };
  }
  async request(url, params) {
    if (!this.describe().configured) fail(503, '云函数存储尚未配置，请联系管理员。', 'STORAGE_UNCONFIGURED');
    try {
      const { data } = await this.http.get(url, { params, timeout: 15000, maxRedirects: 0, maxContentLength: 2 * 1024 * 1024 });
      if (data?.success !== true) fail(502, '云函数响应无效，请检查函数地址和接口配置。', 'SCF_CONTRACT');
      return data;
    } catch (error) {
      if (error instanceof QuantificationError) throw error;
      if (url.endsWith('/download') && error.response?.status === 404) fail(404, '文件尚未上传完成或已不存在，请重试上传。', 'OBJECT_MISSING');
      fail(502, '云函数无法响应，请检查函数地址、部署状态和运行角色权限。', 'SCF_UNAVAILABLE');
    }
  }
  cloudParams(extra = {}) { return { bucket: this.config.bucket, region: this.config.region, prefix: this.directoryPrefix, ...extra }; }
  params(key) {
    if (!safeStorageKey(key)) fail(400, '对象路径无效。');
    return { Bucket: this.config.bucket, Region: this.config.region, Key: key };
  }
  uploadKey(filename) {
    const key = `${this.directoryPrefix}${filename}`;
    if (!safeMaterialKey(key)) fail(400, '上传目录或文件名无效。');
    return key;
  }
  confirmationTarget(key, filename) {
    this.params(key);
    if (safeMaterialKey(key)) return key;
    const prefix = key.replace(/[a-f\d]{24}\/[a-f\d]{24}\/(?:staging|submitted)\/[a-f\d]{24}\.zip$/, '');
    const target = `${prefix}${filename}`;
    if (!safeMaterialKey(target)) fail(400, '原上传目录或文件名无效。');
    return target;
  }
  async assertAvailable(key) {
    try { await this.headObject(key); }
    catch (error) { if (error.code === 'OBJECT_MISSING') return; throw error; }
    fail(409, '目录中已有同名文件，请修改 ZIP 文件名后再上传；已传完但尚未确认的文件请点击“重新确认提交”。', 'FILENAME_EXISTS');
  }
  async runtimeClient() {
    if (this.runtimePending) return this.runtimePending;
    if (this.client && this.runtimeUntil > Date.now()) return this.client;
    this.runtimePending = (async () => {
      const data = await this.request(this.tokenEndpoint, this.cloudParams());
      const c = data.credentials;
      if (data.bucket !== this.config.bucket || data.region !== this.config.region || !c || !['TmpSecretId', 'TmpSecretKey', 'Token'].every(key => typeof c[key] === 'string' && c[key].length > 0 && c[key].length < 16384)) fail(502, '上传云函数凭证或存储桶信息不完整。', 'SCF_CONTRACT');
      this.client = new this.Cos({ SecretId: c.TmpSecretId, SecretKey: c.TmpSecretKey, SecurityToken: c.Token, Timeout: 120000, Protocol: 'https:', Domain: new URL(this.config.endpoint).hostname });
      this.runtimeUntil = Date.now() + 15000;
      return this.client;
    })();
    try { return await this.runtimePending; } finally { this.runtimePending = null; }
  }
  getClient() { if (!this.client) fail(503, '上传云函数凭证尚未获取。'); return this.client; }
  async call(method, params) { await this.runtimeClient(); return super.call(method, params); }
  async credentials(key) {
    this.params(key);
    await this.runtimeClient();
    const start = Math.floor(Date.now() / 1000);
    return { mode: 'signed', StartTime: start, ExpiredTime: start + 300, ScopeLimit: true };
  }
  uploadTarget(key, multipartId, partBytes) { return { ...super.uploadTarget(key, multipartId, partBytes), endpoint: this.config.endpoint }; }
  async initiateUpload(key, uploadId) {
    const data = await this.call('multipartInit', { ...this.params(key), ContentType: 'application/zip', ACL: 'private', Headers: { 'x-cos-forbid-overwrite': 'true', 'x-cos-meta-classhub-upload': uploadId } });
    return data.UploadId;
  }
  async completeMultipart(key, uploadId, fileSize, partBytes) {
    const parts = (await this.listParts(key, uploadId)).sort((a, b) => a.partNumber - b.partNumber);
    const count = Math.ceil(fileSize / partBytes);
    if (parts.length !== count || parts.some((p, index) => p.partNumber !== index + 1 || p.size !== Math.min(partBytes, fileSize - index * partBytes) || !p.etag)) fail(409, '文件分片尚未上传完整，请继续上传后再确认。', 'PARTS_INCOMPLETE');
    await this.call('multipartComplete', { ...this.params(key), UploadId: uploadId, Parts: parts.map(p => ({ PartNumber: p.partNumber, ETag: p.etag })), Headers: { 'x-cos-forbid-overwrite': 'true' } });
  }
  async authorizeUpload(key, multipartId, partNumber, uploadId) {
    this.params(key);
    const headers = { 'Content-Type': 'application/zip' };
    if (!multipartId) { headers['x-cos-acl'] = 'private'; headers['x-cos-forbid-overwrite'] = 'true'; if (uploadId) headers['x-cos-meta-classhub-upload'] = uploadId; }
    const query = multipartId ? { uploadId: multipartId, partNumber: String(partNumber) } : {};
    const data = await this.call('getObjectUrl', { ...this.params(key), Method: 'PUT', Sign: true, Expires: 300, Query: query, Headers: headers });
    return { url: this.validateUrl(data.Url, key), headers, expiresAt: new Date(Date.now() + 300000) };
  }
  validateUrl(value, key) {
    try {
      const url = new URL(value);
      if (url.origin === this.config.endpoint && !url.username && !url.password && !url.hash && decodeURIComponent(url.pathname) === `/${key}` && url.searchParams.has('q-signature')) return url.href;
    } catch { /* Never expose an untrusted URL or credentials in an error. */ }
    fail(502, '云端返回的文件地址无效，请检查云函数配置。', 'SCF_CONTRACT');
  }
  directoryFor(key) {
    this.params(key);
    return safeKey(key) ? key.replace(/[a-f\d]{24}\/[a-f\d]{24}\/(?:staging|submitted)\/[a-f\d]{24}\.zip$/, '') : key.slice(0, key.lastIndexOf('/') + 1);
  }
  async downloadUrl(key, filename) {
    const data = await this.request(`${this.functionUrl}/download`, this.cloudParams({ key, filename: filename || key.split('/').at(-1), prefix: this.directoryFor(key) }));
    return this.validateUrl(data.url, key);
  }
  async readUrl(key) {
    const cached = this.readUrls.get(key);
    if (cached && cached.until > Date.now()) return cached.url;
    const url = await this.downloadUrl(key);
    this.readUrls.set(key, { url, until: Date.now() + 240000 });
    return url;
  }
  storageError(error) {
    if (error instanceof QuantificationError) throw error;
    if (error.response?.status === 404) fail(404, '文件尚未上传完成或已不存在，请重试上传。', 'OBJECT_MISSING');
    if (error.response?.status === 412) fail(409, '上传文件在确认期间发生变化，请重新提交。', 'OBJECT_CHANGED');
    if (error.response?.status === 409) fail(409, '目录中已有同名文件，请修改 ZIP 文件名后再上传。', 'FILENAME_EXISTS');
    fail(502, '下载云函数提供的 COS 地址暂时无法读取，请重试确认或联系管理员检查下载角色权限。', 'STORAGE_FAILED');
  }
  async rangeResponse(key, start, end, etag) {
    try {
      const response = await this.http.get(await this.readUrl(key), { headers: { Range: `bytes=${start}-${end}`, ...(etag ? { 'If-Match': etag } : {}) }, responseType: 'arraybuffer', maxRedirects: 0, timeout: 60000, maxContentLength: end - start + 1 });
      if (response.status !== 206 || Buffer.from(response.data).length !== end - start + 1) fail(502, '云端文件范围响应无效，请重新确认。', 'SCF_CONTRACT');
      return response;
    } catch (error) { this.storageError(error); }
  }
  async headObject(key) {
    // A GET-signed URL cannot authorize HEAD. A one-byte GET gives the full
    // length in Content-Range without downloading the archive.
    const response = await this.rangeResponse(key, 0, 0);
    const range = /^bytes 0-0\/(\d+)$/.exec(response.headers['content-range'] || '');
    if (!range) fail(502, '云端未返回文件总大小。', 'SCF_CONTRACT');
    return { fileSize: Number(range[1]), mimeType: response.headers['content-type'] || '', etag: response.headers.etag || '', crc64: response.headers['x-cos-hash-crc64ecma'] || '', uploadId: response.headers['x-cos-meta-classhub-upload'] || '' };
  }
  async readRange(key, start, end, etag) { return Buffer.from((await this.rangeResponse(key, start, end, etag)).data); }
  async sealObject(source, target, etag, uploadId) {
    // Compatibility recovery for uploads created by the former staging flow.
    // Stream a signed download into a signed PUT, using each role for its own
    // operation; neither GetObject nor PutObjectCopy is required of the writer.
    const sourceHead = await this.headObject(source);
    if (sourceHead.etag !== etag) fail(409, '上传文件在确认期间发生变化，请重新提交。', 'OBJECT_CHANGED');
    try {
      const existing = await this.headObject(target);
      if (existing.uploadId === uploadId && existing.fileSize === sourceHead.fileSize && (existing.etag === etag || sourceHead.crc64 && existing.crc64 === sourceHead.crc64)) return existing;
      fail(409, '目录中已有同名文件，请修改 ZIP 文件名后重新上传。', 'FILENAME_EXISTS');
    } catch (error) { if (error.code !== 'OBJECT_MISSING') throw error; }
    let stream;
    try {
      const response = await this.http.get(await this.readUrl(source), { headers: { 'If-Match': etag }, responseType: 'stream', timeout: 180000, maxRedirects: 0 });
      stream = response.data;
      const authorization = await this.authorizeUpload(target, '', null, uploadId);
      await this.http.put(authorization.url, stream, { headers: { ...authorization.headers, 'Content-Length': String(sourceHead.fileSize) }, maxRedirects: 0, timeout: 180000, maxBodyLength: MAX_FILE_BYTES });
    } catch (error) { this.storageError(error); }
    finally { stream?.destroy(); }
    return this.headObject(target);
  }
  async listFiles() {
    const files = new Map(); let marker = '';
    for (let page = 0; page < 100; page++) {
      const data = await this.request(`${this.functionUrl}/list`, this.cloudParams({ limit: 1000, ...(marker ? { marker } : {}) }));
      if (data.prefix !== this.directoryPrefix || !Array.isArray(data.files)) fail(502, '下载云函数目录响应不一致。', 'SCF_CONTRACT');
      for (const file of data.files) {
        if (typeof file.key !== 'string' || !file.key.startsWith(this.directoryPrefix) || !safeStorageKey(file.key) || !Number.isSafeInteger(file.size) || file.size < 0) continue;
        files.set(file.key, { key: file.key, name: file.key.slice(this.directoryPrefix.length), size: file.size, lastModified: typeof file.lastModified === 'string' ? file.lastModified : '' });
      }
      if (!data.nextMarker) return [...files.values()];
      if (typeof data.nextMarker !== 'string' || !data.nextMarker.startsWith(this.directoryPrefix) || data.nextMarker === marker || data.nextMarker.length > 1024) fail(502, '云函数分页响应无效。', 'SCF_CONTRACT');
      marker = data.nextMarker;
    }
    fail(502, '材料列表页数过多，请联系管理员缩小目录范围。', 'SCF_CONTRACT');
  }
  async testConnection() {
    await this.runtimeClient();
    const data = await this.request(`${this.functionUrl}/list`, this.cloudParams({ limit: 1 }));
    if (data.prefix !== this.directoryPrefix || !Array.isArray(data.files)) fail(502, '下载云函数目录响应不一致。', 'SCF_CONTRACT');
    return { connected: true, message: '上传凭证与下载列表接口可访问。实际上传还需正确的 COS 权限和跨域配置。' };
  }
}
module.exports = ScfStorageAdapter;
