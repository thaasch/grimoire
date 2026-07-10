import { MockAudioContext } from './mocks/audio';
(globalThis as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
import 'fake-indexeddb/auto';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as db from '../src/lib/db';
import { engine } from '../src/lib/engine';
import { lang, t } from '../src/lib/i18n';
import { flushPersist } from '../src/lib/persist';
import {
  activateScene,
  activeScene,
  addFilesToPad,
  addPad,
  addToSet,
  brokenSounds,
  createScene,
  createSet,
  deleteScene,
  deleteSet,
  duplicateScene,
  importFiles,
  init,
  mergePads,
  moveScene,
  movePad,
  removePad,
  removeFromSet,
  removeSound,
  resolveRef,
  scenes,
  setActiveScene,
  setFades,
  setLanguage,
  setMasterVolume,
  settings,
  sets,
  sounds,
  triggerRef,
  triggerSound,
  updatePad,
  updateScene,
  updateSet,
  _lastPick,
  _setRngForTests,
} from '../src/lib/stores';
import { DEFAULT_SETTINGS, type Settings, type Sound } from '../src/lib/types';

const loopDecoder = async () => ({ duration: 120 });
const shotDecoder = async () => ({ duration: 2 });

async function twoOneshots(): Promise<[string, string]> {
  const { added } = await importFiles([file('a.mp3'), file('b.mp3')], shotDecoder);
  return [added[0].id, added[1].id];
}

function file(name: string): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: 'audio/mpeg' });
}

beforeEach(async () => {
  await db._resetForTests();
  sounds.set([]);
  scenes.set([]);
  settings.set({ ...DEFAULT_SETTINGS });
  brokenSounds.set(new Set());
  sets.set([]);
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

  it('init clears brokenSounds', async () => {
    brokenSounds.set(new Set(['stale-id']));
    await init();
    expect(get(brokenSounds).size).toBe(0);
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

  it('classifies exactly 30s as a one-shot (strict > threshold)', async () => {
    await init();
    const boundaryDecoder = async () => ({ duration: 30 });
    const { added } = await importFiles([file('edge.mp3')], boundaryDecoder);
    expect(added[0].type).toBe('oneshot');
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

  it('activateScene abandoned when a newer activation wins', async () => {
    await init();
    const sceneB = await createScene('B'); // createScene activates it
    const sceneC = await createScene('C'); // createScene activates it — C is now active

    const loopSound: Sound = {
      id: 'race-loop',
      name: 'Race',
      emoji: '🔥',
      type: 'loop',
      defaultVolume: 0.8,
      duration: 60,
      mimeType: 'audio/mpeg',
      createdAt: 0,
    };
    await db.saveSound(loopSound); // metadata without bytes — missing-blob path, never touches AudioContext
    sounds.update((list) => [...list, loopSound]);
    await addPad(sceneB.id, loopSound.id);
    await updatePad(sceneB.id, loopSound.id, { autoplay: true });

    // Currently active is C, so activating B is a real transition and proceeds into the pad loop.
    const p = activateScene(sceneB.id);
    await setActiveScene(sceneC.id); // a newer activation wins while B's activation is in flight
    await p;

    expect(get(settings).activeSceneId).toBe(sceneC.id);
    expect(get(brokenSounds).size).toBe(0); // the abandoned activation bailed before marking
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
    await flushPersist(); // masterVolume persistence is now debounced
    expect((await db.loadSettings())?.masterVolume).toBe(0.5);
  });
});

describe('variation sets', () => {
  it('createSet stores the set and resolveRef finds it', async () => {
    await init();
    const [a, b] = await twoOneshots();
    const set = await createSet([a, b], { name: 'Hits', emoji: '🎲', defaultVolume: 0.7 });
    expect(get(sets)).toHaveLength(1);
    expect(await db.getAllSets()).toEqual([set]);
    expect(resolveRef(set.id)).toEqual({ kind: 'set', set });
    expect(resolveRef(a)?.kind).toBe('sound');
    expect(resolveRef('nope')).toBeNull();
  });

  it('createSet rejects loops and too-few members', async () => {
    await init();
    const { added } = await importFiles([file('amb.mp3')], loopDecoder);
    const [a] = await twoOneshots();
    await expect(createSet([a, added[0].id], { name: 'x', emoji: '🎲', defaultVolume: 1 })).rejects.toThrow(
      'loopInSet',
    );
    await expect(createSet([a], { name: 'x', emoji: '🎲', defaultVolume: 1 })).rejects.toThrow(
      'tooFewMembers',
    );
  });

  it('addToSet dedupes and validates', async () => {
    await init();
    const [a, b] = await twoOneshots();
    const set = await createSet([a, b], { name: 'Hits', emoji: '🎲', defaultVolume: 0.7 });
    const { added } = await importFiles([file('c.mp3')], shotDecoder);
    await addToSet(set.id, [added[0].id, b]); // b already a member
    expect(get(sets)[0].soundIds).toEqual([a, b, added[0].id]);
  });

  it('removeFromSet dissolves at one member and rewrites pads', async () => {
    await init();
    const sceneId = get(scenes)[0].id;
    const [a, b] = await twoOneshots();
    const set = await createSet([a, b], { name: 'Hits', emoji: '🎲', defaultVolume: 0.7 });
    await addPad(sceneId, set.id);
    await removeFromSet(set.id, a);
    expect(get(sets)).toEqual([]); // dissolved
    const padIds = get(activeScene)!.pads.map((p) => p.soundId);
    expect(padIds).toContain(b); // pad rewritten to the survivor
    expect(padIds).not.toContain(set.id);
    expect(await db.getAllSets()).toEqual([]);
  });

  it('deleteSet removes pads referencing it but keeps member sounds', async () => {
    await init();
    const sceneId = get(scenes)[0].id;
    const [a, b] = await twoOneshots();
    const set = await createSet([a, b], { name: 'Hits', emoji: '🎲', defaultVolume: 0.7 });
    await addPad(sceneId, set.id);
    await deleteSet(set.id);
    expect(get(sets)).toEqual([]);
    expect(get(activeScene)!.pads.map((p) => p.soundId)).not.toContain(set.id);
    expect(get(sounds).map((s) => s.id)).toEqual(expect.arrayContaining([a, b]));
  });

  it('removeSound cascades into sets with dissolution', async () => {
    await init();
    const [a, b] = await twoOneshots();
    const set = await createSet([a, b], { name: 'Hits', emoji: '🎲', defaultVolume: 0.7 });
    await removeSound(a);
    expect(get(sets)).toEqual([]); // dropped to 1 member → dissolved
    expect(resolveRef(set.id)).toBeNull();
  });

  it('init loads sets and merges fade defaults into legacy settings', async () => {
    await init();
    const [a, b] = await twoOneshots();
    await createSet([a, b], { name: 'Hits', emoji: '🎲', defaultVolume: 0.7 });
    // simulate a v1 settings record without fades
    const legacy = { language: 'de', masterVolume: 0.5, activeSceneId: null } as unknown as Settings;
    await db.saveSettings(legacy);
    await init();
    expect(get(sets)).toHaveLength(1);
    expect(get(settings).fades).toEqual({ stop: 0.3, stopAll: 1.5, crossfade: 1.5 });
    expect(get(settings).masterVolume).toBe(0.5);
  });
});

const FAKE_BUFFER = { duration: 1 } as unknown as AudioBuffer;

describe('set playback', () => {
  it('picks a random member, never the same twice in a row', async () => {
    await init();
    const { added } = await importFiles([file('a.mp3'), file('b.mp3'), file('c.mp3')], shotDecoder);
    const [a, b, c] = added.map((s) => s.id);
    const set = await createSet([a, b, c], { name: 'Hits', emoji: '🎲', defaultVolume: 0.7 });
    for (const id of [a, b, c]) engine.setBuffer(id, FAKE_BUFFER);
    _setRngForTests(() => 0); // always take the first candidate
    await triggerRef(set.id);
    expect(_lastPick(set.id)).toBe(a);
    await triggerRef(set.id);
    expect(_lastPick(set.id)).toBe(b); // a was excluded as the previous pick
    await triggerRef(set.id);
    expect(_lastPick(set.id)).toBe(a); // b excluded, a is first candidate again
    const setInstances = get(engine.playing).filter((i) => i.soundId === set.id);
    expect(setInstances.length).toBe(3); // all registered under the set's id
  });

  it('falls back to another member when the pick is unplayable', async () => {
    await init();
    const { added } = await importFiles([file('real.mp3')], shotDecoder);
    const real = added[0].id;
    const orphan: Sound = {
      id: 'ghost-member',
      name: 'Ghost',
      emoji: '👻',
      type: 'oneshot',
      defaultVolume: 1,
      duration: 2,
      mimeType: 'audio/mpeg',
      createdAt: 0,
    };
    await db.saveSound(orphan); // metadata, no bytes
    sounds.update((list) => [...list, orphan]);
    const set = await createSet(['ghost-member', real], { name: 'x', emoji: '🎲', defaultVolume: 1 });
    engine.setBuffer(real, FAKE_BUFFER);
    _setRngForTests(() => 0); // would pick the ghost first
    await triggerRef(set.id);
    expect(_lastPick(set.id)).toBe(real);
    expect(get(brokenSounds).has(set.id)).toBe(false);
  });

  it('marks the set broken only when every member is unplayable', async () => {
    await init();
    const mk = (id: string): Sound => ({
      id,
      name: id,
      emoji: '👻',
      type: 'oneshot',
      defaultVolume: 1,
      duration: 2,
      mimeType: 'audio/mpeg',
      createdAt: 0,
    });
    for (const id of ['g1', 'g2']) {
      await db.saveSound(mk(id));
      sounds.update((list) => [...list, mk(id)]);
    }
    const set = await createSet(['g1', 'g2'], { name: 'x', emoji: '🎲', defaultVolume: 1 });
    await triggerRef(set.id);
    expect(get(brokenSounds).has(set.id)).toBe(true);
  });
});

describe('mergePads and addFilesToPad', () => {
  it('merging two one-shot pads creates a set at the target pad', async () => {
    await init();
    const sceneId = get(scenes)[0].id;
    const [a, b] = await twoOneshots();
    const ok = await mergePads(sceneId, a, b);
    expect(ok).toBe(true);
    const pads = get(activeScene)!.pads;
    expect(pads).toHaveLength(1);
    const set = get(sets)[0];
    expect(pads[0].soundId).toBe(set.id);
    expect(set.soundIds).toEqual([b, a]); // target first
    expect(set.name).toBe(get(sounds).find((s) => s.id === b)!.name);
  });

  it('merging onto an existing set-pad joins it', async () => {
    await init();
    const sceneId = get(scenes)[0].id;
    const [a, b] = await twoOneshots();
    await mergePads(sceneId, a, b);
    const setId = get(sets)[0].id;
    const { added } = await importFiles([file('c.mp3')], shotDecoder);
    const ok = await mergePads(sceneId, added[0].id, setId);
    expect(ok).toBe(true);
    expect(get(sets)[0].soundIds).toHaveLength(3);
    expect(get(activeScene)!.pads).toHaveLength(1);
  });

  it('refuses to merge loops', async () => {
    await init();
    const sceneId = get(scenes)[0].id;
    const { added: loops } = await importFiles([file('amb.mp3')], loopDecoder);
    const [a] = await twoOneshots();
    expect(await mergePads(sceneId, loops[0].id, a)).toBe(false);
    expect(await mergePads(sceneId, a, loops[0].id)).toBe(false);
    expect(get(sets)).toEqual([]);
  });

  it('addFilesToPad converts a sound pad into a set and rejects loops from it', async () => {
    await init();
    const sceneId = get(scenes)[0].id;
    const { added: base } = await importFiles([file('hit.mp3')], shotDecoder);
    let call = 0;
    const alternating = async () => ({ duration: ++call === 1 ? 2 : 120 }); // 1st file one-shot, 2nd loop
    const result = await addFilesToPad(sceneId, base[0].id, [file('x.mp3'), file('y.mp3')], alternating);
    expect(result.applied).toBe(true);
    expect(result.rejectedLoops).toBe(1);
    const set = get(sets)[0];
    expect(set.soundIds).toHaveLength(2); // base + the one-shot upload
    expect(get(activeScene)!.pads.some((p) => p.soundId === set.id)).toBe(true);
    expect(get(sounds).some((s) => s.type === 'loop')).toBe(true); // loop stayed in the library
  });

  it('addFilesToPad onto a loop pad leaves everything library-only', async () => {
    await init();
    const sceneId = get(scenes)[0].id;
    const { added: loops } = await importFiles([file('amb.mp3')], loopDecoder);
    const result = await addFilesToPad(sceneId, loops[0].id, [file('x.mp3')], shotDecoder);
    expect(result.applied).toBe(false);
    expect(get(sets)).toEqual([]);
  });
});

describe('duplicateScene', () => {
  it('deep-copies pads, inserts after the original, renumbers and activates', async () => {
    await init();
    const first = get(scenes)[0];
    await importFiles([file('a.mp3')], shotDecoder);
    await createScene('Zwei');
    const copy = await duplicateScene(first.id);
    expect(copy).not.toBeNull();
    const ordered = [...get(scenes)].sort((x, y) => x.position - y.position);
    expect(ordered.map((s) => s.id)).toEqual([first.id, copy!.id, ordered[2].id]);
    expect(ordered.map((s) => s.position)).toEqual([0, 1, 2]);
    expect(copy!.name).toMatch(/\((Kopie|copy)\)$/);
    expect(copy!.pads).toEqual(get(scenes).find((s) => s.id === first.id)!.pads);
    expect(copy!.pads).not.toBe(get(scenes).find((s) => s.id === first.id)!.pads);
    expect(get(settings).activeSceneId).toBe(copy!.id);
  });
});

describe('debounced persistence', () => {
  it('updatePad with debounce coalesces db writes but updates the store immediately', async () => {
    // Restrict the fake clock to setTimeout/clearTimeout only: faking setImmediate
    // (vitest's default) stalls fake-indexeddb, whose task queue runs on setImmediate.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await init();
      const sceneId = get(scenes)[0].id;
      const { added } = await importFiles([file('a.mp3')], shotDecoder);
      for (const v of [0.1, 0.2, 0.3]) {
        await updatePad(sceneId, added[0].id, { volume: v }, true);
      }
      expect(get(activeScene)!.pads[0].volume).toBe(0.3); // store immediate
      const beforeFlush = (await db.getAllScenes()).find((s) => s.id === sceneId)!;
      expect(beforeFlush.pads[0].volume).toBeUndefined(); // not yet persisted
      await vi.advanceTimersByTimeAsync(300);
      const after = (await db.getAllScenes()).find((s) => s.id === sceneId)!;
      expect(after.pads[0].volume).toBe(0.3);
    } finally {
      await flushPersist();
      vi.useRealTimers();
    }
  });

  it('setFades persists after the debounce window', async () => {
    // Restrict the fake clock to setTimeout/clearTimeout only: faking setImmediate
    // (vitest's default) stalls fake-indexeddb, whose task queue runs on setImmediate.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await init();
      await setFades({ crossfade: 2.5 });
      expect(get(settings).fades.crossfade).toBe(2.5);
      await vi.advanceTimersByTimeAsync(300);
      expect((await db.loadSettings())!.fades.crossfade).toBe(2.5);
    } finally {
      await flushPersist();
      vi.useRealTimers();
    }
  });
});
