export type SoundType = 'loop' | 'oneshot';

export interface Sound {
  id: string; // uuid
  name: string;
  emoji: string; // pad icon, user-editable, default '🎵'
  type: SoundType; // guessed on upload (duration > 30s => loop), editable
  defaultVolume: number; // 0..1
  duration: number; // seconds, from decode
  mimeType: string;
  createdAt: number;
}

export interface Pad {
  soundId: string;
  volume?: number; // per-scene override, else sound.defaultVolume
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

export interface Settings {
  language: 'de' | 'en';
  masterVolume: number; // 0..1
  activeSceneId: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'de',
  masterVolume: 0.8,
  activeSceneId: null,
};
