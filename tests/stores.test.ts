import 'fake-indexeddb/auto';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import * as db from '../src/lib/db';
import {
  activeScene,
  addPad,
  brokenSounds,
  createScene,
  deleteScene,
  importFiles,
  init,
  movePad,
  removePad,
  removeSound,
  scenes,
  settings,
  sounds,
  triggerSound,
  updatePad,
} from '../src/lib/stores';
import { DEFAULT_SETTINGS, type Sound } from '../src/lib/types';

const loopDecoder = async () => ({ duration: 120 });
const shotDecoder = async () => ({ duration: 2 });

function file(name: string): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: 'audio/mpeg' });
}

beforeEach(async () => {
  await db._resetForTests();
  sounds.set([]);
  scenes.set([]);
  settings.set({ ...DEFAULT_SETTINGS });
  brokenSounds.set(new Set());
});

describe('init', () => {
  it('seeds an empty scene on first run and persists settings', async () => {
    await init();
    const list = get(scenes);
    expect(list).toHaveLength(1);
    expect(list[0].pads).toEqual([]);
    expect(get(settings).activeSceneId).toBe(list[0].id);
    expect(await db.loadSettings()).toEqual(get(settings));
  });

  it('restores the same scene on a second init (reload)', async () => {
    await init();
    const first = get(scenes)[0];
    await init();
    expect(get(scenes)).toHaveLength(1);
    expect(get(scenes)[0].id).toBe(first.id);
  });
});

describe('importFiles', () => {
  it('adds a loop sound and creates a pad in the active scene', async () => {
    await init();
    const { added, failed } = await importFiles([file('rain.mp3')], loopDecoder);
    expect(failed).toEqual([]);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ name: 'rain', type: 'loop', emoji: '🎵', defaultVolume: 0.8 });
    expect(get(activeScene)!.pads).toEqual([{ soundId: added[0].id, position: 0 }]);
    expect(await db.getBlob(added[0].id)).toBeDefined();
  });

  it('classifies short files as one-shots', async () => {
    await init();
    const { added } = await importFiles([file('sword.wav')], shotDecoder);
    expect(added[0].type).toBe('oneshot');
  });

  it('reports undecodable files without aborting the batch', async () => {
    await init();
    const badDecoder = async () => {
      throw new Error('bad data');
    };
    const { added, failed } = await importFiles([file('broken.mp3'), file('ok.mp3')], badDecoder);
    expect(added).toEqual([]);
    expect(failed).toEqual([
      { name: 'broken.mp3', reason: 'unsupported' },
      { name: 'ok.mp3', reason: 'unsupported' },
    ]);
  });
});

describe('scenes and pads', () => {
  it('createScene appends and activates', async () => {
    await init();
    const scene = await createScene('Bosskampf', '🐉');
    expect(get(scenes)).toHaveLength(2);
    expect(scene.position).toBe(1);
    expect(get(settings).activeSceneId).toBe(scene.id);
  });

  it('deleteScene reseeds a fresh scene when the last one dies', async () => {
    await init();
    const only = get(scenes)[0];
    await deleteScene(only.id);
    expect(get(scenes)).toHaveLength(1);
    expect(get(scenes)[0].id).not.toBe(only.id);
    expect(get(settings).activeSceneId).toBe(get(scenes)[0].id);
  });

  it('movePad reorders and renumbers positions', async () => {
    await init();
    const sceneId = get(scenes)[0].id;
    const { added } = await importFiles([file('a.mp3'), file('b.mp3'), file('c.mp3')], shotDecoder);
    await movePad(sceneId, 0, 2);
    const pads = [...get(activeScene)!.pads].sort((x, y) => x.position - y.position);
    expect(pads.map((p) => p.soundId)).toEqual([added[1].id, added[2].id, added[0].id]);
    expect(pads.map((p) => p.position)).toEqual([0, 1, 2]);
  });

  it('updatePad patches volume and autoplay', async () => {
    await init();
    const sceneId = get(scenes)[0].id;
    const { added } = await importFiles([file('a.mp3')], loopDecoder);
    await updatePad(sceneId, added[0].id, { volume: 0.4, autoplay: true });
    expect(get(activeScene)!.pads[0]).toMatchObject({ volume: 0.4, autoplay: true });
  });

  it('removePad renumbers the remaining pads', async () => {
    await init();
    const sceneId = get(scenes)[0].id;
    const { added } = await importFiles([file('a.mp3'), file('b.mp3')], shotDecoder);
    await removePad(sceneId, added[0].id);
    expect(get(activeScene)!.pads).toEqual([{ soundId: added[1].id, position: 0 }]);
  });

  it('removeSound cascades into every scene', async () => {
    await init();
    const { added } = await importFiles([file('a.mp3')], shotDecoder);
    const second = await createScene('Zwei');
    await addPad(second.id, added[0].id);
    await removeSound(added[0].id);
    expect(get(sounds)).toEqual([]);
    for (const scene of get(scenes)) expect(scene.pads).toEqual([]);
    expect(await db.getBlob(added[0].id)).toBeUndefined();
  });
});

describe('playback glue', () => {
  it('triggerSound marks sounds with missing bytes as broken', async () => {
    await init();
    const orphan: Sound = {
      id: 'ghost',
      name: 'Ghost',
      emoji: '👻',
      type: 'oneshot',
      defaultVolume: 1,
      duration: 2,
      mimeType: 'audio/mpeg',
      createdAt: 0,
    };
    await db.saveSound(orphan); // metadata without bytes
    sounds.update((list) => [...list, orphan]);
    await triggerSound('ghost');
    expect(get(brokenSounds).has('ghost')).toBe(true);
  });
});
