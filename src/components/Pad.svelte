<script lang="ts">
  import { engine } from '../lib/engine';
  import { keyLabel, padKeyCode } from '../lib/hotkeys';
  import { lang, t } from '../lib/i18n';
  import { brokenSounds, editMode, editingSound, removePad, sounds, triggerPad, updatePad } from '../lib/stores';
  import type { Pad } from '../lib/types';

  let { pad, sceneId }: { pad: Pad; sceneId: string } = $props();

  const { playing } = engine;

  const sound = $derived($sounds.find((s) => s.id === pad.soundId));
  const instances = $derived($playing.filter((i) => i.soundId === pad.soundId && !i.stopping));
  const isPlaying = $derived(instances.length > 0);
  const code = $derived(padKeyCode(pad.position));
  const broken = $derived($brokenSounds.has(pad.soundId));

  let progress = $state(0);

  $effect(() => {
    if (!isPlaying || !sound || sound.type !== 'oneshot') {
      progress = 0;
      return;
    }
    let raf = 0;
    const tick = () => {
      const latest = instances[instances.length - 1];
      progress = latest ? Math.min(1, (engine.now() - latest.startedAt) / latest.duration) : 0;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });
</script>

{#if sound}
  <div class="pad" class:playing={isPlaying} class:broken class:loop={sound.type === 'loop'}>
    <button
      class="face"
      onclick={() => triggerPad(pad)}
      disabled={broken}
      title={broken ? $t('pad.broken') : sound.name}
    >
      <span class="emoji">{sound.emoji}</span>
      <span class="name">{sound.name}</span>
      <span class="meta">
        {#if code}<kbd>{keyLabel(code, $lang)}</kbd>{/if}
        {#if sound.type === 'loop'}<span class="badge">∞</span>{/if}
        {#if broken}<span class="badge">⚠</span>{/if}
      </span>
      {#if sound.type === 'oneshot' && isPlaying}
        <span class="ring" style="--p: {progress}"></span>
      {/if}
    </button>
    {#if $editMode}
      <div class="editbar">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          title={$t('pad.volume')}
          value={pad.volume ?? sound.defaultVolume}
          oninput={(e) => updatePad(sceneId, pad.soundId, { volume: Number(e.currentTarget.value) })}
        />
        {#if sound.type === 'loop'}
          <label class="auto" title={$t('pad.autoplay')}>
            <input
              type="checkbox"
              checked={pad.autoplay ?? false}
              onchange={(e) => updatePad(sceneId, pad.soundId, { autoplay: e.currentTarget.checked })}
            />▶
          </label>
        {/if}
        <button class="gear" title={$t('pad.editSound')} onclick={() => editingSound.set(pad.soundId)}>⚙</button>
        <button class="rm" title={$t('pad.remove')} onclick={() => removePad(sceneId, pad.soundId)}>✕</button>
      </div>
    {/if}
  </div>
{:else}
  <div class="pad orphan">
    <div class="face orphan-face">
      <span class="emoji">⚠</span>
      <span class="name">{$t('pad.broken')}</span>
      <button class="rm" title={$t('pad.remove')} onclick={() => removePad(sceneId, pad.soundId)}>✕</button>
    </div>
  </div>
{/if}

<style>
  .face {
    position: relative;
    overflow: hidden;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 1.1rem 0.5rem 0.9rem;
    background: var(--gold-faint);
    border: 1px solid var(--gold-dim);
    border-radius: 6px;
    color: var(--text);
    transition: border-color 0.15s, box-shadow 0.3s, background 0.3s;
  }

  .face:hover {
    border-color: var(--gold);
  }

  .playing .face {
    background: radial-gradient(circle at 50% 25%, var(--ember-glow), var(--ink-deep));
    border-color: var(--ember);
    box-shadow: 0 0 16px var(--ember-glow);
  }

  .playing.loop .face {
    animation: pulse 2.4s ease-in-out infinite;
  }

  @keyframes pulse {
    50% {
      box-shadow: 0 0 26px var(--ember-glow);
    }
  }

  .broken .face {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .orphan-face {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 1.1rem 0.5rem 0.9rem;
    border: 1px dashed var(--violet-dim);
    border-radius: 6px;
    color: var(--muted);
  }

  .emoji {
    font-size: 1.6rem;
  }

  .name {
    font-size: 0.85rem;
    text-align: center;
    overflow-wrap: anywhere;
  }

  .meta {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  kbd {
    font-family: var(--font-ui);
    font-size: 0.6rem;
    color: var(--muted);
    border: 1px solid var(--panel-border);
    border-radius: 3px;
    padding: 0 0.3rem;
  }

  .badge {
    color: var(--gold);
    font-size: 0.7rem;
  }

  .ring {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: conic-gradient(var(--ember) calc(var(--p) * 360deg), var(--ring-track) 0);
  }

  .editbar {
    display: flex;
    gap: 0.3rem;
    align-items: center;
    margin-top: 0.3rem;
    font-family: var(--font-ui);
    font-size: 0.75rem;
    color: var(--muted);
  }

  .editbar input[type='range'] {
    flex: 1;
    min-width: 0;
  }

  .auto {
    display: flex;
    align-items: center;
    gap: 0.15rem;
  }

  .rm {
    color: var(--danger);
    padding: 0 0.2rem;
  }

  .gear {
    color: var(--muted);
    padding: 0 0.2rem;
  }

  .gear:hover {
    color: var(--gold);
  }
</style>
