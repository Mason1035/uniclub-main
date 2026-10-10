const crypto = require('node:crypto');
const { DeepSeekAssistant } = require('./DeepSeekAssistant');
const NewsAPIService = require('./NewsAPIService');
const DailyNewsRepository = require('./DailyNewsRepository');
const { DailyNewsError, errorForDailyNews } = require('../utils/dailyNewsErrors');
const { clip, plainText } = require('../utils/newsAiContext');
const { validRecentSource } = require('../utils/newsSourceCandidates');
const { selectionPrompt, articlePrompt, verificationPrompt } = require('../utils/dailyNewsPrompts');

const QUERIES = Object.freeze({
  ai: '"artificial intelligence" OR "AI research" OR "AI model"',
  technology: '"technology" OR "semiconductor" OR "computing"',
  software: '"software engineering" OR "open source" OR "developer tools" OR "cybersecurity"',
  science: '"scientific discovery" OR "research breakthrough" OR "science"',
  education: '"higher education" OR "university research" OR "student"',
});
const PRIMARY_DOMAINS = ['openai.com', 'anthropic.com', 'deepmind.google', 'blog.google', 'research.google', 'microsoft.com', 'blogs.nvidia.com', 'nvidia.com', 'github.blog', 'apple.com', 'ibm.com', 'nasa.gov', 'esa.int', 'cern.ch'];
const PREFERRED_DOMAINS = ['reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'nature.com', 'science.org', 'scientificamerican.com', 'arstechnica.com', 'technologyreview.com', 'theverge.com', 'techcrunch.com', 'wired.com', 'theguardian.com'];
const atDomain = (host, domain) => host === domain || host.endsWith('.' + domain);
function primaryDomain(host, pathname = '') {
  // A company's domain can also host community posts, and university domains
  // can contain personal pages. These cannot satisfy the one-primary-source
  // exception merely by sharing an official parent domain.
  if (/(^|\.)(community|forums?|answers|discuss|discussions)\./i.test(host) ||
      /(?:^|\/)(?:community|forums?|discussions?|answers|users?|~[^/]+)(?:\/|$)/i.test(pathname)) return false;
  return PRIMARY_DOMAINS.some(domain => atDomain(host, domain)) || /\.(gov(?:\.[a-z]{2})?|edu(?:\.[a-z]{2})?|ac\.[a-z]{2})$/.test(host);
}
const publisherDomain = host => {
  if (['bbc.com', 'bbc.co.uk'].some(domain => atDomain(host, domain))) return 'bbc';
  const known = [...PRIMARY_DOMAINS, ...PREFERRED_DOMAINS].find(domain => atDomain(host, domain));
  if (known) return known;
  const pieces = host.split('.');
  return pieces.slice(/\.(?:co|com|ac|edu|gov)\.[a-z]{2}$/.test(host) ? -3 : -2).join('.');
};

function shanghaiClock(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function candidatePool(results, now, categories) {
  const unique = new Map();
  for (const item of results) {
    const usable = validRecentSource(item, now);
    if (!usable) continue;
    const url = new URL(usable.url), timestamp = Date.parse(usable.publishedAt);
    const age = now.getTime() - timestamp;
    const { title, snippet } = usable;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const primary = primaryDomain(host, url.pathname), preferred = PREFERRED_DOMAINS.some(domain => atDomain(host, domain));
    const id = 's-' + crypto.createHash('sha256').update(url.href).digest('hex').slice(0, 16);
    const candidate = { id, title, url: url.href, snippet, publisher: clip(plainText(item.publisher), 200) || host, publishedAt: new Date(timestamp).toISOString(), primary, host, categories: item.categories?.filter(category => categories.includes(category)) || [], score: (primary ? 30 : preferred ? 20 : 0) + 20 * (1 - Math.max(0, age) / (24 * 60 * 60 * 1000)) };
    const previous = unique.get(id);
    if (previous) previous.categories = [...new Set([...previous.categories, ...candidate.categories])];
    else unique.set(id, candidate);
  }
  return [...unique.values()].sort((a, b) => b.score - a.score).slice(0, 30);
}

const fail = (code, message) => { throw new DailyNewsError(code, message); };
function hasInventedUrl(value) {
  if (typeof value === 'string') return /https?:\/\/|www\./i.test(value);
  if (Array.isArray(value)) return value.some(hasInventedUrl);
  if (value && typeof value === 'object') return Object.entries(value).some(([key, item]) => /^(url|sourceReferences|originalUrl)$/i.test(key) || hasInventedUrl(item));
  return false;
}

function evidenceFor(ids, candidates) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 3 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) fail('VALIDATION_FAILED', 'AI 选题的来源结构不正确。');
  const sources = ids.map(id => candidates.find(candidate => candidate.id === id));
  if (sources.some(source => !source)) fail('VALIDATION_FAILED', 'AI 引用了未检索到的来源。');
  const independent = new Set(sources.map(source => publisherDomain(source.host))).size;
  if (independent < 2 && !sources.some(source => source.primary)) fail('INSUFFICIENT_SOURCES', '选题缺少独立来源或权威一手来源。');
  return sources;
}

function topicSimilarity(first, second) {
  const tokens = value => new Set((value.toLowerCase().match(/[a-z0-9]{3,}|[\u3400-\u9fff]{2,}/g) || []).flatMap(word => /[\u3400-\u9fff]/.test(word) ? Array.from({ length: word.length - 1 }, (_, index) => word.slice(index, index + 2)) : [word]));
  const a = tokens(first), b = tokens(second);
  if (!a.size || !b.size) return first.trim() === second.trim() ? 1 : 0;
  return [...a].filter(token => b.has(token)).length / Math.min(a.size, b.size);
}

function validateSelection(output, candidates, config) {
  if (hasInventedUrl(output)) fail('VALIDATION_FAILED', 'AI 选题包含自行生成的链接。');
  const events = output?.selectedEvents;
  if (!Array.isArray(events) || events.length !== config.articleCount) fail('INSUFFICIENT_SOURCES', '没有足够证据支持指定数量的独立新闻。');
  const keys = new Set(), used = new Set();
  return events.map((event, index) => {
    if (!event || !config.categories.includes(event.category) || typeof event.topic !== 'string' || !event.topic.trim() || event.topic.length > 180 || typeof event.eventKey !== 'string' || !event.eventKey.trim() || event.eventKey.length > 160 || typeof event.reason !== 'string' || event.reason.length > 1000) fail('VALIDATION_FAILED', 'AI 选题格式不正确。');
    const key = event.eventKey.trim().toLowerCase();
    if (keys.has(key) || events.slice(0, index).some(previous => topicSimilarity(previous.topic, event.topic) > 0.7)) fail('VALIDATION_FAILED', '本次选题包含重复事件。');
    keys.add(key);
    evidenceFor(event.candidateIds, candidates);
    if (event.candidateIds.some(id => used.has(id))) fail('VALIDATION_FAILED', '不同事件重复使用同一报道，无法确认选题独立。');
    event.candidateIds.forEach(id => used.add(id));
    return { candidateIds: event.candidateIds, eventKey: key, topic: event.topic.trim(), reason: event.reason.trim(), category: event.category };
  });
}

function validateArticle(output, event, sources) {
  if (output?.insufficientEvidence) fail('INSUFFICIENT_SOURCES', '当前资料不足以生成完整新闻。');
  if (hasInventedUrl(output)) fail('VALIDATION_FAILED', 'AI 文章包含自行生成的链接。');
  for (const [field, min, max] of [['title', 6, 100], ['summary', 80, 180], ['content', 600, 1400]]) {
    if (typeof output?.[field] !== 'string' || output[field].trim().length < min || output[field].trim().length > max || /<\/?(?:script|iframe|style|[a-z]+)[\s>]/i.test(output[field])) fail('VALIDATION_FAILED', `AI 新闻${field === 'title' ? '标题' : field === 'summary' ? '摘要' : '正文'}不符合格式或长度要求。`);
  }
  if (output.category !== event.category) fail('VALIDATION_FAILED', 'AI 新闻类别与选题不一致。');
  const referenced = evidenceFor(output.sourceIds, sources);
  return {
    title: output.title.trim(), summary: output.summary.trim(), content: output.content.trim(), category: event.category,
    sourceReferences: referenced.map(source => ({ title: source.title, publisher: source.publisher, url: source.url, publishedAt: source.publishedAt })),
    singlePrimarySource: new Set(referenced.map(source => publisherDomain(source.host))).size === 1,
    sourceIds: output.sourceIds,
  };
}

function validateFactCheck(check, count) {
  if (check?.distinctEvents !== true || !Array.isArray(check.articles) || check.articles.length !== count) fail('VALIDATION_FAILED', '新闻事实审核未通过。');
  const indices = new Set();
  for (const item of check.articles) {
    if (!Number.isInteger(item.index) || item.index < 0 || item.index >= count || indices.has(item.index) || item.supported !== true || item.original !== true || !Array.isArray(item.unsupportedClaims) || item.unsupportedClaims.length) fail('VALIDATION_FAILED', '新闻包含无法核实的事实、重复事件或非原创内容。');
    indices.add(item.index);
  }
}

class DailyAiNewsService {
  constructor({ repository, assistant, search, pageFetcher, clock = () => new Date(), logger = entry => console.info(JSON.stringify(entry)), timeoutMs = 8 * 60 * 1000 } = {}) {
    this.repository = repository || new DailyNewsRepository();
    this.assistant = assistant || new DeepSeekAssistant();
    this.searchService = search;
    this.pageFetcher = pageFetcher;
    this.clock = clock; this.logger = logger; this.timeoutMs = timeoutMs;
    this.tasks = new Map(); this.searchDiagnostic = null;
  }
  async initialize() { await this.repository.initialize(); }
  search() { return this.searchService || (this.searchService = new NewsAPIService()); }
  fetcher() { return this.pageFetcher || (this.pageFetcher = new (require('./WebPageFetcher'))()); }
  recordFailure(error) {
    const safe = errorForDailyNews(error);
    if (this.searchDiagnostic) this.searchDiagnostic = { ...this.searchDiagnostic,
      failureStage: this.searchDiagnostic.stage || 'searching', errorCode: safe.code, errorMessage: safe.message };
    return safe;
  }
  async status() {
    const [status, ai] = await Promise.all([this.repository.getStatus(), this.assistant.getSettings()]);
    const last = status.lastRun;
    const searchConfig = this.search().dailyDiagnostic?.() || { provider: 'newsapi', configured: Boolean(this.searchService?.NEWS_API_KEY || process.env.NEWS_API_KEY) };
    const searchError = ['SEARCH_UNAVAILABLE', 'SEARCH_NO_RESULTS', 'INSUFFICIENT_SOURCES'].includes(last?.errorCode);
    return { ...status, ai: { configured: ai.configured, provider: ai.provider, model: ai.model }, search: { ...searchConfig, ...(this.searchDiagnostic || { checkedAt: last?.finishedAt || null, searchPerformed: last?.searchPerformed || false, resultCount: last?.searchResultCount || 0, errorCode: searchError ? last.errorCode : null, errorMessage: searchError ? last.errorMessage : null }) }, scheduler: { timezone: 'Asia/Shanghai', automatic: process.env.NODE_ENV === 'production' && !process.env.VERCEL, externalCron: Boolean(process.env.CRON_SECRET) } };
  }
  async saveSettings(body, requestedBy) { await this.repository.saveSettings(body, requestedBy); return this.status(); }
  async requestRun({ force = false, trigger = 'manual', requestedBy, wait = false } = {}) {
    const { date } = shanghaiClock(this.clock());
    const claim = await this.repository.claim({ date, force, trigger, requestedBy });
    if (!claim) {
      const status = await this.repository.getStatus();
      return { started: false, skipped: true, alreadySucceeded: status.activeDate === date, job: status.lastRun };
    }
    const task = this.execute(claim);
    this.tasks.set(claim.batchId, task);
    void task.then(() => this.tasks.delete(claim.batchId), () => this.tasks.delete(claim.batchId));
    if (wait) return { started: true, job: await task };
    return { started: true, job: await this.repository.getJob(claim._id) };
  }
  async tick({ wait = true } = {}) {
    const config = await this.repository.getSettings(), { time } = shanghaiClock(this.clock());
    if (!config.enabled || time < config.time) return { started: false, skipped: true };
    try { return await this.requestRun({ trigger: 'scheduler', wait }); }
    catch (error) { if (['ALREADY_RUNNING', 'RETRY_DEFERRED'].includes(error.code)) return { started: false, skipped: true, code: error.code }; throw error; }
  }
  async execute(claim) {
    const controller = new AbortController();
    let renewalError = null;
    const deadline = setTimeout(() => controller.abort(), this.timeoutMs); deadline.unref?.();
    const heartbeat = setInterval(async () => {
      try { if (await this.repository.heartbeat(claim) === false) throw new DailyNewsError('ALREADY_RUNNING', '任务租约已失效，本次不会发布。'); }
      catch (error) { renewalError = error; controller.abort(); }
    }, 20000); heartbeat.unref?.();
    const phase = async (status, metrics) => {
      if (controller.signal.aborted) throw renewalError || new DailyNewsError('AI_TIMEOUT', '每日新闻任务超时，已保留上一批新闻。');
      await this.repository.phase(claim, status, metrics);
      this.logger({ job: 'daily-ai-news', batchDate: claim.date, phase: status, ...metrics });
    };
    try {
      const generated = await this.generate(claim.config || await this.repository.getSettings(), claim.date, { signal: controller.signal, onPhase: phase });
      this.searchDiagnostic.stage = 'publishing';
      await phase('publishing', generated.metrics);
      await this.repository.publish(claim, generated.articles);
      this.searchDiagnostic.stage = 'complete';
      this.logger({ job: 'daily-ai-news', batchDate: claim.date, phase: 'success', articleCount: generated.articles.length });
    } catch (error) {
      const safe = this.recordFailure(renewalError || (controller.signal.aborted ? new DailyNewsError('AI_TIMEOUT', '每日新闻任务超时，已保留上一批新闻。') : error));
      this.logger({ job: 'daily-ai-news', batchDate: claim.date, phase: 'failed', code: safe.code,
        failureStage: this.searchDiagnostic?.failureStage, checkedFeeds: this.searchDiagnostic?.checkedFeeds,
        failedFeeds: this.searchDiagnostic?.failedFeeds, retrievedSourceCount: this.searchDiagnostic?.retrievedSourceCount });
      await this.repository.fail(claim, safe).catch(() => this.logger({ job: 'daily-ai-news', batchDate: claim.date, phase: 'record-failure', code: 'DATABASE_ERROR' }));
    } finally {
      clearTimeout(deadline); clearInterval(heartbeat);
      await this.repository.release(claim).catch(() => {});
    }
    return this.repository.getJob(claim._id).catch(() => ({ _id: claim._id, status: 'failed', errorCode: 'DATABASE_ERROR', errorMessage: '任务状态暂时不可读取，请稍后刷新。' }));
  }
  async generate(config, date, { signal, onPhase = async () => {} } = {}) {
    if (config.webSearch !== true) fail('SEARCH_UNAVAILABLE', '每日新闻必须启用真实联网搜索。');
    const now = this.clock(), from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const queries = config.categories.map(category => ({ category, query: QUERIES[category] })).filter(item => item.query);
    if (!queries.length) fail('VALIDATION_FAILED', '请选择至少一个有效新闻类别。');
    let search;
    try { search = this.search(); } catch (error) { throw errorForDailyNews(error); }
    await onPhase('searching', { searchPerformed: true });
    let response;
    try {
      // One bounded pass through the shared search layer. Repeating identical
      // empty /everything queries cannot overcome a provider's 24h delay.
      response = await search.searchBatch(queries, { from, to: now.toISOString(), signal, minimumResults: config.articleCount * 2 });
      if (response.searchPerformed !== true || !Array.isArray(response.results)) fail('SEARCH_UNAVAILABLE', '检索服务未返回真实结果。');
    } catch (error) {
      const safe = errorForDailyNews(error);
      this.searchDiagnostic = { ...search.lastBatch, stage: 'searching', checkedAt: this.clock().toISOString(),
        searchPerformed: true, resultCount: 0, errorCode: safe.code, errorMessage: safe.message };
      throw safe;
    }
    const candidates = candidatePool(response.results, now, config.categories);
    const publisherCount = new Set(candidates.map(candidate => publisherDomain(candidate.host))).size;
    const primaryCount = candidates.filter(candidate => candidate.primary).length;
    this.searchDiagnostic = { checkedAt: this.clock().toISOString(), searchPerformed: true, provider: response.provider,
      resultCount: candidates.length, rawResultCount: response.results.length,
      newsapiResultCount: response.diagnostics?.newsapiResults || 0, feedResultCount: response.diagnostics?.feedResults || 0,
      checkedFeeds: response.diagnostics?.checkedFeeds, failedFeeds: response.diagnostics?.failedFeeds,
      feedDiagnostics: response.diagnostics?.feedDiagnostics, stage: 'selection',
      publisherCount, primaryCount, retrievedSourceCount: 0, failedSourceCount: 0,
      errorCode: null, errorMessage: null };
    if (!candidates.length) {
      await onPhase('searching', { searchPerformed: true, searchResultCount: 0 });
      this.searchDiagnostic = { ...this.searchDiagnostic, errorCode: 'SEARCH_NO_RESULTS', errorMessage: '文章检索及实时订阅均没有符合过去24小时时效的有效新闻。' };
      fail('SEARCH_NO_RESULTS', '文章检索及实时订阅均没有有效新闻，本次保留上一批内容。');
    }
    await onPhase('generating', { searchPerformed: true, searchResultCount: candidates.length,
      searchProvider: response.provider, checkedFeeds: this.searchDiagnostic.checkedFeeds,
      failedFeeds: this.searchDiagnostic.failedFeeds, publisherCount, primaryCount });
    // Ten stories from one secondary publisher are still zero qualifying
    // events. Reject this known impossible pool before spending an AI call;
    // neither the source requirement nor the 24h freshness window is relaxed.
    if (publisherCount === 1 && primaryCount < config.articleCount) {
      fail('INSUFFICIENT_SOURCES', `检索到 ${candidates.length} 条有效候选，但仅有一个独立发布者、${primaryCount} 条一手来源，无法支持 ${config.articleCount} 篇新闻。请检查实时来源连接。`);
    }
    const high = config.reasoning === 'high';
    // Auto uses ordinary structured selection. Forcing thinking on a 4096-token
    // completion can consume the entire budget in reasoning and return no JSON.
    // Explicit High keeps the existing opt-in thinking strategy.
    const selected = validateSelection(await this.assistant.structured(selectionPrompt(candidates, config, date), { signal, reasoning: high, reasoningEffort: high ? 'high' : 'low', maxTokens: high ? 8192 : 4096, retries: 1 }), candidates, config);
    const selectedIds = [...new Set(selected.flatMap(event => event.candidateIds))];
    const retrieved = [];
    this.searchDiagnostic.stage = 'source-reading';
    const evidenceBytes = Math.min(12000, Math.floor(48000 / selectedIds.length));
    // Fetch only selected references; cap total evidence to three pages per article.
    for (const id of selectedIds) {
      const source = candidates.find(candidate => candidate.id === id);
      try {
        const page = await this.fetcher().fetchPage(source.url, { signal });
        const text = clip(plainText(page.text), evidenceBytes);
        // A newly indexed old page is not a new event. When page metadata is
        // available it must also fit the daily freshness window.
        if (page.publishedAt) {
          const age = now.getTime() - new Date(page.publishedAt).getTime();
          if (!Number.isFinite(age) || age < -5 * 60 * 1000 || age > 24 * 60 * 60 * 1000) continue;
        }
        if (text.length >= 500) retrieved.push({ ...source, text });
      } catch (error) { if (signal?.aborted) throw error; /* Missing evidence is excluded, never replaced with invented text. */ }
      this.searchDiagnostic.retrievedSourceCount = retrieved.length;
    }
    this.searchDiagnostic.failedSourceCount = selectedIds.length - retrieved.length;
    const articles = [];
    for (const event of selected) {
      this.searchDiagnostic.stage = 'source-reading';
      const availableIds = event.candidateIds.filter(id => retrieved.some(source => source.id === id));
      if (!availableIds.length) fail('INSUFFICIENT_SOURCES', '来源正文无法读取，本次保留上一批新闻。');
      const sources = evidenceFor(availableIds, retrieved);
      this.searchDiagnostic.stage = 'writing';
      const output = await this.assistant.structured(articlePrompt(event, sources, date), { signal, reasoning: high, reasoningEffort: high ? 'high' : 'low', maxTokens: high ? 8192 : 4096, retries: 1 });
      articles.push(validateArticle(output, event, sources));
    }
    const sourcesUsed = new Set(articles.flatMap(article => article.sourceIds)).size;
    const metrics = { searchPerformed: true, searchResultCount: candidates.length, sourcesUsed, articleCount: articles.length };
    await onPhase('validating', metrics);
    this.searchDiagnostic.stage = 'fact-checking';
    const verified = await this.assistant.structured(verificationPrompt(articles, retrieved, date), { signal, reasoning: false, maxTokens: 2048, retries: 1 });
    validateFactCheck(verified, config.articleCount);
    this.searchDiagnostic.stage = 'complete';
    return { articles: articles.map(({ sourceIds: _ids, ...article }) => article), metrics, proof: { provider: response.provider, searchPerformed: true, queries: queries.map(item => item.query), resultCount: candidates.length, latestResult: [...candidates].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0], selectedTopics: selected.map(event => event.topic), sourcesUsed, date,
      retrieval: { checkedFeeds: this.searchDiagnostic.checkedFeeds, failedFeeds: this.searchDiagnostic.failedFeeds,
        feedDiagnostics: this.searchDiagnostic.feedDiagnostics, publisherCount, primaryCount } } };
  }
  async dryRun({ settings, date } = {}) {
    const controller = new AbortController(), deadline = setTimeout(() => controller.abort(), this.timeoutMs); deadline.unref?.();
    try {
      const result = await this.generate(settings || await this.repository.getSettings(), date || shanghaiClock(this.clock()).date, { signal: controller.signal });
      const ai = await this.assistant.getSettings();
      return { ...result, persist: false, ai: { provider: ai.provider, model: ai.model, configuration: 'existing AI Assistant' } };
    } catch (error) {
      throw this.recordFailure(controller.signal.aborted ? new DailyNewsError('AI_TIMEOUT') : error);
    } finally { clearTimeout(deadline); }
  }
}

let instance;
function getDailyNewsService() { return instance || (instance = new DailyAiNewsService()); }
module.exports = { DailyAiNewsService, getDailyNewsService, shanghaiClock, candidatePool, validateSelection, validateArticle, validateFactCheck, primaryDomain, hasInventedUrl, QUERIES };
