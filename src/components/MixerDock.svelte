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
    <button class="stopall" onclick={() => engine.stopAll($settings.fades.stopAll)}>⏹ {$t('mixer.stopAll')}</button>
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
