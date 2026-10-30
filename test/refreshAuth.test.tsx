import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { UserProvider } from '../src/context/UserContext';
import { useAuth } from '../src/context/authContextState';
import { useUser } from '../src/context/userContextState';
import { ThemeContext } from '../src/context/themeContextState';
import SiteHeader from '../src/components/SiteHeader';
import { readAuthSnapshot } from '../src/lib/authIdentity';
import { loadCurrentUser } from '../src/lib/currentUser';

const require = createRequire(path.resolve('uniclub-backend/package.json'));
const { JSDOM } = require('jsdom');
const identity = { id: '507f1f77bcf86cd799439011', uniqueId: 'member-one', name: '测试成员', email: '',
  avatarUrl: '/api/users/avatar/507f1f77bcf86cd799439011?v=one',
  profile: { bio: '简介', location: '', website: '', interests: [] }, role: 'committee' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const wait = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
let rendered: ReturnType<typeof useAuth>[] = [];
let latestAuth: ReturnType<typeof useAuth>;
let latestUser: ReturnType<typeof useUser>;
function Probe() {
  latestAuth = useAuth(); latestUser = useUser();
  rendered.push(latestAuth);
  return <output>{latestAuth.status}:{latestUser.user.name}:{latestUser.user.profileImage}</output>;
}
function providers(children = <Probe/>) {
  return <AuthProvider><UserProvider>{children}</UserProvider></AuthProvider>;
}
function setup(cached: unknown = identity, token: string | null = 'test-token') {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:8081/', pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
    HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true });
  if (token) localStorage.setItem('token', token);
  if (cached) localStorage.setItem('authUser', JSON.stringify(cached));
  rendered = [];
  return dom;
}
async function mounted() {
  const root = createRoot(document.getElementById('root')!);
  await act(async () => { root.render(<StrictMode>{providers()}</StrictMode>); await wait(); });
  return root;
}
async function dispose(root: Root, dom: InstanceType<typeof JSDOM>) {
  await act(async () => { root.unmount(); }); dom.window.close();
}

test('cached identity is a member on first render, without trusting cached privileges', () => {
  const dom = setup({ ...identity, role: 'admin', isAdmin: true, permissions: ['system:manage'] });
  try {
    const markup = renderToStaticMarkup(providers());
    assert.match(markup, /member:测试成员/);
    assert.equal(latestAuth.loading, false);
    assert.equal(latestAuth.verified, false);
    assert.equal(latestAuth.user?.role, 'student');
    assert.deepEqual(latestAuth.user?.permissions, []);
    assert.equal(latestUser.user.profileImage, identity.avatarUrl);
  } finally { dom.window.close(); }
});

test('StrictMode uses one identity request, never clears the painted user, and adapts the profile from the same result', async () => {
  const dom = setup(); const calls: string[] = [];
  let release!: (value: Response) => void;
  globalThis.fetch = async url => { calls.push(String(url)); return new Promise(resolve => { release = resolve; }); };
  const root = await mounted();
  try {
    assert.equal(latestAuth.loading, false); assert.equal(latestAuth.verifying, true);
    assert.ok(rendered.every(snapshot => snapshot.user?.name === identity.name));
    assert.deepEqual(calls, ['/api/auth/me']);
    await act(async () => { release(json({ user: identity })); await wait(); });
    assert.equal(latestAuth.verified, true); assert.equal(latestAuth.verifying, false);
    assert.equal(latestUser.user.profile.bio, '简介');
    assert.equal(latestUser.user.role, 'committee');
    assert.equal(JSON.parse(localStorage.getItem('authUser')!).avatarUrl, identity.avatarUrl);
    assert.deepEqual(calls, ['/api/auth/me']);
  } finally { await dispose(root, dom); }
});

test('transport failure retries once and preserves cached identity and token', async () => {
  const dom = setup(); let calls = 0;
  globalThis.fetch = async () => { calls++; throw new TypeError('offline'); };
  const root = await mounted();
  try {
    assert.equal(calls, 2); assert.equal(latestAuth.status, 'member');
    assert.equal(latestAuth.loading, false); assert.equal(latestAuth.verifying, false);
    assert.equal(latestAuth.user?.name, identity.name);
    assert.equal(localStorage.getItem('token'), 'test-token');
    assert.ok(latestAuth.error);
  } finally { await dispose(root, dom); }
});

test('HTTP 500 preserves identity while an explicit 401 clears the whole session', async () => {
  const dom = setup(); globalThis.fetch = async () => json({}, 500);
  const root = await mounted();
  try {
    assert.equal(latestAuth.status, 'member');
    assert.equal(localStorage.getItem('token'), 'test-token');
    globalThis.fetch = async () => json({ error: 'expired' }, 401);
    await act(async () => { window.dispatchEvent(new Event('auth:changed')); await wait(); });
    assert.equal(latestAuth.status, 'guest'); assert.equal(latestAuth.user, null);
    assert.equal(latestUser.isAuthenticated, false);
    assert.equal(localStorage.getItem('token'), null);
    assert.equal(localStorage.getItem('authUser'), null);
  } finally { await dispose(root, dom); }
});

test('guests render directly and make no identity request; damaged display cache retains token and checking state', async () => {
  const dom = setup(null, null); let calls = 0;
  globalThis.fetch = async () => { calls++; return json({}); };
  const root = await mounted();
  try {
    assert.equal(latestAuth.status, 'guest'); assert.equal(latestAuth.loading, false);
    assert.equal(calls, 0);
    localStorage.setItem('token', 'valid-token'); localStorage.setItem('authUser', '{broken');
    const snapshot = readAuthSnapshot();
    assert.equal(snapshot.user, null); assert.equal(snapshot.token, 'valid-token');
  } finally { await dispose(root, dom); }
});

test('checking header reserves account controls without a login link', () => {
  const dom = setup(null);
  try {
    const markup = renderToStaticMarkup(providers(<ThemeContext.Provider value={{ isDarkMode: false, toggleDarkMode: () => {} }}>
      <MemoryRouter><SiteHeader isAuthenticated={false} checking name="" onProfile={() => {}} onSearch={() => {}}/></MemoryRouter>
    </ThemeContext.Provider>));
    assert.match(markup, /data-auth-placeholder/);
    assert.doesNotMatch(markup, /成员登录|>登录<|href="\/auth"/);
  } finally { dom.window.close(); }
});

test('a profile save wins over an identity check that began before the save', async () => {
  const dom = setup(); globalThis.fetch = async () => json({ user: identity });
  const root = await mounted();
  try {
    let release!: (value: Response) => void;
    globalThis.fetch = async () => new Promise(resolve => { release = resolve; });
    await act(async () => { window.dispatchEvent(new Event('auth:changed')); await wait(); });
    await act(async () => { await latestUser.updateProfileImage('data:image/webp;base64,new-upload'); });
    await act(async () => { release(json({ user: identity })); await wait(); });
    assert.equal(latestUser.user.profileImage, 'data:image/webp;base64,new-upload');
    assert.equal(JSON.parse(localStorage.getItem('authUser')!).avatar.data, 'data:image/webp;base64,new-upload');
  } finally { await dispose(root, dom); }
});

test('profileless identity responses use defaults without a second /users/me read', async () => {
  const dom = setup(); const calls: string[] = [];
  globalThis.fetch = async url => { calls.push(String(url)); return json({ user: { ...identity, profile: undefined } }); };
  try {
    const user = await loadCurrentUser('test-token');
    assert.deepEqual(user.profile, { bio: '', location: '', website: '', interests: [] });
    assert.deepEqual(calls, ['/api/auth/me']);
  } finally { dom.window.close(); }
});


test('a stalled identity response body times out, retries once, and retains cached identity', async () => {
  const dom = setup(); let calls = 0;
  const schedule = globalThis.setTimeout;
  globalThis.setTimeout = ((callback, delay, ...args) => schedule(callback, delay === 10000 ? 1 : delay, ...args)) as typeof setTimeout;
  globalThis.fetch = (async (_url, options) => {
    calls++;
    return { ok: true, json: () => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(new Error('response body timed out')), { once: true });
    }) } as Response;
  }) as typeof fetch;
  let root: Root | undefined;
  try {
    root = await mounted();
    await act(async () => { await wait(15); });
    assert.equal(calls, 2); assert.equal(latestAuth.status, 'member');
    assert.equal(latestAuth.verifying, false); assert.equal(localStorage.getItem('token'), 'test-token');
  } finally {
    globalThis.setTimeout = schedule;
    if (root) await dispose(root, dom); else dom.window.close();
  }
});
