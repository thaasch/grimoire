import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import * as db from '../src/lib/db';
import type { Scene, Sound, VariationSet } from '../src/lib/types';

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
    const settings = {
      language: 'de' as const,
      masterVolume: 0.5,
      activeSceneId: 'sc1',
      fades: { stop: 0.3, stopAll: 1.5, crossfade: 1.5 },
    };
    await db.saveSettings(settings);
    expect(await db.loadSettings()).toEqual(settings);
  });
});

const variationSet: VariationSet = {
  id: 'set1',
  name: 'Schwerter',
  emoji: '🎲',
  soundIds: ['a', 'b'],
  defaultVolume: 0.7,
};

describe('db sets (v2)', () => {
  it('saves, lists and deletes variation sets', async () => {
    await db.saveSet(variationSet);
    expect(await db.getAllSets()).toEqual([variationSet]);
    await db.deleteSet('set1');
    expect(await db.getAllSets()).toEqual([]);
  });

  it('upgrades a v1 database in place, preserving data', async () => {
    await db._resetForTests();
    // Simulate a database created by GRIMOIRE v1 (version 1, no sets store)
    const { openDB } = await import('idb');
    const v1 = await openDB('grimoire', 1, {
      upgrade(oldDb) {
        oldDb.createObjectStore('sounds', { keyPath: 'id' });
        oldDb.createObjectStore('blobs');
        oldDb.createObjectStore('scenes', { keyPath: 'id' });
        oldDb.createObjectStore('settings');
      },
    });
    await v1.put('sounds', sound);
    v1.close();

    // First access through the module triggers the 1 → 2 upgrade
    expect(await db.getAllSounds()).toEqual([sound]); // v1 data survives
    await db.saveSet(variationSet); // new store exists and works
    expect(await db.getAllSets()).toEqual([variationSet]);
  });
});
