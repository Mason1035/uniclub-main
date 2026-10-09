const express = require('express');
const requireAdmin = require('../../middleware/admin');
const { createAiRateLimiter, sendAiError } = require('../../utils/aiHttp');
const { DailyNewsError, errorForDailyNews } = require('../../utils/dailyNewsErrors');

function createDailyNewsRouter({ service, authorize = requireAdmin } = {}) {
  const router = express.Router();
  const current = () => service || require('../../services/DailyAiNewsService').getDailyNewsService();
  router.use(authorize);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const handler = callback => async (req, res) => {
    try { await callback(req, res); }
    catch (error) { sendAiError(res, error, false, errorForDailyNews); }
  };
  router.get('/', handler(async (_req, res) => { res.json(await current().status()); }));
  router.put('/', handler(async (req, res) => { res.json(await current().saveSettings(req.body, req.adminUser._id)); }));
  router.get('/history', handler(async (_req, res) => { res.json({ history: (await current().status()).history }); }));
  router.post('/run', createAiRateLimiter(4, '每日新闻运行请求较多，请稍后重试。'), handler(async (req, res) => {
    if (req.body?.confirm !== true || (req.body.force !== undefined && typeof req.body.force !== 'boolean')) throw new DailyNewsError('CONFIRM_REQUIRED');
    const status = await current().status();
    const today = require('../../utils/dailyNewsSchedule').batchDate();
    if (!req.body.force && status.activeDate === today) throw new DailyNewsError('ALREADY_GENERATED');
    // ECS returns immediately and the admin polls persisted job status. Vercel
    // must await its job because serverless runtimes can freeze after response.
    const result = await current().requestRun({ force: req.body.force === true, trigger: 'manual', requestedBy: req.adminUser._id, wait: Boolean(process.env.VERCEL) });
    res.status(result.started ? 202 : 200).json(result);
  }));
  router.post('/dry-run', createAiRateLimiter(2), handler(async (req, res) => {
    if (req.body?.confirm !== true) throw new DailyNewsError('CONFIRM_REQUIRED');
    res.json(await current().dryRun());
  }));
  return router;
}

module.exports = createDailyNewsRouter();
module.exports.createDailyNewsRouter = createDailyNewsRouter;
