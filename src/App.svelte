<script lang="ts">
  import { onMount } from 'svelte';
  import DropOverlay from './components/DropOverlay.svelte';
  import Toasts from './components/Toasts.svelte';
  import TopBar from './components/TopBar.svelte';
  import { engine } from './lib/engine';
  import { importFiles, init } from './lib/stores';
  import { toast } from './lib/toasts';

  let ready = $state(false);
  let dragDepth = $state(0);

  onMount(async () => {
    await init();
    ready = true;
  });

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragDepth = 0;
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length === 0) return;
    const { added, failed } = await importFiles(files, (data) => engine.decode(data));
    if (added.length > 0) toast('toast.added', { n: added.length });
    for (const f of failed) {
      toast(f.reason === 'quota' ? 'toast.quota' : 'toast.unsupported', { name: f.name }, 'error');
    }
  }
</script>

<svelte:window
  ondragenter={(e) => {
    e.preventDefault();
    dragDepth++;
  }}
  ondragleave={() => (dragDepth = Math.max(0, dragDepth - 1))}
  ondragover={(e) => e.preventDefault()}
  ondrop={handleDrop}
/>

{#if ready}
  <div class="app">
    <TopBar />
    <main></main>
    <footer></footer>
  </div>
  {#if dragDepth > 0}
    <DropOverlay />
  {/if}
  <Toasts />
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
