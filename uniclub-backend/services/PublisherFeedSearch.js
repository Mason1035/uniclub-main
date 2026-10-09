const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const WebPageFetcher = require('./WebPageFetcher');
const { AiError } = require('../utils/aiSecret');
const { clip, plainText } = require('../utils/newsAiContext');
const { safeWebUrl } = require('../utils/webSafety');
const { validRecentSource } = require('../utils/newsSourceCandidates');

// Fixed publisher-owned feeds, never a URL supplied by a user or by the model.
// These are live retrieval sources, not a static collection of news stories.
const FEEDS = Object.freeze([
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', publisher: 'BBC', hosts: ['bbc.co.uk', 'bbc.com'], categories: ['technology'] },
  { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', publisher: 'BBC', hosts: ['bbc.co.uk', 'bbc.com'], categories: ['science'] },
  { url: 'https://www.theguardian.com/technology/rss', publisher: 'The Guardian', hosts: ['theguardian.com'], categories: ['technology'] },
  { url: 'https://www.nasa.gov/feed/', publisher: 'NASA', hosts: ['nasa.gov'], categories: ['science'] },
  { url: 'https://arstechnica.com/feed/', publisher: 'Ars Technica', hosts: ['arstechnica.com'], categories: [] },
  { url: 'https://www.sciencedaily.com/rss/top/science.xml', publisher: 'ScienceDaily', hosts: ['sciencedaily.com'], categories: ['science'] },
  { url: 'https://blogs.nvidia.com/feed/', publisher: 'NVIDIA', hosts: ['blogs.nvidia.com', 'nvidia.com'], categories: ['ai', 'technology'] },
  { url: 'https://blog.google/rss/', publisher: 'Google', hosts: ['blog.google'], categories: [],
    excludeTitles: /\b(?:deals?|discounts?|coupons?|giveaways?|sweepstakes|black friday|cyber monday)\b/i },
]);
const CATEGORY_TERMS = Object.freeze({
  ai: /\b(?:AI|artificial intelligence|machine learning|deep learning|OpenAI|Anthropic|DeepSeek|chatbot|language model|neural network)\b/i,
  technology: /\b(?:tech(?:nology)?|comput(?:er|ing)|semiconductor|chip|software|internet|digital|cyber|robot|AI|artificial intelligence)\b/i,
  software: /\b(?:software|programming|developer|open.source|cybersecurity|security|hack(?:ed|er|ers|ing)?|code|Linux|GitHub|VMware)\b/i,
  science: /\b(?:science|scientist|research|physics|quark|quantum|NASA|space|astronom|telescope|biology|discovery|experiment)\b/i,
  education: /\b(?:education|university|college|student|campus|higher education|teaching)\b/i,
});
const feedError = (reason = 'FEED_UNAVAILABLE') => {
  const error = new AiError('SEARCH_UNAVAILABLE', '实时新闻来源暂不可用，请稍后重试。', 503);
  error.reason = reason;
  return error;
};
const SAFE_FEED_ERRORS = new Set(['SEARCH_UNAVAILABLE', 'SOURCE_FETCH_UNAVAILABLE', 'SOURCE_URL_BLOCKED', 'CANCELLED']);
const SAFE_FEED_REASONS = new Set(['FEED_UNAVAILABLE', 'FEED_INVALID_XML', 'FEED_UNSAFE_XML']);

function parseFeed(xml, feed) {
  if (typeof xml !== 'string') throw feedError('FEED_INVALID_XML');
  // CDATA and XML comments are literal data, not declarations. NASA embeds
  // quoted HTML DOCTYPEs in content:encoded CDATA; leave the original document
  // intact for the strict XML parser while rejecting actual XML DTD/entities.
  const declarations = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g, '');
  if (/<!DOCTYPE|<!ENTITY/i.test(declarations)) throw feedError('FEED_UNSAFE_XML');
  let dom;
  try {
    dom = new JSDOM(xml, { contentType: 'text/xml' });
    const items = [...dom.window.document.querySelectorAll('item')].slice(0, 100);
    const sources = [];
    for (const item of items) {
      const title = clip(plainText(item.querySelector('title')?.textContent || ''), 600);
      const description = item.querySelector('description')?.textContent || '';
      const content = item.getElementsByTagName('content:encoded')[0]?.textContent || '';
      const snippet = clip(plainText(description || content), 2000);
      const date = Date.parse(item.querySelector('pubDate')?.textContent || '');
      let url;
      try { url = safeWebUrl(item.querySelector('link')?.textContent?.trim()); } catch { continue; }
      if (!feed.hosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) continue;
      if (!title || !snippet || !Number.isFinite(date) || feed.excludeTitles?.test(title)) continue;
      const text = title + ' ' + snippet;
      const categories = [...new Set([...feed.categories, ...Object.keys(CATEGORY_TERMS).filter(category => CATEGORY_TERMS[category].test(text))])];
      sources.push({ id: 'feed-' + crypto.createHash('sha256').update(url.href).digest('hex').slice(0, 16), title,
        url: url.href, snippet, publisher: feed.publisher, publishedAt: new Date(date).toISOString(), categories });
    }
    return sources;
  } catch { throw feedError('FEED_INVALID_XML'); }
  finally { dom?.window.close(); }
}

class PublisherFeedSearch {
  constructor({ reader = new WebPageFetcher(), clock = () => new Date() } = {}) {
    this.reader = reader;
    this.clock = clock;
    this.cache = new Map();
  }

  async load(feed, signal) {
    const cached = this.cache.get(feed.url);
    if (cached && this.clock().getTime() - cached.checkedAt < 5 * 60 * 1000) return cached.sources;
    const document = await this.reader.fetchDocument(feed.url, {
      signal, timeoutMs: 15000, maxBytes: 1024 * 1024,
      accept: 'application/rss+xml,application/xml,text/xml',
      mimeTypes: ['application/rss+xml', 'application/xml', 'text/xml', 'application/atom+xml'],
    });
    const sources = parseFeed(document.text, feed);
    this.cache.set(feed.url, { checkedAt: this.clock().getTime(), sources });
    return sources;
  }

  async search({ categories = Object.keys(CATEGORY_TERMS), from, to, signal, query, limit = 30 } = {}) {
    const oldest = Date.parse(from), newest = Date.parse(to || this.clock().toISOString());
    if (!Number.isFinite(oldest) || !Number.isFinite(newest) || oldest > newest ||
        !categories.length || categories.some(category => !Object.hasOwn(CATEGORY_TERMS, category))) throw feedError();
    if (signal?.aborted) throw new AiError('CANCELLED', '请求已取消。', 499);
    // One bounded request per fixed feed, and only completed reads are cached. A canceled
    // caller never shares an aborted promise with the following request.
    const reads = await Promise.allSettled(FEEDS.map(feed => this.load(feed, signal)));
    if (signal?.aborted) throw new AiError('CANCELLED', '请求已取消。', 499);
    const completed = reads.filter(read => read.status === 'fulfilled');
    const feedDiagnostics = reads.map((read, index) => ({
      publisher: FEEDS[index].publisher, feedUrl: FEEDS[index].url,
      status: read.status === 'fulfilled' ? 'ok' : 'failed',
      rawResultCount: read.status === 'fulfilled' ? read.value.length : 0,
      eligibleResultCount: 0,
      errorCode: read.status === 'rejected' ? (SAFE_FEED_ERRORS.has(read.reason?.code) ? read.reason.code : 'SEARCH_UNAVAILABLE') : null,
      reason: read.status === 'rejected' && SAFE_FEED_REASONS.has(read.reason?.reason) ? read.reason.reason : null,
    }));
    if (!completed.length) {
      const error = feedError();
      Object.assign(error, { feedDiagnostics, checkedFeeds: 0, failedFeeds: reads.length });
      throw error;
    }
    const terms = query?.toLowerCase().match(/[a-z0-9]{3,}|[\u3400-\u9fff]{2,}/g)?.filter(term => !['the', 'and', 'what', 'latest', 'news', 'recent', 'about'].includes(term)) || [];
    const unique = new Map();
    for (let index = 0; index < reads.length; index++) {
      const read = reads[index];
      if (read.status !== 'fulfilled') continue;
      for (const source of read.value) {
        // Filter before the result cap. Short snippets from one busy feed must
        // not crowd valid primary/independent evidence out of the candidate pool.
        const usable = validRecentSource(source, new Date(newest));
        if (!usable || Date.parse(usable.publishedAt) < oldest) continue;
        const matched = source.categories.filter(category => categories.includes(category));
        if (!matched.length) continue;
        if (terms.length && !terms.some(term => (usable.title + ' ' + usable.snippet).toLowerCase().includes(term))) continue;
        feedDiagnostics[index].eligibleResultCount++;
        const previous = unique.get(usable.url);
        if (previous) previous.categories = [...new Set([...previous.categories, ...matched])];
        else unique.set(usable.url, { ...source, ...usable, categories: matched });
      }
    }
    // Preserve independent publishers within the same bounded result budget.
    // The daily service still validates that references concern the same event;
    // this selection never claims unrelated stories corroborate one another.
    const publishers = new Map();
    for (const source of [...unique.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))) {
      if (!publishers.has(source.publisher)) publishers.set(source.publisher, []);
      publishers.get(source.publisher).push(source);
    }
    const count = Math.min(30, Math.max(1, Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : 30));
    const selected = [];
    for (let index = 0; selected.length < count; index++) {
      let added = false;
      for (const sources of publishers.values()) {
        if (!sources[index]) continue;
        selected.push(sources[index]); added = true;
        if (selected.length >= count) break;
      }
      if (!added) break;
    }
    return { provider: 'publisher-rss', searchPerformed: true,
      results: selected, checkedFeeds: completed.length, failedFeeds: reads.length - completed.length, feedDiagnostics };
  }
}

module.exports = { PublisherFeedSearch, parseFeed, FEEDS };
