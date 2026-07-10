import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import * as db from '../src/lib/db';
import type { Scene, Sound } from '../src/lib/types';

const sound: Sound = {
  id: 'a',
  name: 'Fire',
  emoji: '🔥',
  type: 'loop',
  defaultVolume: 0.8,
  duration: 60,
  mimeType: 'audio/mpeg',
  createdAt: 1,
};

const scene: Scene = {
  id: 'sc1',
  name: 'Taverne',
  emoji: '🍺',
  pads: [{ soundId: 'a', position: 0 }],
  position: 0,
};

beforeEach(async () => {
  await db._resetForTests();
});

describe('db', () => {
  it('saves and loads sounds with their bytes', async () => {
    await db.saveSound(sound, new Uint8Array([1, 2, 3]).buffer);
    expect(await db.getAllSounds()).toEqual([sound]);
    const bytes = await db.getBlob('a');
    expect(new Uint8Array(bytes!)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('saves metadata-only without touching bytes', async () => {
    await db.saveSound(sound, new Uint8Array([1]).buffer);
    await db.saveSound({ ...sound, name: 'Renamed' });
    expect((await db.getAllSounds())[0].name).toBe('Renamed');
    expect(await db.getBlob('a')).toBeDefined();
  });

  it('deleteSound removes metadata and bytes', async () => {
    await db.saveSound(sound, new Uint8Array([1]).buffer);
    await db.deleteSound('a');
    expect(await db.getAllSounds()).toEqual([]);
    expect(await db.getBlob('a')).toBeUndefined();
  });

  it('saves, lists and deletes scenes', async () => {
    await db.saveScene(scene);
    expect(await db.getAllScenes()).toEqual([scene]);
    await db.deleteScene('sc1');
    expect(await db.getAllScenes()).toEqual([]);
  });

  it('settings: undefined on first run, then round-trips', async () => {
    expect(await db.loadSettings()).toBeUndefined();
    const settings = { language: 'de' as const, masterVolume: 0.5, activeSceneId: 'sc1' };
    await db.saveSettings(settings);
    expect(await db.loadSettings()).toEqual(settings);
  });
});
