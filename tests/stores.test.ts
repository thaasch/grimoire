import 'fake-indexeddb/auto';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import * as db from '../src/lib/db';
import { lang, t } from '../src/lib/i18n';
import {
  activateScene,
  activeScene,
  addPad,
  brokenSounds,
  createScene,
  deleteScene,
  importFiles,
  init,
  moveScene,
  movePad,
  removePad,
  removeSound,
  scenes,
  setActiveScene,
  setLanguage,
  setMasterVolume,
  settings,
  sounds,
  triggerSound,
  updatePad,
  updateScene,
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

  it('seeds the first scene with a name from the language dictionary', async () => {
    await init();
    const language = get(settings).language;
    expect(get(lang)).toBe(language);
    const expectedName = get(t)('scenes.defaultName', { n: 1 });
    expect(['Scene 1', 'Szene 1']).toContain(expectedName);
    expect(get(scenes)[0].name).toBe(expectedName);
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

  it('deleteScene of a middle scene renumbers survivors contiguously', async () => {
    await init();
    const first = get(scenes)[0];
    const second = await createScene('Two');
    const third = await createScene('Three');
    await deleteScene(second.id);
    const remaining = [...get(scenes)].sort((a, b) => a.position - b.position);
    expect(remaining.map((s) => s.id)).toEqual([first.id, third.id]);
    expect(remaining.map((s) => s.position)).toEqual([0, 1]);
    const stored = [...(await db.getAllScenes())].sort((a, b) => a.position - b.position);
    expect(stored.map((s) => s.id)).toEqual([first.id, third.id]);
    expect(stored.map((s) => s.position)).toEqual([0, 1]);
  });

  it('moveScene(0, 2) reorders and renumbers positions contiguously', async () => {
    await init();
    const first = get(scenes)[0];
    const second = await createScene('Two');
    const third = await createScene('Three');
    await moveScene(0, 2);
    const ordered = [...get(scenes)].sort((a, b) => a.position - b.position);
    expect(ordered.map((s) => s.id)).toEqual([second.id, third.id, first.id]);
    expect(ordered.map((s) => s.position)).toEqual([0, 1, 2]);
    const stored = [...(await db.getAllScenes())].sort((a, b) => a.position - b.position);
    expect(stored.map((s) => s.id)).toEqual([second.id, third.id, first.id]);
  });

  it('updateScene renames and persists', async () => {
    await init();
    const sceneId = get(scenes)[0].id;
    await updateScene(sceneId, { name: 'Renamed', emoji: '🐲' });
    expect(get(scenes)[0]).toMatchObject({ name: 'Renamed', emoji: '🐲' });
    const stored = await db.getAllScenes();
    expect(stored.find((s) => s.id === sceneId)).toMatchObject({ name: 'Renamed', emoji: '🐲' });
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

  it('activateScene switches the active scene and marks broken only the autoplay loop with a missing blob', async () => {
    await init();
    const sceneA = get(scenes)[0];
    const sceneB = await createScene('B'); // createScene activates it
    await setActiveScene(sceneA.id); // switch back so activateScene(sceneB) is a real transition

    const autoplaySound: Sound = {
      id: 'auto-loop',
      name: 'Auto',
      emoji: '🔥',
      type: 'loop',
      defaultVolume: 0.8,
      duration: 60,
      mimeType: 'audio/mpeg',
      createdAt: 0,
    };
    const manualSound: Sound = {
      id: 'manual-loop',
      name: 'Manual',
      emoji: '🎵',
      type: 'loop',
      defaultVolume: 0.8,
      duration: 60,
      mimeType: 'audio/mpeg',
      createdAt: 0,
    };
    await db.saveSound(autoplaySound); // metadata without bytes
    await db.saveSound(manualSound); // metadata without bytes
    sounds.update((list) => [...list, autoplaySound, manualSound]);
    await addPad(sceneB.id, autoplaySound.id);
    await addPad(sceneB.id, manualSound.id);
    await updatePad(sceneB.id, autoplaySound.id, { autoplay: true });

    await activateScene(sceneB.id);

    expect(get(settings).activeSceneId).toBe(sceneB.id);
    expect(get(brokenSounds).has(autoplaySound.id)).toBe(true);
    expect(get(brokenSounds).has(manualSound.id)).toBe(false);
  });

  it('activateScene with the already-active id is a no-op', async () => {
    await init();
    const before = get(settings);
    await activateScene(before.activeSceneId!);
    expect(get(settings)).toBe(before);
  });
});

describe('settings', () => {
  it('setLanguage updates settings, persists, and sets the lang store', async () => {
    await init();
    await setLanguage('en');
    expect(get(settings).language).toBe('en');
    expect(get(lang)).toBe('en');
    expect((await db.loadSettings())?.language).toBe('en');
  });

  it('setMasterVolume updates settings and persists', async () => {
    await init();
    await setMasterVolume(0.5);
    expect(get(settings).masterVolume).toBe(0.5);
    expect((await db.loadSettings())?.masterVolume).toBe(0.5);
  });
});
