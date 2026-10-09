const crypto = require('node:crypto');
const express = require('express');
const { errorForDailyNews } = require('../utils/dailyNewsErrors');

function cronAuthorized(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'Cron secret is not configured' });
  const actual = Buffer.from(req.headers.authorization || ''), expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return res.status(401).json({ error: 'Unauthorized' });
  return next();
}
function createCronRouter({ service } = {}) {
  const router = express.Router();
  const tick = async (_req, res) => {
    try {
      // Await execution for serverless platforms; manual ECS generation uses
      // the same service asynchronously and polls its durable job record.
      const current = service || require('../services/DailyAiNewsService').getDailyNewsService();
      const result = await current.tick({ wait: true });
      const failed = result.started && result.job?.status === 'failed';
      res.json({ success: !failed, ...result,
        ...(failed && { code: result.job.errorCode, error: result.job.errorMessage }),
      });
    } catch (error) {
      const safe = errorForDailyNews(error);
      res.status(safe.status).json({ success: false, error: safe.message, code: safe.code });
    }
  };
  // The old path is a protected compatibility alias to the same safe Daily job;
  // it no longer invokes the Gemini importer or broad createdAt cleanup.
  router.get('/daily-news', cronAuthorized, tick);
  router.get('/news-curation', cronAuthorized, tick);
  return router;
}
module.exports = createCronRouter();
module.exports.createCronRouter = createCronRouter;
module.exports.cronAuthorized = cronAuthorized;
