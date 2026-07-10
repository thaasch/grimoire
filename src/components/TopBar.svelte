<script lang="ts">
  import { onMount } from 'svelte';
  import { lang, t, type Lang } from '../lib/i18n';
  import { editMode, libraryOpen, searchQuery, setLanguage } from '../lib/stores';
  import SceneTabs from './SceneTabs.svelte';
  import SettingsPopover from './SettingsPopover.svelte';

  const LANGS: Lang[] = ['de', 'en'];

  let searchInput: HTMLInputElement | undefined = $state();
  let settingsOpen = $state(false);

  onMount(() => {
    const focus = () => searchInput?.focus();
    window.addEventListener('grimoire:focus-search', focus);
    return () => window.removeEventListener('grimoire:focus-search', focus);
  });
</script>

<header>
  <h1>⚔ GRIMOIRE</h1>
  <SceneTabs />
  <div class="right">
    <input
      class="search"
      bind:this={searchInput}
      bind:value={$searchQuery}
      placeholder={$t('search.placeholder')}
      aria-label={$t('search.placeholder')}
    />
    <button
      class="ghost"
      class:active={$editMode}
      onclick={() => editMode.update((v) => !v)}
      title={$t('edit.mode')}
      aria-label={$t('a11y.editMode')}
    >✎</button>
    <button class="ghost" aria-label={$t('a11y.settings')} onclick={() => (settingsOpen = true)}>⚙</button>
    <button class="ghost" onclick={() => libraryOpen.set(true)}>{$t('library.title')}</button>
    <div class="langs">
      {#each LANGS as language (language)}
        <button class:active={$lang === language} onclick={() => setLanguage(language)}>
          {language.toUpperCase()}
        </button>
      {/each}
    </div>
  </div>
</header>

{#if settingsOpen}
  <SettingsPopover onclose={() => (settingsOpen = false)} />
{/if}

<style>
  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.6rem 1rem;
    background: var(--panel);
    border-bottom: 1px solid var(--panel-border);
  }

  h1 {
    margin: 0;
    font-size: 1rem;
    font-weight: normal;
    letter-spacing: 0.25em;
    color: var(--gold);
    white-space: nowrap;
  }

  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .search {
    background: var(--gold-faint);
    border: 1px solid var(--panel-border);
    color: var(--text);
    padding: 0.35rem 0.7rem;
    border-radius: 4px;
    font-family: var(--font-ui);
    width: 12rem;
  }

  .ghost {
    border: 1px solid var(--panel-border);
    color: var(--muted);
    padding: 0.35rem 0.7rem;
    border-radius: 4px;
  }

  .ghost.active,
  .ghost:hover {
    color: var(--gold);
    border-color: var(--gold-dim);
  }

  .langs button {
    color: var(--muted);
    padding: 0.35rem 0.3rem;
    font-size: 0.8rem;
    font-family: var(--font-ui);
  }

  .langs button.active {
    color: var(--gold);
  }
</style>
