const express = require('express');
const rateLimit = require('express-rate-limit');
const authenticate = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');
const { activityMediaService } = require('../services/ActivityMediaService');

function createActivityMediaRouter(service = activityMediaService) {
  const router = express.Router();
  const noCache = (req, res, next) => { res.set('Cache-Control', 'no-store, private'); next(); };
  const limiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 120, keyGenerator: req => req.user.userId, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: '图片上传请求过于频繁，请稍后重试。', code: 'MEDIA_UPLOAD_LIMIT' } });
  const wrap = handler => async (req, res, next) => { try { await handler(req, res); } catch (error) { next(error); } };
  router.get('/:id/media', authenticate, noCache, wrap(async (req, res) => res.json(await service.list(req.params.id, req.user.userId, req.query))));
  router.post('/:id/media/init', requireAdmin, noCache, limiter, wrap(async (req, res) => res.status(201).json(await service.init(req.params.id, req.user.userId, req.body))));
  router.patch('/:id/media/order', requireAdmin, noCache, wrap(async (req, res) => res.json(await service.order(req.params.id, req.user.userId, req.body))));
  router.delete('/:id/media/cover', requireAdmin, noCache, wrap(async (req, res) => res.json(await service.clearCover(req.params.id, req.user.userId, req.body))));
  router.post('/:id/media/:mediaId/complete', requireAdmin, noCache, wrap(async (req, res) => res.json(await service.complete(req.params.id, req.params.mediaId, req.user.userId, req.body))));
  router.delete('/:id/media/:mediaId', requireAdmin, noCache, wrap(async (req, res) => res.json(await service.remove(req.params.id, req.params.mediaId, req.user.userId, req.body))));
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (!error.status) console.error('[activity-media] operation failed; request bodies and cloud credentials omitted');
    res.status(error.status || 500).json({ error: error.status ? error.message : '活动图片暂时无法处理，请稍后重试。', code: error.status && error.code || 'ACTIVITY_MEDIA_FAILED' });
  });
  return router;
}
module.exports = createActivityMediaRouter();
module.exports.createActivityMediaRouter = createActivityMediaRouter;
