<script lang="ts">
  import { exportAll, importZip } from '../lib/exchange';
  import { engine } from '../lib/engine';
  import { trapFocus } from '../lib/focus';
  import { t } from '../lib/i18n';
  import {
    activeScene,
    addPad,
    deleteSet,
    editingSound,
    init,
    libraryOpen,
    removeSound,
    sets,
    sounds,
    triggerRef,
  } from '../lib/stores';
  import { toast } from '../lib/toasts';
  import type { PadColor } from '../lib/types';

  let query = $state('');
  let fileInput: HTMLInputElement | undefined = $state();

  interface Entry {
    id: string;
    name: string;
    emoji: string;
    isSet: boolean;
    detail: string;
    color?: PadColor;
  }

  const entries = $derived.by((): Entry[] => {
    const q = query.trim().toLowerCase();
    const soundEntries = $sounds
      .filter((s) => s.name.toLowerCase().includes(q))
      .map((s) => ({
        id: s.id,
        name: s.name,
        emoji: s.emoji,
        isSet: false,
        detail: `${fmt(s.duration)} · ${s.type === 'loop' ? '∞' : '1×'}`,
        color: s.color,
      }));
    const setEntries = $sets
      .filter((s) => s.name.toLowerCase().includes(q))
      .map((s) => ({ id: s.id, name: s.name, emoji: s.emoji, isSet: true, detail: `🎲 ${s.soundIds.length}`, color: s.color }));
    return [...soundEntries, ...setEntries].sort((a, b) => a.name.localeCompare(b.name));
  });

  const inScene = $derived(new Set($activeScene?.pads.map((p) => p.soundId) ?? []));

  function fmt(seconds: number): string {
    const total = Math.round(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
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
      toast('toast.imported', { sounds: result.sounds, scenes: result.scenes });
    } catch (error) {
      const quota = error instanceof DOMException && error.name === 'QuotaExceededError';
      toast(quota ? 'toast.quota' : 'toast.unsupported', quota ? {} : { name: file.name }, 'error');
    } finally {
      engine.clearBuffers(); // imported bytes may replace cached ids
      await init(); // sync stores with whatever actually landed in the DB
      input.value = '';
    }
  }

  async function del(entry: Entry) {
    if (!confirm($t('library.deleteConfirm', { name: entry.name }))) return;
    if (entry.isSet) await deleteSet(entry.id);
    else await removeSound(entry.id);
  }
</script>

{#if $libraryOpen}
  <button class="backdrop" aria-label={$t('a11y.close')} onclick={() => libraryOpen.set(false)}></button>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="library-title" use:trapFocus>
    <header>
      <h3 id="library-title">{$t('library.title')}</h3>
      <input aria-label={$t('search.placeholder')} placeholder={$t('search.placeholder')} bind:value={query} />
      <button class="ghost" onclick={doExport}>{$t('library.export')}</button>
      <button class="ghost" onclick={() => fileInput?.click()}>{$t('library.import')}</button>
      <input type="file" accept=".zip" bind:this={fileInput} onchange={doImport} hidden />
      <button class="x" aria-label={$t('a11y.close')} onclick={() => libraryOpen.set(false)}>✕</button>
    </header>
    {#if $sounds.length === 0 && $sets.length === 0}
      <p class="empty">{$t('library.empty')}</p>
    {:else}
      <ul>
        {#each entries as entry (entry.id)}
          <li>
            <button class="play" title={entry.name} aria-label={$t('a11y.preview')} onclick={() => triggerRef(entry.id)}>
              {entry.emoji}
            </button>
            <span class="dot" style="background: var(--accent-{entry.color ?? 'gold'})"></span>
            <span class="name">{entry.name}</span>
            <span class="detail">{entry.detail}</span>
            <button class="ghost" title={$t('pad.editSound')} aria-label={$t('a11y.editSound')} onclick={() => editingSound.set(entry.id)}>⚙</button>
            <button
              class="ghost"
              disabled={inScene.has(entry.id)}
              onclick={() => $activeScene && addPad($activeScene.id, entry.id)}
            >{$t('library.addToScene')}</button>
            <button class="del" aria-label={$t('a11y.delete')} onclick={() => del(entry)}>🗑</button>
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
    background: var(--overlay);
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
    box-shadow: var(--shadow-modal);
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

  .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    flex-shrink: 0;
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
