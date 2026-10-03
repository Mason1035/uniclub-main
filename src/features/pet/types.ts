import type { AccountDetails, NotificationPreferences } from '../settings/types';
export type PetAction = 'signature' | 'fly' | 'dance' | 'spin' | 'hops' | 'roll' | 'breach' | 'sway' | 'random';

export interface PetConfig {
  petEnabled: boolean;
  petSkin: string;
  petSize: number;
  petOpacity: number;
  petMuted: boolean;
  petVolume: number;
  petTalkative: boolean;
  petWalkable: boolean;
  petHue: number;
  petPokeAction: PetAction;
  petCelebrateAction: PetAction;
  petInteractive: boolean;
  petPageMessages: boolean;
  petActivity: 'quiet' | 'normal' | 'active';
}

export interface PetSkin {
  id: string;
  name: string;
  image: string;
  imageBlink?: string;
  imageShout?: string;
  imageFly?: string;
  imageFlyShout?: string;
  imageSpout?: string;
  shoutAnim?: readonly { src: string; at: number }[];
  sounds?: readonly string[];
  soundDurationsMs?: readonly number[];
  voice: 'squeak' | 'whale' | null;
  signature: PetAction;
  shoutBubble: string;
  quips: string[];
  defaultSize: number;
  aspectRatio: number;
}

export interface PetAPI {
  poke(): void;
  celebrate(): void;
  say(message: string): void;
  setBusy(busy: boolean, message?: string): void;
  perform(action?: PetAction): void;
  resetPosition(): void;
}

export interface PetHandle extends PetAPI {
  refreshViewport(): void;
  focus(): void;
  destroy(): void;
}

export interface PetSnapshot {
  config: PetConfig;
  notifications: NotificationPreferences;
  account: AccountDetails | null;
  available: boolean;
  status: 'loading' | 'ready' | 'saving' | 'error';
  error: string | null;
}
