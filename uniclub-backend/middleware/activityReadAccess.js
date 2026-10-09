const authenticateToken = require('./auth');

/** Scope protection to activity data; other content keeps its existing rules. */
function createActivityReadAccess({ service, authenticate = authenticateToken } = {}) {
  const activities = () => service || require('../services/ActivityService').activityService;
  const verified = (req, res, next) => req.user ? next() : authenticate(req, res, next);
  const optional = (req, res, next) => {
    req.canReadActivities = false;
    if (!req.headers.authorization) return next();
    return verified(req, res, async () => {
      try { await activities().account(req.user.userId); req.canReadActivities = true; }
      catch (error) { if (![401, 403].includes(error.status)) return res.status(503).json({ error: '活动权限服务暂时不可用。' }); }
      next();
    });
  };
  const content = (req, res, next) => {
    const match = req.path.match(/(?:^|\/)event\/([^/]+)(?:\/|$)/i);
    if (!match) return next();
    return verified(req, res, async () => {
      try { await activities().readableEvent(match[1], req.user.userId); next(); }
      catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : '活动权限服务暂时不可用。', code: error.code || 'ACTIVITY_UNAVAILABLE' }); }
    });
  };
  return { optional, content };
}
async function activityPreview(raw, userId) {
  if (!raw) return null;
  const plain = raw.toObject ? raw.toObject() : raw;
  const dto = require('../services/ActivityService').eventDTO(plain);
  await require('../services/ActivityMediaService').activityMediaService.decorateEvent(dto, plain, userId);
  // Preserve homepage consumers without exposing the embedded audit ledger.
  dto.engagement = { rsvpCount: plain.rsvpCount || 0, views: plain.engagement?.views || 0 };
  return dto;
}
module.exports = { createActivityReadAccess, activityPreview };
