const { NEWS_CONFIG } = require('../utils/newsConstants');
const { AiError } = require('../utils/aiSecret');
const { clip, plainText } = require('../utils/newsAiContext');
const { safeWebUrl } = require('../utils/webSafety');
const { validRecentSource } = require('../utils/newsSourceCandidates');

function searchFailure(reason, retryable = false) {
  const error = new AiError('SEARCH_UNAVAILABLE', '新闻联网检索暂不可用，请检查搜索服务配置后重试。', 503);
  error.reason = reason; error.retryable = retryable; return error;
}

function retryDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new AiError('CANCELLED', '请求已取消。', 499)); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

class NewsAPIService {
  constructor({ apiKey = process.env.NEWS_API_KEY, fetchClient = fetch, feedSearch } = {}) {
    this.NEWS_API_KEY = apiKey;
    this.fetch = fetchClient;
    this.feedSearch = feedSearch;
  }

  // Shared real retrieval: daily jobs and interactive news Q&A use this same
  // provider and existing credential. Nothing here invents/memorizes results.
  diagnostic() {
    return { provider: 'newsapi', configured: Boolean(this.NEWS_API_KEY),
      available: this.lastCheck?.available ?? null, checkedAt: this.lastCheck?.checkedAt || null,
      errorCode: this.lastCheck?.errorCode || null };
  }

  async search(query, { from, to, signal, timeoutMs = 8000, limit = 10, retries = 1 } = {}) {
    if (!this.NEWS_API_KEY) throw searchFailure('NEWS_SEARCH_NOT_CONFIGURED');
    const q = String(query || '').trim().slice(0, 200);
    if (!q) throw new AiError('SEARCH_UNAVAILABLE', '请输入有效的新闻检索关键词。', 400);
    const count = Math.min(10, Math.max(1, Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : 10));
    const oldest = new Date(from || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newest = to ? new Date(to) : null;
    if (!Number.isFinite(oldest.getTime()) || (newest && (!Number.isFinite(newest.getTime()) || newest < oldest))) {
      throw new AiError('SEARCH_UNAVAILABLE', '新闻检索时间范围无效。', 400);
    }
    const attempts = Math.min(2, Math.max(1, Math.floor(Number(retries) || 0) + 1));
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (signal?.aborted) throw new AiError('CANCELLED', '请求已取消。', 499);
      try {
        const found = await this.requestSearch(q, { from: oldest, to: newest, signal, timeoutMs, limit: count });
        this.lastCheck = { available: true, checkedAt: new Date().toISOString(), errorCode: null };
        return { provider: 'newsapi', searchPerformed: true, results: found };
      } catch (error) {
        if (signal?.aborted) throw new AiError('CANCELLED', '请求已取消。', 499);
        this.lastCheck = { available: false, checkedAt: new Date().toISOString(), errorCode: 'SEARCH_UNAVAILABLE' };
        if (!error.retryable || attempt + 1 === attempts) throw error;
        await retryDelay(300 * 2 ** attempt, signal);
      }
    }
  }

  feeds() {
    return this.feedSearch || (this.feedSearch = new (require('./PublisherFeedSearch').PublisherFeedSearch)());
  }

  dailyDiagnostic() {
    // Public publisher feeds need no credential. NewsAPI is an optional shared
    // supplement; its Developer /everything delay cannot satisfy a 24h window.
    return { provider: this.lastBatch?.provider || 'newsapi + publisher-rss', configured: true,
      newsapiConfigured: Boolean(this.NEWS_API_KEY),
      ...(this.lastBatch?.feedDiagnostics && { feedDiagnostics: this.lastBatch.feedDiagnostics,
        checkedFeeds: this.lastBatch.checkedFeeds, failedFeeds: this.lastBatch.failedFeeds }) };
  }

  async searchBatch(queries, { from, to, signal, minimumResults = 4 } = {}) {
    this.lastBatch = null;
    const results = [], categories = queries.map(item => item.category);
    let succeeded = 0, failed = 0, feedResults = 0, feedFailed = false, feedDiagnostic;
    for (const { category, query } of queries.slice(0, 5)) {
      if (!this.NEWS_API_KEY) break;
      try {
        const found = await this.search(query, { from, to, signal, limit: 10 });
        results.push(...found.results.map(result => ({ ...result, categories: [category] })));
        succeeded++;
      } catch (error) {
        if (signal?.aborted || error.code === 'CANCELLED') throw error;
        failed++;
      }
    }
    const now = new Date(to || Date.now()), oldest = Date.parse(from);
    const fresh = new Map();
    for (const source of results) {
      const usable = validRecentSource(source, now);
      if (usable && Date.parse(usable.publishedAt) >= oldest) fresh.set(usable.url, usable);
    }
    let provider = 'newsapi';
    if (fresh.size < minimumResults) {
      provider = 'newsapi + publisher-rss';
      try {
        const found = await this.feeds().search({ categories, from, to, signal, limit: 30 });
        if (found.searchPerformed !== true || !Array.isArray(found.results)) throw searchFailure('PUBLISHER_SEARCH_UNAVAILABLE');
        feedDiagnostic = found;
        results.push(...found.results); feedResults = found.results.length; succeeded++;
      } catch (error) {
        if (signal?.aborted || error.code === 'CANCELLED') throw error;
        feedDiagnostic = error;
        feedFailed = true;
      }
    }
    // A provider label only identifies attempted providers. Keep each fixed
    // feed's safe health result, including partial failures, for diagnostics.
    this.lastBatch = { provider, newsapiResults: results.length - feedResults, feedResults, failedQueries: failed, feedFailed,
      ...(feedDiagnostic?.feedDiagnostics && { feedDiagnostics: feedDiagnostic.feedDiagnostics,
        checkedFeeds: feedDiagnostic.checkedFeeds, failedFeeds: feedDiagnostic.failedFeeds }) };
    if (!succeeded || (!fresh.size && feedFailed)) throw searchFailure('NEWS_SEARCH_UNAVAILABLE');
    return { provider, searchPerformed: true, results, diagnostics: this.lastBatch };
  }

  async requestSearch(query, { from, to, signal, timeoutMs, limit }) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(abort, Math.min(15000, Math.max(1, timeoutMs))); timer.unref?.();
    let response;
    try {
      const url = new URL('https://newsapi.org/v2/everything');
      // No unverified sources IDs: the old list exceeded NewsAPI's 20-ID limit.
      // Trust/recency scoring happens after retrieval, before daily generation.
      url.search = new URLSearchParams({ q: query, language: 'en', sortBy: 'publishedAt',
        pageSize: String(limit), from: from.toISOString(), ...(to && { to: to.toISOString() }) }).toString();
      response = await this.fetch(url, { signal: controller.signal, redirect: 'error', headers: {
        'X-Api-Key': this.NEWS_API_KEY, 'User-Agent': 'ClassHub-News-Assistant/1.0', Accept: 'application/json',
      } });
      if (!response.ok) {
        await response.body?.cancel?.();
        throw searchFailure('NEWS_SEARCH_UNAVAILABLE', response.status === 429 || response.status >= 500);
      }
      if (!response.body) throw searchFailure('NEWS_SEARCH_UNAVAILABLE');
      // Bound bytes before parsing, including responses without Content-Length.
      let raw = '', bytes = 0;
      const decoder = new TextDecoder();
      for await (const chunk of response.body) {
        bytes += chunk.byteLength;
        if (bytes > 256 * 1024) throw searchFailure('NEWS_SEARCH_TOO_LARGE');
        raw += decoder.decode(chunk, { stream: true });
      }
      raw += decoder.decode();
      let data;
      try { data = JSON.parse(raw); } catch { throw searchFailure('NEWS_SEARCH_UNAVAILABLE'); }
      if (!data || typeof data !== 'object' || data.status !== 'ok' || !Array.isArray(data.articles)) throw searchFailure('NEWS_SEARCH_UNAVAILABLE');
      const result = [], seen = new Set();
      for (const item of data.articles) {
        let link;
        try { link = safeWebUrl(item?.url).href; } catch { continue; }
        const title = clip(plainText(item?.title), 600);
        if (!title || title === '[Removed]' || seen.has(link)) continue;
        seen.add(link);
        const date = item.publishedAt && new Date(item.publishedAt);
        result.push({ id: `source-${result.length + 1}`, title, url: link,
          snippet: clip(plainText(item.description || item.content), 2000),
          publisher: clip(plainText(item.source?.name), 200),
          publishedAt: date && Number.isFinite(date.getTime()) ? date.toISOString() : null });
        if (result.length >= limit) break;
      }
      return result;
    } catch (error) {
      // Cancel unread bodies without exposing the URL/key-bearing fetch error.
      try { await response?.body?.cancel?.(); } catch { /* already read/locked */ }
      if (signal?.aborted) throw new AiError('CANCELLED', '请求已取消。', 499);
      if (error instanceof AiError) throw error;
      throw searchFailure(controller.signal.aborted ? 'NEWS_SEARCH_TIMEOUT' : 'NEWS_SEARCH_UNAVAILABLE', true);
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }

  // Compatibility for the current Q&A caller: the same real provider returns
  // its previous shape, while daily jobs consume the normalized search result.
  async searchRecentNews(query, { signal, timeoutMs = 8000, limit = 4 } = {}) {
    try {
      const q = String(query || '').trim().slice(0, 200);
      if (!q) throw new AiError('SEARCH_UNAVAILABLE', '请输入有效的新闻检索关键词。', 400);
      const count = Math.min(4, Math.max(1, Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : 4));
      const now = new Date(), from = new Date(now - 24 * 60 * 60 * 1000).toISOString(), to = now.toISOString();
      let found, primaryError;
      try {
        found = await this.search(q, { from, to, signal, timeoutMs, limit: count, retries: 0 });
        // Latest-progress questions must not accept an old article merely
        // because the delayed provider returned a nonempty response.
        found.results = found.results.filter(item => {
          const date = Date.parse(item.publishedAt);
          return Number.isFinite(date) && date >= Date.parse(from) && date <= now.getTime() + 5 * 60 * 1000;
        });
      } catch (error) {
        // The caller's timeout is terminal: do not start another retrieval
        // after its original provider deadline has expired.
        if (signal?.aborted || error.code === 'CANCELLED' || error.reason === 'NEWS_SEARCH_TIMEOUT') throw error;
        primaryError = error;
      }
      if (!found?.results.length) {
        // Q&A and the daily job share the same live feed retrieval, including
        // cancellation, provenance and safe source reading; no second AI client.
        try { found = await this.feeds().search({ query: q, from, to, signal, limit: count }); }
        catch (error) {
          if (signal?.aborted || error.code === 'CANCELLED') throw error;
          throw primaryError || error;
        }
      }
      return found.results.map(item => ({ title: item.title, url: item.url,
        description: item.snippet, publishedAt: item.publishedAt, source: { name: item.publisher } }));
    } catch (error) {
      if (error.code === 'CANCELLED' || error.reason === 'NEWS_SEARCH_TIMEOUT') throw new DOMException('新闻检索已停止。', 'AbortError');
      throw new AiError('SEARCH_UNAVAILABLE', error.reason || 'NEWS_SEARCH_UNAVAILABLE', 502);
    }
  }

  async fetchLatestArticles() {
    console.log('\n📡 Fetching fresh articles from all sources...');
    const allArticles = [];
    
    for (let i = 0; i < NEWS_CONFIG.TECH_QUERIES.length; i++) {
      console.log(`📡 Query ${i + 1}/${NEWS_CONFIG.TECH_QUERIES.length}...`);
      const articles = await this.fetchNewsFromAPI(NEWS_CONFIG.TECH_QUERIES[i]);
      allArticles.push(...articles);
      
      // Add delay between requests to respect rate limits
      if (i < NEWS_CONFIG.TECH_QUERIES.length - 1) {
        await this.sleep(NEWS_CONFIG.API_DELAY);
      }
    }
    
    console.log(`📰 Found ${allArticles.length} total articles`);
    return allArticles;
  }

  async fetchNewsFromAPI(query, retryCount = 0) {
    try {
      const url = `https://newsapi.org/v2/everything?` +
        `q=${encodeURIComponent(query)}&` +
        `sources=${NEWS_CONFIG.TECH_SOURCES.join(',')}&` +
        `language=en&` +
        `sortBy=publishedAt&` +
        `pageSize=20&` +
        `from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`;
      
      const response = await this.fetch(url, {
        headers: { 
          'X-Api-Key': this.NEWS_API_KEY,
          'User-Agent': 'AI-Club-News-Bot/1.0'
        }
      });
      
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your NEWS_API_KEY in .env file');
      }
      
      if (response.status === 429) {
        // Rate limit hit
        if (retryCount < NEWS_CONFIG.MAX_RETRIES) {
          const waitTime = Math.pow(2, retryCount) * 5000; // Exponential backoff
          console.log(`⏳ Rate limit hit, waiting ${waitTime/1000}s before retry ${retryCount + 1}/${NEWS_CONFIG.MAX_RETRIES}...`);
          await this.sleep(waitTime);
          return this.fetchNewsFromAPI(query, retryCount + 1);
        } else {
          throw new Error('Rate limit exceeded after maximum retries');
        }
      }
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} - ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'error') {
        throw new Error(`API Error: ${data.message}`);
      }
      
      return data.articles || [];
    } catch (error) {
      console.error(`❌ Failed to fetch query "${query}":`, error.message);
      
      // Retry logic for non-rate-limit errors
      if (retryCount < NEWS_CONFIG.MAX_RETRIES && 
          !error.message.includes('Rate limit exceeded') && 
          !error.message.includes('Invalid API key')) {
        console.log(`🔄 Retrying query (${retryCount + 1}/${NEWS_CONFIG.MAX_RETRIES})...`);
        await this.sleep(NEWS_CONFIG.API_DELAY * (retryCount + 1));
        return this.fetchNewsFromAPI(query, retryCount + 1);
      }
      
      return [];
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = NewsAPIService;
