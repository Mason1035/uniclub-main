const express = require('express');
const authenticateToken = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const ResourceQuickLinkService = require('../services/ResourceQuickLinkService');
const ResourceQuickLinkRepository = require('../services/ResourceQuickLinkRepository');
const { ResourceQuickLinkError } = require('../utils/resourceQuickLinks');

function privateResponse(req, res, next) {
  res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff' });
  res.vary('Authorization');
  next();
}

function handleError(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof ResourceQuickLinkError) return res.status(error.status).json({ error: error.message });
  return res.status(500).json({ error: '快捷访问暂时无法响应，请稍后重试。' });
}

function createResourceQuickLinksRouters(service = new ResourceQuickLinkService(new ResourceQuickLinkRepository())) {
  const userRouter = express.Router();
  const adminRouter = express.Router();
  userRouter.use(privateResponse, authenticateToken);
  adminRouter.use(privateResponse, requireAdmin);

  userRouter.get('/', async (req, res) => res.json({ links: await service.list() }));
  adminRouter.post('/', async (req, res) => res.status(201).json({ link: await service.create(req.body, String(req.adminUser._id)) }));
  adminRouter.delete('/:id', async (req, res) => {
    await service.delete(req.params.id);
    res.status(204).end();
  });
  userRouter.use(handleError);
  adminRouter.use(handleError);
  return { userRouter, adminRouter };
}

const routers = createResourceQuickLinksRouters();
module.exports = routers.userRouter;
module.exports.adminRouter = routers.adminRouter;
module.exports.createResourceQuickLinksRouters = createResourceQuickLinksRouters;
