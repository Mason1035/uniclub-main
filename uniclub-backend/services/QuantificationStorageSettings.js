const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { fail, assertFields } = require('../utils/quantificationPolicy');

const KEYS = ['OBJECT_STORAGE_PROVIDER', 'COS_BUCKET', 'COS_REGION', 'COS_ENDPOINT', 'COS_UPLOAD_DIRECTORY', 'SCF_TOKEN_ENDPOINT', 'SCF_FUNCTION_URL'];
const FIELDS = ['revision', 'bucket', 'region', 'endpoint', 'directoryPrefix', 'tokenEndpoint', 'functionUrl'];
// Retired cloud access fields are ignored only within storage configuration.
// In particular, this does not change ClassHub's authToken login/session keys.
const retiredCloudField = key => /^(?:scf(?:_?(?:auth|shared))?_?token|shared_?token|function_?token|authToken|authTokenConfigured)$/i.test(key);
const omitRetiredFields = value => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).filter(([key]) => !retiredCloudField(key))) : value;
const text = value => typeof value === 'string' ? value.trim() : '';
const validBucket = value => /^[a-z\d][a-z\d-]{1,61}-\d{5,20}$/.test(value);
const validRegion = value => /^ap-[a-z\d-]{2,30}$/.test(value);
const validPrefix = value => typeof value === 'string' && value.length <= 128 && /^(?:[a-zA-Z\d_-]{1,63}\/){1,4}$/.test(value);
function cosEndpoint(bucket, region) { return `https://${bucket}.cos.${region}.myqcloud.com`; }
function functionEndpoint(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !/^[a-z\d-]+\.ap-[a-z\d-]+\.tencentscf\.com$/.test(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}

class QuantificationStorageSettings {
  constructor({ filename = process.env.QUANTIFICATION_STORAGE_CONFIG_PATH || path.join(__dirname, '..', '.quantification-storage.json'), env = process.env } = {}) {
    this.filename = filename;
    this.base = Object.fromEntries(Object.entries(env).filter(([key]) => !/^scf(?:_?(?:auth|shared))?_?token$/i.test(key)));
    this.active = 0;
    this.saving = false;
  }
  read() {
    try {
      const stat = fs.lstatSync(this.filename);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) throw new Error('Invalid config file');
      const data = JSON.parse(fs.readFileSync(this.filename, 'utf8'));
      data.values = omitRetiredFields(data.values);
      if (data.version !== 1 || typeof data.revision !== 'string' || !data.values || Object.keys(data.values).some(key => !KEYS.includes(key)) || Object.values(data.values).some(value => typeof value !== 'string')) throw new Error('Invalid config');
      return data;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      fail(503, '存储配置文件无法读取，请联系服务器管理员检查文件。', 'CONFIG_UNREADABLE');
    }
  }
  environment() { return { ...this.base, ...(this.read()?.values || {}) }; }
  view() {
    const saved = this.read();
    const env = { ...this.base, ...(saved?.values || {}) };
    return {
      revision: saved?.revision || createHash('sha256').update(JSON.stringify(KEYS.map(key => env[key] || ''))).digest('hex'),
      mode: env.OBJECT_STORAGE_PROVIDER === 'scf' ? 'scf' : 'cos',
      bucket: env.COS_BUCKET || '', region: env.COS_REGION || '',
      endpoint: env.COS_ENDPOINT || (env.COS_BUCKET && env.COS_REGION ? cosEndpoint(env.COS_BUCKET, env.COS_REGION) : ''),
      directoryPrefix: env.COS_UPLOAD_DIRECTORY || 'quantification/',
      tokenEndpoint: env.SCF_TOKEN_ENDPOINT || '', functionUrl: env.SCF_FUNCTION_URL || '',
      updatedAt: saved?.updatedAt || null,
    };
  }
  enterOperation() {
    if (this.saving) fail(409, '存储配置正在保存，请稍后重试。', 'CONFIG_BUSY');
    this.active++;
    let released = false;
    return () => { if (!released) { released = true; this.active--; } };
  }
  validate(body, current) {
    body = omitRetiredFields(body);
    assertFields(body, FIELDS);
    if (typeof body.revision !== 'string' || body.revision !== current.revision) fail(409, '配置已被另一位管理员更新，请重新打开后再保存。', 'CONFIG_CONFLICT');
    for (const key of FIELDS.filter(key => key !== 'revision')) if (typeof body[key] !== 'string') fail(400, '请完整填写存储配置。');
    const bucket = text(body.bucket), region = text(body.region);
    if (!validBucket(bucket) || !validRegion(region)) fail(400, '存储桶名称或地域格式无效。');
    const expected = cosEndpoint(bucket, region);
    const endpoint = text(body.endpoint).replace(/\/$/, '') || expected;
    if (endpoint !== expected) fail(400, 'Endpoint 必须是此存储桶与地域对应的 HTTPS COS 地址。');
    const directoryPrefix = text(body.directoryPrefix).replace(/\/$/, '') + '/';
    if (!validPrefix(directoryPrefix)) fail(400, '上传目录只能包含字母、数字、下划线、短横线和斜杠，最多 4 层目录。');
    const tokenEndpoint = functionEndpoint(text(body.tokenEndpoint));
    const functionUrl = functionEndpoint(text(body.functionUrl));
    if (!tokenEndpoint || !functionUrl) fail(400, '请填写腾讯云 SCF 的 HTTPS 函数根地址，不要附加 /list、/download 或查询参数。');
    return { OBJECT_STORAGE_PROVIDER: 'scf', COS_BUCKET: bucket, COS_REGION: region, COS_ENDPOINT: endpoint, COS_UPLOAD_DIRECTORY: directoryPrefix, SCF_TOKEN_ENDPOINT: tokenEndpoint, SCF_FUNCTION_URL: functionUrl };
  }
  async save(body, actor, hasRecords) {
    if (this.saving || this.active) fail(409, '当前有存储操作正在进行，请稍后再保存配置。', 'CONFIG_BUSY');
    this.saving = true;
    let lock, temporary;
    try {
      try { lock = await fsp.open(`${this.filename}.lock`, 'wx', 0o600); }
      catch (error) { if (error.code === 'EEXIST') fail(409, '另一进程正在保存配置，请稍后重试。', 'CONFIG_BUSY'); throw error; }
      const current = this.view();
      const values = this.validate(body, current);
      if ((current.bucket && current.bucket !== values.COS_BUCKET || current.region && current.region !== values.COS_REGION) && await hasRecords()) fail(409, '已有上传或提交记录，不能直接更换存储桶或地域；请先完成材料迁移。', 'STORAGE_IN_USE');
      const data = { version: 1, revision: randomUUID(), updatedAt: new Date().toISOString(), updatedBy: actor, values };
      temporary = `${this.filename}.${randomUUID()}.tmp`;
      await fsp.writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      const file = await fsp.open(temporary, 'r');
      try { await file.sync(); } finally { await file.close(); }
      await fsp.rename(temporary, this.filename);
      return this.view();
    } catch (error) {
      if (error.status) throw error;
      fail(503, '配置未能保存，请检查后端配置目录的写入权限。', 'CONFIG_WRITE_FAILED');
    } finally {
      if (temporary) await fsp.unlink(temporary).catch(() => {});
      if (lock) { await lock.close(); await fsp.unlink(`${this.filename}.lock`).catch(() => {}); }
      this.saving = false;
    }
  }
}
module.exports = QuantificationStorageSettings;
module.exports.functionEndpoint = functionEndpoint;
module.exports.validPrefix = validPrefix;
module.exports.cosEndpoint = cosEndpoint;
