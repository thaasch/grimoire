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
