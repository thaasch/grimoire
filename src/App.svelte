<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from './components/TopBar.svelte';
  import { init } from './lib/stores';

  let ready = $state(false);

  onMount(async () => {
    await init();
    ready = true;
  });
</script>

{#if ready}
  <div class="app">
    <TopBar />
    <main></main>
    <footer></footer>
  </div>
{/if}

<style>
  .app {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100vh;
  }

  main {
    overflow-y: auto;
  }

  footer {
    min-height: 3.2rem;
    background: var(--panel);
    border-top: 1px solid var(--panel-border);
  }
</style>
