import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { createRequire } from 'node:module';
import path from 'node:path';
import { loadCurrentUser } from '../src/lib/currentUser';
import { invalidateCommentCounters } from '../src/lib/commentCounters';
import { useEngagement } from '../src/hooks/useEngagement';
import api from '../src/lib/axios';

const identity = (id: string, profile = true) => ({ user: { id, name: id, email: '', uniqueId: id, isAdmin: false,
  avatar: { data: 'data:image/webp;base64,avatar', contentType: 'image/webp' },
  ...(profile ? { profile: { bio: id, location: '', website: '', interests: [] } } : {}) } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  Object.assign(globalThis, { localStorage: storage, sessionStorage: storage });
  const target = new EventTarget();
  Object.assign(target, { localStorage: storage, sessionStorage: storage });
  Object.assign(globalThis, { window: target });
});

test('both contexts share one pending identity read and do not retain completed results', async () => {
  localStorage.setItem('token', 'same-token');
  let calls = 0;
  let resolve: (response: Response) => void;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, '/api/auth/me');
    assert.equal((options.headers as Record<string, string>).Authorization, 'Bearer same-token');
    return await new Promise<Response>(done => { resolve = done; });
  };
  const first = loadCurrentUser('same-token');
  const second = loadCurrentUser('same-token');
  assert.equal(first, second);
  assert.equal(calls, 1);
  resolve(json(identity('member')));
  assert.deepEqual(await first, identity('member').user);
  await second;
  const refresh = loadCurrentUser('same-token');
  assert.equal(calls, 2);
  resolve(json(identity('member')));
  await refresh;
});

test('a stale unauthorized response cannot clear the newly signed-in account', async () => {
  localStorage.setItem('token', 'old-token');
  let release: (response: Response) => void;
  globalThis.fetch = async (_url, options) => (options.headers as Record<string, string>).Authorization === 'Bearer old-token'
    ? await new Promise<Response>(done => { release = done; }) : json(identity('new-member'));
  const old = loadCurrentUser('old-token');
  localStorage.setItem('token', 'new-token');
  const current = await loadCurrentUser('new-token');
  release(json({ error: 'expired' }, 401));
  await assert.rejects(old);
  assert.equal(localStorage.getItem('token'), 'new-token');
  assert.equal(current.id, 'new-member');
});

test('a current unauthorized response clears the session and a failed request can be retried', async () => {
  localStorage.setItem('token', 'expired-token');
  let changes = 0;
  window.addEventListener('auth:changed', () => { changes++; });
  globalThis.fetch = async () => json({ error: 'expired' }, 401);
  await assert.rejects(loadCurrentUser('expired-token'));
  assert.equal(localStorage.getItem('token'), null);
  assert.equal(changes, 1);
  localStorage.setItem('token', 'expired-token');
  globalThis.fetch = async () => json(identity('renewed'));
  assert.equal((await loadCurrentUser('expired-token')).id, 'renewed');
});

test('only an older backend without profile makes the compatibility read', async () => {
  localStorage.setItem('token', 'legacy-token');
  const calls: string[] = [];
  globalThis.fetch = async url => {
    calls.push(String(url));
    return url === '/api/auth/me' ? json(identity('legacy', false))
      : json({ success: true, user: identity('legacy').user });
  };
  const current = await loadCurrentUser('legacy-token');
  assert.equal(current.profile.bio, 'legacy');
  assert.deepEqual(calls, ['/api/auth/me', '/api/users/me']);
});

test('an unavailable legacy profile endpoint does not invalidate verified identity', async () => {
  localStorage.setItem('token', 'legacy-offline');
  globalThis.fetch = async url => {
    if (url === '/api/auth/me') return json(identity('legacy', false));
    throw new Error('profile offline');
  };
  assert.equal((await loadCurrentUser('legacy-offline')).id, 'legacy');
  assert.equal(localStorage.getItem('token'), 'legacy-offline');
});

test('comment changes invalidate only their matching stats and legacy count cache', () => {
  const client = new QueryClient();
  const matching = [['stats', 'News', 'one'], ['comment-count', 'news', 'one']];
  const other = [['stats', 'Resource', 'one'], ['stats', 'News', 'two'], ['comment-count', 'news', 'two']];
  for (const key of [...matching, ...other]) client.setQueryData(key, { totalComments: 3 });
  invalidateCommentCounters(client, 'news', 'one');
  for (const key of matching) assert.equal(client.getQueryState(key).isInvalidated, true);
  for (const key of other) assert.equal(client.getQueryState(key).isInvalidated, false);
  client.clear();
});

test('a pending like failure cannot make the earlier comment count fresh after a comment was added', async () => {
  // Bundled React's act() falls back to MessageChannel. Track its ports so
  // this DOM test releases them instead of keeping Node's test worker alive.
  const OriginalMessageChannel = globalThis.MessageChannel;
  const channels: MessageChannel[] = [];
  globalThis.MessageChannel = class extends OriginalMessageChannel {
    constructor() { super(); channels.push(this); }
  };
  const require = createRequire(path.resolve('uniclub-backend/package.json'));
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://classhub.test' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  // session.ts reads these globals; keep the authenticated session shared with
  // the jsdom window rather than the earlier storage test doubles.
  Object.assign(globalThis, { localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  localStorage.setItem('token', 'member-token');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const statsKey = ['stats', 'News', 'one'];
  const engagementKey = ['engagement', 'News', 'one'];
  const previous = { totalLikes: 2, totalSaves: 0, totalShares: 0, totalViews: 0, totalComments: 3 };
  const user = { liked: false, saved: false, shared: false, viewed: false };
  client.setQueryData(statsKey, previous);
  client.setQueryData(engagementKey, user);
  let hook: ReturnType<typeof useEngagement>;
  function Probe() { hook = useEngagement('News', 'one'); return null; }
  const originalPost = api.post;
  const originalGet = api.get;
  let rejectLike: (error: Error) => void;
  api.post = (() => new Promise((_resolve, reject) => { rejectLike = reject; })) as typeof api.post;
  let root = createRoot(document.getElementById('root'));
  const render = () => root.render(createElement(QueryClientProvider, { client }, createElement(Probe)));
  try {
    await act(async () => { render(); });
    let mutation: Promise<boolean | undefined>;
    await act(async () => {
      mutation = hook.toggleLike();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.equal(client.getQueryData<typeof previous>(statsKey).totalLikes, 3);
    await act(async () => { root.unmount(); });
    // Discussion pages do not observe card stats, so invalidation should remain
    // pending until the card remounts, even when the earlier like now fails.
    invalidateCommentCounters(client, 'news', 'one');
    rejectLike(new Error('like request failed'));
    await mutation;
    assert.equal(client.getQueryData<typeof previous>(statsKey).totalLikes, 2);
    assert.equal(client.getQueryData<typeof user>(engagementKey).liked, false);
    assert.equal(client.getQueryState(statsKey).isInvalidated, true);
    let reads = 0;
    api.get = (async () => { reads++; return { data: { stats: { ...previous, totalComments: 4 } } }; }) as typeof api.get;
    root = createRoot(document.getElementById('root'));
    await act(async () => { render(); await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.equal(reads, 1);
    assert.equal(client.getQueryData<typeof previous>(statsKey).totalComments, 4);
  } finally {
    await act(async () => { root.unmount(); });
    api.post = originalPost; api.get = originalGet;
    client.clear(); dom.window.close();
    for (const channel of channels) { channel.port1.close(); channel.port2.close(); }
    globalThis.MessageChannel = OriginalMessageChannel;
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  }
});
