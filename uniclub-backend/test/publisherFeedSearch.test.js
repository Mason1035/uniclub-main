const { test } = require('node:test');
const assert = require('node:assert/strict');
const NewsAPIService = require('../services/NewsAPIService');
const { PublisherFeedSearch, parseFeed, FEEDS } = require('../services/PublisherFeedSearch');
const { validRecentSource } = require('../utils/newsSourceCandidates');

const now = new Date('2026-10-06T14:00:00Z');
const from = new Date(now - 86400000).toISOString(), to = now.toISOString();
const story = (id = '1', date = to, host = 'www.bbc.co.uk') => `<item><title>AI research and software security ${id}</title><link>https://${host}/news/${id}</link><pubDate>${date}</pubDate><description><![CDATA[<p>Researchers report new artificial intelligence results and explain the methodology and its limitations.</p>]]></description></item>`;
const xml = items => `<rss version="2.0"><channel>${items}</channel></rss>`;
const queries = [{ category: 'ai', query: 'artificial intelligence' }, { category: 'science', query: 'science research' }];
const source = (id, date = to) => ({ title: `A current research report ${id}`, url: `https://www.nasa.gov/${id}`, snippet: 'The agency publishes new research findings and documented methodology.', publisher: 'NASA', publishedAt: date, categories: ['science'] });
const response = articles => new Response(JSON.stringify({ status: 'ok', articles }));

test('publisher feed reads are real bounded document calls, cached and filtered by date/category', async () => {
  const reads = [];
  const reader = { async fetchDocument(url, options) {
    reads.push({ url, options });
    return { text: xml(story() + story('old', '2026-10-04T12:00:00Z') + story('future', '2026-10-07T12:00:00Z') + story('no-date', 'invalid') + story('private', to, '127.0.0.1') + story('external', to, 'unknown.example')), url };
  } };
  const search = new PublisherFeedSearch({ reader, clock: () => now });
  const result = await search.search({ categories: ['ai'], from, to });
  assert.equal(result.searchPerformed, true); assert.equal(result.provider, 'publisher-rss');
  assert.equal(result.results.length, 1); assert.equal(result.results[0].publisher, 'BBC');
  assert.deepEqual(result.results[0].categories, ['ai']);
  assert.equal(reads.length, FEEDS.length);
  assert.ok(reads.every(read => read.options.maxBytes <= 1024 * 1024 && read.options.timeoutMs === 15000));
  await search.search({ categories: ['ai'], from, to });
  assert.equal(reads.length, FEEDS.length, 'completed feed reads reused across related queries');
  assert.equal((await search.search({ categories: ['education'], from, to })).results.length, 0);
});

test('XML entities, malformed XML and off-publisher links cannot become retrieval evidence', () => {
  assert.throws(() => parseFeed('<!DOCTYPE rss [<!ENTITY injected SYSTEM "file:///etc/passwd">]><rss/>', FEEDS[0]), { code: 'SEARCH_UNAVAILABLE' });
  assert.throws(() => parseFeed('<rss><bad></rss>', FEEDS[0]), { code: 'SEARCH_UNAVAILABLE' });
  assert.equal(parseFeed(xml(story('outside', to, 'untrusted.example')), FEEDS[0]).length, 0);
});

test('NASA-style quoted HTML DOCTYPE inside CDATA is data; actual XML declarations remain blocked', () => {
  const feed = FEEDS.find(item => item.publisher === 'NASA');
  const content = '<p><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">The telescope report describes new observations and their documented limitations.</p>';
  const document = `<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item><title>NASA telescope research report</title><link>https://www.nasa.gov/research/report</link><pubDate>${to}</pubDate><content:encoded><![CDATA[${content}]]></content:encoded></item></channel></rss>`;
  const parsed = parseFeed(document, feed);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].snippet, 'The telescope report describes new observations and their documented limitations.');
  assert.equal(parseFeed('<!-- <!DOCTYPE html> <!ENTITY quoted "literal"> -->' + document, feed).length, 1);
  for (const declaration of ['<!DOCTYPE rss>', '<!ENTITY injected SYSTEM "file:///etc/passwd">',
    '<!DOCTYPE rss [<!ENTITY injected SYSTEM "https://external.invalid/entity">]>']) {
    assert.throws(() => parseFeed(declaration + document, feed), { code: 'SEARCH_UNAVAILABLE', reason: 'FEED_UNSAFE_XML' });
  }
});

test('fixed official Google and NVIDIA feeds enforce publisher hosts and exclude obvious Google sales', () => {
  const google = FEEDS.find(feed => feed.publisher === 'Google'), nvidia = FEEDS.find(feed => feed.publisher === 'NVIDIA');
  assert.equal(google.url, 'https://blog.google/rss/');
  assert.equal(nvidia.url, 'https://blogs.nvidia.com/feed/');
  const googleXml = xml(story('research', to, 'blog.google') + story('outside', to, 'untrusted.example') +
    story('deals', to, 'blog.google').replace('AI research and software security deals', 'Black Friday AI software deals'));
  const googleSources = parseFeed(googleXml, google);
  assert.equal(googleSources.length, 1); assert.equal(googleSources[0].publisher, 'Google');
  assert.ok(googleSources[0].categories.includes('ai'));
  assert.equal(parseFeed(xml(story('official', to, 'blogs.nvidia.com')), nvidia).length, 1);
  assert.equal(parseFeed(xml(story('external', to, 'unknown.example')), nvidia).length, 0);
});

test('partial feed failure is tolerated; all failed or cancellation produces no fabricated result', async () => {
  const reader = { async fetchDocument(url) { if (url !== FEEDS[0].url) throw new Error('socket internals'); return { text: xml(story()), url }; } };
  const found = await new PublisherFeedSearch({ reader }).search({ categories: ['ai'], from, to });
  assert.equal(found.results.length, 1); assert.equal(found.failedFeeds, FEEDS.length - 1);
  await assert.rejects(new PublisherFeedSearch({ reader: { async fetchDocument() { throw new Error('private internals'); } } }).search({ categories: ['ai'], from, to }), error => error.code === 'SEARCH_UNAVAILABLE' && !error.message.includes('private internals'));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(new PublisherFeedSearch({ reader }).search({ categories: ['ai'], from, to, signal: controller.signal }), { code: 'CANCELLED' });
});

test('feed diagnostics distinguish parsed and eligible sources without exposing raw errors', async () => {
  const reader = { async fetchDocument(url) {
    if (url !== FEEDS[0].url) throw Object.assign(new Error('private-provider-secret must not escape'), { code: 'private-provider-secret', reason: 'private-provider-secret' });
    return { text: xml(story('good') + story('old', '2026-10-04T12:00:00Z') +
      story('brief').replace('Researchers report new artificial intelligence results and explain the methodology and its limitations.', 'Short description.')), url };
  } };
  const found = await new PublisherFeedSearch({ reader }).search({ categories: ['ai'], from, to });
  assert.equal(found.feedDiagnostics.length, FEEDS.length);
  assert.deepEqual(found.feedDiagnostics[0], { publisher: 'BBC', feedUrl: FEEDS[0].url, status: 'ok',
    rawResultCount: 3, eligibleResultCount: 1, errorCode: null, reason: null });
  assert.ok(found.feedDiagnostics.slice(1).every(feed => feed.status === 'failed' && feed.errorCode === 'SEARCH_UNAVAILABLE' && feed.reason === null));
  assert.ok(!JSON.stringify(found).includes('private-provider-secret'));
  const failed = new PublisherFeedSearch({ reader: { async fetchDocument() { throw new Error('private-provider-secret'); } } });
  await assert.rejects(failed.search({ categories: ['ai'], from, to }), error => {
    assert.equal(error.checkedFeeds, 0); assert.equal(error.failedFeeds, FEEDS.length);
    assert.equal(error.feedDiagnostics.length, FEEDS.length);
    assert.ok(!JSON.stringify(error).includes('private-provider-secret'));
    return error.code === 'SEARCH_UNAVAILABLE';
  });
});

test('quality filtering precedes the cap so short busy-feed snippets cannot discard primary evidence', async () => {
  const busy = Array.from({ length: 30 }, (_, index) => story(`busy-${index}`).replace(
    'Researchers report new artificial intelligence results and explain the methodology and its limitations.',
    index < 20 ? 'Short description.' : 'Documented technology results provide sufficient factual evidence for readers.',
  )).join('');
  const nasa = story('nebula', '2026-10-06T07:00:00Z', 'www.nasa.gov') + story('planet', '2026-10-06T08:00:00Z', 'www.nasa.gov');
  const reader = { async fetchDocument(url) { return { text: xml(url === FEEDS[0].url ? busy : url === FEEDS.find(feed => feed.publisher === 'NASA').url ? nasa : ''), url }; } };
  const found = await new PublisherFeedSearch({ reader }).search({ categories: ['ai', 'science'], from, to, limit: 30 });
  assert.equal(found.checkedFeeds, FEEDS.length);
  assert.equal(found.results.length, 12);
  assert.equal(found.results.filter(source => source.publisher === 'NASA').length, 2);
  assert.ok(found.results.every(source => validRecentSource(source, now)));
});

test('the bounded pool preserves publishers instead of letting one recent feed fill every slot', async () => {
  const reader = { async fetchDocument(url) {
    const feed = FEEDS.find(item => item.url === url);
    let items = '';
    if (url === FEEDS[0].url) items = Array.from({ length: 40 }, (_, index) => story(`bbc-${index}`)).join('');
    if (['The Guardian', 'NASA', 'NVIDIA', 'Google'].includes(feed.publisher)) items =
      Array.from({ length: 2 }, (_, index) => story(`${feed.publisher}-${index}`, '2026-10-06T07:00:00Z', feed.hosts[0])).join('');
    return { text: xml(items), url };
  } };
  const found = await new PublisherFeedSearch({ reader }).search({ categories: ['ai', 'technology', 'science'], from, to, limit: 6 });
  assert.equal(found.results.length, 6);
  assert.deepEqual(new Set(found.results.map(source => source.publisher)), new Set(['BBC', 'The Guardian', 'NASA', 'NVIDIA', 'Google']));
  assert.equal(new Set(found.results.map(source => source.url)).size, found.results.length);
});

test('delayed empty NewsAPI lookup uses live feeds once without repeating queries', async () => {
  let apiCalls = 0, feedCalls = 0;
  const search = new NewsAPIService({ apiKey: 'isolated-placeholder', fetchClient: async () => { apiCalls++; return response([]); },
    feedSearch: { async search(options) { feedCalls++; assert.deepEqual(options.categories, ['ai', 'science']); return { searchPerformed: true, results: [source('one'), source('two')] }; } } });
  const result = await search.searchBatch(queries, { from, to });
  assert.equal(result.provider, 'newsapi + publisher-rss'); assert.equal(result.results.length, 2);
  assert.equal(apiCalls, queries.length); assert.equal(feedCalls, 1);
  assert.deepEqual(result.diagnostics, { provider: result.provider, newsapiResults: 0, feedResults: 2, failedQueries: 0, feedFailed: false });
});

test('stale NewsAPI results require live supplementation; sufficient recent articles avoid extra calls', async () => {
  let feedCalls = 0;
  const feedSearch = { async search() { feedCalls++; return { searchPerformed: true, results: [source('live')] }; } };
  const article = (date, id = 'article') => ({ ...source(id, date), description: 'Research results and documented evidence.', source: { name: 'NASA' } });
  const stale = new NewsAPIService({ apiKey: 'placeholder', fetchClient: async () => response([article('2026-10-04T12:00:00Z')]), feedSearch });
  assert.equal((await stale.searchBatch(queries, { from, to })).diagnostics.feedResults, 1);
  let index = 0;
  const current = new NewsAPIService({ apiKey: 'placeholder', fetchClient: async () => response([article(to, `article-${index++}`)]), feedSearch });
  assert.equal((await current.searchBatch(queries, { from, to, minimumResults: 2 })).provider, 'newsapi');
  assert.equal(feedCalls, 1);
});

test('live publisher retrieval works without NewsAPI credentials or when its quota is exhausted', async () => {
  const feedSearch = { async search() { return { searchPerformed: true, results: [source('live')] }; } };
  const keyless = new NewsAPIService({ apiKey: '', feedSearch });
  assert.equal(keyless.dailyDiagnostic().configured, true);
  assert.equal((await keyless.searchBatch(queries, { from, to })).results.length, 1);
  const exhausted = new NewsAPIService({ apiKey: 'placeholder', fetchClient: async () => new Response('', { status: 429 }), feedSearch });
  assert.equal((await exhausted.searchBatch(queries, { from, to })).results.length, 1);
});

test('failed supplementary feeds retain valid original results; both failures remain errors', async () => {
  const feedSearch = { async search() { throw new Error('feed unavailable'); } };
  const healthy = new NewsAPIService({ apiKey: 'placeholder', fetchClient: async () => response([{ ...source('available'), description: 'Documented research findings and their methodology.', source: { name: 'NASA' } }]), feedSearch });
  assert.equal((await healthy.searchBatch(queries, { from, to })).results.length, 2);
  await assert.rejects(new NewsAPIService({ apiKey: '', feedSearch }).searchBatch(queries, { from, to }), { code: 'SEARCH_UNAVAILABLE' });
});

test('interactive news QA shares the same live feed fallback and keeps its previous response contract', async () => {
  let feedCalls = 0;
  const search = new NewsAPIService({ apiKey: 'placeholder', fetchClient: async () => response([]), feedSearch: { async search(options) { feedCalls++; assert.equal(options.query, 'NASA research'); return { results: [source('live')] }; } } });
  const found = await search.searchRecentNews('NASA research');
  assert.equal(feedCalls, 1);
  assert.deepEqual(found, [{ title: source('live').title, url: source('live').url, description: source('live').snippet, publishedAt: to, source: { name: 'NASA' } }]);
});

test('shared candidate policy canonicalizes URLs and rejects stale, future or low-quality evidence', () => {
  const candidate = { ...source('valid'), url: 'https://www.nasa.gov/valid?utm_source=tracking&fbclid=tracking&gclid=tracking&keep=yes#section' };
  assert.deepEqual(validRecentSource(candidate, now), {
    url: 'https://www.nasa.gov/valid?keep=yes', title: candidate.title, snippet: candidate.snippet, publishedAt: to,
  });
  assert.ok(validRecentSource({ ...candidate, publishedAt: from }, now));
  for (const changes of [
    { publishedAt: new Date(now - 86400000 - 1).toISOString() },
    { publishedAt: new Date(now.getTime() + 5 * 60000 + 1).toISOString() },
    { publishedAt: null }, { publishedAt: 'invalid' }, { url: 'http://127.0.0.1/internal' },
    { title: 'Short' }, { snippet: 'Too short' }, { title: 'Sponsored science report' },
  ]) assert.equal(validRecentSource({ ...candidate, ...changes }, now), null);
});

test('duplicate URLs across categories and tracking variants cannot suppress live supplementation', async () => {
  let apiCalls = 0, feedCalls = 0;
  const search = new NewsAPIService({ apiKey: 'isolated-placeholder', fetchClient: async () => {
    const suffix = apiCalls++ ? '?utm_source=duplicate' : '';
    return response([{ ...source('same'), url: source('same').url + suffix, description: source('same').snippet, source: { name: 'NASA' } }]);
  }, feedSearch: { async search() { feedCalls++; return { searchPerformed: true, results: [source('additional')] }; } } });
  const found = await search.searchBatch(queries, { from, to, minimumResults: 2 });
  assert.equal(apiCalls, 2); assert.equal(feedCalls, 1);
  assert.equal(found.diagnostics.feedResults, 1);
});

test('recent but unusable result counts cannot suppress live supplementation', async () => {
  let feedCalls = 0;
  const bad = [
    { ...source('short-title'), title: 'Short' },
    { ...source('short-snippet'), snippet: 'Too short' },
    { ...source('advertising'), title: 'Sponsored artificial intelligence announcement' },
  ].map(item => ({ ...item, description: item.snippet, source: { name: 'NASA' } }));
  const search = new NewsAPIService({ apiKey: 'isolated-placeholder', fetchClient: async () => response(bad),
    feedSearch: { async search() { feedCalls++; return { searchPerformed: true, results: [source('usable')] }; } } });
  const found = await search.searchBatch(queries, { from, to, minimumResults: 2 });
  assert.equal(found.diagnostics.newsapiResults, 6); assert.equal(feedCalls, 1);
});

test('empty or wholly stale primary search plus failed live retrieval is unavailable, not no-news', async () => {
  const feedSearch = { async search() { throw new Error('isolated source unavailable'); } };
  for (const articles of [[], [{ ...source('stale', '2026-10-04T12:00:00Z'), description: source('stale').snippet }]]) {
    const search = new NewsAPIService({ apiKey: 'isolated-placeholder', fetchClient: async () => response(articles), feedSearch });
    await assert.rejects(search.searchBatch(queries, { from, to }), { code: 'SEARCH_UNAVAILABLE' });
    assert.equal(search.lastBatch.feedFailed, true);
  }
});

test('interactive latest-news lookup rejects stale nonempty primary results and uses live retrieval', async () => {
  let feedCalls = 0;
  const recent = source('live', new Date().toISOString());
  const stale = { ...source('stale', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()), description: source('stale').snippet };
  const search = new NewsAPIService({ apiKey: 'isolated-placeholder', fetchClient: async url => {
    const requested = new URL(url), start = Date.parse(requested.searchParams.get('from')), end = Date.parse(requested.searchParams.get('to'));
    assert.equal(end - start, 86400000);
    return response([stale]);
  }, feedSearch: { async search(options) { feedCalls++; assert.equal(options.limit, 4); return { searchPerformed: true, results: [recent] }; } } });
  const found = await search.searchRecentNews('NASA latest progress', { limit: 100 });
  assert.equal(feedCalls, 1); assert.equal(found.length, 1); assert.equal(found[0].url, recent.url);
});
