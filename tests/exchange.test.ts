import 'fake-indexeddb/auto';
import { strToU8, zipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import * as db from '../src/lib/db';
import { exportAll, importZip } from '../src/lib/exchange';
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

describe('exchange', () => {
  it('round-trips sounds, bytes and scenes through a zip', async () => {
    await db.saveSound(sound, new Uint8Array([9, 9]).buffer);
    await db.saveScene(scene);
    await db.saveSettings({
      language: 'de',
      masterVolume: 0.5,
      activeSceneId: 'sc1',
      fades: { stop: 0.3, stopAll: 1.5, crossfade: 1.5 },
    });

    const zip = await exportAll();
    await db._resetForTests();

    const result = await importZip(zip);
    expect(result).toEqual({ sounds: 1, scenes: 1, sets: 0 });
    expect(await db.getAllSounds()).toEqual([sound]);
    expect(new Uint8Array((await db.getBlob('a'))!)).toEqual(new Uint8Array([9, 9]));
    expect(await db.getAllScenes()).toEqual([scene]);
    expect(await db.loadSettings()).toBeUndefined(); // settings are NOT imported
  });

  it('skips sounds whose bytes are missing from the zip', async () => {
    await db.saveSound(sound); // metadata only, no bytes
    const zip = await exportAll();
    await db._resetForTests();
    const result = await importZip(zip);
    expect(result.sounds).toBe(0);
    expect(await db.getAllSounds()).toEqual([]);
  });

  it('throws when manifest.json is missing', async () => {
    const zip = zipSync({ 'readme.txt': strToU8('nope') });
    await expect(importZip(zip)).rejects.toThrow('manifest.json');
  });

  it('throws on an unknown manifest version', async () => {
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ version: 2, sounds: [], scenes: [], settings: {} })),
    });
    await expect(importZip(zip)).rejects.toThrow('Unsupported archive version');
  });

  it('merges into a non-empty library, overwriting by id and keeping unrelated entries', async () => {
    await db.saveSound(sound, new Uint8Array([9, 9]).buffer);
    await db.saveScene(scene);
    const zip = await exportAll();
    await db._resetForTests();

    const other: Sound = { ...sound, id: 'b', name: 'Other' };
    await db.saveSound(other, new Uint8Array([5]).buffer);
    await db.saveSound({ ...sound, name: 'Stale' }, new Uint8Array([1]).buffer);

    await importZip(zip);
    const all = (await db.getAllSounds()).sort((x, y) => x.id.localeCompare(y.id));
    expect(all).toEqual([sound, other]);
    expect(new Uint8Array((await db.getBlob('a'))!)).toEqual(new Uint8Array([9, 9]));
    expect(new Uint8Array((await db.getBlob('b'))!)).toEqual(new Uint8Array([5]));
  });

  it('round-trips variation sets', async () => {
    const set: VariationSet = {
      id: 'set1',
      name: 'Schwerter',
      emoji: '🎲',
      soundIds: ['a'],
      defaultVolume: 0.7,
    };
    await db.saveSound(sound, new Uint8Array([9]).buffer);
    await db.saveSet(set);
    const zip = await exportAll();
    await db._resetForTests();
    const result = await importZip(zip);
    expect(result.sets).toBe(1);
    expect(await db.getAllSets()).toEqual([set]);
  });

  it('imports v1 archives without a sets field', async () => {
    await db.saveSound(sound, new Uint8Array([9]).buffer);
    const zip = await exportAll();
    // strip the sets field to simulate a v1 archive
    const { unzipSync, zipSync: rezip, strFromU8: fromU8, strToU8: toU8 } = await import('fflate');
    const files = unzipSync(zip);
    const manifest = JSON.parse(fromU8(files['manifest.json']));
    delete manifest.sets;
    files['manifest.json'] = toU8(JSON.stringify(manifest));
    await db._resetForTests();
    const result = await importZip(rezip(files, { level: 0 }));
    expect(result).toEqual({ sounds: 1, scenes: 0, sets: 0 });
  });
});
