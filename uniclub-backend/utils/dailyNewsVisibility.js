const AiSettings = require('../models/AiSettings');

async function runtime(settingsModel = AiSettings) {
  if (!settingsModel) return {};
  // Do not buffer a settings query while Mongo is disconnected. Public news
  // readers then exclude all AI batches until durable state is available.
  if (settingsModel.db && settingsModel.db.readyState !== 1) return {};
  return (await settingsModel.findById('deepseek').select('dailyNewsRuntime').lean())?.dailyNewsRuntime || {};
}
function publicNewsFilter(activeBatchId, now = new Date()) {
  return {
    status: 'approved', publishedAt: { $lte: now },
    $or: [{ origin: 'manual' }, { origin: null },
      ...(activeBatchId ? [{ origin: 'ai_daily', generationBatchId: activeBatchId }] : [])],
  };
}
async function visibilityFilter(now = new Date(), settingsModel = AiSettings) {
  return publicNewsFilter((await runtime(settingsModel)).activeBatchId, now);
}
async function articleVisible(article, now = new Date(), settingsModel = AiSettings) {
  if (!article || article.status !== 'approved' || (article.publishedAt && new Date(article.publishedAt) > now)) return false;
  if (article.origin !== 'ai_daily') return true;
  // Previously committed archives remain available by direct link. Staging or
  // failed batches are never made readable merely because status is approved.
  if (article.automationCommittedAt) return true;
  const state = await runtime(settingsModel);
  return state.activeBatchId === article.generationBatchId || Boolean(state.committedBatches?.includes(article.generationBatchId));
}

module.exports = { runtime, publicNewsFilter, visibilityFilter, articleVisible };
