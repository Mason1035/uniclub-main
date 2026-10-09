import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Match the repository's existing isolated TypeScript test convention. Stub
// only the API/session imports; all SSE parsing and requests run as written.
const streamSource = await readFile(new URL('../src/lib/aiStream.ts', import.meta.url), 'utf8');
const streamModule = ts.transpileModule(`
  const api = { defaults: { baseURL: 'https://classhub.test/' } };
  const readToken = () => 'fixture-token';
  const clearSession = () => {};
  ${streamSource.replace(/^import .*;\n/gm, '')}
`, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { AiRequestError, readAiStream, postAiStream } = await import(`data:text/javascript;base64,${Buffer.from(streamModule).toString('base64')}`);
const newsSource = await readFile(new URL('../src/lib/newsChat.ts', import.meta.url), 'utf8');
const newsModule = ts.transpileModule(`
  class AiRequestError extends Error { constructor(message, code) { super(message); this.code = code; } }
  let historyFixture = null;
  export const setHistoryFixture = value => { historyFixture = value; };
  const api = { get: async () => ({ data: historyFixture }) };
  ${newsSource.replace(/^import .*;\n/gm, '')}
`, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { safeNewsSources, getNewsChat, setHistoryFixture } = await import(`data:text/javascript;base64,${Buffer.from(newsModule).toString('base64')}`);
const answerSource = await readFile(new URL('../src/components/AiAnswer.tsx', import.meta.url), 'utf8');
const answerModule = ts.transpileModule(answerSource, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  .replace(/^import ['"].*\.css['"];\n/gm, '')
  .replace(/(['"])(react-markdown|react\/jsx-runtime)\1/g, (_, _quote, dependency) => JSON.stringify(import.meta.resolve(dependency)));
const { default: AiAnswer } = await import(`data:text/javascript;base64,${Buffer.from(answerModule).toString('base64')}`);

function responseFrom(parts, onCancel = () => {}) {
  return new Response(new ReadableStream({
    start(controller) { parts.forEach(part => controller.enqueue(part)); controller.close(); },
    cancel: onCancel,
  }), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
}
const frame = (event, data, ending = '\n') => `event: ${event}${ending}data: ${JSON.stringify(data)}${ending}${ending}`;
const options = extra => ({ signal: new AbortController().signal, onDelta() {}, ...extra });

test('SSE decodes split Chinese UTF-8, CRLF and successive status/delta/result events', async () => {
  const bytes = new TextEncoder().encode(`: keepalive\r\n\r\n${frame('status', { phase: 'searching', message: '查找资料' }, '\r\n')}${frame('delta', { text: '新闻你好' }, '\r\n')}${frame('result', { answer: '新闻你好' }, '\r\n')}`);
  const deltas = [], statuses = [];
  const result = await readAiStream(responseFrom(Array.from(bytes, byte => new Uint8Array([byte]))), options({ onDelta: text => deltas.push(text), onStatus: status => statuses.push(status) }));
  assert.deepEqual(deltas, ['新闻你好']);
  assert.deepEqual(statuses, [{ phase: 'searching', message: '查找资料' }]);
  assert.equal(result.answer, '新闻你好');
});

test('SSE requires a completed result and translates interrupted streams', async () => {
  const encoder = new TextEncoder();
  await assert.rejects(readAiStream(responseFrom([encoder.encode(frame('delta', { text: '尚未完成' }))]), options()), error => error instanceof AiRequestError && error.code === 'INCOMPLETE_STREAM');
  const broken = new Response(new ReadableStream({ start(controller) { controller.error(new Error('socket disconnected')); } }), { headers: { 'Content-Type': 'text/event-stream' } });
  await assert.rejects(readAiStream(broken, options()), error => error.code === 'NETWORK_ERROR' && !error.message.includes('socket'));
});

test('SSE reports provider/rate errors without exposing technical messages', async () => {
  const encoder = new TextEncoder();
  await assert.rejects(readAiStream(responseFrom([encoder.encode(frame('error', { code: 'RATE_LIMIT', error: '提问太频繁，请稍后重试。' }))]), options()), error => error.code === 'RATE_LIMIT' && error.message.includes('太频繁'));
  await assert.rejects(readAiStream(responseFrom([encoder.encode(frame('error', { code: 'PROVIDER_ERROR', error: 'Error stack at /private/server.js:123' }))]), options()), error => error.code === 'PROVIDER_ERROR' && !error.message.includes('/private'));
  await assert.rejects(readAiStream(responseFrom([encoder.encode('event: delta\ndata: invalid JSON\n\n')]), options()), error => error.code === 'INVALID_RESPONSE');
});

test('SSE rejects invalid results and oversized output', async () => {
  const encoder = new TextEncoder();
  await assert.rejects(readAiStream(responseFrom([encoder.encode(frame('result', { bad: true }))]), options({ validateResult: value => typeof value.answer === 'string' })), error => error.code === 'INVALID_RESPONSE');
  await assert.rejects(readAiStream(responseFrom([encoder.encode(frame('delta', { text: 'x'.repeat(1024 * 1024 + 1) }))]), options()), error => error.code === 'OUTPUT_TOO_LONG');
});

test('SSE cancels a blocked reader when its caller aborts', async () => {
  const controller = new AbortController(); let cancelled = false;
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/event-stream' } });
  const pending = readAiStream(response, options({ signal: controller.signal }));
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.equal(cancelled, true);
});

test('shared request keeps JWT/API origin, supports JSON and leaves multipart boundaries to fetch', async () => {
  const originalFetch = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return responseFrom([new TextEncoder().encode(frame('result', { answer: '完成' }))]); };
  try {
    await postAiStream('/api/chat/article-id', JSON.stringify({ content: '这篇新闻主要讲了什么？' }), options(), { 'Content-Type': 'application/json' });
    await postAiStream('/api/admin/ai/generate', new FormData(), options());
    assert.equal(calls[0].url, 'https://classhub.test/api/chat/article-id');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer fixture-token');
    assert.equal(calls[0].init.headers.Accept, 'text/event-stream');
    assert.deepEqual(JSON.parse(calls[0].init.body), { content: '这篇新闻主要讲了什么？' });
    assert.equal(calls[1].init.headers['Content-Type'], undefined);
  } finally { globalThis.fetch = originalFetch; }
});

test('HTTP failures stay friendly, including empty proxy bodies and null JSON', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('null', { status: 503 });
    await assert.rejects(postAiStream('/api/chat/id', '{}', options()), error => error.code === 'HTTP_ERROR' && error.message.includes('稍后'));
    globalThis.fetch = async () => new Response('', { status: 429 });
    await assert.rejects(postAiStream('/api/chat/id', '{}', options()), error => error.message.includes('太频繁'));
    globalThis.fetch = async () => new Response('{}', { status: 403 });
    await assert.rejects(postAiStream('/api/chat/id', '{}', options()), error => !error.message.includes('管理员权限'));
  } finally { globalThis.fetch = originalFetch; }
});

test('citations accept only actual server metadata with HTTP(S) URLs and a bounded count', () => {
  assert.deepEqual(safeNewsSources([{ title: '政府官网', url: 'https://example.gov/latest' }, { title: '恶意页面', url: 'javascript:alert(1)' }, { title: '内联内容', url: 'data:text/html,test' }, { title: '未检索', url: 'invented' }]), [{ title: '政府官网', url: 'https://example.gov/latest' }]);
  assert.deepEqual(safeNewsSources(null), []);
  assert.equal(safeNewsSources(Array.from({ length: 30 }, () => ({ title: '资料', url: 'https://example.com' }))).length, 4);
  assert.deepEqual(safeNewsSources([{ title: '用户名', url: 'https://reader@example.com/page' }, { title: '密码', url: 'https://reader:secret@example.com/page' }, { title: '只有密码', url: 'https://:secret@example.com/page' }]), []);
});

test('null and malformed history responses use a friendly error instead of a TypeError', async () => {
  const signal = new AbortController().signal;
  for (const value of [null, undefined, {}, { messages: null }]) {
    setHistoryFixture(value);
    await assert.rejects(getNewsChat('article-id', signal), error => error.code === 'INVALID_RESPONSE' && error.message.includes('聊天记录格式异常'));
  }
  setHistoryFixture([]);
  assert.deepEqual(await getNewsChat('article-id', signal), []);
});

test('news Markdown enables only retrieved citation URLs and preserves unverified link labels', () => {
  const text = '[实际资料](https://example.gov/latest) [虚构资料](https://invented.example/page) [带凭据](https://reader:secret@example.gov/latest)';
  const rendered = renderToStaticMarkup(createElement(AiAnswer, { text, allowedLinks: ['https://example.gov/latest'] }));
  assert.match(rendered, /href="https:\/\/example.gov\/latest"/);
  assert.doesNotMatch(rendered, /href="https:\/\/invented/);
  assert.doesNotMatch(rendered, /href="https:\/\/reader/);
  assert.match(rendered, /<span>虚构资料<\/span>/);
  assert.match(rendered, /<span>带凭据<\/span>/);
  const live = renderToStaticMarkup(createElement(AiAnswer, { text, allowedLinks: [] }));
  assert.doesNotMatch(live, /<a\b/);
  const admin = renderToStaticMarkup(createElement(AiAnswer, { text: '[管理员链接](https://example.com)' }));
  assert.match(admin, /href="https:\/\/example.com"/);
});
