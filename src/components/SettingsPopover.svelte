<script lang="ts">
  import { trapFocus } from '../lib/focus';
  import { t } from '../lib/i18n';
  import { setFades, settings } from '../lib/stores';

  let { onclose }: { onclose: () => void } = $props();

  const FIELDS = [
    { key: 'stop', label: 'settings.fadeStop' },
    { key: 'stopAll', label: 'settings.fadeStopAll' },
    { key: 'crossfade', label: 'settings.fadeCrossfade' },
  ] as const;
</script>

<button class="backdrop" aria-label={$t('a11y.close')} onclick={onclose}></button>
<div
  class="popover"
  role="dialog"
  aria-modal="true"
  aria-labelledby="settings-title"
  tabindex="-1"
  use:trapFocus
  onkeydown={(e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onclose();
    }
  }}
>
  <h3 id="settings-title">⚙ {$t('settings.title')}</h3>
  {#each FIELDS as field (field.key)}
    <label>
      <span>{$t(field.label)} <em>{$settings.fades[field.key].toFixed(1)}s</em></span>
      <input
        type="range"
        min="0"
        max="5"
        step="0.1"
        value={$settings.fades[field.key]}
        oninput={(e) => setFades({ [field.key]: Number(e.currentTarget.value) })}
      />
    </label>
  {/each}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 15;
  }

  .popover {
    position: fixed;
    top: 3.4rem;
    right: 1rem;
    z-index: 16;
    width: 17rem;
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    box-shadow: var(--shadow-pop);
  }

  h3 {
    margin: 0;
    color: var(--gold);
    font-weight: normal;
    font-size: 0.95rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    color: var(--muted);
    font-size: 0.8rem;
    font-family: var(--font-ui);
  }

  label span {
    display: flex;
    justify-content: space-between;
  }

  em {
    font-style: normal;
    color: var(--gold);
  }
</style>
