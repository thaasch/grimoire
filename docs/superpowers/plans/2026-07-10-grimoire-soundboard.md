# GRIMOIRE — PnP Soundboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build GRIMOIRE, a fully client-side soundboard for tabletop-RPG game masters: drag & drop audio files into the browser, organize them into scenes, play layered loops and one-shots with crossfades — wrapped in a dark "Arcane Console" design.

**Architecture:** Svelte 5 (runes) + Vite single-page app. A framework-free Web Audio engine (`engine.ts`) plays decoded AudioBuffers through per-instance and master gain nodes. IndexedDB (via `idb`) persists sound metadata, audio bytes, scenes, and settings; Svelte stores (`stores.ts`) mediate between UI, engine, and DB. Zip export/import via `fflate`.

**Tech Stack:** Svelte 5, Vite 6, TypeScript, Vitest + fake-indexeddb, idb, fflate. No other runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-07-10-pnp-soundboard-design.md` — read it before starting.

## Global Constraints

- Node ≥ 20 required (tests use the global `File` class).
- Runtime dependencies: exactly `idb` and `fflate`. Dev tooling as pinned in Task 1. Do not add others.
- Svelte 5 runes syntax (`$state`, `$derived`, `$props`, `$effect`) in components; classic `svelte/store` writables in `src/lib/` so plain Vitest can test them.
- Every user-visible string goes through `t('key')` with the key present in **both** `de` and `en` dictionaries.
- Colors only via the CSS custom properties defined in `src/app.css` (`--bg`, `--panel`, `--gold`, `--ember`, …). Ember orange is reserved for playing/active states.
- Desktop-only (≥1024px). No responsive/mobile work.
- Fade times: single stop 0.3 s; Stop All 1.5 s; scene crossfade 1.5 s. Loop threshold: duration > 30 s.
- App title: GRIMOIRE. IndexedDB database name: `grimoire`.
- After each task: all tests green (`npm test`), `npm run check` clean, then commit.

## File Structure

```
pnp-soundboard/
  index.html                 Vite entry
  package.json               scripts + pinned deps
  vite.config.ts / vitest.config.ts / tsconfig.json / svelte.config.js
  src/
    main.ts                  mount App
    app.css                  theme tokens + base styles
    App.svelte               layout shell, global listeners (drop, hotkeys, unlock)
    lib/
      types.ts               Sound / Pad / Scene / Settings interfaces
      i18n.ts                DE/EN dictionaries, lang store, t()
      db.ts                  IndexedDB access (idb); no audio, no Svelte
      engine.ts              Web Audio engine; no DB, no components
      stores.ts              app state + actions; glues db + engine
      hotkeys.ts             pure key-mapping helpers
      exchange.ts            zip export/import (fflate)
      toasts.ts              toast store
    components/
      TopBar.svelte          title, SceneTabs, search, edit toggle, library, lang
      SceneTabs.svelte       tabs: activate, rename, emoji, delete, reorder, add
      Stage.svelte           pad grid + library-match row + empty state
      Pad.svelte             one pad: states, progress, edit controls
      MixerDock.svelte       instance chips, master volume, stop all, unlock hint
      InstanceChip.svelte    one playing instance
      LibraryModal.svelte    all sounds, search, add/delete, export/import
      SoundEditModal.svelte  edit name/emoji/type/volume of a sound
      DropOverlay.svelte     full-screen drop hint
      Toasts.svelte          toast rendering
  tests/
    mocks/audio.ts           Mock AudioContext/Gain/Source
    *.test.ts                per-module test files
```

Dependency direction: `components → stores → (db, engine, i18n)`. `db`, `engine`, `hotkeys`, `i18n` never import each other (exception: stores imports all). `exchange` imports only `db` + `types`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `svelte.config.js`, `index.html`, `src/main.ts`, `src/app.css`, `src/App.svelte`, `src/vite-env.d.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: working `npm run dev|build|check|test` toolchain; CSS custom properties every later task styles against.

- [ ] **Step 1: Write all scaffold files**

`package.json`:

```json
{
  "name": "grimoire-soundboard",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "fflate": "^0.8.2",
    "idb": "^8.0.0"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "@tsconfig/svelte": "^5.0.4",
    "fake-indexeddb": "^6.0.0",
    "svelte": "^5.16.0",
    "svelte-check": "^4.1.0",
    "typescript": "~5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

`vite.config.ts`:

```ts
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
});
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

`tsconfig.json`:

```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleDetection": "force",
    "isolatedModules": true,
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.svelte", "tests/**/*.ts"]
}
```

`svelte.config.js`:

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
};
```

`index.html`:

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚔️</text></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GRIMOIRE — PnP Soundboard</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`:

```ts
import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const app = mount(App, { target: document.getElementById('app')! });

export default app;
```

`src/vite-env.d.ts`:

```ts
/// <reference types="svelte" />
/// <reference types="vite/client" />
```

`src/app.css`:

```css
:root {
  --bg: #0d0a12;
  --panel: #161020;
  --panel-border: rgba(232, 200, 126, 0.2);
  --gold: #e8c87e;
  --gold-dim: rgba(232, 200, 126, 0.25);
  --gold-faint: rgba(232, 200, 126, 0.06);
  --ember: #ff6b35;
  --ember-glow: rgba(255, 107, 53, 0.4);
  --text: #d8cde8;
  --muted: #8a7a9a;
  --danger: #e89a9a;
  --danger-border: rgba(220, 80, 80, 0.5);
  --danger-bg: rgba(180, 40, 40, 0.2);
  --font-display: Georgia, 'Times New Roman', serif;
  --font-ui: system-ui, -apple-system, sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  height: 100%;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-display);
  overflow: hidden;
}

#app {
  height: 100%;
}

button {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
}

input,
select {
  font: inherit;
}

input[type='range'] {
  accent-color: var(--gold);
}
```

`src/App.svelte` (placeholder, replaced in Task 8):

```svelte
<main>
  <h1>⚔ GRIMOIRE</h1>
</main>

<style>
  main {
    display: grid;
    place-items: center;
    height: 100vh;
  }

  h1 {
    color: var(--gold);
    letter-spacing: 0.3em;
    font-weight: normal;
  }
</style>
```

`tests/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('toolchain', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Install and verify the toolchain**

Run (in `/home/timo/tricks/code/ideas/pnp-soundboard`):

```bash
npm install
npm test
npm run check
npm run build
```

Expected: install succeeds; `1 passed` from Vitest; `svelte-check found 0 errors`; build ends with `✓ built in …`.

- [ ] **Step 3: Verify dev server renders the placeholder**

Run: `npm run dev` — open the printed URL. Expected: near-black page with gold "⚔ GRIMOIRE" centered. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Svelte 5 + Vite + Vitest toolchain with Arcane theme tokens"
```

---

### Task 2: Types and i18n

**Files:**
- Create: `src/lib/types.ts`, `src/lib/i18n.ts`
- Test: `tests/i18n.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `types.ts`: `Sound`, `Pad`, `Scene`, `Settings`, `SoundType`, `DEFAULT_SETTINGS`
  - `i18n.ts`: `lang: Writable<Lang>`, `t: Readable<(key: TranslationKey, vars?) => string>`, `detectLang(navLang?): Lang`, types `Lang`, `TranslationKey`

- [ ] **Step 1: Write the failing tests**

`tests/i18n.test.ts`:

```ts
import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { detectLang, lang, t } from '../src/lib/i18n';

describe('i18n', () => {
  it('translates keys in the active language', () => {
    lang.set('de');
    expect(get(t)('mixer.stopAll')).toBe('Alles stoppen');
    lang.set('en');
    expect(get(t)('mixer.stopAll')).toBe('Stop all');
  });

  it('interpolates variables', () => {
    lang.set('de');
    expect(get(t)('scenes.defaultName', { n: 3 })).toBe('Szene 3');
  });

  it('detects German browser languages, defaults to English', () => {
    expect(detectLang('de-DE')).toBe('de');
    expect(detectLang('de')).toBe('de');
    expect(detectLang('en-US')).toBe('en');
    expect(detectLang('fr')).toBe('en');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/lib/i18n'` (or similar resolve error).

- [ ] **Step 3: Write the implementation**

`src/lib/types.ts`:

```ts
export type SoundType = 'loop' | 'oneshot';

export interface Sound {
  id: string; // uuid
  name: string;
  emoji: string; // pad icon, user-editable, default '🎵'
  type: SoundType; // guessed on upload (duration > 30s => loop), editable
  defaultVolume: number; // 0..1
  duration: number; // seconds, from decode
  mimeType: string;
  createdAt: number;
}

export interface Pad {
  soundId: string;
  volume?: number; // per-scene override, else sound.defaultVolume
  autoplay?: boolean; // loops only: start when scene is activated
  position: number; // grid order
}

export interface Scene {
  id: string;
  name: string;
  emoji: string;
  pads: Pad[];
  position: number; // tab order
}

export interface Settings {
  language: 'de' | 'en';
  masterVolume: number; // 0..1
  activeSceneId: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'de',
  masterVolume: 0.8,
  activeSceneId: null,
};
```

`src/lib/i18n.ts`:

```ts
import { derived, writable } from 'svelte/store';

export type Lang = 'de' | 'en';

const de = {
  'scenes.new': 'Neue Szene',
  'scenes.defaultName': 'Szene {n}',
  'scenes.rename': 'Umbenennen',
  'scenes.delete': 'Löschen',
  'scenes.deleteConfirm': 'Szene "{name}" wirklich löschen?',
  'stage.dropHint': 'Dateien hierher ziehen',
  'search.placeholder': 'Suchen…',
  'search.fromLibrary': 'Aus der Bibliothek',
  'library.title': 'Bibliothek',
  'library.empty': 'Noch keine Sounds — Audiodateien einfach ins Fenster ziehen',
  'library.addToScene': 'Zur Szene',
  'library.export': 'Exportieren',
  'library.import': 'Importieren',
  'library.deleteConfirm': '"{name}" endgültig löschen? Er wird aus allen Szenen entfernt.',
  'mixer.nothing': 'Nichts spielt',
  'mixer.stopAll': 'Alles stoppen',
  'mixer.master': 'Master',
  'mixer.enableAudio': 'Klicken zum Aktivieren',
  'pad.volume': 'Lautstärke',
  'pad.autoplay': 'Autostart bei Szenenwechsel',
  'pad.remove': 'Aus Szene entfernen',
  'pad.editSound': 'Sound bearbeiten',
  'pad.broken': 'Datei fehlt',
  'edit.mode': 'Bearbeiten',
  'edit.done': 'Fertig',
  'sound.name': 'Name',
  'sound.type': 'Typ',
  'sound.loop': 'Loop',
  'sound.oneshot': 'Einmalig',
  'toast.added': '{n} Sound(s) hinzugefügt',
  'toast.unsupported': '"{name}" konnte nicht gelesen werden',
  'toast.quota': 'Speicher voll — bitte exportieren und aufräumen',
  'toast.imported': '{sounds} Sounds, {scenes} Szenen importiert',
  'app.unsupported': 'Dieser Browser unterstützt kein Web Audio — bitte einen aktuellen Browser verwenden.',
} as const;

export type TranslationKey = keyof typeof de;

const en: Record<TranslationKey, string> = {
  'scenes.new': 'New scene',
  'scenes.defaultName': 'Scene {n}',
  'scenes.rename': 'Rename',
  'scenes.delete': 'Delete',
  'scenes.deleteConfirm': 'Really delete scene "{name}"?',
  'stage.dropHint': 'Drop files here',
  'search.placeholder': 'Search…',
  'search.fromLibrary': 'From the library',
  'library.title': 'Library',
  'library.empty': 'No sounds yet — just drag audio files into the window',
  'library.addToScene': 'To scene',
  'library.export': 'Export',
  'library.import': 'Import',
  'library.deleteConfirm': 'Delete "{name}" permanently? It will be removed from all scenes.',
  'mixer.nothing': 'Nothing playing',
  'mixer.stopAll': 'Stop all',
  'mixer.master': 'Master',
  'mixer.enableAudio': 'Click to enable audio',
  'pad.volume': 'Volume',
  'pad.autoplay': 'Autoplay on scene switch',
  'pad.remove': 'Remove from scene',
  'pad.editSound': 'Edit sound',
  'pad.broken': 'File missing',
  'edit.mode': 'Edit',
  'edit.done': 'Done',
  'sound.name': 'Name',
  'sound.type': 'Type',
  'sound.loop': 'Loop',
  'sound.oneshot': 'One-shot',
  'toast.added': '{n} sound(s) added',
  'toast.unsupported': 'Could not read "{name}"',
  'toast.quota': 'Storage full — please export and clean up',
  'toast.imported': 'Imported {sounds} sounds, {scenes} scenes',
  'app.unsupported': 'This browser does not support Web Audio — please use a current browser.',
};

const dictionaries: Record<Lang, Record<TranslationKey, string>> = { de, en };

export const lang = writable<Lang>('de');

export const t = derived(
  lang,
  ($lang) =>
    (key: TranslationKey, vars: Record<string, string | number> = {}): string => {
      let text: string = dictionaries[$lang][key] ?? de[key] ?? key;
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
      return text;
    },
);

export function detectLang(
  navLang = typeof navigator !== 'undefined' ? navigator.language : 'en',
): Lang {
  return navLang?.toLowerCase().startsWith('de') ? 'de' : 'en';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all i18n tests PASS.
Run: `npm run check` — Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/i18n.ts tests/i18n.test.ts
git commit -m "feat: add domain types and DE/EN i18n"
```

---

### Task 3: IndexedDB layer (db.ts)

**Files:**
- Create: `src/lib/db.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Consumes: `types.ts` (`Sound`, `Scene`, `Settings`)
- Produces (all `async`):
  - `saveSound(sound: Sound, bytes?: ArrayBuffer): Promise<void>` — metadata + optional audio bytes in one transaction
  - `deleteSound(id: string): Promise<void>` — removes metadata **and** bytes
  - `getAllSounds(): Promise<Sound[]>`, `getBlob(id: string): Promise<ArrayBuffer | undefined>`
  - `saveScene(scene: Scene)`, `deleteScene(id: string)`, `getAllScenes(): Promise<Scene[]>`
  - `loadSettings(): Promise<Settings | undefined>` (undefined = first run), `saveSettings(settings: Settings)`
  - `_resetForTests(): Promise<void>`

Audio bytes are stored as `ArrayBuffer` (not `Blob`) — structured-clones cleanly in fake-indexeddb and feeds `decodeAudioData` directly.

- [ ] **Step 1: Write the failing tests**

`tests/db.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/lib/db`.

- [ ] **Step 3: Write the implementation**

`src/lib/db.ts`:

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Scene, Settings, Sound } from './types';

interface GrimoireSchema extends DBSchema {
  sounds: { key: string; value: Sound };
  blobs: { key: string; value: ArrayBuffer };
  scenes: { key: string; value: Scene };
  settings: { key: string; value: Settings };
}

let dbPromise: Promise<IDBPDatabase<GrimoireSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<GrimoireSchema>> {
  dbPromise ??= openDB<GrimoireSchema>('grimoire', 1, {
    upgrade(db) {
      db.createObjectStore('sounds', { keyPath: 'id' });
      db.createObjectStore('blobs');
      db.createObjectStore('scenes', { keyPath: 'id' });
      db.createObjectStore('settings');
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all db tests PASS.
Run: `npm run check` — Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/db.test.ts
git commit -m "feat: add IndexedDB persistence layer"
```

---

### Task 4: Web Audio engine (engine.ts)

**Files:**
- Create: `src/lib/engine.ts`, `tests/mocks/audio.ts`
- Test: `tests/engine.test.ts`

**Interfaces:**
- Consumes: `types.ts` (`Sound`)
- Produces: `createEngine(createContext?)` and the singleton `export const engine`. Engine API:
  - `playing: Writable<Instance[]>` where `Instance = { id, soundId, loop, volume, startedAt, duration, stopping }`
  - `unlocked: Writable<boolean>`, `unlock(): Promise<void>`, `now(): number`
  - `decode(data: ArrayBuffer): Promise<AudioBuffer>`, `hasBuffer(soundId): boolean`, `setBuffer(soundId, buffer): void`
  - `play(sound: Sound, volume?: number, fadeIn?: number): string | null` (null = no buffer)
  - `stop(id, fade = 0.3)`, `stopAll(fade = 1.5)`, `stopLoops(fade = 1.5)`, `stopSound(soundId, fade = 0.3)`, `isSoundPlaying(soundId): boolean`
  - `setInstanceVolume(id, volume)`, `setMasterVolume(volume)`

The AudioContext is created lazily on first use, so importing this module in Node tests is safe.

- [ ] **Step 1: Write the audio mocks**

`tests/mocks/audio.ts`:

```ts
export class MockParam {
  value = 1;
  events: Array<{ type: 'set' | 'ramp' | 'cancel'; value?: number; time?: number }> = [];

  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: 'set', value, time });
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: 'ramp', value, time });
  }

  cancelScheduledValues(time: number) {
    this.events.push({ type: 'cancel', time });
  }
}

export class MockNode {
  connections: unknown[] = [];

  connect(target: unknown) {
    this.connections.push(target);
  }

  disconnect() {}
}

export class MockGain extends MockNode {
  gain = new MockParam();
}

export class MockSource extends MockNode {
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  started: number[] = [];
  stopped: number[] = [];

  start(when = 0) {
    this.started.push(when);
  }

  // Deliberately does NOT fire onended — tests trigger it manually to
  // simulate the scheduled stop time actually arriving.
  stop(when = 0) {
    this.stopped.push(when);
  }
}

export class MockAudioContext {
  currentTime = 0;
  state: 'suspended' | 'running' = 'suspended';
  destination = new MockNode();
  gains: MockGain[] = [];
  sources: MockSource[] = [];

  async resume() {
    this.state = 'running';
  }

  createGain() {
    const gain = new MockGain();
    this.gains.push(gain);
    return gain;
  }

  createBufferSource() {
    const source = new MockSource();
    this.sources.push(source);
    return source;
  }

  async decodeAudioData(data: ArrayBuffer) {
    return { duration: 42, length: data.byteLength } as unknown as AudioBuffer;
  }
}
```

- [ ] **Step 2: Write the failing tests**

`tests/engine.test.ts`:

```ts
import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/lib/engine';
import type { Sound } from '../src/lib/types';
import { MockAudioContext } from './mocks/audio';

const FAKE_BUFFER = { duration: 42 } as unknown as AudioBuffer;

function makeSound(over: Partial<Sound> = {}): Sound {
  return {
    id: 's1',
    name: 'Fire',
    emoji: '🔥',
    type: 'loop',
    defaultVolume: 0.8,
    duration: 42,
    mimeType: 'audio/mpeg',
    createdAt: 0,
    ...over,
  };
}

function setup() {
  const ctx = new MockAudioContext();
  const engine = createEngine(() => ctx as unknown as AudioContext);
  return { ctx, engine };
}

describe('engine.play', () => {
  it('wires source → instance gain → master and reports the instance', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    const id = engine.play(makeSound());
    expect(id).not.toBeNull();
    // gains[0] is the master (created in ensure()), gains[1] the instance gain
    expect(ctx.gains).toHaveLength(2);
    expect(ctx.gains[0].connections).toContain(ctx.destination);
    expect(ctx.gains[1].connections).toContain(ctx.gains[0]);
    expect(ctx.sources[0].connections).toContain(ctx.gains[1]);
    expect(ctx.sources[0].loop).toBe(true);
    expect(ctx.sources[0].started).toEqual([0]);
    const list = get(engine.playing);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ soundId: 's1', loop: true, volume: 0.8, stopping: false });
  });

  it('returns null when no buffer is loaded', () => {
    const { engine } = setup();
    expect(engine.play(makeSound())).toBeNull();
    expect(get(engine.playing)).toEqual([]);
  });

  it('one-shots do not loop', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    engine.play(makeSound({ type: 'oneshot' }));
    expect(ctx.sources[0].loop).toBe(false);
  });

  it('fadeIn ramps gain from 0 to the target volume', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    engine.play(makeSound(), 0.6, 1.5);
    const events = ctx.gains[1].gain.events;
    expect(events).toContainEqual({ type: 'set', value: 0, time: 0 });
    expect(events).toContainEqual({ type: 'ramp', value: 0.6, time: 1.5 });
  });
});

describe('engine.stop', () => {
  it('fades to zero, schedules source.stop, marks stopping; onended removes', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    const id = engine.play(makeSound())!;
    engine.stop(id, 0.3);
    const events = ctx.gains[1].gain.events;
    expect(events).toContainEqual({ type: 'ramp', value: 0, time: 0.3 });
    expect(ctx.sources[0].stopped).toEqual([0.3]);
    expect(get(engine.playing)[0].stopping).toBe(true);
    ctx.sources[0].onended!();
    expect(get(engine.playing)).toEqual([]);
  });

  it('stopAll fades everything with the 1.5s default', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    engine.setBuffer('s2', FAKE_BUFFER);
    engine.play(makeSound());
    engine.play(makeSound({ id: 's2', type: 'oneshot' }));
    engine.stopAll();
    expect(ctx.sources[0].stopped).toEqual([1.5]);
    expect(ctx.sources[1].stopped).toEqual([1.5]);
  });

  it('stopLoops leaves one-shots running', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    engine.setBuffer('s2', FAKE_BUFFER);
    engine.play(makeSound());
    engine.play(makeSound({ id: 's2', type: 'oneshot' }));
    engine.stopLoops();
    expect(ctx.sources[0].stopped).toEqual([1.5]);
    expect(ctx.sources[1].stopped).toEqual([]);
  });
});

describe('engine volumes and queries', () => {
  it('setInstanceVolume updates the gain param and the store', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    const id = engine.play(makeSound())!;
    engine.setInstanceVolume(id, 0.25);
    expect(ctx.gains[1].gain.events).toContainEqual({ type: 'set', value: 0.25, time: 0 });
    expect(get(engine.playing)[0].volume).toBe(0.25);
  });

  it('setMasterVolume before first playback applies when the context is created', () => {
    const { ctx, engine } = setup();
    engine.setMasterVolume(0.5);
    engine.setBuffer('s1', FAKE_BUFFER);
    engine.play(makeSound());
    expect(ctx.gains[0].gain.value).toBe(0.5);
  });

  it('isSoundPlaying ignores stopping instances; stopSound stops all of a sound', () => {
    const { engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    const id = engine.play(makeSound())!;
    expect(engine.isSoundPlaying('s1')).toBe(true);
    engine.stopSound('s1');
    expect(engine.isSoundPlaying('s1')).toBe(false);
    expect(get(engine.playing)[0].id).toBe(id); // still fading, just marked stopping
  });

  it('unlock resumes a suspended context', async () => {
    const { ctx, engine } = setup();
    expect(get(engine.unlocked)).toBe(false);
    await engine.unlock();
    expect(ctx.state).toBe('running');
    expect(get(engine.unlocked)).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/lib/engine`.

- [ ] **Step 4: Write the implementation**

`src/lib/engine.ts`:

```ts
import { get, writable, type Writable } from 'svelte/store';
import type { Sound } from './types';

export interface Instance {
  id: string;
  soundId: string;
  loop: boolean;
  volume: number; // target volume of the instance gain, 0..1
  startedAt: number; // ctx.currentTime at start
  duration: number; // buffer duration in seconds
  stopping: boolean;
}

export type Engine = ReturnType<typeof createEngine>;

export function createEngine(createContext: () => AudioContext = () => new AudioContext()) {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let masterVolume = 0.8;
  let counter = 0;
  const buffers = new Map<string, AudioBuffer>();
  const nodes = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();
  const playing: Writable<Instance[]> = writable([]);
  const unlocked = writable(false);

  function ensure(): AudioContext {
    if (!ctx) {
      ctx = createContext();
      master = ctx.createGain();
      master.gain.value = masterVolume;
      master.connect(ctx.destination);
      if (ctx.state === 'running') unlocked.set(true);
    }
    return ctx;
  }

  async function unlock(): Promise<void> {
    const c = ensure();
    if (c.state !== 'running') await c.resume();
    unlocked.set(true);
  }

  function now(): number {
    return ctx ? ctx.currentTime : 0;
  }

  async function decode(data: ArrayBuffer): Promise<AudioBuffer> {
    // decodeAudioData detaches its input — always hand it a copy
    return ensure().decodeAudioData(data.slice(0));
  }

  function hasBuffer(soundId: string): boolean {
    return buffers.has(soundId);
  }

  function setBuffer(soundId: string, buffer: AudioBuffer): void {
    buffers.set(soundId, buffer);
  }

  function play(sound: Sound, volume = sound.defaultVolume, fadeIn = 0): string | null {
    const c = ensure();
    const buffer = buffers.get(sound.id);
    if (!buffer) return null;
    const id = `inst-${++counter}`;
    const gain = c.createGain();
    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(volume, c.currentTime + fadeIn);
    } else {
      gain.gain.setValueAtTime(volume, c.currentTime);
    }
    gain.connect(master!);
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.loop = sound.type === 'loop';
    source.connect(gain);
    source.onended = () => removeInstance(id);
    source.start();
    nodes.set(id, { source, gain });
    playing.update((list) => [
      ...list,
      {
        id,
        soundId: sound.id,
        loop: source.loop,
        volume,
        startedAt: c.currentTime,
        duration: buffer.duration,
        stopping: false,
      },
    ]);
    return id;
  }

  function removeInstance(id: string): void {
    const entry = nodes.get(id);
    if (entry) entry.gain.disconnect();
    nodes.delete(id);
    playing.update((list) => list.filter((i) => i.id !== id));
  }

  function setInstanceVolume(id: string, volume: number): void {
    const entry = nodes.get(id);
    if (!entry || !ctx) return;
    entry.gain.gain.cancelScheduledValues(ctx.currentTime);
    entry.gain.gain.setValueAtTime(volume, ctx.currentTime);
    playing.update((list) => list.map((i) => (i.id === id ? { ...i, volume } : i)));
  }

  function setMasterVolume(volume: number): void {
    masterVolume = volume;
    if (master && ctx) master.gain.setValueAtTime(volume, ctx.currentTime);
  }

  function stop(id: string, fade = 0.3): void {
    const entry = nodes.get(id);
    if (!entry || !ctx) return;
    const instance = get(playing).find((i) => i.id === id);
    const t = ctx.currentTime;
    entry.gain.gain.cancelScheduledValues(t);
    entry.gain.gain.setValueAtTime(instance?.volume ?? 1, t);
    entry.gain.gain.linearRampToValueAtTime(0, t + fade);
    try {
      entry.source.stop(t + fade);
    } catch {
      // source may never have started or already been stopped
    }
    playing.update((list) => list.map((i) => (i.id === id ? { ...i, stopping: true } : i)));
  }

  function stopAll(fade = 1.5): void {
    for (const id of [...nodes.keys()]) stop(id, fade);
  }

  function stopLoops(fade = 1.5): void {
    for (const instance of get(playing)) {
      if (instance.loop && !instance.stopping) stop(instance.id, fade);
    }
  }

  function stopSound(soundId: string, fade = 0.3): void {
    for (const instance of get(playing)) {
      if (instance.soundId === soundId && !instance.stopping) stop(instance.id, fade);
    }
  }

  function isSoundPlaying(soundId: string): boolean {
    return get(playing).some((i) => i.soundId === soundId && !i.stopping);
  }

  return {
    playing,
    unlocked,
    unlock,
    now,
    decode,
    hasBuffer,
    setBuffer,
    play,
    stop,
    stopAll,
    stopLoops,
    stopSound,
    isSoundPlaying,
    setInstanceVolume,
    setMasterVolume,
  };
}

export const engine = createEngine();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test` — Expected: all engine tests PASS.
Run: `npm run check` — Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/engine.ts tests/mocks/audio.ts tests/engine.test.ts
git commit -m "feat: add Web Audio engine with gapless loops and gain-ramp fades"
```

---

### Task 5: App state and actions (stores.ts + toasts.ts)

**Files:**
- Create: `src/lib/stores.ts`, `src/lib/toasts.ts`
- Test: `tests/stores.test.ts`

**Interfaces:**
- Consumes: `db.ts`, `engine.ts` (singleton), `i18n.ts` (`lang`, `detectLang`), `types.ts`
- Produces (stores): `sounds: Writable<Sound[]>`, `scenes: Writable<Scene[]>`, `settings: Writable<Settings>`, `activeScene: Readable<Scene | null>`, `brokenSounds: Writable<Set<string>>`, `searchQuery: Writable<string>`, `editMode: Writable<boolean>`, `libraryOpen: Writable<boolean>`, `editingSound: Writable<string | null>`
- Produces (actions, all `async` unless noted):
  - `init(): Promise<void>` — load all, seed first scene, apply language + master volume
  - `importFiles(files: File[], decode: Decoder): Promise<{ added: Sound[]; failed: { name: string; reason: 'unsupported' | 'quota' }[] }>` with `type Decoder = (data: ArrayBuffer) => Promise<{ duration: number }>`
  - `createScene(name, emoji?)`, `updateScene(id, patch)`, `moveScene(from, to)`, `deleteScene(id)`, `setActiveScene(id)`
  - `addPad(sceneId, soundId)`, `updatePad(sceneId, soundId, patch)`, `removePad(sceneId, soundId)`, `movePad(sceneId, from, to)`
  - `updateSound(id, patch)`, `removeSound(id)`
  - `setMasterVolume(volume)`, `setLanguage(language)`
  - `triggerSound(soundId, volume?)`, `triggerPad(pad)`, `activateScene(id)` (crossfade)
- Produces (toasts.ts): `toasts: Writable<Toast[]>`, `toast(key, vars?, kind?)`, `dismiss(id)` with `Toast = { id: number; key: TranslationKey; vars: Record<string, string | number>; kind: 'info' | 'error' }`

- [ ] **Step 1: Write the failing tests**

`tests/stores.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/lib/stores`.

- [ ] **Step 3: Write the implementation**

`src/lib/toasts.ts`:

```ts
import { writable } from 'svelte/store';
import type { TranslationKey } from './i18n';

export interface Toast {
  id: number;
  key: TranslationKey;
  vars: Record<string, string | number>;
  kind: 'info' | 'error';
}

let nextId = 0;

export const toasts = writable<Toast[]>([]);

export function toast(
  key: TranslationKey,
  vars: Record<string, string | number> = {},
  kind: 'info' | 'error' = 'info',
): void {
  const id = ++nextId;
  toasts.update((list) => [...list, { id, key, vars, kind }]);
  setTimeout(() => dismiss(id), 5000);
}

export function dismiss(id: number): void {
  toasts.update((list) => list.filter((t) => t.id !== id));
}
```

`src/lib/stores.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all stores tests PASS (plus everything earlier).
Run: `npm run check` — Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores.ts src/lib/toasts.ts tests/stores.test.ts
git commit -m "feat: add app state stores, upload flow, scene/pad actions and playback glue"
```

---

### Task 6: Hotkey helpers (hotkeys.ts)

**Files:**
- Create: `src/lib/hotkeys.ts`
- Test: `tests/hotkeys.test.ts`

**Interfaces:**
- Consumes: `i18n.ts` (type `Lang` only)
- Produces:
  - `PAD_CODES: string[]` — 36 `KeyboardEvent.code` values in keyboard-row order
  - `padKeyCode(position: number): string | null`
  - `padIndexForCode(code: string): number | null`
  - `keyLabel(code: string, lang: Lang): string` — display label; swaps Y/Z for German layouts
  - `isTypingTarget(el: unknown): boolean`

- [ ] **Step 1: Write the failing tests**

`tests/hotkeys.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isTypingTarget, keyLabel, PAD_CODES, padIndexForCode, padKeyCode } from '../src/lib/hotkeys';

describe('hotkeys', () => {
  it('maps grid positions to keyboard rows', () => {
    expect(padKeyCode(0)).toBe('Digit1');
    expect(padKeyCode(9)).toBe('Digit0');
    expect(padKeyCode(10)).toBe('KeyQ');
    expect(padKeyCode(20)).toBe('KeyA');
    expect(padKeyCode(29)).toBe('KeyZ');
    expect(padKeyCode(35)).toBe('KeyM');
    expect(padKeyCode(36)).toBeNull();
    expect(PAD_CODES).toHaveLength(36);
  });

  it('maps codes back to positions', () => {
    expect(padIndexForCode('Digit1')).toBe(0);
    expect(padIndexForCode('KeyQ')).toBe(10);
    expect(padIndexForCode('Escape')).toBeNull();
  });

  it('labels physical keys per language layout', () => {
    expect(keyLabel('Digit1', 'de')).toBe('1');
    expect(keyLabel('KeyQ', 'en')).toBe('Q');
    expect(keyLabel('KeyZ', 'de')).toBe('Y'); // physical Z position prints Y on QWERTZ
    expect(keyLabel('KeyZ', 'en')).toBe('Z');
    expect(keyLabel('KeyY', 'de')).toBe('Z');
  });

  it('detects typing targets', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/lib/hotkeys`.

- [ ] **Step 3: Write the implementation**

`src/lib/hotkeys.ts`:

```ts
import type { Lang } from './i18n';

const ROWS: string[][] = [
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM'],
];

export const PAD_CODES: string[] = ROWS.flat();

export function padKeyCode(position: number): string | null {
  return PAD_CODES[position] ?? null;
}

export function padIndexForCode(code: string): number | null {
  const index = PAD_CODES.indexOf(code);
  return index === -1 ? null : index;
}

// KeyboardEvent.code names physical positions using the US layout; on a
// German QWERTZ keyboard the physical KeyZ position prints "Y" and vice versa.
const DE_LABELS: Record<string, string> = { KeyY: 'Z', KeyZ: 'Y' };

export function keyLabel(code: string, lang: Lang): string {
  if (lang === 'de' && DE_LABELS[code]) return DE_LABELS[code];
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Key')) return code.slice(3);
  return code;
}

export function isTypingTarget(el: unknown): boolean {
  const target = el as { tagName?: string; isContentEditable?: boolean } | null;
  const tag = target?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable === true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all hotkeys tests PASS.
Run: `npm run check` — Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hotkeys.ts tests/hotkeys.test.ts
git commit -m "feat: add layout-aware hotkey mapping helpers"
```

---

### Task 7: Zip export/import (exchange.ts)

**Files:**
- Create: `src/lib/exchange.ts`
- Test: `tests/exchange.test.ts`

**Interfaces:**
- Consumes: `db.ts`, `types.ts`
- Produces:
  - `exportAll(): Promise<Uint8Array>` — zip of `manifest.json` + `sounds/<id>` raw audio bytes
  - `importZip(data: Uint8Array): Promise<{ sounds: number; scenes: number }>` — merges by id; throws on missing manifest or unknown version. Settings in the manifest are informational only and are **not** imported (local settings win).
- Caller contract: after `importZip`, call `init()` from stores to reload state.

- [ ] **Step 1: Write the failing tests**

`tests/exchange.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { strToU8, zipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import * as db from '../src/lib/db';
import { exportAll, importZip } from '../src/lib/exchange';
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

describe('exchange', () => {
  it('round-trips sounds, bytes and scenes through a zip', async () => {
    await db.saveSound(sound, new Uint8Array([9, 9]).buffer);
    await db.saveScene(scene);
    await db.saveSettings({ language: 'de', masterVolume: 0.5, activeSceneId: 'sc1' });

    const zip = await exportAll();
    await db._resetForTests();

    const result = await importZip(zip);
    expect(result).toEqual({ sounds: 1, scenes: 1 });
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/lib/exchange`.

- [ ] **Step 3: Write the implementation**

`src/lib/exchange.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all exchange tests PASS.
Run: `npm run check` — Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/exchange.ts tests/exchange.test.ts
git commit -m "feat: add zip export/import with merge-by-id"
```

---

**UI tasks (8–14):** the spec verifies UI by running the app, so these tasks have no unit tests. The cycle is: implement → `npm run check` + `npm test` (regressions) → manual verification in `npm run dev` → commit. Manual steps list exactly what to click and what must happen.

### Task 8: App shell, TopBar, SceneTabs

**Files:**
- Create: `src/components/TopBar.svelte`, `src/components/SceneTabs.svelte`
- Modify: `src/App.svelte` (replace placeholder)

**Interfaces:**
- Consumes: stores (`init`, `scenes`, `settings`, `activeScene`, `activateScene`, `createScene`, `updateScene`, `deleteScene`, `moveScene`, `searchQuery`, `editMode`, `libraryOpen`, `setLanguage`), i18n (`lang`, `t`)
- Produces: `.app` grid layout (header / main / footer) that Tasks 9–11 fill; TopBar listens for the `grimoire:focus-search` window event (dispatched by App in Task 11).

- [ ] **Step 1: Write the components**

`src/App.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from './components/TopBar.svelte';
  import { init } from './lib/stores';

  let ready = $state(false);

  onMount(async () => {
    await init();
    ready = true;
  });
</script>

{#if ready}
  <div class="app">
    <TopBar />
    <main></main>
    <footer></footer>
  </div>
{/if}

<style>
  .app {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100vh;
  }

  main {
    overflow-y: auto;
  }

  footer {
    min-height: 3.2rem;
    background: var(--panel);
    border-top: 1px solid var(--panel-border);
  }
</style>
```

`src/components/TopBar.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { lang, t, type Lang } from '../lib/i18n';
  import { editMode, libraryOpen, searchQuery, setLanguage } from '../lib/stores';
  import SceneTabs from './SceneTabs.svelte';

  const LANGS: Lang[] = ['de', 'en'];

  let searchInput: HTMLInputElement | undefined = $state();

  onMount(() => {
    const focus = () => searchInput?.focus();
    window.addEventListener('grimoire:focus-search', focus);
    return () => window.removeEventListener('grimoire:focus-search', focus);
  });
</script>

<header>
  <h1>⚔ GRIMOIRE</h1>
  <SceneTabs />
  <div class="right">
    <input
      class="search"
      bind:this={searchInput}
      bind:value={$searchQuery}
      placeholder={$t('search.placeholder')}
    />
    <button
      class="ghost"
      class:active={$editMode}
      onclick={() => editMode.update((v) => !v)}
      title={$t('edit.mode')}
    >✎</button>
    <button class="ghost" onclick={() => libraryOpen.set(true)}>{$t('library.title')}</button>
    <div class="langs">
      {#each LANGS as language (language)}
        <button class:active={$lang === language} onclick={() => setLanguage(language)}>
          {language.toUpperCase()}
        </button>
      {/each}
    </div>
  </div>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.6rem 1rem;
    background: var(--panel);
    border-bottom: 1px solid var(--panel-border);
  }

  h1 {
    margin: 0;
    font-size: 1rem;
    font-weight: normal;
    letter-spacing: 0.25em;
    color: var(--gold);
    white-space: nowrap;
  }

  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .search {
    background: var(--gold-faint);
    border: 1px solid var(--panel-border);
    color: var(--text);
    padding: 0.35rem 0.7rem;
    border-radius: 4px;
    font-family: var(--font-ui);
    width: 12rem;
  }

  .ghost {
    border: 1px solid var(--panel-border);
    color: var(--muted);
    padding: 0.35rem 0.7rem;
    border-radius: 4px;
  }

  .ghost.active,
  .ghost:hover {
    color: var(--gold);
    border-color: var(--gold-dim);
  }

  .langs button {
    color: var(--muted);
    padding: 0.35rem 0.3rem;
    font-size: 0.8rem;
    font-family: var(--font-ui);
  }

  .langs button.active {
    color: var(--gold);
  }
</style>
```

`src/components/SceneTabs.svelte`:

```svelte
<script lang="ts">
  import { t } from '../lib/i18n';
  import {
    activateScene,
    createScene,
    deleteScene,
    moveScene,
    scenes,
    settings,
    updateScene,
  } from '../lib/stores';

  const EMOJIS = ['📜', '🍺', '🕸', '🐉', '⚔', '🔥', '🌲', '🏰', '🌊', '👻'];

  let menuFor: string | null = $state(null);
  let menuPos = $state({ x: 0, y: 0 });
  let renamingId: string | null = $state(null);
  let renameValue = $state('');
  let dragIndex: number | null = $state(null);

  const ordered = $derived([...$scenes].sort((a, b) => a.position - b.position));

  function focusOnMount(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  function openMenu(e: MouseEvent, id: string) {
    e.preventDefault();
    menuFor = id;
    menuPos = { x: e.clientX, y: e.clientY };
  }

  function startRename(id: string, current: string) {
    renamingId = id;
    renameValue = current;
    menuFor = null;
  }

  async function commitRename() {
    if (renamingId && renameValue.trim()) {
      await updateScene(renamingId, { name: renameValue.trim() });
    }
    renamingId = null;
  }

  async function remove(id: string, name: string) {
    menuFor = null;
    if (confirm($t('scenes.deleteConfirm', { name }))) await deleteScene(id);
  }

  async function addScene() {
    await createScene($t('scenes.defaultName', { n: ordered.length + 1 }));
  }

  function onDrop(e: DragEvent, to: number) {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== to) moveScene(dragIndex, to);
    dragIndex = null;
  }
</script>

<nav>
  {#each ordered as scene, i (scene.id)}
    {#if renamingId === scene.id}
      <input
        class="rename"
        bind:value={renameValue}
        use:focusOnMount
        onblur={commitRename}
        onkeydown={(e) => {
          if (e.key === 'Enter') commitRename();
          if (e.key === 'Escape') renamingId = null;
          e.stopPropagation();
        }}
      />
    {:else}
      <button
        class="tab"
        class:active={scene.id === $settings.activeSceneId}
        draggable="true"
        ondragstart={() => (dragIndex = i)}
        ondragover={(e) => e.preventDefault()}
        ondrop={(e) => onDrop(e, i)}
        onclick={() => activateScene(scene.id)}
        ondblclick={() => startRename(scene.id, scene.name)}
        oncontextmenu={(e) => openMenu(e, scene.id)}
      >{scene.emoji} {scene.name}</button>
    {/if}
  {/each}
  <button class="tab add" onclick={addScene} title={$t('scenes.new')}>+</button>
</nav>

{#if menuFor}
  {@const scene = ordered.find((s) => s.id === menuFor)}
  <button class="backdrop" onclick={() => (menuFor = null)} aria-label="close"></button>
  {#if scene}
    <div class="menu" style="left: {menuPos.x}px; top: {menuPos.y}px">
      <div class="emojis">
        {#each EMOJIS as emoji (emoji)}
          <button
            onclick={() => {
              updateScene(scene.id, { emoji });
              menuFor = null;
            }}
          >{emoji}</button>
        {/each}
      </div>
      <button class="item" onclick={() => startRename(scene.id, scene.name)}>
        {$t('scenes.rename')}
      </button>
      <button class="item danger" onclick={() => remove(scene.id, scene.name)}>
        {$t('scenes.delete')}
      </button>
    </div>
  {/if}
{/if}

<style>
  nav {
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
  }

  .tab {
    white-space: nowrap;
    color: var(--muted);
    border: 1px solid rgba(107, 93, 122, 0.3);
    border-radius: 3px;
    padding: 0.35rem 0.9rem;
    font-size: 0.85rem;
  }

  .tab:hover {
    color: var(--text);
  }

  .tab.active {
    background: rgba(232, 200, 126, 0.15);
    border-color: rgba(232, 200, 126, 0.5);
    color: var(--gold);
  }

  .rename {
    background: var(--gold-faint);
    border: 1px solid var(--gold);
    color: var(--gold);
    border-radius: 3px;
    padding: 0.3rem 0.6rem;
    width: 9rem;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
  }

  .menu {
    position: fixed;
    z-index: 11;
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    padding: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  }

  .emojis {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
  }

  .emojis button {
    padding: 0.25rem;
    border-radius: 3px;
  }

  .emojis button:hover {
    background: var(--gold-faint);
  }

  .item {
    text-align: left;
    padding: 0.35rem 0.5rem;
    border-radius: 3px;
    font-size: 0.85rem;
    color: var(--text);
  }

  .item:hover {
    background: var(--gold-faint);
  }

  .item.danger {
    color: var(--danger);
  }
</style>
```

- [ ] **Step 2: Check and test**

Run: `npm run check` — Expected: 0 errors. Run: `npm test` — Expected: all green.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, open the URL:

1. Header shows "⚔ GRIMOIRE", one tab "Szene 1" (gold/active), "+", search, ✎, "Bibliothek", DE/EN.
2. Click "+" → "Szene 2" appears and becomes active.
3. Double-click a tab → inline rename; Enter commits, Escape cancels.
4. Right-click a tab → menu with emoji grid, rename, delete. Pick 🍺 → tab emoji changes. Delete → confirm dialog → tab gone; deleting the last tab reseeds "Szene 1".
5. Drag one tab onto another → order swaps. Reload page → order and active tab persist.
6. Click EN → tab "+"-tooltip and button labels switch to English; reload keeps EN.

- [ ] **Step 4: Commit**

```bash
git add src/App.svelte src/components/TopBar.svelte src/components/SceneTabs.svelte
git commit -m "feat: add app shell with top bar and scene tabs"
```

---

### Task 9: Toasts, drop overlay, file upload

**Files:**
- Create: `src/components/Toasts.svelte`, `src/components/DropOverlay.svelte`
- Modify: `src/App.svelte`

**Interfaces:**
- Consumes: `toasts.ts` (`toasts`, `toast`, `dismiss`), stores (`importFiles`), `engine.decode`
- Produces: window-level drag & drop that feeds `importFiles`; `Toasts` rendered app-wide. Sounds land in the library and as pads of the active scene (invisible until Task 10 renders the stage — verify via toast + reload persistence).

- [ ] **Step 1: Write the components**

`src/components/Toasts.svelte`:

```svelte
<script lang="ts">
  import { t } from '../lib/i18n';
  import { dismiss, toasts } from '../lib/toasts';
</script>

<div class="toasts">
  {#each $toasts as item (item.id)}
    <button class="toast {item.kind}" onclick={() => dismiss(item.id)}>
      {$t(item.key, item.vars)}
    </button>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    top: 4rem;
    right: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 50;
  }

  .toast {
    background: var(--panel);
    border: 1px solid var(--panel-border);
    color: var(--text);
    padding: 0.6rem 1rem;
    border-radius: 4px;
    font-family: var(--font-ui);
    font-size: 0.85rem;
    text-align: left;
    max-width: 22rem;
  }

  .toast.error {
    border-color: var(--danger-border);
    color: var(--danger);
  }
</style>
```

`src/components/DropOverlay.svelte`:

```svelte
<script lang="ts">
  import { t } from '../lib/i18n';
</script>

<div class="overlay">
  <div class="frame">📜 {$t('stage.dropHint')}</div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(13, 10, 18, 0.85);
    display: grid;
    place-items: center;
    z-index: 40;
    pointer-events: none;
  }

  .frame {
    border: 2px dashed var(--gold);
    color: var(--gold);
    border-radius: 8px;
    padding: 3rem 5rem;
    font-size: 1.5rem;
  }
</style>
```

`src/App.svelte` (full replacement):

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import DropOverlay from './components/DropOverlay.svelte';
  import Toasts from './components/Toasts.svelte';
  import TopBar from './components/TopBar.svelte';
  import { engine } from './lib/engine';
  import { importFiles, init } from './lib/stores';
  import { toast } from './lib/toasts';

  let ready = $state(false);
  let dragDepth = $state(0);

  onMount(async () => {
    await init();
    ready = true;
  });

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragDepth = 0;
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length === 0) return;
    const { added, failed } = await importFiles(files, (data) => engine.decode(data));
    if (added.length > 0) toast('toast.added', { n: added.length });
    for (const f of failed) {
      toast(f.reason === 'quota' ? 'toast.quota' : 'toast.unsupported', { name: f.name }, 'error');
    }
  }
</script>

<svelte:window
  ondragenter={(e) => {
    e.preventDefault();
    dragDepth++;
  }}
  ondragleave={() => (dragDepth = Math.max(0, dragDepth - 1))}
  ondragover={(e) => e.preventDefault()}
  ondrop={handleDrop}
/>

{#if ready}
  <div class="app">
    <TopBar />
    <main></main>
    <footer></footer>
  </div>
  {#if dragDepth > 0}
    <DropOverlay />
  {/if}
  <Toasts />
{/if}

<style>
  .app {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100vh;
  }

  main {
    overflow-y: auto;
  }

  footer {
    min-height: 3.2rem;
    background: var(--panel);
    border-top: 1px solid var(--panel-border);
  }
</style>
```

- [ ] **Step 2: Check and test**

Run: `npm run check` — Expected: 0 errors. Run: `npm test` — Expected: all green.

- [ ] **Step 3: Manual verification**

In `npm run dev`:

1. Drag an audio file over the window → dark overlay with dashed gold "Dateien hierher ziehen" frame; leaving the window hides it.
2. Drop an `.mp3` → toast "1 Sound(s) hinzugefügt".
3. Drop a `.txt` file → red toast »"…" konnte nicht gelesen werden«; a mixed drop adds the good file and toasts the bad one.
4. Toast disappears after ~5 s; clicking dismisses immediately.

- [ ] **Step 4: Commit**

```bash
git add src/components/Toasts.svelte src/components/DropOverlay.svelte src/App.svelte
git commit -m "feat: add window drag-and-drop upload with overlay and toasts"
```

---

### Task 10: Stage and Pad

**Files:**
- Create: `src/components/Stage.svelte`, `src/components/Pad.svelte`
- Modify: `src/App.svelte` (mount Stage in `<main>`)

**Interfaces:**
- Consumes: stores (`activeScene`, `sounds`, `searchQuery`, `triggerPad`, `triggerSound`, `addPad`, `brokenSounds`, `editMode` — edit UI itself comes in Task 12), engine (`playing`, `now`), hotkeys (`padKeyCode`, `keyLabel`), i18n
- Produces: `Pad` receives `{ pad: Pad; sceneId: string }` props; pads render by `pad.position` (that position also drives the hotkey label — Task 11 relies on the same ordering).

- [ ] **Step 1: Write the components**

`src/components/Pad.svelte`:

```svelte
<script lang="ts">
  import { engine } from '../lib/engine';
  import { keyLabel, padKeyCode } from '../lib/hotkeys';
  import { lang, t } from '../lib/i18n';
  import { brokenSounds, sounds, triggerPad } from '../lib/stores';
  import type { Pad } from '../lib/types';

  let { pad, sceneId }: { pad: Pad; sceneId: string } = $props();

  const { playing } = engine;

  const sound = $derived($sounds.find((s) => s.id === pad.soundId));
  const instances = $derived($playing.filter((i) => i.soundId === pad.soundId && !i.stopping));
  const isPlaying = $derived(instances.length > 0);
  const code = $derived(padKeyCode(pad.position));
  const broken = $derived($brokenSounds.has(pad.soundId));

  let progress = $state(0);

  $effect(() => {
    if (!isPlaying || !sound || sound.type !== 'oneshot') {
      progress = 0;
      return;
    }
    let raf = 0;
    const tick = () => {
      const latest = instances[instances.length - 1];
      progress = latest ? Math.min(1, (engine.now() - latest.startedAt) / latest.duration) : 0;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });
</script>

{#if sound}
  <div class="pad" class:playing={isPlaying} class:broken class:loop={sound.type === 'loop'}>
    <button
      class="face"
      onclick={() => triggerPad(pad)}
      disabled={broken}
      title={broken ? $t('pad.broken') : sound.name}
    >
      <span class="emoji">{sound.emoji}</span>
      <span class="name">{sound.name}</span>
      <span class="meta">
        {#if code}<kbd>{keyLabel(code, $lang)}</kbd>{/if}
        {#if sound.type === 'loop'}<span class="badge">∞</span>{/if}
        {#if broken}<span class="badge">⚠</span>{/if}
      </span>
      {#if sound.type === 'oneshot' && isPlaying}
        <span class="ring" style="--p: {progress}"></span>
      {/if}
    </button>
  </div>
{/if}

<style>
  .face {
    position: relative;
    overflow: hidden;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 1.1rem 0.5rem 0.9rem;
    background: var(--gold-faint);
    border: 1px solid var(--gold-dim);
    border-radius: 6px;
    color: var(--text);
    transition: border-color 0.15s, box-shadow 0.3s, background 0.3s;
  }

  .face:hover {
    border-color: var(--gold);
  }

  .playing .face {
    background: radial-gradient(circle at 50% 25%, var(--ember-glow), rgba(26, 20, 36, 0.9));
    border-color: var(--ember);
    box-shadow: 0 0 16px var(--ember-glow);
  }

  .playing.loop .face {
    animation: pulse 2.4s ease-in-out infinite;
  }

  @keyframes pulse {
    50% {
      box-shadow: 0 0 26px var(--ember-glow);
    }
  }

  .broken .face {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .emoji {
    font-size: 1.6rem;
  }

  .name {
    font-size: 0.85rem;
    text-align: center;
    overflow-wrap: anywhere;
  }

  .meta {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  kbd {
    font-family: var(--font-ui);
    font-size: 0.6rem;
    color: var(--muted);
    border: 1px solid var(--panel-border);
    border-radius: 3px;
    padding: 0 0.3rem;
  }

  .badge {
    color: var(--gold);
    font-size: 0.7rem;
  }

  .ring {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: conic-gradient(var(--ember) calc(var(--p) * 360deg), rgba(255, 255, 255, 0.12) 0);
  }
</style>
```

`src/components/Stage.svelte`:

```svelte
<script lang="ts">
  import { t } from '../lib/i18n';
  import { activeScene, addPad, searchQuery, sounds, triggerSound } from '../lib/stores';
  import PadView from './Pad.svelte';

  const query = $derived($searchQuery.trim().toLowerCase());

  const pads = $derived.by(() => {
    const scene = $activeScene;
    if (!scene) return [];
    const ordered = [...scene.pads].sort((a, b) => a.position - b.position);
    if (!query) return ordered;
    return ordered.filter((p) =>
      $sounds.find((s) => s.id === p.soundId)?.name.toLowerCase().includes(query),
    );
  });

  const libraryMatches = $derived.by(() => {
    const scene = $activeScene;
    if (!query || !scene) return [];
    return $sounds.filter(
      (s) => s.name.toLowerCase().includes(query) && !scene.pads.some((p) => p.soundId === s.id),
    );
  });
</script>

<div class="stage">
  {#if $activeScene && $activeScene.pads.length === 0}
    <div class="empty">📜 {$t('stage.dropHint')}</div>
  {:else if $activeScene}
    <div class="grid">
      {#each pads as pad (pad.soundId)}
        <PadView {pad} sceneId={$activeScene.id} />
      {/each}
    </div>
    {#if libraryMatches.length > 0}
      <h3 class="label">{$t('search.fromLibrary')}</h3>
      <div class="grid">
        {#each libraryMatches as sound (sound.id)}
          <div class="libpad">
            <button class="play" onclick={() => triggerSound(sound.id)}>
              <span class="emoji">{sound.emoji}</span>
              <span class="name">{sound.name}</span>
            </button>
            <button
              class="addbtn"
              title={$t('library.addToScene')}
              onclick={() => $activeScene && addPad($activeScene.id, sound.id)}
            >+</button>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .stage {
    padding: 1rem;
  }

  .empty {
    display: grid;
    place-items: center;
    min-height: 50vh;
    color: var(--muted);
    font-size: 1.2rem;
    border: 2px dashed var(--gold-dim);
    border-radius: 8px;
    margin: 1rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.7rem;
  }

  .label {
    color: var(--muted);
    font-size: 0.75rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin: 1.2rem 0 0.5rem;
    font-family: var(--font-ui);
  }

  .libpad {
    display: flex;
    align-items: stretch;
    border: 1px dashed var(--gold-dim);
    border-radius: 6px;
    overflow: hidden;
  }

  .libpad .play {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 1.1rem 0.5rem 0.9rem;
    color: var(--muted);
  }

  .libpad .play:hover {
    color: var(--text);
  }

  .libpad .emoji {
    font-size: 1.6rem;
  }

  .libpad .name {
    font-size: 0.85rem;
    text-align: center;
  }

  .addbtn {
    border-left: 1px dashed var(--gold-dim);
    padding: 0 0.7rem;
    color: var(--gold);
    font-size: 1.1rem;
  }

  .addbtn:hover {
    background: var(--gold-faint);
  }
</style>
```

In `src/App.svelte`, add the import and replace the empty `<main>`:

```svelte
  import Stage from './components/Stage.svelte';
```

```svelte
    <main><Stage /></main>
```

- [ ] **Step 2: Check and test**

Run: `npm run check` — Expected: 0 errors. Run: `npm test` — Expected: all green.

- [ ] **Step 3: Manual verification**

In `npm run dev` (drop 2–3 real audio files first — one long ambience, one short effect):

1. Empty scene shows the dashed "Dateien hierher ziehen" area; after dropping files, pads appear with 🎵, name, hotkey (1, 2, …), ∞ on the long file.
2. Click a loop pad → it glows ember and pulses; click again → fades out (~0.3 s) and the glow stops.
3. Click a one-shot pad → glow + progress ring fills clockwise, pad returns to idle when the sound ends; rapid double-click overlaps two playbacks.
4. Type in search → pads filter; a sound that exists only in another scene appears under "Aus der Bibliothek" with a dashed border; its ▶ area plays it, "+" adds it to the current scene as a real pad.
5. Switch scenes → the grid swaps to that scene's pads.

- [ ] **Step 4: Commit**

```bash
git add src/components/Stage.svelte src/components/Pad.svelte src/App.svelte
git commit -m "feat: add stage pad grid with playing states and library search row"
```

---

### Task 11: MixerDock, hotkeys wiring, audio unlock

**Files:**
- Create: `src/components/MixerDock.svelte`, `src/components/InstanceChip.svelte`
- Modify: `src/App.svelte` (mount MixerDock, add keydown + pointer handlers)

**Interfaces:**
- Consumes: engine (`playing`, `unlocked`, `unlock`, `stop`, `stopAll`, `setInstanceVolume`), stores (`settings`, `setMasterVolume`, `scenes`, `activeScene`, `activateScene`, `triggerPad`, `libraryOpen`), hotkeys (`padIndexForCode`, `isTypingTarget`), i18n
- Produces: full keyboard control (pad keys, `←/→`, `Ctrl+1..9`, `Esc`, `/`); `grimoire:focus-search` window event consumed by TopBar (Task 8).

- [ ] **Step 1: Write the components**

`src/components/InstanceChip.svelte`:

```svelte
<script lang="ts">
  import { engine, type Instance } from '../lib/engine';
  import { sounds } from '../lib/stores';

  let { inst }: { inst: Instance } = $props();

  const sound = $derived($sounds.find((s) => s.id === inst.soundId));
</script>

<div class="chip" class:stopping={inst.stopping}>
  <span class="who">{sound?.emoji ?? '🎵'} {sound?.name ?? '?'}</span>
  {#if inst.loop}<span class="badge">∞</span>{/if}
  <input
    type="range"
    min="0"
    max="1"
    step="0.01"
    value={inst.volume}
    oninput={(e) => engine.setInstanceVolume(inst.id, Number(e.currentTarget.value))}
  />
  <button class="x" onclick={() => engine.stop(inst.id)}>✕</button>
</div>

<style>
  .chip {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--gold-dim);
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    white-space: nowrap;
    transition: opacity 0.4s;
  }

  .chip.stopping {
    opacity: 0.35;
  }

  .who {
    color: var(--gold);
  }

  .badge {
    color: var(--gold);
    font-size: 0.7rem;
  }

  input[type='range'] {
    width: 5rem;
  }

  .x {
    color: var(--muted);
    padding: 0 0.2rem;
  }

  .x:hover {
    color: var(--danger);
  }
</style>
```

`src/components/MixerDock.svelte`:

```svelte
<script lang="ts">
  import { engine } from '../lib/engine';
  import { t } from '../lib/i18n';
  import { setMasterVolume, settings } from '../lib/stores';
  import InstanceChip from './InstanceChip.svelte';

  const { playing, unlocked } = engine;
</script>

<footer>
  <div class="chips">
    {#if !$unlocked}
      <button class="hint" onclick={() => engine.unlock()}>🔇 {$t('mixer.enableAudio')}</button>
    {:else if $playing.length === 0}
      <span class="nothing">{$t('mixer.nothing')}</span>
    {:else}
      {#each $playing as inst (inst.id)}
        <InstanceChip {inst} />
      {/each}
    {/if}
  </div>
  <div class="global">
    <label class="master">
      {$t('mixer.master')}
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={$settings.masterVolume}
        oninput={(e) => setMasterVolume(Number(e.currentTarget.value))}
      />
    </label>
    <button class="stopall" onclick={() => engine.stopAll(1.5)}>⏹ {$t('mixer.stopAll')}</button>
  </div>
</footer>

<style>
  footer {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 1rem;
    background: var(--panel);
    border-top: 1px solid var(--panel-border);
    min-height: 3.2rem;
  }

  .chips {
    display: flex;
    gap: 0.5rem;
    flex: 1;
    overflow-x: auto;
    align-items: center;
  }

  .nothing {
    color: var(--muted);
    font-size: 0.85rem;
  }

  .hint {
    color: var(--muted);
    border: 1px dashed var(--panel-border);
    border-radius: 4px;
    padding: 0.3rem 0.8rem;
    font-size: 0.85rem;
  }

  .global {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .master {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--muted);
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .stopall {
    background: var(--danger-bg);
    border: 1px solid var(--danger-border);
    color: var(--danger);
    padding: 0.45rem 1rem;
    border-radius: 4px;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }
</style>
```

`src/App.svelte` (full replacement):

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import DropOverlay from './components/DropOverlay.svelte';
  import MixerDock from './components/MixerDock.svelte';
  import Stage from './components/Stage.svelte';
  import Toasts from './components/Toasts.svelte';
  import TopBar from './components/TopBar.svelte';
  import { engine } from './lib/engine';
  import { isTypingTarget, padIndexForCode } from './lib/hotkeys';
  import {
    activateScene,
    activeScene,
    importFiles,
    init,
    libraryOpen,
    scenes,
    settings,
    triggerPad,
  } from './lib/stores';
  import { toast } from './lib/toasts';

  let ready = $state(false);
  let dragDepth = $state(0);

  onMount(async () => {
    await init();
    ready = true;
  });

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragDepth = 0;
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length === 0) return;
    const { added, failed } = await importFiles(files, (data) => engine.decode(data));
    if (added.length > 0) toast('toast.added', { n: added.length });
    for (const f of failed) {
      toast(f.reason === 'quota' ? 'toast.quota' : 'toast.unsupported', { name: f.name }, 'error');
    }
  }

  function onPointerDown() {
    if (!get(engine.unlocked)) engine.unlock();
  }

  function onKeydown(e: KeyboardEvent) {
    if (isTypingTarget(e.target)) return;

    if (e.key === 'Escape') {
      if (get(libraryOpen)) {
        libraryOpen.set(false);
      } else {
        engine.stopAll(1.5);
      }
      return;
    }

    if (e.key === '/') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('grimoire:focus-search'));
      return;
    }

    const ordered = [...get(scenes)].sort((a, b) => a.position - b.position);

    if (e.ctrlKey && /^Digit[1-9]$/.test(e.code)) {
      const scene = ordered[Number(e.code.slice(5)) - 1];
      if (scene) {
        e.preventDefault();
        activateScene(scene.id);
      }
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const current = ordered.findIndex((s) => s.id === get(settings).activeSceneId);
      const next = ordered[current + (e.key === 'ArrowRight' ? 1 : -1)];
      if (next) activateScene(next.id);
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const index = padIndexForCode(e.code);
    if (index === null) return;
    const scene = get(activeScene);
    const pad = scene ? [...scene.pads].sort((a, b) => a.position - b.position)[index] : undefined;
    if (pad) triggerPad(pad);
  }
</script>

<svelte:window
  ondragenter={(e) => {
    e.preventDefault();
    dragDepth++;
  }}
  ondragleave={() => (dragDepth = Math.max(0, dragDepth - 1))}
  ondragover={(e) => e.preventDefault()}
  ondrop={handleDrop}
  onkeydown={onKeydown}
  onpointerdown={onPointerDown}
/>

{#if ready}
  <div class="app">
    <TopBar />
    <main><Stage /></main>
    <MixerDock />
  </div>
  {#if dragDepth > 0}
    <DropOverlay />
  {/if}
  <Toasts />
{/if}

<style>
  .app {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100vh;
  }

  main {
    overflow-y: auto;
  }
</style>
```

- [ ] **Step 2: Check and test**

Run: `npm run check` — Expected: 0 errors. Run: `npm test` — Expected: all green.

- [ ] **Step 3: Manual verification**

In `npm run dev`:

1. Fresh reload: dock shows "🔇 Klicken zum Aktivieren"; after any click it switches to "Nichts spielt".
2. Start a loop + a one-shot → one chip each in the dock with name, ∞ on the loop, its own volume slider (audibly works), ✕ fades that instance out.
3. Master slider changes overall volume; value survives reload.
4. "⏹ Alles stoppen" fades everything out over ~1.5 s; chips dim while fading, then disappear.
5. Keyboard: `1` fires the first pad; `←`/`→` and `Ctrl+2` switch scenes; `Esc` = stop all; `/` focuses search; keys typed inside the search field never fire pads.
6. Give a loop pad `autoplay` by... (not yet possible in UI — skip, covered in Task 12). Instead: switch scenes while a loop plays → it fades out over ~1.5 s.

- [ ] **Step 4: Commit**

```bash
git add src/components/MixerDock.svelte src/components/InstanceChip.svelte src/App.svelte
git commit -m "feat: add mixer dock, global hotkeys and audio unlock"
```

---

### Task 12: Edit mode and sound editing

**Files:**
- Create: `src/components/SoundEditModal.svelte`
- Modify: `src/components/Pad.svelte` (edit bar), `src/components/Stage.svelte` (pad drag-reorder), `src/App.svelte` (mount modal, Escape priority, Files-only drag guard)

**Interfaces:**
- Consumes: stores (`editMode`, `editingSound`, `updatePad`, `removePad`, `movePad`, `updateSound`), types (`SoundType`)
- Produces: pencil-toggle edit mode — per-pad volume/autoplay/remove/reorder; `editingSound` store id opens `SoundEditModal` from anywhere (Library reuses it in Task 13).

- [ ] **Step 1: Update Pad.svelte**

Add to the imports in `src/components/Pad.svelte`:

```ts
  import { brokenSounds, editMode, editingSound, removePad, sounds, triggerPad, updatePad } from '../lib/stores';
```

(replacing the existing stores import line), and insert this block directly after the closing `</button>` of `.face`, still inside `.pad`:

```svelte
    {#if $editMode}
      <div class="editbar">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          title={$t('pad.volume')}
          value={pad.volume ?? sound.defaultVolume}
          oninput={(e) => updatePad(sceneId, pad.soundId, { volume: Number(e.currentTarget.value) })}
        />
        {#if sound.type === 'loop'}
          <label class="auto" title={$t('pad.autoplay')}>
            <input
              type="checkbox"
              checked={pad.autoplay ?? false}
              onchange={(e) => updatePad(sceneId, pad.soundId, { autoplay: e.currentTarget.checked })}
            />▶
          </label>
        {/if}
        <button class="gear" title={$t('pad.editSound')} onclick={() => editingSound.set(pad.soundId)}>⚙</button>
        <button class="rm" title={$t('pad.remove')} onclick={() => removePad(sceneId, pad.soundId)}>✕</button>
      </div>
    {/if}
```

Add to Pad's `<style>`:

```css
  .editbar {
    display: flex;
    gap: 0.3rem;
    align-items: center;
    margin-top: 0.3rem;
    font-family: var(--font-ui);
    font-size: 0.75rem;
    color: var(--muted);
  }

  .editbar input[type='range'] {
    flex: 1;
    min-width: 0;
  }

  .auto {
    display: flex;
    align-items: center;
    gap: 0.15rem;
  }

  .rm {
    color: var(--danger);
    padding: 0 0.2rem;
  }

  .gear {
    color: var(--muted);
    padding: 0 0.2rem;
  }

  .gear:hover {
    color: var(--gold);
  }
```

- [ ] **Step 2: Add pad drag-reorder to Stage.svelte**

In `src/components/Stage.svelte`, extend the stores import with `editMode` and `movePad`, add drag state to the script:

```ts
  import { activeScene, addPad, editMode, movePad, searchQuery, sounds, triggerSound } from '../lib/stores';

  let dragIndex: number | null = $state(null);

  function onPadDrop(e: DragEvent, to: number) {
    e.preventDefault();
    e.stopPropagation();
    if ($activeScene && dragIndex !== null && dragIndex !== to) {
      movePad($activeScene.id, dragIndex, to);
    }
    dragIndex = null;
  }
```

and replace the pad `{#each}` block with:

```svelte
      {#each pads as pad, i (pad.soundId)}
        <div
          class="cell"
          role="presentation"
          draggable={$editMode && !query}
          ondragstart={(e) => {
            if ($editMode && !query) dragIndex = i;
            else e.preventDefault();
          }}
          ondragover={(e) => {
            if (dragIndex !== null) e.preventDefault();
          }}
          ondrop={(e) => onPadDrop(e, i)}
        >
          <PadView {pad} sceneId={$activeScene.id} />
        </div>
      {/each}
```

(Reordering is disabled while a search filter is active — indices would not match positions.)

- [ ] **Step 3: Write SoundEditModal.svelte**

`src/components/SoundEditModal.svelte`:

```svelte
<script lang="ts">
  import { t } from '../lib/i18n';
  import { editingSound, sounds, updateSound } from '../lib/stores';
  import type { SoundType } from '../lib/types';

  const EMOJIS = ['🎵', '🔥', '⚡', '🗡', '🚪', '🐺', '🌧', '💀', '🎻', '🍺', '👣', '🐉'];

  const sound = $derived($sounds.find((s) => s.id === $editingSound) ?? null);
</script>

{#if sound}
  <button class="backdrop" aria-label="close" onclick={() => editingSound.set(null)}></button>
  <div class="modal" role="dialog">
    <h3>{sound.emoji} {sound.name}</h3>
    <label>
      {$t('sound.name')}
      <input value={sound.name} onchange={(e) => updateSound(sound.id, { name: e.currentTarget.value })} />
    </label>
    <div class="emojis">
      {#each EMOJIS as emoji (emoji)}
        <button class:active={sound.emoji === emoji} onclick={() => updateSound(sound.id, { emoji })}>
          {emoji}
        </button>
      {/each}
    </div>
    <label>
      {$t('sound.type')}
      <select
        value={sound.type}
        onchange={(e) => updateSound(sound.id, { type: e.currentTarget.value as SoundType })}
      >
        <option value="loop">{$t('sound.loop')}</option>
        <option value="oneshot">{$t('sound.oneshot')}</option>
      </select>
    </label>
    <label>
      {$t('pad.volume')}
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={sound.defaultVolume}
        oninput={(e) => updateSound(sound.id, { defaultVolume: Number(e.currentTarget.value) })}
      />
    </label>
    <button class="done" onclick={() => editingSound.set(null)}>{$t('edit.done')}</button>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(13, 10, 18, 0.7);
    z-index: 20;
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 21;
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    padding: 1.2rem;
    width: 20rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
  }

  h3 {
    margin: 0;
    color: var(--gold);
    font-weight: normal;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    color: var(--muted);
    font-size: 0.8rem;
    font-family: var(--font-ui);
  }

  input:not([type='range']),
  select {
    background: var(--gold-faint);
    border: 1px solid var(--panel-border);
    color: var(--text);
    padding: 0.35rem 0.6rem;
    border-radius: 4px;
  }

  .emojis {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.2rem;
  }

  .emojis button {
    padding: 0.3rem;
    border-radius: 4px;
    border: 1px solid transparent;
  }

  .emojis button.active {
    border-color: var(--gold);
    background: var(--gold-faint);
  }

  .done {
    align-self: flex-end;
    border: 1px solid var(--gold-dim);
    color: var(--gold);
    padding: 0.35rem 1rem;
    border-radius: 4px;
  }
</style>
```

- [ ] **Step 4: Update App.svelte**

Three changes in `src/App.svelte`:

1. Import and mount the modal (next to `<Toasts />`):

```ts
  import SoundEditModal from './components/SoundEditModal.svelte';
```

```svelte
  <SoundEditModal />
  <Toasts />
```

2. Extend the stores import with `editingSound` and give Escape modal-priority in `onKeydown`:

```ts
    if (e.key === 'Escape') {
      if (get(editingSound)) {
        editingSound.set(null);
      } else if (get(libraryOpen)) {
        libraryOpen.set(false);
      } else {
        engine.stopAll(1.5);
      }
      return;
    }
```

3. Only count **file** drags for the drop overlay (pad/tab dragging must not trigger it):

```svelte
<svelte:window
  ondragenter={(e) => {
    e.preventDefault();
    if (e.dataTransfer?.types.includes('Files')) dragDepth++;
  }}
  ondragleave={(e) => {
    if (e.dataTransfer?.types.includes('Files')) dragDepth = Math.max(0, dragDepth - 1);
  }}
  ondragover={(e) => e.preventDefault()}
  ondrop={handleDrop}
  onkeydown={onKeydown}
  onpointerdown={onPointerDown}
/>
```

- [ ] **Step 5: Check and test**

Run: `npm run check` — Expected: 0 errors. Run: `npm test` — Expected: all green.

- [ ] **Step 6: Manual verification**

In `npm run dev`:

1. Toggle ✎ → every pad grows an edit bar: volume slider, ▶ checkbox (loops only), ⚙, ✕.
2. Pad volume slider: while the sound plays, newly triggered playback uses the new volume; value persists after reload.
3. Check ▶ on a loop, switch to another scene and back → the loop fades in automatically on activation (1.5 s).
4. Drag a pad onto another pad in edit mode → order changes and persists; no drop overlay appears while dragging; dragging is inert while searching.
5. ⚙ opens the modal: rename, pick emoji, change type (∞ badge follows), default volume. Escape and "Fertig" close it; Escape with the modal open does NOT stop playing sounds.
6. ✕ removes the pad from the scene (sound stays in the library — verify via search: it appears under "Aus der Bibliothek").

- [ ] **Step 7: Commit**

```bash
git add src/components/Pad.svelte src/components/Stage.svelte src/components/SoundEditModal.svelte src/App.svelte
git commit -m "feat: add edit mode with pad reorder, per-pad settings and sound editor"
```

---

### Task 13: Library modal with export/import

**Files:**
- Create: `src/components/LibraryModal.svelte`
- Modify: `src/App.svelte` (mount)

**Interfaces:**
- Consumes: stores (`sounds`, `activeScene`, `addPad`, `removeSound`, `triggerSound`, `editingSound`, `libraryOpen`, `init`), `exchange.ts` (`exportAll`, `importZip`), `toasts.ts`
- Produces: the Library UI; export downloads `grimoire-export.zip`; import merges a zip and reloads state via `init()`.

- [ ] **Step 1: Write LibraryModal.svelte**

`src/components/LibraryModal.svelte`:

```svelte
<script lang="ts">
  import { exportAll, importZip } from '../lib/exchange';
  import { t } from '../lib/i18n';
  import {
    activeScene,
    addPad,
    editingSound,
    init,
    libraryOpen,
    removeSound,
    sounds,
    triggerSound,
  } from '../lib/stores';
  import { toast } from '../lib/toasts';

  let query = $state('');
  let fileInput: HTMLInputElement | undefined = $state();

  const filtered = $derived(
    $sounds
      .filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  const inScene = $derived(new Set($activeScene?.pads.map((p) => p.soundId) ?? []));

  function fmt(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function doExport() {
    const data = await exportAll();
    const url = URL.createObjectURL(new Blob([data], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grimoire-export.zip';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function doImport(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const result = await importZip(new Uint8Array(await file.arrayBuffer()));
      await init();
      toast('toast.imported', { sounds: result.sounds, scenes: result.scenes });
    } catch {
      toast('toast.unsupported', { name: file.name }, 'error');
    }
    input.value = '';
  }

  async function del(id: string, name: string) {
    if (confirm($t('library.deleteConfirm', { name }))) await removeSound(id);
  }
</script>

{#if $libraryOpen}
  <button class="backdrop" aria-label="close" onclick={() => libraryOpen.set(false)}></button>
  <div class="modal" role="dialog">
    <header>
      <h3>{$t('library.title')}</h3>
      <input placeholder={$t('search.placeholder')} bind:value={query} />
      <button class="ghost" onclick={doExport}>{$t('library.export')}</button>
      <button class="ghost" onclick={() => fileInput?.click()}>{$t('library.import')}</button>
      <input type="file" accept=".zip" bind:this={fileInput} onchange={doImport} hidden />
      <button class="x" onclick={() => libraryOpen.set(false)}>✕</button>
    </header>
    {#if $sounds.length === 0}
      <p class="empty">{$t('library.empty')}</p>
    {:else}
      <ul>
        {#each filtered as sound (sound.id)}
          <li>
            <button class="play" title={sound.name} onclick={() => triggerSound(sound.id)}>
              {sound.emoji}
            </button>
            <span class="name">{sound.name}</span>
            <span class="detail">{fmt(sound.duration)} · {sound.type === 'loop' ? '∞' : '1×'}</span>
            <button class="ghost" title={$t('pad.editSound')} onclick={() => editingSound.set(sound.id)}>⚙</button>
            <button
              class="ghost"
              disabled={inScene.has(sound.id)}
              onclick={() => $activeScene && addPad($activeScene.id, sound.id)}
            >{$t('library.addToScene')}</button>
            <button class="del" onclick={() => del(sound.id, sound.name)}>🗑</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(13, 10, 18, 0.7);
    z-index: 20;
  }

  .modal {
    position: fixed;
    top: 8vh;
    left: 50%;
    transform: translateX(-50%);
    z-index: 21;
    width: min(44rem, 90vw);
    max-height: 80vh;
    overflow-y: auto;
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    padding: 1rem 1.2rem;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.8rem;
  }

  h3 {
    margin: 0;
    color: var(--gold);
    font-weight: normal;
    flex: 1;
  }

  header input:not([type='file']) {
    background: var(--gold-faint);
    border: 1px solid var(--panel-border);
    color: var(--text);
    padding: 0.35rem 0.7rem;
    border-radius: 4px;
    font-family: var(--font-ui);
    width: 11rem;
  }

  .ghost {
    border: 1px solid var(--panel-border);
    color: var(--muted);
    padding: 0.3rem 0.7rem;
    border-radius: 4px;
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .ghost:hover:not(:disabled) {
    color: var(--gold);
    border-color: var(--gold-dim);
  }

  .ghost:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .x {
    color: var(--muted);
  }

  .empty {
    color: var(--muted);
    text-align: center;
    padding: 2rem 0;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.3rem 0.4rem;
    border-radius: 4px;
  }

  li:hover {
    background: var(--gold-faint);
  }

  .play {
    font-size: 1.2rem;
    padding: 0.1rem 0.3rem;
  }

  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail {
    color: var(--muted);
    font-size: 0.75rem;
    font-family: var(--font-ui);
    white-space: nowrap;
  }

  .del {
    padding: 0.1rem 0.3rem;
  }
</style>
```

- [ ] **Step 2: Mount in App.svelte**

Add the import and place it next to the other overlays:

```ts
  import LibraryModal from './components/LibraryModal.svelte';
```

```svelte
  <LibraryModal />
  <SoundEditModal />
  <Toasts />
```

- [ ] **Step 3: Check and test**

Run: `npm run check` — Expected: 0 errors. Run: `npm test` — Expected: all green.

- [ ] **Step 4: Manual verification**

In `npm run dev`:

1. "Bibliothek" opens the modal listing every sound alphabetically with emoji, duration `m:ss`, ∞/1×.
2. Emoji button plays/stops the sound; ⚙ opens the sound editor on top; "Zur Szene" adds a pad (button disables once present); 🗑 asks for confirmation and removes the sound everywhere.
3. "Exportieren" downloads `grimoire-export.zip`; open it — `manifest.json` plus one file per sound under `sounds/`.
4. DevTools → Application → clear IndexedDB, reload (empty app), "Importieren" with the zip → toast "N Sounds, M Szenen importiert" and everything is back (scenes, pads, autoplay flags).
5. Escape closes the library (and only the library — sounds keep playing).

- [ ] **Step 5: Commit**

```bash
git add src/components/LibraryModal.svelte src/App.svelte
git commit -m "feat: add library modal with zip export/import"
```

---

### Task 14: Polish, unsupported-browser notice, README, final sweep

**Files:**
- Modify: `src/app.css` (vignette), `src/App.svelte` (unsupported notice)
- Create: `README.md`

**Interfaces:**
- Consumes: everything
- Produces: v1 complete.

**Documented deviation from spec:** the spec's "pre-decode autoplay sounds of the active scene" optimization is intentionally skipped — decoding happens on first play or scene switch, which is imperceptible for typical file sizes and keeps `stores.ts` free of AudioContext-in-Node issues. Everything else in the spec is implemented.

- [ ] **Step 1: Add the vignette**

Append to `src/app.css`:

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 20%, transparent 55%, rgba(0, 0, 0, 0.45) 100%);
  z-index: 1;
}
```

And add `position: relative; z-index: 2;` to the modal/overlay layers only if the vignette visually sits above them — check in the browser first; the overlays use `z-index ≥ 20` and are `position: fixed`, so no change should be needed.

- [ ] **Step 2: Unsupported-browser notice**

In `src/App.svelte`, add to the script:

```ts
  import { t } from './lib/i18n';

  const supported = typeof AudioContext !== 'undefined';
```

and wrap the template:

```svelte
{#if !supported}
  <div class="unsupported">{$t('app.unsupported')}</div>
{:else if ready}
  <!-- existing .app markup unchanged -->
{/if}
```

with style:

```css
  .unsupported {
    display: grid;
    place-items: center;
    height: 100vh;
    color: var(--muted);
    padding: 2rem;
    text-align: center;
  }
```

- [ ] **Step 3: Write README.md**

````markdown
# ⚔ GRIMOIRE — PnP Soundboard

A fully client-side soundboard for tabletop-RPG game masters. Drag audio files
into the browser, organize them into scenes, and play layered ambience loops
and one-shot effects during your session. Everything is stored locally in your
browser (IndexedDB) — no server, no accounts.

## Usage

- **Add sounds:** drag & drop audio files (mp3, ogg, wav, flac, webm) anywhere
  into the window. Files longer than 30 s become loops, shorter ones one-shots
  (changeable via ⚙ in edit mode).
- **Scenes:** tabs at the top. `+` adds, double-click renames, right-click for
  emoji/rename/delete, drag to reorder. Switching scenes crossfades: loops
  marked ▶ (autoplay, set in edit mode) fade in automatically.
- **Play:** click a pad. Loops toggle, one-shots overlap. The mixer dock at the
  bottom shows everything that is playing with its own volume and stop.
- **Panic:** the red "Stop all" button or `Esc` fades everything out.
- **Backup:** Library → Export downloads a zip; Import merges it back.

## Hotkeys

| Keys | Action |
| --- | --- |
| `1`–`0`, `Q`–`P`, `A`–`L`, `Y/Z`–`M` | trigger pad at that grid position |
| `←` / `→`, `Ctrl+1..9` | switch scene (crossfade) |
| `Esc` | close modal / stop all (fade) |
| `/` | focus search |

## Development

```bash
npm install
npm run dev      # dev server
npm test         # Vitest unit tests
npm run check    # svelte-check
npm run build    # production build (static, host anywhere)
```

Built with Svelte 5 + Vite, Web Audio API, IndexedDB (`idb`), `fflate`.
````

- [ ] **Step 4: Full verification sweep**

```bash
npm test
npm run check
npm run build
npm run preview
```

Expected: all tests pass, 0 check errors, clean build. In the preview build run through the complete session flow once: drop files → build two scenes (one with an autoplay loop) → play/overlap/search → scene crossfade → mixer volumes → stop all → edit mode reorder → library export → clear site data → import → everything restored. Verify the vignette renders and pads still glow above it.

- [ ] **Step 5: Commit**

```bash
git add src/app.css src/App.svelte README.md
git commit -m "feat: add vignette polish, unsupported-browser notice and README"
```

---

## Self-Review Notes

- **Spec coverage:** all spec sections map to tasks — data model (T2), persistence (T3), engine/fades (T4), upload/scenes/pads/playback glue (T5), hotkeys (T6/T11), export/import (T7/T13), UI incl. edit mode, library, search-with-library-row, toasts, broken-pad state, unlock hint (T8–T13), vignette + unsupported notice + README (T14). One documented deviation: pre-decode of autoplay sounds (see Task 14).
- **Type consistency:** component props (`Pad` gets `{ pad, sceneId }`, `InstanceChip` gets `{ inst }`), store/action names, and engine API are used identically across tasks; `Decoder` is satisfied structurally by `engine.decode` (an `AudioBuffer` has `duration`).
- **Escape priority order** (SoundEditModal → LibraryModal → stop all) is defined once, in Task 12's App update.



