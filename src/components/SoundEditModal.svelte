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
    background: var(--overlay);
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
    box-shadow: var(--shadow-modal);
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
