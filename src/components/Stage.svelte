<script lang="ts">
  import { engine } from '../lib/engine';
  import { t } from '../lib/i18n';
  import {
    activeScene,
    addFilesToPad,
    addPad,
    editMode,
    mergePads,
    movePad,
    searchQuery,
    sets,
    sounds,
    triggerRef,
  } from '../lib/stores';
  import { toast } from '../lib/toasts';
  import PadView from './Pad.svelte';

  let dragIndex: number | null = $state(null);
  let overIndex: number | null = $state(null);
  let overZone: 'merge' | 'before' | 'after' | null = $state(null);

  const query = $derived($searchQuery.trim().toLowerCase());

  function refName(id: string): string | undefined {
    return $sets.find((s) => s.id === id)?.name ?? $sounds.find((s) => s.id === id)?.name;
  }

  const pads = $derived.by(() => {
    const scene = $activeScene;
    if (!scene) return [];
    const ordered = [...scene.pads].sort((a, b) => a.position - b.position);
    if (!query) return ordered;
    return ordered.filter((p) => refName(p.soundId)?.toLowerCase().includes(query));
  });

  const libraryMatches = $derived.by(() => {
    const scene = $activeScene;
    if (!query || !scene) return [];
    const inScene = new Set(scene.pads.map((p) => p.soundId));
    const setEntries = $sets
      .filter((s) => s.name.toLowerCase().includes(query) && !inScene.has(s.id))
      .map((s) => ({ id: s.id, emoji: s.emoji, name: `${s.name} 🎲` }));
    const soundEntries = $sounds
      .filter((s) => s.name.toLowerCase().includes(query) && !inScene.has(s.id))
      .map((s) => ({ id: s.id, emoji: s.emoji, name: s.name }));
    return [...setEntries, ...soundEntries];
  });

  function clearDragState() {
    dragIndex = null;
    overIndex = null;
    overZone = null;
  }

  function zoneFor(e: DragEvent, cell: HTMLElement): 'merge' | 'before' | 'after' {
    const rect = cell.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.25) return 'before';
    if (x > 0.75) return 'after';
    return 'merge';
  }

  function onCellDragover(e: DragEvent, i: number) {
    if (dragIndex === null || dragIndex === i) return;
    e.preventDefault();
    overIndex = i;
    overZone = zoneFor(e, e.currentTarget as HTMLElement);
  }

  async function onCellDrop(e: DragEvent, i: number) {
    const files = [...(e.dataTransfer?.files ?? [])];
    if (dragIndex === null && files.length > 0 && $editMode && $activeScene) {
      e.preventDefault();
      e.stopPropagation(); // handled here — must not reach the window import handler
      const pad = pads[i];
      const result = await addFilesToPad($activeScene.id, pad.soundId, files, (d) => engine.decode(d));
      if (!result.applied || result.rejectedLoops > 0) toast('toast.loopInSet', {}, 'error');
      if (result.applied && result.added.length > 0) toast('toast.added', { n: result.added.length });
      for (const f of result.failed) {
        toast(f.reason === 'quota' ? 'toast.quota' : 'toast.unsupported', { name: f.name }, 'error');
      }
      return;
    }
    if (dragIndex === null) return; // plain file drop outside edit mode → bubbles to the window handler
    e.preventDefault();
    e.stopPropagation();
    const from = dragIndex;
    const zone = overZone ?? 'merge';
    clearDragState();
    if (!$activeScene || from === i) return;
    if (zone === 'merge') {
      const ok = await mergePads($activeScene.id, pads[from].soundId, pads[i].soundId);
      if (!ok) toast('toast.loopInSet', {}, 'error');
    } else {
      const to = zone === 'before' ? (from < i ? i - 1 : i) : from < i ? i : i + 1;
      movePad($activeScene.id, from, to);
    }
  }
</script>

<div class="stage">
  {#if $activeScene && $activeScene.pads.length === 0}
    <div class="empty">📜 {$t('stage.dropHint')}</div>
  {:else if $activeScene}
    <div class="grid">
      {#each pads as pad, i (pad.soundId)}
        <div
          class="cell"
          class:merge-target={overIndex === i && overZone === 'merge' && dragIndex !== null && dragIndex !== i}
          class:before-target={overIndex === i && overZone === 'before' && dragIndex !== null}
          class:after-target={overIndex === i && overZone === 'after' && dragIndex !== null}
          role="presentation"
          draggable={$editMode && !query}
          ondragstart={(e) => {
            if ($editMode && !query) dragIndex = i;
            else e.preventDefault();
          }}
          ondragover={(e) => onCellDragover(e, i)}
          ondragleave={() => {
            if (overIndex === i) {
              overIndex = null;
              overZone = null;
            }
          }}
          ondrop={(e) => onCellDrop(e, i)}
          ondragend={clearDragState}
        >
          <PadView {pad} sceneId={$activeScene.id} />
        </div>
      {/each}
    </div>
    {#if libraryMatches.length > 0}
      <h3 class="label">{$t('search.fromLibrary')}</h3>
      <div class="grid">
        {#each libraryMatches as entry (entry.id)}
          <div class="libpad">
            <button class="play" onclick={() => triggerRef(entry.id)}>
              <span class="emoji">{entry.emoji}</span>
              <span class="name">{entry.name}</span>
            </button>
            <button
              class="addbtn"
              title={$t('library.addToScene')}
              aria-label={$t('library.addToScene')}
              onclick={() => $activeScene && addPad($activeScene.id, entry.id)}
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

  .cell {
    border-radius: 6px;
  }

  .cell.merge-target {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }

  .cell.before-target {
    box-shadow: -4px 0 0 var(--gold);
  }

  .cell.after-target {
    box-shadow: 4px 0 0 var(--gold);
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
