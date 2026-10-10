const { test } = require('node:test');
const assert = require('node:assert/strict');
const NewsAPIService = require('../services/NewsAPIService');
const { AiError } = require('../utils/aiSecret');

const from = '2026-10-05T14:00:00Z', to = '2026-10-06T14:00:00Z';
const queries = [{ category: 'science', query: 'science research' }];
const feedDiagnostics = [{ publisher: 'NASA', feedUrl: 'https://www.nasa.gov/feed/', status: 'failed',
  rawResultCount: 0, eligibleResultCount: 0, errorCode: 'SEARCH_UNAVAILABLE', reason: 'FEED_INVALID_XML' }];
const source = { title: 'NASA publishes new observations', url: 'https://www.nasa.gov/observations',
  snippet: 'The agency describes the observations and documented methodology.', publishedAt: to, categories: ['science'] };

test('partial and complete feed failure diagnostics survive the shared search layer', async () => {
  const search = new NewsAPIService({ apiKey: '', feedSearch: { async search() {
    return { searchPerformed: true, results: [source], feedDiagnostics, checkedFeeds: 1, failedFeeds: 1 };
  } } });
  const found = await search.searchBatch(queries, { from, to });
  assert.deepEqual(found.diagnostics.feedDiagnostics, feedDiagnostics);
  assert.equal(search.dailyDiagnostic().failedFeeds, 1);
  search.feedSearch.search = async () => { throw Object.assign(new AiError('SEARCH_UNAVAILABLE', '安全错误'),
    { feedDiagnostics, checkedFeeds: 0, failedFeeds: 8 }); };
  await assert.rejects(search.searchBatch(queries, { from, to }), { code: 'SEARCH_UNAVAILABLE' });
  assert.deepEqual(search.lastBatch.feedDiagnostics, feedDiagnostics);
  assert.equal(search.lastBatch.checkedFeeds, 0); assert.equal(search.lastBatch.failedFeeds, 8);
});

test('canceled new retrieval never exposes a previous run as fresh feed health', async () => {
  const search = new NewsAPIService({ apiKey: '', feedSearch: { async search() {
    return { searchPerformed: true, results: [source], feedDiagnostics, checkedFeeds: 1, failedFeeds: 1 };
  } } });
  await search.searchBatch(queries, { from, to });
  const controller = new AbortController(); controller.abort();
  search.feedSearch.search = async () => { throw new AiError('CANCELLED', '请求已取消。', 499); };
  await assert.rejects(search.searchBatch(queries, { from, to, signal: controller.signal }), { code: 'CANCELLED' });
  assert.equal(search.lastBatch, null);
  assert.equal(search.dailyDiagnostic().feedDiagnostics, undefined);
});
