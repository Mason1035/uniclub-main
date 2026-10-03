const express = require('express');
const multer = require('multer');
const authenticateToken = require('../middleware/auth');
const { requireAdmin, isAdminUser } = require('../middleware/admin');
const { paginationOf, paged } = require('./admin/_shared');
const { FeeError, MAX_IMAGE_BYTES } = require('../utils/feeImage');
const FeeService = require('../services/FeeService');
const FeeRepository = require('../services/FeeRepository');

const proofUpload = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: MAX_IMAGE_BYTES, files: 1, fields: 1, parts: 3, fieldSize: 1200,
} }).single('proof');
const qrUpload = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 2,
} }).single('paymentQr');

function privateResponse(req, res, next) {
  res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff' });
  res.vary('Authorization');
  next();
}

const sendImage = (res, image) => res.type(image.mimeType).send(image.data);

// No image bytes, filenames, remarks, or request bodies are logged here.
function handleError(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof FeeError) return res.status(error.status).json({ error: error.message });
  if (error instanceof multer.MulterError) {
    const large = error.code === 'LIMIT_FILE_SIZE';
    return res.status(large ? 413 : 400).json({ error: large ? '图片不能超过 5MB。' : '上传内容不符合要求，请只选择一张图片。' });
  }
  return res.status(500).json({ error: '班费服务暂时无法响应，请稍后重试。' });
}

function createFeesRouters(service = new FeeService(new FeeRepository(), { isAdmin: isAdminUser })) {
  const userRouter = express.Router();
  const adminRouter = express.Router();
  userRouter.use(privateResponse, authenticateToken);
  adminRouter.use(privateResponse, requireAdmin);

  userRouter.get('/settings', async (req, res) => res.json({ settings: await service.settings() }));
  userRouter.get('/payment-qr', async (req, res) => sendImage(res, await service.qr()));
  userRouter.get('/me', async (req, res) => res.json({ submission: await service.mine(req.user.userId) }));
  userRouter.post('/submissions', proofUpload, async (req, res) => res.json({
    message: '缴费凭证提交成功', submission: await service.submit(req.user.userId, req.body, req.file, true),
  }));
  userRouter.patch('/submissions/me', proofUpload, async (req, res) => res.json({
    message: '缴费凭证提交成功', submission: await service.submit(req.user.userId, req.body, req.file, false),
  }));
  userRouter.get('/submissions/:id/proof', async (req, res) => sendImage(res, await service.proof(req.params.id, req.user.userId)));

  adminRouter.put('/payment-qr', qrUpload, async (req, res) => res.json({ settings: await service.saveQr(req.file, req.body) }));
  adminRouter.get('/submissions', async (req, res) => {
    const { page, limit, skip } = paginationOf(req.query);
    const result = await service.list({ status: req.query.status || '', skip, limit });
    res.json({ submissions: result.items, pagination: paged(page, limit, result.total) });
  });
  adminRouter.post('/submissions/:id/confirm', async (req, res) => res.json({
    submission: await service.confirm(req.params.id, String(req.adminUser._id)),
  }));
  userRouter.use(handleError);
  adminRouter.use(handleError);
  return { userRouter, adminRouter };
}

const routers = createFeesRouters();
module.exports = routers.userRouter;
module.exports.adminRouter = routers.adminRouter;
module.exports.createFeesRouters = createFeesRouters;
