import { derived, get, writable } from 'svelte/store';
import * as db from './db';
import { engine } from './engine';
import { detectLang, lang, t, type Lang } from './i18n';
import { debouncedPersist, guard } from './persist';
import { DEFAULT_FADES, DEFAULT_SETTINGS, type FadeSettings, type Pad, type PadColor, type Scene, type Settings, type Sound, type VariationSet } from './types';

export const sounds = writable<Sound[]>([]);
export const scenes = writable<Scene[]>([]);
export const settings = writable<Settings>({ ...DEFAULT_SETTINGS });
export const sets = writable<VariationSet[]>([]);
export const brokenSounds = writable<Set<string>>(new Set());
export const searchQuery = writable('');
export const editMode = writable(false);
export const libraryOpen = writable(false);
export const editingSound = writable<string | null>(null);

export const activeScene = derived([scenes, settings], ([$scenes, $settings]) =>
  $scenes.find((s) => s.id === $settings.activeSceneId) ?? null,
);

export type Ref =
  | { kind: 'sound'; sound: Sound }
  | { kind: 'set'; set: VariationSet }
  | null;

export function resolveRef(id: string): Ref {
  const set = get(sets).find((s) => s.id === id);
  if (set) return { kind: 'set', set };
  const sound = get(sounds).find((s) => s.id === id);
  if (sound) return { kind: 'sound', sound };
  return null;
}

export type Decoder = (data: ArrayBuffer) => Promise<{ duration: number }>;

const LOOP_THRESHOLD_SECONDS = 30;

function nextPosition(items: { position: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.position), -1) + 1;
}

function defaultSceneName(language: Lang): string {
  lang.set(language);
  return get(t)('scenes.defaultName', { n: 1 });
}

export async function init(): Promise<void> {
  const [allSounds, allScenes, allSets, stored] = await Promise.all([
    db.getAllSounds(),
    db.getAllScenes(),
    db.getAllSets(),
    db.loadSettings(),
  ]);
  const base = stored ?? { ...DEFAULT_SETTINGS, language: detectLang() };
  const current: Settings = {
    ...DEFAULT_SETTINGS,
    ...base,
    fades: { ...DEFAULT_FADES, ...base.fades },
  };
  let sceneList = [...allScenes].sort((a, b) => a.position - b.position);
  if (sceneList.length === 0) {
    const first: Scene = {
      id: crypto.randomUUID(),
      name: defaultSceneName(current.language),
      emoji: '📜',
      pads: [],
      position: 0,
    };
    await db.saveScene(first);
    sceneList = [first];
  }
  if (!current.activeSceneId || !sceneList.some((s) => s.id === current.activeSceneId)) {
    current.activeSceneId = sceneList[0].id;
  }
  sounds.set(allSounds);
  scenes.set(sceneList);
  sets.set(allSets);
  settings.set(current);
  brokenSounds.set(new Set());
  lang.set(current.language);
  engine.setMasterVolume(current.masterVolume);
  await db.saveSettings(current);
}

async function patchSettings(patch: Partial<Settings>, debounce = false): Promise<void> {
  const next = { ...get(settings), ...patch };
  settings.set(next);
  if (debounce) {
    debouncedPersist('settings', () => db.saveSettings(get(settings)));
  } else {
    await guard(db.saveSettings(next));
  }
}

export async function setMasterVolume(volume: number): Promise<void> {
  engine.setMasterVolume(volume);
  await patchSettings({ masterVolume: volume }, true);
}

export async function setFades(patch: Partial<FadeSettings>): Promise<void> {
  await patchSettings({ fades: { ...get(settings).fades, ...patch } }, true);
}

export async function setLanguage(language: Lang): Promise<void> {
  lang.set(language);
  await patchSettings({ language });
}

export async function setActiveScene(id: string | null): Promise<void> {
  await patchSettings({ activeSceneId: id });
}

async function uploadFiles(
  files: File[],
  decode: Decoder,
): Promise<{ added: Sound[]; failed: { name: string; reason: 'unsupported' | 'quota' }[] }> {
  const added: Sound[] = [];
  const failed: { name: string; reason: 'unsupported' | 'quota' }[] = [];
  for (const file of files) {
    let bytes: ArrayBuffer;
    let duration: number;
    try {
      bytes = await file.arrayBuffer();
      ({ duration } = await decode(bytes));
    } catch {
      failed.push({ name: file.name, reason: 'unsupported' });
      continue;
    }
    const sound: Sound = {
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^.]+$/, ''),
      emoji: '🎵',
      type: duration > LOOP_THRESHOLD_SECONDS ? 'loop' : 'oneshot',
      defaultVolume: 0.8,
      duration,
      mimeType: file.type || 'audio/mpeg',
      createdAt: Date.now(),
    };
    try {
      await db.saveSound(sound, bytes);
    } catch {
      failed.push({ name: file.name, reason: 'quota' });
      continue;
    }
    added.push(sound);
  }
  if (added.length > 0) sounds.update((list) => [...list, ...added]);
  return { added, failed };
}

export async function importFiles(
  files: File[],
  decode: Decoder,
): Promise<{ added: Sound[]; failed: { name: string; reason: 'unsupported' | 'quota' }[] }> {
  const result = await uploadFiles(files, decode);
  if (result.added.length > 0) {
    const scene = get(activeScene);
    if (scene) {
      for (const sound of result.added) {
        try {
          await addPad(scene.id, sound.id);
        } catch {
          // pad creation failed (e.g. quota) — the sound is still in the library
        }
      }
    }
  }
  return result;
}

export async function createScene(name: string, emoji = '📜'): Promise<Scene> {
  const scene: Scene = {
    id: crypto.randomUUID(),
    name,
    emoji,
    pads: [],
    position: nextPosition(get(scenes)),
  };
  scenes.update((list) => [...list, scene]);
  await guard(db.saveScene(scene));
  await setActiveScene(scene.id);
  return scene;
}

async function patchScene(id: string, fn: (scene: Scene) => Scene, debounce = false): Promise<void> {
  let updated: Scene | undefined;
  scenes.update((list) => list.map((s) => (s.id === id ? (updated = fn(s)) : s)));
  if (!updated) return;
  if (debounce) {
    debouncedPersist(`scene:${id}`, () => {
      const current = get(scenes).find((s) => s.id === id);
      return current ? db.saveScene(current) : Promise.resolve();
    });
  } else {
    await guard(db.saveScene(updated));
  }
}

export async function updateScene(
  id: string,
  patch: Partial<Pick<Scene, 'name' | 'emoji'>>,
): Promise<void> {
  await patchScene(id, (s) => ({ ...s, ...patch }));
}

export async function moveScene(from: number, to: number): Promise<void> {
  const ordered = [...get(scenes)].sort((a, b) => a.position - b.position);
  const [moved] = ordered.splice(from, 1);
  if (!moved) return;
  ordered.splice(to, 0, moved);
  const renumbered = ordered.map((s, i) => ({ ...s, position: i }));
  scenes.set(renumbered);
  for (const scene of renumbered) await guard(db.saveScene(scene));
}

export async function deleteScene(id: string): Promise<void> {
  const renumbered = [...get(scenes)]
    .filter((s) => s.id !== id)
    .sort((a, b) => a.position - b.position)
    .map((s, i) => ({ ...s, position: i }));
  scenes.set(renumbered);
  await guard(db.deleteScene(id));
  for (const scene of renumbered) await guard(db.saveScene(scene));
  let remaining = renumbered;
  if (remaining.length === 0) {
    await createScene(defaultSceneName(get(settings).language));
    remaining = get(scenes);
  }
  if (get(settings).activeSceneId === id) {
    await setActiveScene(remaining[0].id);
  }
}

export async function duplicateScene(id: string): Promise<Scene | null> {
  const source = get(scenes).find((s) => s.id === id);
  if (!source) return null;
  const copy: Scene = {
    id: crypto.randomUUID(),
    name: get(t)('scenes.copyName', { name: source.name }),
    emoji: source.emoji,
    pads: source.pads.map((p) => ({ ...p })),
    position: 0, // renumbered below
  };
  const ordered = [...get(scenes)].sort((a, b) => a.position - b.position);
  ordered.splice(ordered.findIndex((s) => s.id === id) + 1, 0, copy);
  const renumbered = ordered.map((s, i) => ({ ...s, position: i }));
  scenes.set(renumbered);
  for (const scene of renumbered) await guard(db.saveScene(scene));
  await setActiveScene(copy.id);
  return copy;
}

export async function addPad(sceneId: string, soundId: string): Promise<void> {
  await patchScene(sceneId, (s) =>
    s.pads.some((p) => p.soundId === soundId)
      ? s
      : { ...s, pads: [...s.pads, { soundId, position: nextPosition(s.pads) }] },
  );
}

export async function updatePad(
  sceneId: string,
  soundId: string,
  patch: Partial<Pick<Pad, 'volume' | 'autoplay'>>,
  debounce = false,
): Promise<void> {
  await patchScene(
    sceneId,
    (s) => ({
      ...s,
      pads: s.pads.map((p) => (p.soundId === soundId ? { ...p, ...patch } : p)),
    }),
    debounce,
  );
}

export async function removePad(sceneId: string, soundId: string): Promise<void> {
  await patchScene(sceneId, (s) => ({
    ...s,
    pads: s.pads
      .filter((p) => p.soundId !== soundId)
      .sort((a, b) => a.position - b.position)
      .map((p, i) => ({ ...p, position: i })),
  }));
}

export async function movePad(sceneId: string, from: number, to: number): Promise<void> {
  await patchScene(sceneId, (s) => {
    const ordered = [...s.pads].sort((a, b) => a.position - b.position);
    const [moved] = ordered.splice(from, 1);
    if (!moved) return s;
    ordered.splice(to, 0, moved);
    return { ...s, pads: ordered.map((p, i) => ({ ...p, position: i })) };
  });
}

export async function updateSound(
  id: string,
  patch: Partial<Pick<Sound, 'name' | 'emoji' | 'type' | 'defaultVolume'>>,
  debounce = false,
): Promise<void> {
  let updated: Sound | undefined;
  sounds.update((list) => list.map((s) => (s.id === id ? (updated = { ...s, ...patch }) : s)));
  if (!updated) return;
  if (debounce) {
    debouncedPersist(`sound:${id}`, () => {
      const current = get(sounds).find((s) => s.id === id);
      return current ? db.saveSound(current) : Promise.resolve();
    });
  } else {
    await guard(db.saveSound(updated));
  }
}

export async function removeSound(id: string): Promise<void> {
  engine.stopSound(id, 0.1);
  engine.removeBuffer(id);
  sounds.update((list) => list.filter((s) => s.id !== id));
  await guard(db.deleteSound(id));
  for (const scene of get(scenes)) {
    if (scene.pads.some((p) => p.soundId === id)) await removePad(scene.id, id);
  }
  for (const set of get(sets).filter((s) => s.soundIds.includes(id))) {
    await removeFromSet(set.id, id);
  }
}

function assertOneshotMembers(memberIds: string[]): Sound[] {
  const members = memberIds.map((id) => get(sounds).find((s) => s.id === id));
  if (members.some((m) => !m || m.type !== 'oneshot')) throw new Error('loopInSet');
  return members as Sound[];
}

export async function createSet(
  memberIds: string[],
  template: { name: string; emoji: string; defaultVolume: number; color?: PadColor },
): Promise<VariationSet> {
  if (memberIds.length < 2) throw new Error('tooFewMembers');
  assertOneshotMembers(memberIds);
  const set: VariationSet = { id: crypto.randomUUID(), soundIds: [...memberIds], ...template };
  sets.update((list) => [...list, set]);
  await guard(db.saveSet(set));
  return set;
}

async function patchSet(
  id: string,
  fn: (set: VariationSet) => VariationSet,
  debounce = false,
): Promise<void> {
  let updated: VariationSet | undefined;
  sets.update((list) => list.map((s) => (s.id === id ? (updated = fn(s)) : s)));
  if (!updated) return;
  if (debounce) {
    debouncedPersist(`set:${id}`, () => {
      const current = get(sets).find((s) => s.id === id);
      return current ? db.saveSet(current) : Promise.resolve();
    });
  } else {
    await guard(db.saveSet(updated));
  }
}

export async function updateSet(
  id: string,
  patch: Partial<Pick<VariationSet, 'name' | 'emoji' | 'defaultVolume' | 'color'>>,
  debounce = false,
): Promise<void> {
  await patchSet(id, (s) => ({ ...s, ...patch }), debounce);
}

export async function addToSet(setId: string, soundIds: string[]): Promise<void> {
  const set = get(sets).find((s) => s.id === setId);
  if (!set) return;
  const fresh = soundIds.filter((id) => !set.soundIds.includes(id));
  if (fresh.length === 0) return;
  assertOneshotMembers(fresh);
  await patchSet(setId, (s) => ({ ...s, soundIds: [...s.soundIds, ...fresh] }));
}

async function dissolveSet(setId: string, survivorId: string): Promise<void> {
  for (const scene of get(scenes)) {
    if (!scene.pads.some((p) => p.soundId === setId)) continue;
    await patchScene(scene.id, (s) => ({
      ...s,
      pads: s.pads.map((p) => (p.soundId === setId ? { ...p, soundId: survivorId } : p)),
    }));
  }
  sets.update((list) => list.filter((s) => s.id !== setId));
  await guard(db.deleteSet(setId));
}

export async function removeFromSet(setId: string, soundId: string): Promise<void> {
  const set = get(sets).find((s) => s.id === setId);
  if (!set) return;
  const remaining = set.soundIds.filter((id) => id !== soundId);
  if (remaining.length === set.soundIds.length) return;
  if (remaining.length === 1) {
    await dissolveSet(setId, remaining[0]);
    return;
  }
  await patchSet(setId, (s) => ({ ...s, soundIds: remaining }));
}

export async function deleteSet(id: string): Promise<void> {
  engine.stopSound(id, 0.1);
  sets.update((list) => list.filter((s) => s.id !== id));
  await guard(db.deleteSet(id));
  for (const scene of get(scenes)) {
    if (scene.pads.some((p) => p.soundId === id)) await removePad(scene.id, id);
  }
}

export async function mergePads(
  sceneId: string,
  sourceRefId: string,
  targetRefId: string,
): Promise<boolean> {
  if (sourceRefId === targetRefId) return false;
  const source = resolveRef(sourceRefId);
  const target = resolveRef(targetRefId);
  if (!source || !target) return false;
  if (source.kind !== 'sound' || source.sound.type !== 'oneshot') return false;
  if (target.kind === 'sound' && target.sound.type !== 'oneshot') return false;

  if (target.kind === 'set') {
    await addToSet(target.set.id, [source.sound.id]);
  } else {
    const set = await createSet([target.sound.id, source.sound.id], {
      name: target.sound.name,
      emoji: target.sound.emoji,
      defaultVolume: target.sound.defaultVolume,
      color: target.sound.color,
    });
    await patchScene(sceneId, (s) => ({
      ...s,
      pads: s.pads.map((p) => (p.soundId === targetRefId ? { ...p, soundId: set.id } : p)),
    }));
  }
  await removePad(sceneId, sourceRefId);
  return true;
}

export async function addFilesToPad(
  sceneId: string,
  refId: string,
  files: File[],
  decode: Decoder,
): Promise<{
  added: Sound[];
  failed: { name: string; reason: 'unsupported' | 'quota' }[];
  rejectedLoops: number;
  applied: boolean;
}> {
  const { added, failed } = await uploadFiles(files, decode);
  const oneshots = added.filter((s) => s.type === 'oneshot');
  const rejectedLoops = added.length - oneshots.length;
  const ref = resolveRef(refId);
  const targetIsOneshot =
    ref?.kind === 'set' || (ref?.kind === 'sound' && ref.sound.type === 'oneshot');
  if (!targetIsOneshot || oneshots.length === 0) {
    return { added, failed, rejectedLoops, applied: false };
  }
  if (ref.kind === 'set') {
    await addToSet(ref.set.id, oneshots.map((s) => s.id));
  } else {
    const set = await createSet([ref.sound.id, ...oneshots.map((s) => s.id)], {
      name: ref.sound.name,
      emoji: ref.sound.emoji,
      defaultVolume: ref.sound.defaultVolume,
      color: ref.sound.color,
    });
    await patchScene(sceneId, (s) => ({
      ...s,
      pads: s.pads.map((p) => (p.soundId === refId ? { ...p, soundId: set.id } : p)),
    }));
  }
  return { added, failed, rejectedLoops, applied: true };
}

async function ensureBuffer(sound: Sound): Promise<boolean> {
  if (engine.hasBuffer(sound.id)) return true;
  const bytes = await db.getBlob(sound.id);
  if (!bytes) return false;
  try {
    engine.setBuffer(sound.id, await engine.decode(bytes));
  } catch {
    return false;
  }
  return true;
}

function markBroken(soundId: string): void {
  brokenSounds.update((set) => new Set(set).add(soundId));
}

let rng: () => number = Math.random;
const lastPick = new Map<string, string>();

export function _setRngForTests(fn: () => number): void {
  rng = fn;
}

export function _lastPick(setId: string): string | undefined {
  return lastPick.get(setId);
}

async function playSound(sound: Sound, volume?: number): Promise<void> {
  if (sound.type === 'loop' && engine.isSoundPlaying(sound.id)) {
    engine.stopSound(sound.id, get(settings).fades.stop);
    return;
  }
  if (!(await ensureBuffer(sound))) {
    markBroken(sound.id);
    return;
  }
  engine.play(sound, volume ?? sound.defaultVolume);
}

async function playFromSet(set: VariationSet, volume?: number): Promise<void> {
  const members = set.soundIds
    .map((id) => get(sounds).find((s) => s.id === id))
    .filter((s): s is Sound => Boolean(s));
  const previous = lastPick.get(set.id);
  const candidates = members.length > 1 ? members.filter((m) => m.id !== previous) : [...members];
  const queue = [...candidates];
  while (queue.length > 0) {
    const index = Math.floor(rng() * queue.length);
    const [member] = queue.splice(index, 1);
    if (await ensureBuffer(member)) {
      lastPick.set(set.id, member.id);
      engine.play(member, volume ?? set.defaultVolume, 0, set.id);
      return;
    }
  }
  // every candidate failed — as a last resort, allow the previous pick
  const last = members.find((m) => m.id === previous && !candidates.some((c) => c.id === m.id));
  if (last && (await ensureBuffer(last))) {
    lastPick.set(set.id, last.id);
    engine.play(last, volume ?? set.defaultVolume, 0, set.id);
    return;
  }
  markBroken(set.id);
}

export async function triggerRef(refId: string, volume?: number): Promise<void> {
  const ref = resolveRef(refId);
  if (!ref) return;
  if (ref.kind === 'sound') await playSound(ref.sound, volume);
  else await playFromSet(ref.set, volume);
}

export async function triggerSound(soundId: string, volume?: number): Promise<void> {
  const sound = get(sounds).find((s) => s.id === soundId);
  if (!sound) return;
  await playSound(sound, volume);
}

export async function triggerPad(pad: Pad): Promise<void> {
  await triggerRef(pad.soundId, pad.volume);
}

export async function activateScene(id: string): Promise<void> {
  if (get(settings).activeSceneId === id) return;
  await setActiveScene(id);
  const crossfade = get(settings).fades.crossfade;
  engine.stopLoops(crossfade);
  const scene = get(scenes).find((s) => s.id === id);
  if (!scene) return;
  for (const pad of [...scene.pads].sort((a, b) => a.position - b.position)) {
    if (!pad.autoplay) continue;
    const sound = get(sounds).find((s) => s.id === pad.soundId);
    if (!sound || sound.type !== 'loop') continue;
    const ok = await ensureBuffer(sound);
    if (get(settings).activeSceneId !== id) return; // a newer activation won
    if (!ok) {
      markBroken(sound.id);
      continue;
    }
    engine.play(sound, pad.volume ?? sound.defaultVolume, crossfade);
  }
}
