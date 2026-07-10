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
