import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ClassHubPetConfigStore, PET_DEFAULTS, NOTIFICATION_DEFAULTS } from '../src/features/pet/pet-config';
import { readPetPosition, savePetPosition, clearPetPosition } from '../src/features/pet/pet-storage';
import { stepFall, releaseVelocity } from '../src/features/pet/pet-physics';
import { PET_SKINS } from '../src/features/pet/pet-skins';
import definition from '../shared/pet-settings.json';
import { createPetAudio } from '../src/features/pet/pet-audio';
import { browserNotificationState, enableBrowserNotifications } from '../src/features/settings/browser-notifications';
import { CONSENT_STORAGE_KEY, getConsent, hasConsent, saveConsent, subscribeConsent } from '../src/lib/privacy/consent';

const pause = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
let records: Map<string, string>, requests: { method: string; token: string; body: object }[], saved: Record<string, Record<string, unknown>>;
let stop: (() => void) | undefined;
const originalFetch = globalThis.fetch;
const windowEvents = new EventTarget();
Object.assign(globalThis, { window: windowEvents });
beforeEach(() => {
  records = new Map(); requests = []; saved = {};
  const storage = {
    get length() { return records.size; },
    key: (index: number) => [...records.keys()][index] ?? null,
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => records.set(key, value),
    removeItem: (key: string) => records.delete(key),
  };
  Object.assign(globalThis, { localStorage: storage });
  Object.assign(windowEvents, { localStorage: storage, sessionStorage: { length: 0, key: () => null, removeItem: () => {} } });
  // A storage event resets the real consent store to this fresh browser state.
  const unsubscribe = subscribeConsent(() => {});
  windowEvents.dispatchEvent(Object.assign(new Event('storage'), { key: null }));
  unsubscribe();
  globalThis.fetch = async (_path, options = {}) => {
    const token = (options.headers as Record<string, string>).Authorization;
    const body = options.body ? JSON.parse(options.body as string) : {};
    requests.push({ method: options.method ?? 'GET', token, body });
    saved[token] = { ...PET_DEFAULTS, ...saved[token], ...body, notifications: { ...NOTIFICATION_DEFAULTS, ...(saved[token]?.notifications as object), ...body.notifications } };
    return Response.json({ success: true, settings: saved[token], profile: { name: '测试用户', uniqueId: 'TEST', displayName: null, bio: '', avatarUrl: null }, security: { email: null, emailVerified: false, lastLoginAt: null } });
  };
});
afterEach(() => { stop?.(); stop = undefined; globalThis.fetch = originalFetch; });
async function start(id = 'a', token = 'token-a') {
  const store = new ClassHubPetConfigStore(id, token);
  stop = store.start(); await pause(); return store;
}
test('consent rejects old versions and malformed records without granting optional storage', () => {
  records.set('token', 'keep-login');
  for (const record of [
    { version: 0, necessary: true, preferences: true, statistics: true, updatedAt: new Date().toISOString() },
    { version: 1, necessary: true, preferences: 'yes', statistics: true, updatedAt: new Date().toISOString() },
  ]) {
    records.set(CONSENT_STORAGE_KEY, JSON.stringify(record));
    const unsubscribe = subscribeConsent(() => {});
    windowEvents.dispatchEvent(Object.assign(new Event('storage'), { key: CONSENT_STORAGE_KEY }));
    unsubscribe();
    assert.equal(getConsent(), null);
    assert.equal(hasConsent('preferences'), false);
    assert.equal(hasConsent('statistics'), false);
    assert.equal(records.get('token'), 'keep-login');
  }
});
test('consent survives unavailable localStorage and cookies with a session-only choice', () => {
  const storage = globalThis.localStorage;
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  try {
    Object.assign(globalThis, { localStorage: {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
    } });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { set cookie(_value: string) { throw new Error('blocked'); } } });
    assert.equal(saveConsent({ preferences: true, statistics: false }), false);
    assert.equal(hasConsent('preferences'), true);
    assert.equal(hasConsent('statistics'), false);
    assert.equal(saveConsent({ preferences: false, statistics: false }), false);
    assert.equal(hasConsent('preferences'), false);
  } finally {
    Object.assign(globalThis, { localStorage: storage });
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
test('consent withdrawal cannot restore a stale grant after a quota write failure', () => {
  assert.equal(saveConsent({ preferences: true, statistics: true }), true);
  const storage = globalThis.localStorage;
  const originalSetItem = storage.setItem;
  try {
    storage.setItem = () => { throw new Error('quota exceeded'); };
    assert.equal(saveConsent({ preferences: false, statistics: false }), false);
    assert.equal(records.has(CONSENT_STORAGE_KEY), false);
    const unsubscribe = subscribeConsent(() => {});
    windowEvents.dispatchEvent(Object.assign(new Event('storage'), { key: CONSENT_STORAGE_KEY }));
    unsubscribe();
    assert.equal(hasConsent('preferences'), false);
    assert.equal(hasConsent('statistics'), false);
  } finally { storage.setItem = originalSetItem; }
});
test('load is shared and 60 slider updates produce one debounced write', async () => {
  const store = await start();
  let updates = 0; const unsubscribe = store.subscribe(() => updates++);
  for (let value = 121; value <= 180; value++) store.update({ petSize: value });
  assert.equal(store.getSnapshot().config.petSize, 180);
  assert.equal(requests.filter(request => request.method === 'PATCH').length, 0);
  await pause(680);
  assert.equal(requests.filter(request => request.method === 'GET').length, 1);
  assert.equal(requests.filter(request => request.method === 'PATCH').length, 1);
  assert.equal(saved['Bearer token-a'].petSize, 180);
  assert.equal(store.getSnapshot().status, 'ready');
  unsubscribe(); assert.ok(updates >= 60);
});
test('a slow save cannot overwrite newer edits; pending writes are serialized', async () => {
  const store = await start();
  let release!: () => void;
  const baseFetch = globalThis.fetch;
  globalThis.fetch = async (path, options) => {
    await new Promise<void>(resolve => { release = resolve; });
    return baseFetch(path, options);
  };
  store.update({ petSize: 150 }); const first = store.flush();
  store.update({ petSize: 180, petMuted: true });
  assert.equal(store.flush(), first);
  release(); await first;
  assert.equal(store.getSnapshot().config.petSize, 180);
  assert.equal(store.getSnapshot().config.petMuted, true);
  globalThis.fetch = baseFetch; await store.flush();
  assert.equal(saved['Bearer token-a'].petSize, 180);
  assert.equal(saved['Bearer token-a'].petMuted, true);
  assert.equal(requests.filter(request => request.method === 'PATCH').length, 2);
});
test('failed saves keep local edits and retry saves them to the account', async () => {
  const store = await start(); const baseFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  store.update({ petSkin: 'whale' }); await store.flush();
  assert.equal(store.getSnapshot().config.petSkin, 'whale');
  assert.equal(store.getSnapshot().status, 'error');
  globalThis.fetch = baseFetch; store.retry(); await pause();
  assert.equal(saved['Bearer token-a'].petSkin, 'whale');
  assert.equal(store.getSnapshot().status, 'ready');
});
test('all bundled skins match the shared whitelist and survive account save/reload', async () => {
  assert.deepEqual(PET_SKINS.map(skin => skin.id), definition.skins);
  const store = await start();
  for (const skin of PET_SKINS) {
    store.update({ petSkin: skin.id }); await store.flush();
    assert.equal(store.getSnapshot().config.petSkin, skin.id);
    const restored = new ClassHubPetConfigStore('a', 'token-a');
    const dispose = restored.start(); await pause();
    assert.equal(restored.getSnapshot().config.petSkin, skin.id);
    dispose();
  }
});
test('sample audio obeys live volume/mute and releases replaced or failed playback', async () => {
  const previousAudio = globalThis.Audio;
  const clips: SampleAudio[] = [];
  let rejectOld!: (reason?: unknown) => void;
  class SampleAudio {
    volume = 1; paused = false; released = false;
    onended: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor(public src: string) { clips.push(this); }
    play() { return clips.length === 1 ? new Promise<void>((_resolve, reject) => { rejectOld = reject; }) : Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute() { this.src = ''; }
    load() { this.released = true; }
  }
  Object.assign(globalThis, { Audio: SampleAudio });
  const audio = createPetAudio();
  const skin = PET_SKINS.find(skin => skin.id === 'xiaonailong')!;
  try {
    audio.sync({ ...PET_DEFAULTS, petVolume: 60 });
    assert.equal(audio.play(skin), 2750); assert.equal(clips[0].volume, .6);
    audio.play(skin); assert.equal(clips[0].released, true);
    rejectOld(new Error('old play rejected')); await pause();
    assert.equal(clips[1].released, false);
    audio.sync({ ...PET_DEFAULTS, petVolume: 25 }); assert.equal(clips[1].volume, .25);
    audio.sync({ ...PET_DEFAULTS, petMuted: true });
    assert.equal(clips[1].paused, true); assert.equal(clips[1].released, true);
    assert.equal(clips[1].onended, null); assert.equal(audio.play(skin), 0);
    audio.sync(PET_DEFAULTS); audio.play(skin); clips[2].onerror!();
    assert.equal(clips[2].released, true);
    audio.play(skin); audio.destroy(); assert.equal(clips[3].released, true);
    assert.equal(audio.play(skin), 0);
  } finally { audio.destroy(); Object.assign(globalThis, { Audio: previousAudio }); }
});
test('failed initial reads never mount a pet; retry can recover', async () => {
  const baseFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: 'offline' }, { status: 503 });
  const store = await start();
  assert.equal(store.getSnapshot().available, false);
  assert.equal(store.getSnapshot().status, 'error');
  globalThis.fetch = baseFetch; store.retry(); await pause();
  assert.equal(store.getSnapshot().available, true);
});
test('logout flush uses the old credential and account B stays isolated', async () => {
  const a = await start(); a.update({ petHue: 123 }); stop!(); stop = undefined;
  const b = await start('b', 'token-b'); await pause();
  assert.equal(saved['Bearer token-a'].petHue, 123);
  assert.equal(b.getSnapshot().config.petHue, 0);
  b.update({ petMuted: true }); await b.flush();
  assert.equal(saved['Bearer token-a'].petMuted, false);
  assert.equal(saved['Bearer token-b'].petMuted, true);
});
test('disposing during an in-flight save releases timers and sends the old account tail', async () => {
  const a = await start(); const baseFetch = globalThis.fetch;
  let release!: () => void;
  globalThis.fetch = async (path, options) => {
    await new Promise<void>(resolve => { release = resolve; }); return baseFetch(path, options);
  };
  a.update({ petHue: 200 }); const inFlight = a.flush();
  a.update({ petSize: 170 }); stop!(); stop = undefined;
  globalThis.fetch = baseFetch; release(); await inFlight; await pause();
  assert.equal(saved['Bearer token-a'].petHue, 200);
  assert.equal(saved['Bearer token-a'].petSize, 170);
  assert.equal(requests.filter(request => request.method === 'PATCH').length, 2);
});
test('position storage is per user and storage denial is harmless', () => {
  saveConsent({ preferences: true, statistics: false });
  const position = { x: 500, viewportWidth: 1200, facing: -1 as const };
  savePetPosition('a', position);
  assert.deepEqual(readPetPosition('a'), position);
  assert.equal(readPetPosition('b'), null);
  assert.ok(records.has('classhub:pet-position:a'));
  clearPetPosition('a'); assert.equal(readPetPosition('a'), null);
  records.set('classhub:pet-position:a', '{bad'); assert.equal(readPetPosition('a'), null);
  Object.assign(globalThis, { localStorage: {
    getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); },
  }});
  assert.doesNotThrow(() => savePetPosition('a', position));
  assert.doesNotThrow(() => clearPetPosition('a'));
  assert.equal(readPetPosition('a'), null);
});
test('pet positions require live preferences consent and withdrawal preserves authentication', () => {
  const position = { x: 500, viewportWidth: 1200, facing: -1 as const };
  assert.equal(getConsent(), null);
  records.set('token', 'existing-account-session');
  records.set('classhub:pet-position:a', JSON.stringify(position));
  assert.equal(readPetPosition('a'), null);
  savePetPosition('b', position);
  assert.equal(records.has('classhub:pet-position:b'), false);

  saveConsent({ preferences: true, statistics: false });
  assert.deepEqual(readPetPosition('a'), position);
  savePetPosition('b', position);
  assert.deepEqual(readPetPosition('b'), position);

  saveConsent({ preferences: false, statistics: false });
  assert.equal(records.has('classhub:pet-position:a'), false);
  assert.equal(records.has('classhub:pet-position:b'), false);
  assert.equal(records.get('token'), 'existing-account-session');
  savePetPosition('a', position);
  assert.equal(readPetPosition('a'), null);
  assert.equal(records.has('classhub:pet-position:a'), false);
});
test('a released pet settles within the screen and stale pointer samples impart no velocity', () => {
  let state = { x: 95, liftY: -250, vx: 1.2, vy: 0 };
  for (let frame = 0; frame < 90 && state.liftY < 0; frame++) {
    state = stepFall(state, 16, 20, 100);
    assert.ok(state.x >= 20 && state.x <= 100);
    assert.ok(state.liftY <= 0);
  }
  assert.equal(state.liftY, 0);
  assert.equal(releaseVelocity([{ x: 10, t: 0 }, { x: 100, t: 10 }], 500), 0);
  assert.equal(releaseVelocity([{ x: 0, t: 0 }, { x: 1000, t: 10 }], 10), 1.2);
});


test('notification switches and pet sliders share a read and preserve nested in-flight edits', async () => {
  const store = await start(); const baseFetch = globalThis.fetch;
  assert.deepEqual(store.getSnapshot().notifications, NOTIFICATION_DEFAULTS);
  assert.equal(store.getSnapshot().account?.profile.name, '测试用户');
  let release!: () => void;
  globalThis.fetch = async (path, options) => { await new Promise<void>(resolve => { release = resolve; }); return baseFetch(path, options); };
  store.updateNotifications({ news: true }); const first = store.flush();
  store.updateNotifications({ fees: false }); store.update({ petHue: 123 });
  release(); await first;
  assert.equal(store.getSnapshot().notifications.news, true);
  assert.equal(store.getSnapshot().notifications.fees, false);
  assert.equal(store.getSnapshot().config.petHue, 123);
  globalThis.fetch = baseFetch; await store.flushAll();
  assert.equal((saved['Bearer token-a'].notifications as typeof NOTIFICATION_DEFAULTS).news, true);
  assert.equal((saved['Bearer token-a'].notifications as typeof NOTIFICATION_DEFAULTS).fees, false);
  assert.equal(requests.filter(r => r.method === 'GET').length, 1);
});
test('preference replies cannot revert newer profile/email saves; reset touches pet fields only', async () => {
  const store = await start();
  store.setProfile({ name: '测试用户', uniqueId: 'TEST', displayName: '昵称', bio: '简介', avatarUrl: null });
  store.setSecurity({ email: 'me@example.test', emailVerified: false, lastLoginAt: null });
  store.updateNotifications({ activities: false }); await store.flushAll();
  store.update({ petHue: 200, petSkin: 'whale', petInteractive: false, petActivity: 'active' }); await store.flushAll();
  store.reset(); await store.flushAll();
  assert.deepEqual(store.getSnapshot().config, PET_DEFAULTS);
  assert.equal(store.getSnapshot().notifications.activities, false);
  assert.equal(store.getSnapshot().account?.profile.displayName, '昵称');
  assert.equal(store.getSnapshot().account?.security.email, 'me@example.test');
});
test('a failed preference save blocks password preflight until its retry succeeds', async () => {
  const store = await start(); const baseFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  store.updateNotifications({ browser: true }); await store.flush();
  await assert.rejects(store.flushAll(), /重试保存/);
  assert.equal(store.getSnapshot().notifications.browser, true);
  globalThis.fetch = baseFetch; store.retry(); await pause(); await store.flushAll();
  assert.equal(store.getSnapshot().status, 'ready');
  stop!(); stop = undefined; await assert.rejects(store.flushAll(), /账号已变化/);
});
test('notification permission is requested only on an explicit enable and handles every browser state', async () => {
  const win = window as Window & typeof globalThis;
  const previousNotification = globalThis.Notification;
  let requested = 0; let permission: NotificationPermission = 'default';
  Object.assign(globalThis, { Notification: { get permission() { return permission; }, requestPermission: async () => { requested++; permission = 'granted'; return permission; } } });
  Object.assign(win, { Notification: globalThis.Notification, isSecureContext: true });
  try {
    assert.equal(browserNotificationState(), 'default'); assert.equal(requested, 0);
    assert.equal(await enableBrowserNotifications(), 'granted'); assert.equal(requested, 1);
    assert.equal(await enableBrowserNotifications(), 'granted'); assert.equal(requested, 1);
    permission = 'denied'; assert.equal(await enableBrowserNotifications(), 'denied'); assert.equal(requested, 1);
    Object.assign(win, { isSecureContext: false }); assert.equal(await enableBrowserNotifications(), 'unsupported');
    Object.assign(win, { isSecureContext: true });
    Object.assign(globalThis.Notification, { requestPermission: async () => { requested++; return 'default'; } }); permission = 'default';
    assert.equal(await enableBrowserNotifications(), 'default');
    Object.assign(globalThis.Notification, { requestPermission: async () => { throw new Error('blocked'); } });
    assert.equal(await enableBrowserNotifications(), 'default');
  } finally { Object.assign(globalThis, { Notification: previousNotification }); delete (win as unknown as { Notification?: unknown }).Notification; Object.assign(win, { isSecureContext: false }); }
});
