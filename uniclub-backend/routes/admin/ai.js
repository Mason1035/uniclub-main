const express = require('express');
const requireAdmin = require('../../middleware/admin');
const multer = require('multer');
const { createAiRateLimiter, sendAiError, aiRequest } = require('../../utils/aiHttp');
const { DeepSeekAssistant } = require('../../services/DeepSeekAssistant');
const { AiError } = require('../../utils/aiSecret');
const { SCENARIOS } = require('../../utils/aiPrompts');
const { LIMITS } = require('../../utils/aiValidation');
const {withAssistantUsage}=require('../../services/AssistantQuotaService');

// The parent console admits content managers; all AI capabilities remain admin-only.
function createAiRouter({ assistant = new DeepSeekAssistant(), requestTimeoutMs = 240000, withUsage = withAssistantUsage } = {}) {
  const router = express.Router();
  router.use(requireAdmin);
  const generationLimit = createAiRateLimiter(20);
  const keyLimit = createAiRateLimiter(10, '密钥操作次数较多，请稍后再试。');
  const upload = multer({ storage: multer.memoryStorage(), limits: { files: LIMITS.images, fileSize: LIMITS.imageBytes, fields: 3, fieldSize: 160 * 1024, parts: 7 } }).array('images', LIMITS.images);
  const action = handler => async (req, res) => {
    try { res.json(await handler(req)); } catch (error) { sendAiError(res, error); }
    finally { if (req.body && Object.hasOwn(req.body, 'apiKey')) req.body.apiKey = undefined; }
  };
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/settings', action(() => assistant.getSettings()));
  router.put('/settings', keyLimit, action(req => assistant.saveKey(req.body?.apiKey, req.adminUser._id)));
  router.delete('/settings', keyLimit, action(req => assistant.deleteKey(req.adminUser._id)));
  router.get('/status', action(async () => ({
    ...(await assistant.getSettings()), scenarios: Object.entries(SCENARIOS).map(([key, value]) => ({ key, ...value })), limits: LIMITS,
  })));
  router.post('/test', keyLimit, action(async req => {const scoped=await withUsage(req.user.userId,()=>assistant.testConnection(),{source:'admin-test'});return {...scoped.result,usage:scoped.usage,quota:scoped.quota};}));
  const prepare = (req, res) => !req.is('multipart/form-data') ? undefined : new Promise((resolve, reject) => {
    upload(req, res, uploadError => {
      try {
        if (uploadError) {
          if (uploadError.code === 'LIMIT_FILE_SIZE') throw new AiError('IMAGE_TOO_LARGE', '单张图片不能超过 2 MiB。');
          if (['LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE', 'LIMIT_PART_COUNT'].includes(uploadError.code)) throw new AiError('TOO_MANY_IMAGES', '最多上传 4 张图片，且仅支持 images 上传字段。');
          throw new AiError('INVALID_INPUT', '请求内容过长或上传格式错误，请检查输入。');
        }
        resolve();
      } catch (error) { reject(error); }
    });
  });
  router.post('/generate', generationLimit, aiRequest(async (req, options) => {const scoped=await withUsage(req.user.userId,()=>assistant.generate(req.body, req.files, options),{source:'admin'});return {...scoped.result,usage:scoped.usage,quota:scoped.quota};}, { prepare, requestTimeoutMs, releaseBody: true }));
  return router;
}
module.exports = createAiRouter();
module.exports.createAiRouter = createAiRouter;
