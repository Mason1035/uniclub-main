/** Observable configuration adapted from dsh-niulai-pet/config.ts.
 * Copyright (c) 2026 whitefirer. MIT License; see public/pet-assets/LICENSE.
 * The existing store also owns the account-center snapshot and notification preferences.
 */
import definition from '../../../shared/pet-settings.json';
import accountDefinition from '../../../shared/account-settings.json';
import { getSettingsBundle, savePetSettings, type SettingsPatch } from './pet-api';
import type { PetConfig, PetSnapshot } from './types';
import type { AccountProfile, AccountSecurity, NotificationPreferences } from '../settings/types';
export const PET_DEFAULTS: Readonly<PetConfig> = Object.freeze(definition.defaults as PetConfig);
export const PET_ACTIONS = definition.actions as PetConfig['petPokeAction'][];
export const NOTIFICATION_DEFAULTS: Readonly<NotificationPreferences> = Object.freeze(accountDefinition.notifications);
export function normalizeNotifications(value: unknown): NotificationPreferences {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(NOTIFICATION_DEFAULTS).map(([key, fallback]) => [key, typeof input[key] === 'boolean' ? input[key] : fallback])) as unknown as NotificationPreferences;
}
export function normalizePetConfig(value: unknown): PetConfig {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result = { ...PET_DEFAULTS };
  for (const key of Object.keys(PET_DEFAULTS) as (keyof PetConfig)[]) {
    const next = input[key]; if (typeof next !== typeof PET_DEFAULTS[key]) continue;
    if (typeof next === 'number') {
      const range = definition.ranges[key as keyof typeof definition.ranges];
      if (!Number.isFinite(next) || !range) continue;
      const bounded = Math.max(range[0], Math.min(range[1], next));
      Object.assign(result, { [key]: key === 'petOpacity' ? bounded : Math.round(bounded) });
    } else if (key === 'petSkin') {
      if (definition.skins.includes(next as string)) result.petSkin = next as string;
    } else if (key === 'petPokeAction' || key === 'petCelebrateAction') {
      if (definition.actions.includes(next as string)) result[key] = next as PetConfig['petPokeAction'];
    } else if (key === 'petActivity') {
      if (definition.activities.includes(next as string)) result.petActivity = next as PetConfig['petActivity'];
    } else Object.assign(result, { [key]: next });
  }
  return result;
}
const mergePatch = (first: SettingsPatch, second: SettingsPatch): SettingsPatch => ({ ...first, ...second,
  ...(first.notifications || second.notifications ? { notifications: { ...first.notifications, ...second.notifications } } : {}) });

/** One store per authenticated session; all preferences share reads and serialized writes.
 * Captured credentials prevent an old account's queued save from touching a new account.
 */
export class ClassHubPetConfigStore {
  private snapshot: PetSnapshot = { config: { ...PET_DEFAULTS }, notifications: { ...NOTIFICATION_DEFAULTS }, account: null, available: false, status: 'loading', error: null };
  private readonly listeners = new Set<() => void>();
  private pending: SettingsPatch = {};
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readController: AbortController | undefined;
  private inFlight: Promise<void> | undefined;
  private generation = 0;
  private connected = false;
  constructor(readonly userId: string, private readonly token: string) {}
  getSnapshot = (): PetSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<PetSnapshot>): void { this.snapshot = { ...this.snapshot, ...patch }; for (const listener of this.listeners) listener(); }
  start = (): (() => void) => {
    this.connected = true; void this.load();
    const onPageHide = () => { void this.flush(); }; window.addEventListener('pagehide', onPageHide);
    return () => {
      this.connected = false; this.generation++; this.readController?.abort(); clearTimeout(this.timer);
      window.removeEventListener('pagehide', onPageHide);
      const tail = this.pending; this.pending = {};
      if (Object.keys(tail).length) void (this.inFlight ?? Promise.resolve()).then(() => savePetSettings(tail, this.token)).catch(() => {});
    };
  };
  private async load(): Promise<void> {
    const generation = ++this.generation; this.readController?.abort();
    const controller = new AbortController(); this.readController = controller; this.publish({ status: 'loading', error: null });
    try {
      const bundle = await getSettingsBundle(this.token, controller.signal);
      if (!this.connected || generation !== this.generation) return;
      this.publish({ config: normalizePetConfig({ ...bundle.settings, ...this.pending }),
        notifications: normalizeNotifications({ ...(bundle.settings.notifications as object), ...this.pending.notifications }),
        account: bundle.profile && bundle.security ? { profile: bundle.profile, security: bundle.security } : null,
        available: true, status: Object.keys(this.pending).length ? 'saving' : 'ready' });
    } catch {
      if (!this.connected || generation !== this.generation || controller.signal.aborted) return;
      this.publish({ status: 'error', error: '个人设置暂时无法加载，请重试。' });
    }
  }
  update = (patch: Partial<PetConfig>): void => {
    if (!this.connected || !this.snapshot.available) return;
    const next = normalizePetConfig({ ...this.snapshot.config, ...patch }); const changed: Partial<PetConfig> = {};
    for (const key of Object.keys(patch) as (keyof PetConfig)[]) if (key in PET_DEFAULTS && next[key] !== this.snapshot.config[key]) Object.assign(changed, { [key]: next[key] });
    if (!Object.keys(changed).length) return;
    this.pending = mergePatch(this.pending, changed); this.publish({ config: next, status: 'saving', error: null });
    clearTimeout(this.timer); this.timer = setTimeout(() => { void this.flush(); }, 600);
  };
  updateNotifications = (patch: Partial<NotificationPreferences>): void => {
    if (!this.connected || !this.snapshot.available) return;
    const next = normalizeNotifications({ ...this.snapshot.notifications, ...patch }); const changed: Partial<NotificationPreferences> = {};
    for (const key of Object.keys(patch) as (keyof NotificationPreferences)[]) if (key in NOTIFICATION_DEFAULTS && next[key] !== this.snapshot.notifications[key]) changed[key] = next[key];
    if (!Object.keys(changed).length) return;
    this.pending = mergePatch(this.pending, { notifications: changed });
    this.publish({ notifications: next, status: 'saving', error: null }); void this.flush();
  };
  setProfile = (profile: AccountProfile): void => { if (this.connected && this.snapshot.account) this.publish({ account: { ...this.snapshot.account, profile } }); };
  setSecurity = (security: AccountSecurity): void => { if (this.connected && this.snapshot.account) this.publish({ account: { ...this.snapshot.account, security } }); };
  flush = (): Promise<void> => {
    clearTimeout(this.timer); if (this.inFlight) return this.inFlight;
    if (!this.connected || !Object.keys(this.pending).length) return Promise.resolve();
    const sent = this.pending; this.pending = {}; const generation = this.generation;
    const operation = savePetSettings(sent, this.token).then(settings => {
      if (!this.connected || generation !== this.generation) return;
      this.publish({ config: normalizePetConfig({ ...settings, ...this.pending }),
        notifications: normalizeNotifications({ ...(settings.notifications as object), ...this.pending.notifications }),
        status: Object.keys(this.pending).length ? 'saving' : 'ready', error: null });
    }).catch(() => {
      if (!this.connected || generation !== this.generation) return;
      this.pending = mergePatch(sent, this.pending);
      this.publish({ status: 'error', error: '更改已在本页生效，尚未保存到账号。请重试保存。' });
    }).finally(() => {
      this.inFlight = undefined;
      if (this.connected && this.snapshot.status !== 'error' && Object.keys(this.pending).length) this.timer = setTimeout(() => { void this.flush(); }, 600);
    });
    this.inFlight = operation; return operation;
  };
  flushAll = async (): Promise<void> => {
    while (this.connected && (this.inFlight || Object.keys(this.pending).length)) {
      await this.flush(); if (this.snapshot.status === 'error') throw new Error('请先重试保存尚未同步的偏好。');
    }
    if (!this.connected) throw new Error('当前账号已变化，请重新登录。');
  };
  retry = (): void => {
    if (Object.keys(this.pending).length) { this.publish({ status: 'saving', error: null }); void this.flush(); }
    else void this.load();
  };
  reset = (): void => { this.update({ ...PET_DEFAULTS }); };
}
