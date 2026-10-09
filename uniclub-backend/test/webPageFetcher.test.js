const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const WebPageFetcher = require('../services/WebPageFetcher');

const publicIp = { address: '23.199.0.160', family: 4 };
const fakeIps = [{ address: '198.18.0.61', family: 4 }, { address: '198.19.1.2', family: 4 }];
const dnsResponse = (answers, Status = 0) => ({
  text: JSON.stringify({ Status, Answer: answers }), headers: { 'content-type': 'application/dns-json' },
});
const goodDns = () => dnsResponse([{ type: 5, data: 'public.example.com' }, { type: 1, data: publicIp.address }]);
const feed = () => ({ text: '<rss><channel><title>Science</title></channel></rss>', headers: { 'content-type': 'text/xml; charset=utf-8' } });
const feedOptions = { mimeTypes: ['application/rss+xml', 'application/xml', 'text/xml'], accept: 'application/rss+xml,application/xml,text/xml' };

function mockDocuments(pages) {
  const requests = [];
  const request = (url, options, callback) => {
    const req = new EventEmitter(); req.destroyed = false;
    req.destroy = () => { req.destroyed = true; };
    req.end = () => {
      requests.push({ url, options, req });
      setImmediate(() => {
        if (req.destroyed) return;
        const page = pages.shift();
        if (!page) { req.emit('error', new Error('Missing test document')); return; }
        if (page.hang) return;
        if (page.error) { req.emit('error', page.error); return; }
        const response = Readable.from(page.chunks || [Buffer.from(page.text || '')]);
        response.statusCode = page.status || 200;
        response.headers = page.headers || { 'content-type': 'text/html' };
        callback(response);
      });
    };
    return req;
  };
  return { request, requests };
}

function assertPinned(options, address) {
  options.lookup('example.com', {}, (error, ip, family) => {
    assert.equal(error, null); assert.equal(ip, address.address); assert.equal(family, address.family);
  });
  options.lookup('example.com', { all: true }, (error, addresses) => {
    assert.equal(error, null); assert.deepEqual(addresses, [address]);
  });
}

test('all fake-IP answers use fixed HTTPS public DNS and pin validated document socket', async () => {
  const mocked = mockDocuments([goodDns(), feed()]);
  const fetcher = new WebPageFetcher({ request: mocked.request, lookup: async () => fakeIps });
  const document = await fetcher.fetchDocument('https://feeds.bbci.co.uk/news/technology/rss.xml', feedOptions);
  assert.equal(document.contentType, 'text/xml'); assert.equal(document.text, feed().text);
  assert.equal(document.url, 'https://feeds.bbci.co.uk/news/technology/rss.xml');
  assert.equal(mocked.requests.length, 2);
  const resolver = mocked.requests[0];
  assert.equal(resolver.url.origin, 'https://cloudflare-dns.com');
  assert.equal(resolver.url.pathname, '/dns-query');
  assert.equal(resolver.url.searchParams.get('name'), 'feeds.bbci.co.uk');
  assert.equal(resolver.url.searchParams.get('type'), 'A');
  assert.equal(resolver.options.headers.Accept, 'application/dns-json');
  assertPinned(resolver.options, { address: '1.1.1.1', family: 4 });
  assertPinned(mocked.requests[1].options, publicIp);
  assert.equal(mocked.requests[1].options.headers.Accept, feedOptions.accept);
  assert.equal(mocked.requests[1].options.headers['Accept-Encoding'], 'identity');
});

test('injected public lookup is used only after all-fake system lookup', async () => {
  const mocked = mockDocuments([feed()]); let calls = 0;
  const fetcher = new WebPageFetcher({ request: mocked.request, lookup: async () => fakeIps,
    publicLookup: async (host, { signal }) => {
      calls++; assert.equal(host, 'feeds.bbci.co.uk'); assert.equal(signal.aborted, false); return [publicIp];
    },
  });
  await fetcher.fetchDocument('https://feeds.bbci.co.uk/rss.xml', feedOptions);
  assert.equal(calls, 1); assert.equal(mocked.requests.length, 1); assertPinned(mocked.requests[0].options, publicIp);
});

test('ordinary private, mixed public/private and mixed fake/private DNS never use fallback', async () => {
  for (const addresses of [
    [{ address: '127.0.0.1', family: 4 }], [{ address: '10.0.0.1', family: 4 }],
    [publicIp, { address: '169.254.169.254', family: 4 }],
    [fakeIps[0], { address: '192.168.0.1', family: 4 }], [fakeIps[0], publicIp],
  ]) {
    const mocked = mockDocuments([]); let calls = 0;
    const fetcher = new WebPageFetcher({ request: mocked.request, lookup: async () => addresses,
      publicLookup: async () => { calls++; return [publicIp]; },
    });
    await assert.rejects(fetcher.fetchDocument('https://example.com/rss.xml', feedOptions), { code: 'SOURCE_URL_BLOCKED' });
    assert.equal(calls, 0); assert.equal(mocked.requests.length, 0);
  }
});

test('ordinary public DNS opens only the pinned document socket', async () => {
  const mocked = mockDocuments([feed()]);
  const fetcher = new WebPageFetcher({ request: mocked.request, lookup: async () => [publicIp],
    publicLookup: async () => assert.fail('Public addresses must not need DoH'),
  });
  await fetcher.fetchDocument('https://example.com/rss.xml', feedOptions);
  assert.equal(mocked.requests.length, 1); assertPinned(mocked.requests[0].options, publicIp);
});

test('public lookup injection cannot bypass private address validation', async () => {
  for (const addresses of [[], [{ address: '127.0.0.1', family: 4 }], [publicIp, fakeIps[0]]]) {
    const mocked = mockDocuments([]);
    const fetcher = new WebPageFetcher({ request: mocked.request, lookup: async () => fakeIps,
      publicLookup: async () => addresses,
    });
    await assert.rejects(fetcher.fetchDocument('https://example.com/rss.xml', feedOptions), { code: 'SOURCE_URL_BLOCKED' });
    assert.equal(mocked.requests.length, 0);
  }
});

test('DoH validates successful status, IPv4 A records and every public address', async () => {
  for (const [page, code] of [
    [dnsResponse([{ type: 1, data: publicIp.address }], 3), 'SOURCE_FETCH_UNAVAILABLE'],
    [dnsResponse([{ type: 28, data: '2606:4700:4700::1111' }]), 'SOURCE_URL_BLOCKED'],
    [dnsResponse([{ type: 1, data: '127.0.0.1' }]), 'SOURCE_URL_BLOCKED'],
    [dnsResponse([{ type: 1, data: '198.18.0.61' }]), 'SOURCE_URL_BLOCKED'],
    [dnsResponse([{ type: 1, data: publicIp.address }, { type: 1, data: '169.254.169.254' }]), 'SOURCE_URL_BLOCKED'],
    [dnsResponse([{ type: 1, data: '2606:4700:4700::1111' }]), 'SOURCE_URL_BLOCKED'],
    [dnsResponse(Array.from({ length: 65 }, () => ({ type: 1, data: publicIp.address }))), 'SOURCE_FETCH_UNAVAILABLE'],
  ]) {
    const mocked = mockDocuments([page]);
    const fetcher = new WebPageFetcher({ request: mocked.request, lookup: async () => fakeIps });
    await assert.rejects(fetcher.fetchDocument('https://example.com/rss.xml', feedOptions), { code });
    assert.equal(mocked.requests.length, 1);
  }
});

test('resolver redirects, wrong MIME and oversized DNS responses are not followed or trusted', async () => {
  for (const page of [
    { status: 302, headers: { location: 'https://evil.example.com/dns' } },
    { text: goodDns().text, headers: { 'content-type': 'text/html' } },
    { chunks: [Buffer.alloc(16385)], headers: { 'content-type': 'application/dns-json' } },
    { text: 'not-json', headers: { 'content-type': 'application/dns-json' } },
  ]) {
    const mocked = mockDocuments([page]);
    const fetcher = new WebPageFetcher({ request: mocked.request, lookup: async () => fakeIps });
    await assert.rejects(fetcher.fetchDocument('https://example.com/rss.xml', feedOptions), { code: 'SOURCE_FETCH_UNAVAILABLE' });
    assert.equal(mocked.requests.length, 1);
  }
});

test('document redirects resolve every destination and never connect to private destinations', async () => {
  const mocked = mockDocuments([
    { status: 302, headers: { location: 'https://redirect.example.com/rss.xml' } },
  ]); const hosts = [];
  const fetcher = new WebPageFetcher({ request: mocked.request, lookup: async host => {
    hosts.push(host); return host === 'example.com' ? [publicIp] : [{ address: '10.0.0.1', family: 4 }];
  } });
  await assert.rejects(fetcher.fetchDocument('https://example.com/rss.xml', feedOptions), { code: 'SOURCE_URL_BLOCKED' });
  assert.deepEqual(hosts, ['example.com', 'redirect.example.com']); assert.equal(mocked.requests.length, 1);
});

test('each fake-IP redirect destination receives a separate validated public resolution', async () => {
  const mocked = mockDocuments([
    goodDns(), { status: 302, headers: { location: 'https://redirect.example.com/rss.xml' } }, goodDns(), feed(),
  ]);
  const fetcher = new WebPageFetcher({ request: mocked.request, lookup: async () => fakeIps });
  const document = await fetcher.fetchDocument('https://example.com/rss.xml', feedOptions);
  assert.equal(document.url, 'https://redirect.example.com/rss.xml');
  assert.deepEqual([mocked.requests[0], mocked.requests[2]].map(req => req.url.searchParams.get('name')),
    ['example.com', 'redirect.example.com']);
  assertPinned(mocked.requests[1].options, publicIp); assertPinned(mocked.requests[3].options, publicIp);
});

test('caller MIME allowlist, identity encoding and bounded bytes apply to feed documents', async () => {
  for (const page of [
    { text: feed().text, headers: { 'content-type': 'text/html' } },
    { text: feed().text, headers: { 'content-type': 'text/xml', 'content-encoding': 'gzip' } },
    { chunks: [Buffer.alloc(101)], headers: { 'content-type': 'text/xml' } },
    { text: feed().text, headers: { 'content-type': 'text/xml', 'content-length': '101' } },
  ]) {
    const mocked = mockDocuments([page]);
    const fetcher = new WebPageFetcher({ request: mocked.request, lookup: async () => [publicIp] });
    await assert.rejects(fetcher.fetchDocument('https://example.com/rss.xml', { ...feedOptions, maxBytes: 100 }), { code: 'SOURCE_FETCH_UNAVAILABLE' });
  }
  const mocked = mockDocuments([feed()]);
  const fetcher = new WebPageFetcher({ request: mocked.request, lookup: async () => [publicIp] });
  await assert.rejects(fetcher.fetchDocument('https://example.com/rss.xml'), { code: 'SOURCE_FETCH_UNAVAILABLE' });
});

test('abort cancels pending public resolution before any document socket', async () => {
  const mocked = mockDocuments([]); const controller = new AbortController(); let resolveStarted;
  const started = new Promise(resolve => { resolveStarted = resolve; });
  const fetcher = new WebPageFetcher({ request: mocked.request, lookup: async () => fakeIps,
    publicLookup: () => { resolveStarted(); return new Promise(() => {}); },
  });
  const pending = fetcher.fetchDocument('https://example.com/rss.xml', { ...feedOptions, signal: controller.signal });
  await started; controller.abort();
  await assert.rejects(pending, { code: 'CANCELLED' }); assert.equal(mocked.requests.length, 0);
});

test('document timeout interrupts a pending DoH request and destroys its socket', async () => {
  const mocked = mockDocuments([{ hang: true }]);
  const fetcher = new WebPageFetcher({ request: mocked.request, lookup: async () => fakeIps });
  // Keep the test alive while production's intentionally unref'ed timers expire.
  const keepAlive = setInterval(() => {}, 100);
  try {
    await assert.rejects(fetcher.fetchDocument('https://example.com/rss.xml', { ...feedOptions, timeoutMs: 20 }), { code: 'SOURCE_FETCH_UNAVAILABLE' });
    assert.equal(mocked.requests.length, 1); assert.equal(mocked.requests[0].req.destroyed, true);
  } finally { clearInterval(keepAlive); }
});

test('DoH has its own three-second bound even with a longer document deadline', async () => {
  const mocked = mockDocuments([{ hang: true }]);
  const fetcher = new WebPageFetcher({ request: mocked.request, lookup: async () => fakeIps });
  const keepAlive = setInterval(() => {}, 100); const started = Date.now();
  try {
    await assert.rejects(fetcher.fetchDocument('https://example.com/rss.xml', { ...feedOptions, timeoutMs: 10000 }), { code: 'SOURCE_FETCH_UNAVAILABLE' });
    assert.ok(Date.now() - started < 5000);
    assert.equal(mocked.requests.length, 1); assert.equal(mocked.requests[0].req.destroyed, true);
  } finally { clearInterval(keepAlive); }
});

test('article extraction reuses safe document fetch without printing external CSS diagnostics', async () => {
  const html = '<html><head><title>Science report</title><style>@layer ignored { invalid {{ }}</style></head><body><article><h1>Science report</h1>' +
    '<p>Scientists describe measured experimental evidence and publish a detailed independent analysis of their results.</p>'.repeat(20) + '</article></body></html>';
  const mocked = mockDocuments([goodDns(), { text: html }]);
  const fetcher = new WebPageFetcher({ request: mocked.request, lookup: async () => fakeIps });
  const messages = []; const previous = console.error;
  console.error = (...args) => messages.push(args);
  try {
    const page = await fetcher.fetchPage('https://example.com/article', { textBytes: 1000 });
    assert.equal(page.title, 'Science report'); assert.ok(page.text.includes('Scientists')); assert.ok(Buffer.byteLength(page.text) <= 1000);
    assert.equal(messages.length, 0); assert.equal(mocked.requests.length, 2);
  } finally { console.error = previous; }
});
