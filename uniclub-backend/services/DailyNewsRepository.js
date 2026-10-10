const crypto = require('node:crypto');
const AiSettings = require('../models/AiSettings');
const DailyNewsJob = require('../models/DailyNewsJob');
const News = require('../models/News');
const User = require('../models/User');
const { DailyNewsError, errorForDailyNews } = require('../utils/dailyNewsErrors');
const { settingsFrom, validateSettings, validDate, batchDate, scheduledAt, nextRun } = require('../utils/dailyNewsSchedule');

const LEASE_MS = 10 * 60 * 1000;
const AUTO_ATTEMPTS = 3;
const CATEGORY_MAP = Object.freeze({ ai: 'AI/ML', technology: 'Tech Industry', software: 'Software Development', science: 'Science', education: 'Education' });
const PHASES = ['pending', 'searching', 'generating', 'validating', 'publishing'];
const METRICS = ['searchPerformed', 'searchResultCount', 'sourcesUsed', 'searchProvider', 'articleCount'];
const asPlain = value => value?.toObject ? value.toObject() : value;
function publicJob(value) {
  const job = asPlain(value);
  if (!job) return null;
  const { ownerToken, requestedBy, ...safe } = job;
  return safe;
}

class DailyNewsRepository {
  constructor({ settingsModel = AiSettings, jobModel = DailyNewsJob, newsModel = News, userModel = User, clock = () => new Date() } = {}) {
    this.settings = settingsModel; this.jobs = jobModel; this.news = newsModel; this.users = userModel; this.clock = clock;
    this.initialization = null;
  }
  async initialize() {
    if (!this.initialization) this.initialization = (async () => {
      await this.jobs.createIndexes();
      await this.news.collection.createIndex({ generationBatchId: 1, automationIndex: 1 }, {
        name: 'daily_news_batch_article_unique', unique: true, partialFilterExpression: { origin: 'ai_daily' },
      });
      // Idempotent singleton initialization never overwrites the encrypted key.
      await this.settings.updateOne({ _id: 'deepseek' }, { $setOnInsert: {
        configured: false, dailyAiNews: settingsFrom(),
      } }, { upsert: true, runValidators: true });
    })().catch(error => { this.initialization = null; throw errorForDailyNews(error); });
    await this.initialization;
  }
  async document() { return this.settings.findById('deepseek').select('dailyAiNews dailyNewsRuntime').lean(); }
  async getSettings() { return settingsFrom((await this.document())?.dailyAiNews); }
  async saveSettings(body, requestedBy) {
    const next = validateSettings(body, await this.getSettings());
    await this.settings.updateOne({ _id: 'deepseek' }, { $set: { dailyAiNews: next,
      ...(requestedBy && { updatedBy: requestedBy }),
    } }, { upsert: true, runValidators: true });
    return next;
  }
  async getJob(id) { return publicJob(await this.jobs.findById(id).lean()); }
  async history(limit = 10) {
    return (await this.jobs.find({}).sort({ startedAt: -1, _id: -1 }).limit(Math.max(1, Math.min(10, limit))).lean()).map(publicJob);
  }
  async getStatus() {
    const [doc, history] = await Promise.all([this.document(), this.history()]);
    const settings = settingsFrom(doc?.dailyAiNews), state = doc?.dailyNewsRuntime || {}, now = this.clock();
    // A crash immediately after the atomic pointer commit cannot turn a
    // successful publication into a second paid run or a false failed status.
    const reconciled = history.map(job => state.committedBatches?.includes(job.batchId) ? { ...job, status: 'success', articleCount: job.articleCount || settings.articleCount } : job);
    const lease = state.lease;
    const running = Boolean(lease?.ownerToken && lease.expiresAt && new Date(lease.expiresAt) > now);
    let scheduledNext = nextRun(settings, now, state.lastSuccessDate);
    const latest = reconciled[0];
    if (settings.enabled && state.lastSuccessDate !== batchDate(now) && latest?.date === batchDate(now) && latest.status === 'failed') {
      if (latest.attempts >= AUTO_ATTEMPTS) {
        const tomorrow = new Date(`${batchDate(now)}T00:00:00Z`);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        scheduledNext = scheduledAt(tomorrow.toISOString().slice(0, 10), settings.time);
      } else if (latest.nextRetryAt && new Date(latest.nextRetryAt) > now) scheduledNext = new Date(latest.nextRetryAt);
    }
    return {
      settings, activeBatchId: state.activeBatchId || null, activeDate: state.activeDate || null,
      lastRun: reconciled[0] || null, nextRun: scheduledNext, history: reconciled, running,
    };
  }
  async claim({ date, force = false, trigger = 'manual', requestedBy } = {}) {
    if (!validDate(date)) throw new DailyNewsError('INVALID_SETTINGS');
    await this.initialize();
    const now = this.clock(), ownerToken = crypto.randomUUID(), batchId = crypto.randomUUID();
    // The singleton's _id is already unique. This update is the distributed
    // lock, not an exists-then-insert check or a process-local mutex.
    const doc = await this.settings.findOneAndUpdate({ _id: 'deepseek', $or: [
      { 'dailyNewsRuntime.lease.expiresAt': { $lte: now } },
      { 'dailyNewsRuntime.lease.expiresAt': { $exists: false } },
      { 'dailyNewsRuntime.lease': null },
    ] }, { $set: { 'dailyNewsRuntime.lease': {
      ownerToken, batchId, date, expiresAt: new Date(now.getTime() + LEASE_MS), heartbeatAt: now,
    } } }, { new: true, runValidators: true }).select('dailyAiNews dailyNewsRuntime').lean();
    if (!doc) throw new DailyNewsError('ALREADY_RUNNING');
    const config = settingsFrom(doc.dailyAiNews), state = doc.dailyNewsRuntime || {};
    const baseKey = `daily-ai-news:${date}`, jobKey = force ? `${baseKey}:${batchId}` : baseKey;
    const claim = { _id: jobKey, jobKey, date, batchId, ownerToken, force, trigger, config, articleCount: config.articleCount };
    try {
      const previous = await this.jobs.findById(baseKey).lean();
      if (state.activeDate && state.activeDate > date) { await this.release(claim); return null; }
      if (!force && (state.successfulDates?.includes(date) || state.lastSuccessDate === date || previous?.status === 'success')) {
        await this.release(claim); return null;
      }
      const automatic = trigger !== 'manual';
      if (!force && automatic && previous?.status === 'failed' &&
        (previous.attempts >= AUTO_ATTEMPTS || (previous.nextRetryAt && new Date(previous.nextRetryAt) > now))) {
        await this.release(claim); return null;
      }
      const author = await this.users.findOne({ isAdmin: true, ...(requestedBy && { _id: requestedBy }) }).select('_id').lean();
      if (!author) throw new DailyNewsError('DATABASE_ERROR', '需要一个有效管理员作为每日新闻发布者。');
      claim.authorId = author._id;
      claim.attempts = force ? 1 : (previous?.attempts || 0) + 1;
      await this.jobs.findOneAndUpdate({ _id: jobKey }, { $set: {
        jobKey, date, batchId, ownerToken, force, trigger, ...(requestedBy && { requestedBy }),
        status: 'pending', attempts: claim.attempts, startedAt: now, articleCount: 0,
        searchPerformed: false, searchResultCount: 0, sourcesUsed: 0,
      }, $unset: { finishedAt: 1, errorCode: 1, errorMessage: 1, nextRetryAt: 1 } }, { upsert: true, new: true, runValidators: true });
      return claim;
    } catch (error) { await this.release(claim); throw errorForDailyNews(error); }
  }
  leaseFilter(claim) {
    return { _id: 'deepseek', 'dailyNewsRuntime.lease.ownerToken': claim.ownerToken,
      'dailyNewsRuntime.lease.batchId': claim.batchId, 'dailyNewsRuntime.lease.expiresAt': { $gt: this.clock() } };
  }
  async heartbeat(claim) {
    const now = this.clock();
    const result = await this.settings.updateOne(this.leaseFilter(claim), { $set: {
      'dailyNewsRuntime.lease.expiresAt': new Date(now.getTime() + LEASE_MS), 'dailyNewsRuntime.lease.heartbeatAt': now,
    } });
    return result.matchedCount === 1;
  }
  async assertLease(claim) {
    if (!(await this.settings.exists(this.leaseFilter(claim)))) throw new DailyNewsError('ALREADY_RUNNING');
  }
  async phase(claim, status, metrics = {}) {
    if (!PHASES.includes(status)) throw new DailyNewsError('DATABASE_ERROR');
    await this.assertLease(claim);
    const safe = {};
    for (const key of METRICS) if (Object.hasOwn(metrics, key)) {
      if (key === 'searchProvider') safe[key] = String(metrics[key]).slice(0, 80);
      else if (key === 'searchPerformed') safe[key] = metrics[key] === true;
      else safe[key] = Number.isInteger(metrics[key]) && metrics[key] >= 0 ? metrics[key] : 0;
    }
    return publicJob(await this.jobs.findOneAndUpdate({ _id: claim.jobKey, ownerToken: claim.ownerToken },
      { $set: { status, ...safe } }, { new: true, runValidators: true }).lean());
  }
  async publish(claim, articles) {
    await this.assertLease(claim);
    if (!Array.isArray(articles) || articles.length !== claim.articleCount) throw new DailyNewsError('VALIDATION_FAILED');
    const now = this.clock();
    const rows = articles.map((article, index) => {
      const excerpt = typeof article.summary === 'string' ? article.summary : article.excerpt;
      if (!article.title || !excerpt || !article.content || !CATEGORY_MAP[article.category] || !article.sourceReferences?.length) throw new DailyNewsError('VALIDATION_FAILED');
      return {
        title: article.title, excerpt, content: article.content, source: 'ClassHub AI 每日精选', author: claim.authorId,
        origin: 'ai_daily', automationDate: claim.date, generationBatchId: claim.batchId, automationIndex: index,
        generatedAt: now, publishedAt: now, status: 'approved', categories: [CATEGORY_MAP[article.category]],
        sourceHash: crypto.createHash('sha256').update(`daily:${claim.batchId}:${index}`).digest('hex'),
        originalAuthor: 'ClassHub AI', sourceReferences: article.sourceReferences,
        singlePrimarySource: article.singlePrimarySource === true,
        summary: { raw: excerpt, quickSummary: excerpt, lastUpdated: now },
      };
    });
    let saved;
    try {
      saved = await this.news.insertMany(rows, { ordered: true });
      const persistedCount = await this.news.countDocuments({ origin: 'ai_daily', generationBatchId: claim.batchId });
      if (persistedCount !== claim.articleCount) throw new DailyNewsError('DATABASE_ERROR');
      // Standalone MongoDB has no multi-document transactions. All staging rows
      // exist first; one fenced singleton CAS atomically publishes the batch and
      // records day-level idempotency. Readers can see the old or complete new
      // batch, never a partially generated mixture.
      const committed = await this.settings.updateOne({ ...this.leaseFilter(claim), $or: [
        { 'dailyNewsRuntime.activeDate': null }, { 'dailyNewsRuntime.activeDate': { $exists: false } },
        { 'dailyNewsRuntime.activeDate': { $lte: claim.date } },
      ] }, { $set: {
        'dailyNewsRuntime.activeBatchId': claim.batchId, 'dailyNewsRuntime.activeDate': claim.date,
        'dailyNewsRuntime.activeArticleIds': saved.map(item => item._id), 'dailyNewsRuntime.lastSuccessDate': claim.date,
      }, $addToSet: { 'dailyNewsRuntime.successfulDates': claim.date, 'dailyNewsRuntime.committedBatches': claim.batchId } });
      if (committed.matchedCount !== 1) throw new DailyNewsError('ALREADY_RUNNING');
    } catch (error) { throw errorForDailyNews(error); }
    // Post-commit bookkeeping is recoverable. It must never report publication
    // as failed after the active pointer and success ledger have been committed.
    try {
      await this.news.updateMany({ origin: 'ai_daily', generationBatchId: claim.batchId }, { $set: { automationCommittedAt: now } });
      await this.news.updateMany({ origin: 'ai_daily', automationDate: { $lt: claim.date },
        generationBatchId: { $ne: claim.batchId }, automationCommittedAt: { $exists: true },
      }, { $set: { automationArchivedAt: now } });
      if (claim.force) await this.news.updateMany({ origin: 'ai_daily', automationDate: claim.date,
        generationBatchId: { $ne: claim.batchId }, automationCommittedAt: { $exists: true },
      }, { $set: { automationArchivedAt: now } });
      await this.jobs.updateOne({ _id: claim.jobKey, ownerToken: claim.ownerToken }, { $set: {
        status: 'success', articleCount: saved.length, finishedAt: now,
      }, $unset: { errorCode: 1, errorMessage: 1, nextRetryAt: 1 } });
    } catch { console.warn(JSON.stringify({ job: 'daily-ai-news', phase: 'bookkeeping', batchDate: claim.date, code: 'DATABASE_ERROR' })); }
    return { batchId: claim.batchId, date: claim.date, articleCount: saved.length, articles: saved.map(item => String(item._id)) };
  }
  async fail(claim, error) {
    const state = (await this.document())?.dailyNewsRuntime;
    if (state?.committedBatches?.includes(claim.batchId)) return this.getJob(claim.jobKey);
    const safe = errorForDailyNews(error), now = this.clock();
    await this.jobs.updateOne({ _id: claim.jobKey, ownerToken: claim.ownerToken }, { $set: {
      status: 'failed', finishedAt: now, errorCode: safe.code, errorMessage: safe.message,
      nextRetryAt: new Date(now.getTime() + 15 * 60 * 1000 * Math.pow(2, Math.max(0, (claim.attempts || 1) - 1))),
    } });
    return this.getJob(claim.jobKey);
  }
  async release(claim) {
    await this.settings.updateOne({ _id: 'deepseek', 'dailyNewsRuntime.lease.ownerToken': claim.ownerToken },
      { $unset: { 'dailyNewsRuntime.lease': 1 } });
  }
}

module.exports = DailyNewsRepository;
module.exports.DailyNewsRepository = DailyNewsRepository;
module.exports.LEASE_MS = LEASE_MS;
module.exports.AUTO_ATTEMPTS = AUTO_ATTEMPTS;
module.exports.CATEGORY_MAP = CATEGORY_MAP;
module.exports.publicJob = publicJob;
