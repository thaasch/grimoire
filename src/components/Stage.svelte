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
