import { derived, get, writable } from 'svelte/store';
import * as db from './db';
import { engine } from './engine';
import { detectLang, lang, type Lang } from './i18n';
import { DEFAULT_SETTINGS, type Pad, type Scene, type Settings, type Sound } from './types';

export const sounds = writable<Sound[]>([]);
export const scenes = writable<Scene[]>([]);
export const settings = writable<Settings>({ ...DEFAULT_SETTINGS });
export const brokenSounds = writable<Set<string>>(new Set());
export const searchQuery = writable('');
export const editMode = writable(false);
export const libraryOpen = writable(false);
export const editingSound = writable<string | null>(null);

export const activeScene = derived([scenes, settings], ([$scenes, $settings]) =>
  $scenes.find((s) => s.id === $settings.activeSceneId) ?? null,
);

export type Decoder = (data: ArrayBuffer) => Promise<{ duration: number }>;

const LOOP_THRESHOLD_SECONDS = 30;

function nextPosition(items: { position: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.position), -1) + 1;
}

function defaultSceneName(language: Lang): string {
  return language === 'de' ? 'Szene 1' : 'Scene 1';
}

export async function init(): Promise<void> {
  const [allSounds, allScenes, stored] = await Promise.all([
    db.getAllSounds(),
    db.getAllScenes(),
    db.loadSettings(),
  ]);
  const current: Settings = stored ?? { ...DEFAULT_SETTINGS, language: detectLang() };
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
  settings.set(current);
  lang.set(current.language);
  engine.setMasterVolume(current.masterVolume);
  await db.saveSettings(current);
}

async function patchSettings(patch: Partial<Settings>): Promise<void> {
  const next = { ...get(settings), ...patch };
  settings.set(next);
  await db.saveSettings(next);
}

export async function setMasterVolume(volume: number): Promise<void> {
  engine.setMasterVolume(volume);
  await patchSettings({ masterVolume: volume });
}

export async function setLanguage(language: Lang): Promise<void> {
  lang.set(language);
  await patchSettings({ language });
}

export async function setActiveScene(id: string | null): Promise<void> {
  await patchSettings({ activeSceneId: id });
}

export async function importFiles(
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
  if (added.length > 0) {
    sounds.update((list) => [...list, ...added]);
    const scene = get(activeScene);
    if (scene) {
      for (const sound of added) await addPad(scene.id, sound.id);
    }
  }
  return { added, failed };
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
  await db.saveScene(scene);
  await setActiveScene(scene.id);
  return scene;
}

async function patchScene(id: string, fn: (scene: Scene) => Scene): Promise<void> {
  let updated: Scene | undefined;
  scenes.update((list) => list.map((s) => (s.id === id ? (updated = fn(s)) : s)));
  if (updated) await db.saveScene(updated);
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
  for (const scene of renumbered) await db.saveScene(scene);
}

export async function deleteScene(id: string): Promise<void> {
  scenes.update((list) => list.filter((s) => s.id !== id));
  await db.deleteScene(id);
  let remaining = get(scenes);
  if (remaining.length === 0) {
    await createScene(defaultSceneName(get(settings).language));
    remaining = get(scenes);
  }
  if (get(settings).activeSceneId === id) {
    await setActiveScene(remaining[0].id);
  }
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
): Promise<void> {
  await patchScene(sceneId, (s) => ({
    ...s,
    pads: s.pads.map((p) => (p.soundId === soundId ? { ...p, ...patch } : p)),
  }));
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
): Promise<void> {
  let updated: Sound | undefined;
  sounds.update((list) => list.map((s) => (s.id === id ? (updated = { ...s, ...patch }) : s)));
  if (updated) await db.saveSound(updated);
}

export async function removeSound(id: string): Promise<void> {
  engine.stopSound(id, 0.1);
  sounds.update((list) => list.filter((s) => s.id !== id));
  await db.deleteSound(id);
  for (const scene of get(scenes)) {
    if (scene.pads.some((p) => p.soundId === id)) await removePad(scene.id, id);
  }
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

export async function triggerSound(soundId: string, volume?: number): Promise<void> {
  const sound = get(sounds).find((s) => s.id === soundId);
  if (!sound) return;
  if (sound.type === 'loop' && engine.isSoundPlaying(sound.id)) {
    engine.stopSound(sound.id);
    return;
  }
  if (!(await ensureBuffer(sound))) {
    markBroken(sound.id);
    return;
  }
  engine.play(sound, volume ?? sound.defaultVolume);
}

export async function triggerPad(pad: Pad): Promise<void> {
  await triggerSound(pad.soundId, pad.volume);
}

export async function activateScene(id: string): Promise<void> {
  if (get(settings).activeSceneId === id) return;
  await setActiveScene(id);
  engine.stopLoops(1.5);
  const scene = get(scenes).find((s) => s.id === id);
  if (!scene) return;
  for (const pad of [...scene.pads].sort((a, b) => a.position - b.position)) {
    if (!pad.autoplay) continue;
    const sound = get(sounds).find((s) => s.id === pad.soundId);
    if (!sound || sound.type !== 'loop') continue;
    if (!(await ensureBuffer(sound))) {
      markBroken(sound.id);
      continue;
    }
    engine.play(sound, pad.volume ?? sound.defaultVolume, 1.5);
  }
}
