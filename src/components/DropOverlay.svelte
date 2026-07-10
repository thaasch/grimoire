<script lang="ts">
  import { t } from '../lib/i18n';
</script>

<div class="overlay">
  <div class="frame">📜 {$t('stage.dropHint')}</div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-strong);
    display: grid;
    place-items: center;
    z-index: 40;
    pointer-events: none;
  }

  .frame {
    border: 2px dashed var(--gold);
    color: var(--gold);
    border-radius: 8px;
    padding: 3rem 5rem;
    font-size: 1.5rem;
  }
</style>
