export interface NotificationPreferences {
  announcements: boolean; activities: boolean; fees: boolean; materials: boolean; news: boolean; browser: boolean;
}
export interface AccountProfile {
  name: string; uniqueId: string; displayName: string | null; bio: string; avatarUrl: string | null;
}
export interface AccountSecurity {
  email: string | null; emailVerified: boolean; lastLoginAt: string | null;
}
export interface AccountDetails { profile: AccountProfile; security: AccountSecurity }
export interface SettingsBundle { settings: Record<string, unknown>; profile?: AccountProfile; security?: AccountSecurity }
