const express = require('express');
const rateLimit = require('express-rate-limit');
const authenticate = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');
const Service = require('../services/QuantificationService');
const { assertFields } = require('../utils/quantificationPolicy');

function createRouters(service = new Service()) {
  const router = express.Router();
  const adminRouter = express.Router();
  const noCache = (req, res, next) => { res.set('Cache-Control', 'no-store, private'); next(); };
  router.use(authenticate, noCache);
  adminRouter.use(requireAdmin, noCache);
  const uploadLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 12, keyGenerator: req => req.user.userId, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: '本小时上传次数较多，请稍后再试。', code: 'UPLOAD_LIMIT' } });
  const credentialLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 120, keyGenerator: req => req.user.userId, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: '上传授权请求过于频繁，请稍后再试。' } });
  router.get('/collections', async (req, res) => res.json(await service.run(s => s.collections())));
  router.get('/access', async (req, res) => res.json(await service.run(s => s.access(req.user.userId))));
  router.get('/collections/:id/me', async (req, res) => res.json(await service.run(s => s.mine(req.params.id, req.user.userId))));
  router.post('/collections/:id/uploads', uploadLimit, async (req, res) => res.status(201).json(await service.run(s => s.initUpload(req.params.id, req.user.userId, req.body))));
  router.post('/uploads/:id/credentials', credentialLimit, async (req, res) => { assertFields(req.body, []); res.json(await service.run(s => s.credentials(req.params.id, req.user.userId))); });
  router.post('/uploads/:id/authorization', credentialLimit, async (req, res) => res.json(await service.run(s => s.authorizeUpload(req.params.id, req.user.userId, req.body))));
  router.get('/uploads/:id/parts', async (req, res) => res.json(await service.run(s => s.parts(req.params.id, req.user.userId))));
  router.post('/uploads/:id/complete', async (req, res) => { assertFields(req.body, []); res.json(await service.run(s => s.confirm(req.params.id, req.user.userId))); });
  router.post('/uploads/:id/abort', async (req, res) => { assertFields(req.body, []); res.json(await service.run(s => s.abort(req.params.id, req.user.userId))); });
  // Owner-only endpoint. Administrators have explicit endpoints below.
  router.get('/submissions/:id/download', async (req, res) => res.json(await service.run(s => s.download(req.params.id, req.user.userId))));

  adminRouter.get('/files', async (req, res) => res.json(await service.run(s => s.storageFiles())));
  adminRouter.post('/files/downloads', async (req, res) => { assertFields(req.body, ['keys']); res.json(await service.run(s => s.storageDownloads(req.body.keys))); });
  adminRouter.get('/storage', (req, res) => res.json(service.storageConfig()));
  adminRouter.put('/storage', async (req, res) => res.json(await service.saveStorageConfig(req.body, req.user.userId)));
  adminRouter.post('/storage/test', async (req, res) => { assertFields(req.body, []); res.json(await service.run(s => s.testStorageConfig())); });
  adminRouter.get('/collections', async (req, res) => res.json(await service.run(s => s.collections(true))));
  adminRouter.post('/collections', async (req, res) => res.status(201).json({ collection: await service.run(s => s.createCollection(req.body, req.user.userId)) }));
  adminRouter.patch('/collections/:id', async (req, res) => res.json({ collection: await service.run(s => s.editCollection(req.params.id, req.body)) }));
  adminRouter.get('/collections/:id/submissions', async (req, res) => res.json(await service.run(s => s.overview(req.params.id, req.query))));
  adminRouter.get('/submissions/:id/download', async (req, res) => res.json(await service.run(s => s.download(req.params.id, req.user.userId, true))));
  adminRouter.post('/downloads', async (req, res) => { assertFields(req.body, ['submissionIds']); res.json(await service.run(s => s.bulkDownload(req.body.submissionIds, req.user.userId))); });
  adminRouter.post('/cleanup', async (req, res) => { assertFields(req.body, []); res.json(await service.run(s => s.cleanup())); });
  const errors = (err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (!err.status) console.error('[quantification] request failed; no request body or cloud credentials logged');
    res.status(err.status || 500).json({ error: err.status ? err.message : '量化材料服务暂时不可用，请稍后重试。', code: err.code && err.status ? err.code : 'INTERNAL_ERROR' });
  };
  const missing = (req, res) => res.status(404).json({ error: '量化材料接口不存在。' });
  router.use(missing); adminRouter.use(missing);
  router.use(errors); adminRouter.use(errors);
  return { router, adminRouter, service, uploadLimit, credentialLimit };
}
const result = createRouters();
module.exports = result.router;
module.exports.adminRouter = result.adminRouter;
module.exports.service = result.service;
module.exports.createRouters = createRouters;
