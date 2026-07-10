import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Scene, Settings, Sound, VariationSet } from './types';

interface GrimoireSchema extends DBSchema {
  sounds: { key: string; value: Sound };
  blobs: { key: string; value: ArrayBuffer };
  scenes: { key: string; value: Scene };
  settings: { key: string; value: Settings };
  sets: { key: string; value: VariationSet };
}

let dbPromise: Promise<IDBPDatabase<GrimoireSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<GrimoireSchema>> {
  dbPromise ??= openDB<GrimoireSchema>('grimoire', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('sounds', { keyPath: 'id' });
        db.createObjectStore('blobs');
        db.createObjectStore('scenes', { keyPath: 'id' });
        db.createObjectStore('settings');
      }
      if (oldVersion < 2) {
        db.createObjectStore('sets', { keyPath: 'id' });
      }
    },
  });
  return dbPromise;
}

export async function saveSound(sound: Sound, bytes?: ArrayBuffer): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['sounds', 'blobs'], 'readwrite');
  await tx.objectStore('sounds').put(sound);
  if (bytes) await tx.objectStore('blobs').put(bytes, sound.id);
  await tx.done;
}

export async function deleteSound(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['sounds', 'blobs'], 'readwrite');
  await tx.objectStore('sounds').delete(id);
  await tx.objectStore('blobs').delete(id);
  await tx.done;
}

export async function getAllSounds(): Promise<Sound[]> {
  return (await getDB()).getAll('sounds');
}

export async function getBlob(id: string): Promise<ArrayBuffer | undefined> {
  return (await getDB()).get('blobs', id);
}

export async function saveScene(scene: Scene): Promise<void> {
  await (await getDB()).put('scenes', scene);
}

export async function deleteScene(id: string): Promise<void> {
  await (await getDB()).delete('scenes', id);
}

export async function getAllScenes(): Promise<Scene[]> {
  return (await getDB()).getAll('scenes');
}

export async function loadSettings(): Promise<Settings | undefined> {
  return (await getDB()).get('settings', 'main');
}

export async function saveSettings(settings: Settings): Promise<void> {
  await (await getDB()).put('settings', settings, 'main');
}

export async function saveSet(set: VariationSet): Promise<void> {
  await (await getDB()).put('sets', set);
}

export async function deleteSet(id: string): Promise<void> {
  await (await getDB()).delete('sets', id);
}

export async function getAllSets(): Promise<VariationSet[]> {
  return (await getDB()).getAll('sets');
}

export async function _resetForTests(): Promise<void> {
  if (dbPromise) {
    (await dbPromise).close();
    dbPromise = null;
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('grimoire');
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
