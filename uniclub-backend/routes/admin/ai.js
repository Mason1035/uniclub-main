const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { DeepSeekAssistant } = require('../../services/DeepSeekAssistant');
const { AiError } = require('../../utils/aiSecret');
const { SCENARIOS } = require('../../utils/aiPrompts');
const { LIMITS } = require('../../utils/aiValidation');

// Mounted under /api/admin after the DB-backed requireAdmin middleware.
function createAiRouter({ assistant = new DeepSeekAssistant(), requestTimeoutMs = 240000 } = {}) {
  const router = express.Router(), active = new Set();
  const limiter = (limit, message) => rateLimit({
    windowMs: 10 * 60 * 1000, limit, keyGenerator: req => req.user.userId,
    standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: message, code: 'AI_RATE_LIMIT' },
  });
  const generationLimit = limiter(20, 'AI 请求次数较多，请稍后再试。');
  const keyLimit = limiter(10, '密钥操作次数较多，请稍后再试。');
  const upload = multer({ storage: multer.memoryStorage(), limits: { files: LIMITS.images, fileSize: LIMITS.imageBytes, fields: 3, fieldSize: 160 * 1024, parts: 7 } }).array('images', LIMITS.images);
  const sendError = (res, error, streaming = false) => {
    const safe = error instanceof AiError ? error : new AiError('AI_INTERNAL_ERROR', 'AI 服务暂时无法响应，请稍后重试。', 503);
    const body = { error: safe.message, code: safe.code };
    // Only metadata. Never raw errors, Authorization, keys or images.
    if (safe.code !== 'CANCELLED') console.warn('Admin AI request', { code: safe.code, status: safe.status, provider: 'deepseek', model: 'deepseek-flash' });
    if (!res.destroyed && !res.writableEnded) {
      if (streaming) res.write(`event: error\ndata: ${JSON.stringify(body)}\n\n`);
      else res.status(safe.status).json(body);
    }
  };
  const action = handler => async (req, res) => {
    try { res.json(await handler(req)); } catch (error) { sendError(res, error); }
    finally { if (req.body && Object.hasOwn(req.body, 'apiKey')) req.body.apiKey = undefined; }
  };
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/settings', action(() => assistant.getSettings()));
  router.put('/settings', keyLimit, action(req => assistant.saveKey(req.body?.apiKey, req.adminUser._id)));
  router.delete('/settings', keyLimit, action(req => assistant.deleteKey(req.adminUser._id)));
  router.get('/status', action(async () => ({
    ...(await assistant.getSettings()), scenarios: Object.entries(SCENARIOS).map(([key, value]) => ({ key, ...value })), limits: LIMITS,
  })));
  router.post('/test', keyLimit, action(() => assistant.testConnection()));
  router.post('/generate', generationLimit, (req, res) => {
    const userId = req.user.userId;
    if (active.has(userId)) return res.status(409).json({ error: '当前已有 AI 请求正在处理，请稍候。', code: 'AI_BUSY' });
    active.add(userId);
    const controller = new AbortController();
    let heartbeat, streaming = false, timedOut = false;
    // An absolute deadline also bounds a provider that keeps a stream alive
    // without completing its answer. axios separately bounds each request.
    const deadline = setTimeout(() => { timedOut = true; controller.abort(); }, requestTimeoutMs);
    deadline.unref?.();
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnect);
    const execute = async uploadError => {
      try {
        if (uploadError) {
          if (uploadError.code === 'LIMIT_FILE_SIZE') throw new AiError('IMAGE_TOO_LARGE', '单张图片不能超过 2 MiB。');
          if (['LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE', 'LIMIT_PART_COUNT'].includes(uploadError.code)) throw new AiError('TOO_MANY_IMAGES', '最多上传 4 张图片，且仅支持 images 上传字段。');
          throw new AiError('INVALID_INPUT', '请求内容过长或上传格式错误，请检查输入。');
        }
        streaming = req.get('accept')?.includes('text/event-stream') === true;
        const emit = (event, value) => {
          if (!res.destroyed && !res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
        };
        if (streaming) {
          res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'X-Accel-Buffering': 'no', 'Cache-Control': 'no-cache, no-store' });
          res.flushHeaders();
          heartbeat = setInterval(() => { if (!res.destroyed) res.write(': heartbeat\n\n'); }, 15000);
        }
        const result = await assistant.generate(req.body, req.files, { signal: controller.signal, ...(streaming && { onDelta: delta => emit('delta', { text: delta }) }) });
        if (streaming) emit('result', result);
        else if (!res.destroyed) res.json(result);
      } catch (error) {
        if (timedOut) sendError(res, new AiError('PROVIDER_TIMEOUT', 'DeepSeek 请求超时，请稍后重试。', 504), streaming);
        else if (!controller.signal.aborted) sendError(res, error, streaming);
      } finally {
        clearTimeout(deadline); clearInterval(heartbeat); res.off('close', disconnect); active.delete(userId);
        req.files = undefined; req.body = undefined;
        if (streaming && !res.writableEnded) res.end();
      }
    };
    if (req.is('multipart/form-data')) upload(req, res, error => void execute(error));
    else void execute();
  });
  return router;
}
module.exports = createAiRouter();
module.exports.createAiRouter = createAiRouter;
