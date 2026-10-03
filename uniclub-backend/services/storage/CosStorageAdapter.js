const COS = require('cos-nodejs-sdk-v5');
const STS = require('qcloud-cos-sts');
const { safeKey, fail, QuantificationError } = require('../../utils/quantificationPolicy');

const uploadPolicy = (bucket, region, key) => {
  if (!safeKey(key) || !key.includes('/staging/')) fail(400, '上传路径无效。');
  return {
    version: '2.0', statement: [{
      effect: 'allow',
      // No GetObject, bucket listing, ACL changes, or writes to submitted keys.
      action: ['name/cos:PutObject', 'name/cos:UploadPart'],
      resource: [`qcs::cos:${region}:uid/${bucket.split('-').at(-1)}:${bucket}/${key}`],
    }],
  };
};

class CosStorageAdapter {
  constructor(env = process.env, dependencies = {}) {
    this.config = { bucket: env.COS_BUCKET || '', region: env.COS_REGION || '', secretId: env.COS_SECRET_ID || '', secretKey: env.COS_SECRET_KEY || '' };
    this.Cos = dependencies.COS || COS;
    this.sts = dependencies.STS || STS;
    this.client = null;
  }
  describe() {
    const c = this.config;
    return { provider: 'cos', configured: /^[a-z\d-]+-\d+$/.test(c.bucket) && /^ap-[a-z\d-]+$/.test(c.region) && Boolean(c.secretId && c.secretKey) };
  }
  getClient() {
    if (!this.describe().configured) fail(503, '文件存储尚未配置，请联系管理员。', 'STORAGE_UNCONFIGURED');
    if (!this.client) this.client = new this.Cos({ SecretId: this.config.secretId, SecretKey: this.config.secretKey, Timeout: 120000 });
    return this.client;
  }
  params(key) {
    if (!safeKey(key)) fail(400, '对象路径无效。');
    return { Bucket: this.config.bucket, Region: this.config.region, Key: key };
  }
  async call(method, params) {
    try { return await new Promise((resolve, reject) => this.getClient()[method](params, (error, data) => error ? reject(error) : resolve(data))); }
    catch (error) {
      if (error instanceof QuantificationError) throw error;
      if (error.statusCode === 404 || ['NoSuchKey', 'NoSuchUpload'].includes(error.code)) fail(404, '文件尚未上传完成或已不存在，请重试上传。', 'OBJECT_MISSING');
      if (error.statusCode === 412) fail(409, '上传文件在确认期间发生变化，请重新提交。', 'OBJECT_CHANGED');
      fail(502, '对象存储暂时无法响应，请检查存储配置或稍后重试。', 'STORAGE_FAILED');
    }
  }
  async credentials(key) {
    this.getClient();
    const c = this.config;
    const policy = uploadPolicy(c.bucket, c.region, key);
    try {
      const data = await new Promise((resolve, reject) => this.sts.getCredential({ secretId: c.secretId, secretKey: c.secretKey, durationSeconds: 1800, policy }, (err, result) => err ? reject(err) : resolve(result)));
      if (!data.credentials?.tmpSecretId || !data.credentials?.tmpSecretKey || !data.credentials?.sessionToken || !data.expiredTime) throw new Error('Incomplete STS response');
      return { TmpSecretId: data.credentials.tmpSecretId, TmpSecretKey: data.credentials.tmpSecretKey, SecurityToken: data.credentials.sessionToken, StartTime: data.startTime || Math.floor(Date.now() / 1000), ExpiredTime: data.expiredTime, ScopeLimit: true };
    } catch { fail(502, '获取临时上传授权失败，请联系管理员检查云端权限。', 'CREDENTIAL_FAILED'); }
  }
  async initiateUpload(key) {
    const data = await this.call('multipartInit', { ...this.params(key), ContentType: 'application/zip', ACL: 'private' });
    return data.UploadId;
  }
  uploadTarget(key, multipartId, partBytes) { return { provider: 'cos', bucket: this.config.bucket, region: this.config.region, key, multipartId, partBytes }; }
  async listParts(key, uploadId) {
    const parts = [];
    let marker = '';
    do {
      const data = await this.call('multipartListPart', { ...this.params(key), UploadId: uploadId, PartNumberMarker: marker, MaxParts: 1000 });
      for (const part of data.Part || []) parts.push({ partNumber: Number(part.PartNumber), size: Number(part.Size), etag: part.ETag });
      marker = data.IsTruncated === 'true' || data.IsTruncated === true ? data.NextPartNumberMarker : '';
    } while (marker);
    return parts;
  }
  async completeMultipart(key, uploadId, fileSize, partBytes) {
    const parts = (await this.listParts(key, uploadId)).sort((a, b) => a.partNumber - b.partNumber);
    const count = Math.ceil(fileSize / partBytes);
    if (parts.length !== count || parts.some((p, index) => p.partNumber !== index + 1 || p.size !== Math.min(partBytes, fileSize - index * partBytes) || !p.etag)) fail(409, '文件分片尚未上传完整，请继续上传后再确认。', 'PARTS_INCOMPLETE');
    await this.call('multipartComplete', { ...this.params(key), UploadId: uploadId, Parts: parts.map(p => ({ PartNumber: p.partNumber, ETag: p.etag })) });
  }
  async headObject(key) {
    const data = await this.call('headObject', this.params(key));
    return { fileSize: Number(data.headers?.['content-length']), mimeType: data.headers?.['content-type'] || '', etag: data.headers?.etag || data.ETag || '' };
  }
  async readRange(key, start, end, etag) {
    const data = await this.call('getObject', { ...this.params(key), Range: `bytes=${start}-${end}`, IfMatch: etag, DataType: 'buffer' });
    return Buffer.isBuffer(data.Body) ? data.Body : Buffer.from(data.Body || '');
  }
  async sealObject(source, target, etag) {
    const copySource = `${this.config.bucket}.cos.${this.config.region}.myqcloud.com/${source.split('/').map(encodeURIComponent).join('/')}`;
    await this.call('putObjectCopy', { ...this.params(target), CopySource: copySource, CopySourceIfMatch: etag, MetadataDirective: 'Replaced', ContentType: 'application/zip', ACL: 'private' });
    return this.headObject(target);
  }
  async downloadUrl(key, filename) {
    const disposition = `attachment; filename="quantification.zip"; filename*=UTF-8''${encodeURIComponent(filename).replace(/'/g, '%27')}`;
    const data = await this.call('getObjectUrl', { ...this.params(key), Sign: true, Expires: 300, Query: { 'response-content-disposition': disposition } });
    return data.Url;
  }
  async deleteObject(key) {
    try { await this.call('deleteObject', this.params(key)); } catch (error) { if (error.status !== 404) throw error; }
  }
  async abortMultipart(key, uploadId) {
    if (!uploadId) return;
    try { await this.call('multipartAbort', { ...this.params(key), UploadId: uploadId }); } catch (error) { if (error.status !== 404) throw error; }
  }
}
module.exports = CosStorageAdapter;
module.exports.uploadPolicy = uploadPolicy;
