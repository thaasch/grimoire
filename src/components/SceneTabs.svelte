<script lang="ts">
  import { t } from '../lib/i18n';
  import {
    activateScene,
    createScene,
    deleteScene,
    moveScene,
    scenes,
    settings,
    updateScene,
  } from '../lib/stores';

  const EMOJIS = ['📜', '🍺', '🕸', '🐉', '⚔', '🔥', '🌲', '🏰', '🌊', '👻'];

  let menuFor: string | null = $state(null);
  let menuPos = $state({ x: 0, y: 0 });
  let menuEl: HTMLDivElement | undefined = $state();
  let renamingId: string | null = $state(null);
  let renameValue = $state('');
  let dragIndex: number | null = $state(null);

  const ordered = $derived([...$scenes].sort((a, b) => a.position - b.position));

  function focusOnMount(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  function showMenu(id: string, x: number, y: number) {
    menuFor = id;
    menuPos = { x, y };
  }

  function openMenu(e: MouseEvent, id: string) {
    e.preventDefault();
    showMenu(id, e.clientX, e.clientY);
  }

  function openMenuFromKeyboard(e: KeyboardEvent, id: string) {
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      showMenu(id, rect.left, rect.bottom);
    }
  }

  $effect(() => {
    if (menuFor && menuEl) {
      menuEl.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }
  });

  function startRename(id: string, current: string) {
    renamingId = id;
    renameValue = current;
    menuFor = null;
  }

  async function commitRename() {
    if (renamingId && renameValue.trim()) {
      await updateScene(renamingId, { name: renameValue.trim() });
    }
    renamingId = null;
  }

  async function remove(id: string, name: string) {
    menuFor = null;
    if (confirm($t('scenes.deleteConfirm', { name }))) await deleteScene(id);
  }

  async function addScene() {
    await createScene($t('scenes.defaultName', { n: ordered.length + 1 }));
  }

  function onDrop(e: DragEvent, to: number) {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== to) moveScene(dragIndex, to);
    dragIndex = null;
  }
</script>

<nav>
  {#each ordered as scene, i (scene.id)}
    {#if renamingId === scene.id}
      <input
        class="rename"
        bind:value={renameValue}
        use:focusOnMount
        onblur={commitRename}
        onkeydown={(e) => {
          if (e.key === 'Enter') commitRename();
          if (e.key === 'Escape') renamingId = null;
          e.stopPropagation();
        }}
      />
    {:else}
      <button
        class="tab"
        class:active={scene.id === $settings.activeSceneId}
        draggable="true"
        ondragstart={() => (dragIndex = i)}
        ondragover={(e) => e.preventDefault()}
        ondrop={(e) => onDrop(e, i)}
        onclick={() => activateScene(scene.id)}
        ondblclick={() => startRename(scene.id, scene.name)}
        oncontextmenu={(e) => openMenu(e, scene.id)}
        onkeydown={(e) => openMenuFromKeyboard(e, scene.id)}
      >{scene.emoji} {scene.name}</button>
    {/if}
  {/each}
  <button class="tab add" onclick={addScene} title={$t('scenes.new')}>+</button>
</nav>

{#if menuFor}
  {@const scene = ordered.find((s) => s.id === menuFor)}
  <button class="backdrop" onclick={() => (menuFor = null)} aria-label="close"></button>
  {#if scene}
    <div
      class="menu"
      role="menu"
      tabindex="-1"
      bind:this={menuEl}
      style="left: {menuPos.x}px; top: {menuPos.y}px"
      onkeydown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          menuFor = null;
        }
      }}
    >
      <div class="emojis">
        {#each EMOJIS as emoji (emoji)}
          <button
            role="menuitem"
            aria-label={emoji}
            onclick={() => {
              updateScene(scene.id, { emoji });
              menuFor = null;
            }}
          >{emoji}</button>
        {/each}
      </div>
      <button class="item" role="menuitem" onclick={() => startRename(scene.id, scene.name)}>
        {$t('scenes.rename')}
      </button>
      <button class="item danger" role="menuitem" onclick={() => remove(scene.id, scene.name)}>
        {$t('scenes.delete')}
      </button>
    </div>
  {/if}
{/if}

<style>
  nav {
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
  }

  .tab {
    white-space: nowrap;
    color: var(--muted);
    border: 1px solid var(--violet-dim);
    border-radius: 3px;
    padding: 0.35rem 0.9rem;
    font-size: 0.85rem;
  }

  .tab:hover {
    color: var(--text);
  }

  .tab.active {
    background: var(--gold-soft);
    border-color: var(--gold-strong);
    color: var(--gold);
  }

  .rename {
    background: var(--gold-faint);
    border: 1px solid var(--gold);
    color: var(--gold);
    border-radius: 3px;
    padding: 0.3rem 0.6rem;
    width: 9rem;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
  }

  .menu {
    position: fixed;
    z-index: 11;
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    padding: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    box-shadow: var(--shadow-pop);
  }

  .emojis {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
  }

  .emojis button {
    padding: 0.25rem;
    border-radius: 3px;
  }

  .emojis button:hover {
    background: var(--gold-faint);
  }

  .item {
    text-align: left;
    padding: 0.35rem 0.5rem;
    border-radius: 3px;
    font-size: 0.85rem;
    color: var(--text);
  }

  .item:hover {
    background: var(--gold-faint);
  }

  .item.danger {
    color: var(--danger);
  }
</style>
