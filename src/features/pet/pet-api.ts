import { clearSession, readToken } from '../../lib/session';
import type { PetConfig } from './types';
import type { NotificationPreferences, SettingsBundle } from '../settings/types';
export type SettingsPatch = Partial<PetConfig> & { notifications?: Partial<NotificationPreferences> };
const PATH = '/api/users/me/settings';
async function settingsRequest(token: string, options: RequestInit): Promise<SettingsBundle> {
  const response = await fetch(PATH, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  if (!response.ok) {
    if (response.status === 401) { try { if (readToken() === token) clearSession(); } catch { /* optional feature */ } }
    throw new Error('Settings request failed');
  }
  const data = await response.json();
  if (!data.success || !data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) throw new Error('Invalid settings response');
  return data;
}
export const getSettingsBundle = (token: string, signal: AbortSignal): Promise<SettingsBundle> => settingsRequest(token, { method: 'GET', signal });
export const getPetSettings = async (token: string, signal: AbortSignal) => (await getSettingsBundle(token, signal)).settings;
export const savePetSettings = async (patch: SettingsPatch, token: string) =>
  (await settingsRequest(token, { method: 'PATCH', body: JSON.stringify(patch), keepalive: true })).settings;
