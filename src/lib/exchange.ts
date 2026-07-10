import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import * as db from './db';
import { DEFAULT_SETTINGS, type Scene, type Settings, type Sound } from './types';

interface Manifest {
  version: 1;
  sounds: Sound[];
  scenes: Scene[];
  settings: Settings;
}

export async function exportAll(): Promise<Uint8Array> {
  const [sounds, scenes, settings] = await Promise.all([
    db.getAllSounds(),
    db.getAllScenes(),
    db.loadSettings(),
  ]);
  const manifest: Manifest = {
    version: 1,
    sounds,
    scenes,
    settings: settings ?? DEFAULT_SETTINGS,
  };
  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
  };
  for (const sound of sounds) {
    const bytes = await db.getBlob(sound.id);
    if (bytes) files[`sounds/${sound.id}`] = new Uint8Array(bytes);
  }
  // level 0: audio formats are already compressed
  return zipSync(files, { level: 0 });
}

export async function importZip(data: Uint8Array): Promise<{ sounds: number; scenes: number }> {
  const files = unzipSync(data);
  const rawManifest = files['manifest.json'];
  if (!rawManifest) throw new Error('manifest.json missing from archive');
  const manifest = JSON.parse(strFromU8(rawManifest)) as Manifest;
  if (manifest.version !== 1) throw new Error(`Unsupported archive version: ${manifest.version}`);

  let importedSounds = 0;
  for (const sound of manifest.sounds ?? []) {
    const bytes = files[`sounds/${sound.id}`];
    if (!bytes) continue;
    await db.saveSound(sound, bytes.slice().buffer);
    importedSounds++;
  }
  const sceneList = manifest.scenes ?? [];
  for (const scene of sceneList) await db.saveScene(scene);
  return { sounds: importedSounds, scenes: sceneList.length };
}
