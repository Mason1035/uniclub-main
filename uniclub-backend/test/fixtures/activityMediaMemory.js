const express = require('express');
const { randomBytes, createHash } = require('node:crypto');
const { safeMediaKey, fail, MAX_IMAGE_BYTES } = require('../../utils/activityMediaPolicy');

// Isolated test-only object transport. Never mounted by the production server.
class ActivityMediaMemoryStorage {
  constructor({ origin = '', now = () => new Date() } = {}) { this.origin = origin; this.now = now; this.objects = new Map(); this.tickets = new Map(); this.calls = []; this.failRead = false; this.failThumbnail = false; }
  describe() { return { provider: 'isolated-memory', configured: true }; }
  target(key) { if (!safeMediaKey(key)) fail(400, '测试图片路径无效。'); }
  ticket(method, key, headers = {}) {
    this.target(key); const id = randomBytes(24).toString('hex');
    const expiresAt = new Date(this.now().getTime() + 300000);
    this.tickets.set(id, { method, key, headers, expiresAt });
    return { url: `${this.origin}/test-storage/${id}`, expiresAt };
  }
  async authorizeImage(key, mimeType, uploadId, fileSize) {
    const headers = { 'Content-Type': mimeType, 'x-cos-acl': 'private', 'x-cos-forbid-overwrite': 'true', 'x-cos-meta-classhub-upload': uploadId };
    this.calls.push(['authorize', key]); const target = this.ticket('PUT', key, headers);
    this.tickets.get(target.url.split('/').at(-1)).fileSize = fileSize;
    return { ...target, method: 'PUT', headers };
  }
  put(key, bytes, { mimeType = 'image/png', uploadId = '' } = {}) {
    this.target(key); const body = Buffer.from(bytes); const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
    this.objects.set(key, { body, fileSize: body.length, mimeType, uploadId, etag });
  }
  async headObject(key) { this.target(key); this.calls.push(['head', key]); const object = this.objects.get(key); if (!object) fail(404, '测试图片尚未上传。', 'OBJECT_MISSING'); return { fileSize: object.fileSize, mimeType: object.mimeType, uploadId: object.uploadId, etag: object.etag }; }
  async readRange(key, start, end, etag) { if (this.failRead) fail(502, '隔离存储模拟网络中断。'); const object = this.objects.get(key); if (!object || object.etag !== etag) fail(409, '测试图片发生变化。', 'OBJECT_CHANGED'); this.calls.push(['range', key, start, end, etag]); return object.body.subarray(start, end + 1); }
  async putThumbnail(key, bytes, uploadId) { if (this.failThumbnail) fail(502, '隔离存储模拟缩略图写入失败。'); this.calls.push(['thumbnail', key]); const existing = this.objects.get(key); if (existing && (existing.uploadId !== uploadId || !existing.body.equals(bytes))) fail(409, '测试缩略图冲突。'); if (!existing) this.put(key, bytes, { mimeType: 'image/webp', uploadId }); }
  async downloadUrl(key) { await this.headObject(key); return this.ticket('GET', key).url; }
  createRouter({ allowedOrigin = null } = {}) {
    const router = express.Router();
    router.use((req, res, next) => {
      if (allowedOrigin && req.get('Origin') === allowedOrigin) { res.set('Access-Control-Allow-Origin', allowedOrigin); res.set('Vary', 'Origin'); }
      res.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS'); res.set('Access-Control-Allow-Headers', 'Content-Type, x-cos-acl, x-cos-forbid-overwrite, x-cos-meta-classhub-upload, Range, If-Match'); res.set('Access-Control-Expose-Headers', 'ETag, Content-Range, x-cos-meta-classhub-upload'); res.set('Cache-Control', 'no-store');
      if (req.method === 'OPTIONS') return res.sendStatus(204); next();
    });
    router.all('/test-storage/:ticket', express.raw({ type: () => true, limit: MAX_IMAGE_BYTES }), (req, res) => {
      const ticket = this.tickets.get(req.params.ticket);
      if (!ticket || ticket.method !== req.method || ticket.expiresAt <= this.now() || req.get('Authorization')) return res.sendStatus(403);
      if (req.method === 'PUT') {
        if (Object.entries(ticket.headers).some(([key, value]) => req.get(key) !== value)) return res.sendStatus(403);
        if (this.objects.has(ticket.key)) return res.sendStatus(409);
        if (req.body.length !== ticket.fileSize || Number(req.get('Content-Length')) !== ticket.fileSize) return res.sendStatus(403);
        this.put(ticket.key, req.body, { mimeType: ticket.headers['Content-Type'], uploadId: ticket.headers['x-cos-meta-classhub-upload'] }); return res.sendStatus(200);
      }
      const object = this.objects.get(ticket.key); if (!object) return res.sendStatus(404);
      if (req.get('If-Match') && req.get('If-Match') !== object.etag) return res.sendStatus(412);
      res.set('Content-Type', object.mimeType); res.set('ETag', object.etag); res.set('x-cos-meta-classhub-upload', object.uploadId);
      const range = /^bytes=(\d+)-(\d+)$/.exec(req.get('Range') || '');
      if (range) { const start = Number(range[1]), end = Number(range[2]); if (start > end || end >= object.fileSize) return res.sendStatus(416); res.set('Content-Range', `bytes ${start}-${end}/${object.fileSize}`); return res.status(206).send(object.body.subarray(start, end + 1)); }
      res.send(object.body);
    });
    return router;
  }
}
module.exports = { ActivityMediaMemoryStorage };
