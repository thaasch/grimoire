# GRIMOIRE — PnP Soundboard: Design

**Date:** 2026-07-10
**Status:** Approved by user (brainstorming session)

## Overview

A browser-based soundboard for pen & paper (tabletop RPG) game masters, inspired by
[devP00L/pnp-soundboard](https://devp00l.github.io/pnp-soundboard/) but with a modern,
polished visual design. Fully client-side: users drag & drop their own audio files into
the app; everything is stored in the browser (IndexedDB) and works offline after first load.

**Working title:** GRIMOIRE

## Goals

- Instant, reliable sound triggering during live game sessions (clicks and hotkeys).
- Layered ambience loops + overlapping one-shot effects, playing in parallel.
- Scenes ("Taverne", "Bosskampf") that switch with a crossfade.
- A visual design that feels like a magical artifact: dark, elegant, glowing.
- Zero server, zero accounts. Static hosting or local file usage.

## Non-goals

- No bundled sound library (users bring their own files).
- No mobile/phone layout. Desktop/laptop only (min-width target ~1024px).
- No streaming integrations (Spotify, YouTube) — local files only.
- No multi-user / remote-player sync.

## Decisions made during brainstorming

| Topic | Decision |
|---|---|
| Sound source | User drag & drop, persisted in IndexedDB |
| Playback | Looping ambience layers, one-shots, scenes/crossfades, global controls |
| Visual style | "Arcane Console": near-black violet, gold + ember glow, serif type |
| Layout | Scene tabs top, pad grid center (stage), mixer dock bottom |
| UI language | German **and** English, runtime switcher |
| Devices | Desktop/laptop only |
| Stack | Svelte 5 + Vite, native Web Audio API, IndexedDB (`idb`), `fflate` for zip export |

## Core concepts & data model

```ts
type SoundType = 'loop' | 'oneshot';

interface Sound {
  id: string;            // uuid
  name: string;
  emoji: string;         // pad icon, user-editable, default '🎵'
  type: SoundType;       // guessed on upload (duration > 30s => loop), editable
  defaultVolume: number; // 0..1
  duration: number;      // seconds, from decode
  mimeType: string;
  createdAt: number;
}
// Audio bytes stored separately in a `blobs` store keyed by sound id.

interface Pad {
  soundId: string;
  volume?: number;       // per-scene override, else sound.defaultVolume
  autoplay?: boolean;    // loops only: start when scene is activated
  position: number;      // grid order
}

interface Scene {
  id: string;
  name: string;
  emoji: string;
  pads: Pad[];
  position: number;      // tab order
}

interface Settings {
  language: 'de' | 'en';
  masterVolume: number;  // 0..1
  activeSceneId: string | null;
}
```

- A **Sound** is one uploaded file. It can appear in any number of scenes without
  duplicating the blob.
- A **Scene** is a named arrangement of pads for a situation. Scene tabs are the primary
  navigation.
- A **playback instance** (runtime only, not persisted) is one currently playing sound.
  Multiple instances can exist per sound (overlapping one-shots).
- The **Library** (modal) lists all sounds with search: edit metadata, delete, add to
  the active scene.
- **Export/import:** one `.zip` containing `manifest.json` (sounds, scenes, settings) plus
  the audio files. Import merges by id (existing ids are overwritten, new ones added).

## UI design

Visual identity ("Arcane Console"):

- Background near-black violet `#0d0a12`, panels `#161020`, subtle vignette/texture.
- Gold `#e8c87e` for structure, borders, active tab, headings.
- Ember orange `#ff6b35` **exclusively** for playing/active states (glow).
- Muted violet-grey `#8a7a9a` for secondary text.
- Serif display font for headings/pad names: system serif stack
  (`Georgia, 'Times New Roman', serif`) for v1 — no font assets to load; small
  labels/values use the system sans stack for legibility.
- Danger accents (Stop All) in muted red.

Layout (top to bottom):

1. **Top bar** — ⚔ GRIMOIRE title; scene tabs (active glows gold; `+` adds; drag to
   reorder; context menu: rename, change emoji, delete with confirm); right side:
   search field, Library button, DE/EN switcher.
2. **Stage** — responsive pad grid of the active scene.
   - Pad shows: emoji, name, hotkey label, ∞ badge for loops.
   - States: idle (dark card, faint gold border) → hover (brighter border) →
     playing (ember radial glow; soft pulse for loops; progress ring for one-shots).
   - Click: loop toggles on/off; one-shot fires (again — overlap allowed).
   - **Edit mode** (pencil toggle): rearrange pads (drag), per-pad volume, autoplay
     toggle for loops, remove pad from scene, edit sound metadata.
   - Empty scene: drop hint ("Dateien hierher ziehen" / "Drop files here").
   - Drag & drop of audio files works anywhere in the app; drops add sounds to the
     library **and** as pads to the active scene.
3. **Mixer dock** (always visible) — one chip per playing instance: emoji + name,
   inline volume slider, ∞ for loops, ✕ stop (quick fade). Right side: master volume
   slider, **⏹ Stop All** (1.5s fade-out). Empty state: quiet "Nichts spielt" text.
4. **Toasts** — top-right, for errors and confirmations.

Search behavior: filters pads of the active scene by name; matching sounds from other
scenes/library are shown in a secondary "aus der Bibliothek" row so anything is
reachable mid-session.

## Audio engine

Single module (`src/lib/engine.ts`) owning one `AudioContext`.

- Graph per instance: `AudioBufferSourceNode → instance GainNode → master GainNode →
  destination`.
- Decode on upload (validates the file, yields duration); AudioBuffers cached in memory
  by sound id (decode lazily after reload on first play; pre-decode autoplay sounds of
  the active scene).
- Loops: `source.loop = true` (gapless, unlike `<audio>`).
- Fades = gain ramps (`linearRampToValueAtTime`):
  - single instance stop: 300 ms
  - Stop All: 1.5 s
  - scene switch: 1.5 s crossfade — running loops ramp down & stop; new scene's
    `autoplay` loops start at 0 and ramp up to their pad volume. One-shots are never
    auto-fired by a scene switch; running one-shots are left alone.
- One-shot instances remove themselves on `ended`.
- Autoplay policy: `context.resume()` on first user gesture; until then, a subtle hint
  chip in the mixer dock ("Klicken zum Aktivieren" / "Click to enable audio").

## Persistence

IndexedDB via `idb`, database `grimoire`, stores:

- `sounds` (metadata, key: id)
- `blobs` (audio bytes, key: sound id)
- `scenes` (key: id)
- `settings` (single record)

Writes are debounced where high-frequency (volume sliders). First run seeds one empty
scene ("Szene 1") so the drop hint shows immediately.

## Hotkeys

- Pads: auto-assigned by grid position, keyboard-layout order rows `1234567890`,
  `QWERTZUIOP`, `ASDFGHJKL`, `YXCVBNM` (uses `KeyboardEvent.code` so DE/EN physical
  layouts behave identically; labels rendered per layout). Shown on the pad.
- `←/→` and `Ctrl+1..9`: switch scenes (with crossfade).
- `Esc`: Stop All (fade). If a modal is open, `Esc` closes the modal instead.
- `/`: focus search.
- All pad/scene hotkeys are suspended while an input/textarea is focused.

## i18n

Tiny dictionary module (`src/lib/i18n.ts`), languages `de` and `en`, Svelte store +
`t('key')` helper. Switcher in the top bar; persisted in settings. Default: browser
language if `de`, else `en`.

## Error handling

- Unsupported/undecodable file on drop → toast with filename and reason; other files in
  the same drop still process.
- IndexedDB quota exceeded → toast advising export + cleanup; upload rolled back.
- Missing blob at play time (partial import, cleared storage) → pad renders a broken
  state (dimmed, ⚠) with a "remove" affordance instead of crashing.
- `AudioContext` unavailable → full-screen unsupported-browser notice.

## Testing

- **Vitest** unit tests: engine fade/crossfade scheduling against a mocked
  AudioContext; store logic (scene CRUD, pad ordering, hotkey assignment); export/import
  manifest round-trip (in-memory IndexedDB via `fake-indexeddb`).
- UI verified by running the app (dev server) — no E2E suite for v1.

## Project structure

```
pnp-soundboard/
  src/
    lib/
      engine.ts        # Web Audio engine
      db.ts            # IndexedDB access (idb)
      stores.ts        # Svelte stores: sounds, scenes, playback, settings
      i18n.ts          # DE/EN dictionary + t()
      hotkeys.ts       # key handling & assignment
      exchange.ts      # zip export/import (fflate)
    components/
      TopBar.svelte, SceneTabs.svelte, Stage.svelte, Pad.svelte,
      MixerDock.svelte, InstanceChip.svelte, LibraryModal.svelte,
      Toasts.svelte, DropOverlay.svelte
    App.svelte
    main.ts
  docs/superpowers/specs/
```

Each unit is independently testable: `engine` knows nothing about Svelte; `db` knows
nothing about audio; components read/write stores only.
