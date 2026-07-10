<script lang="ts">
  import { engine, type Instance } from '../lib/engine';
  import { t } from '../lib/i18n';
  import { settings, sounds } from '../lib/stores';

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
  <button class="x" aria-label={$t('a11y.stop')} onclick={() => engine.stop(inst.id, $settings.fades.stop)}>✕</button>
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
