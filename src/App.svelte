<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import DropOverlay from './components/DropOverlay.svelte';
  import MixerDock from './components/MixerDock.svelte';
  import Stage from './components/Stage.svelte';
  import Toasts from './components/Toasts.svelte';
  import TopBar from './components/TopBar.svelte';
  import { engine } from './lib/engine';
  import { isTypingTarget, padIndexForCode } from './lib/hotkeys';
  import {
    activateScene,
    activeScene,
    importFiles,
    init,
    libraryOpen,
    scenes,
    settings,
    triggerPad,
  } from './lib/stores';
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

  function onPointerDown() {
    if (!get(engine.unlocked)) engine.unlock();
  }

  function onKeydown(e: KeyboardEvent) {
    if (isTypingTarget(e.target)) return;

    if (e.key === 'Escape') {
      if (get(libraryOpen)) {
        libraryOpen.set(false);
      } else {
        engine.stopAll(1.5);
      }
      return;
    }

    if (e.key === '/') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('grimoire:focus-search'));
      return;
    }

    const ordered = [...get(scenes)].sort((a, b) => a.position - b.position);

    if (e.ctrlKey && /^Digit[1-9]$/.test(e.code)) {
      const scene = ordered[Number(e.code.slice(5)) - 1];
      if (scene) {
        e.preventDefault();
        activateScene(scene.id);
      }
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const current = ordered.findIndex((s) => s.id === get(settings).activeSceneId);
      const next = ordered[current + (e.key === 'ArrowRight' ? 1 : -1)];
      if (next) activateScene(next.id);
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const index = padIndexForCode(e.code);
    if (index === null) return;
    const scene = get(activeScene);
    const pad = scene ? [...scene.pads].sort((a, b) => a.position - b.position)[index] : undefined;
    if (pad) triggerPad(pad);
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
  onkeydown={onKeydown}
  onpointerdown={onPointerDown}
/>

{#if ready}
  <div class="app">
    <TopBar />
    <main><Stage /></main>
    <MixerDock />
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
</style>
