export type SoundType = 'loop' | 'oneshot';

export type PadColor =
  | 'gold'
  | 'violet'
  | 'blue'
  | 'green'
  | 'teal'
  | 'rose'
  | 'amber'
  | 'slate';

export const PAD_COLORS: PadColor[] = [
  'gold',
  'violet',
  'blue',
  'green',
  'teal',
  'rose',
  'amber',
  'slate',
];

export interface Sound {
  id: string; // uuid
  name: string;
  emoji: string; // pad icon, user-editable, default '🎵'
  type: SoundType; // guessed on upload (duration > 30s => loop), editable
  defaultVolume: number; // 0..1
  duration: number; // seconds, from decode
  mimeType: string;
  createdAt: number;
  color?: PadColor; // absent = gold (default look)
}

export interface VariationSet {
  id: string; // uuid, same id space as Sound.id
  name: string;
  emoji: string; // default '🎲'
  soundIds: string[]; // members, invariant: length >= 2, one-shots only
  defaultVolume: number; // 0..1
  color?: PadColor;
}

export interface Pad {
  soundId: string; // a Sound id OR a VariationSet id — resolveRef() in stores decides
  volume?: number; // per-scene override, else the referenced entity's defaultVolume
  autoplay?: boolean; // loops only: start when scene is activated
  position: number; // grid order
}

export interface Scene {
  id: string;
  name: string;
  emoji: string;
  pads: Pad[];
  position: number; // tab order
}

export interface FadeSettings {
  stop: number; // single-instance stop, seconds
  stopAll: number; // panic fade, seconds
  crossfade: number; // scene switch, seconds
}

export interface Settings {
  language: 'de' | 'en';
  masterVolume: number; // 0..1
  activeSceneId: string | null;
  fades: FadeSettings;
}

export const DEFAULT_FADES: FadeSettings = { stop: 0.3, stopAll: 1.5, crossfade: 1.5 };

export const DEFAULT_SETTINGS: Settings = {
  language: 'de',
  masterVolume: 0.8,
  activeSceneId: null,
  fades: { ...DEFAULT_FADES },
};
