<script lang="ts">
  import { trapFocus } from '../lib/focus';
  import { t } from '../lib/i18n';
  import {
    editingSound,
    removeFromSet,
    sets,
    sounds,
    triggerSound,
    updateSet,
    updateSound,
  } from '../lib/stores';
  import { PAD_COLORS, type Sound, type SoundType } from '../lib/types';

  const EMOJIS = ['🎵', '🎲', '🔥', '⚡', '🗡', '🚪', '🐺', '🌧', '💀', '🎻', '🍺', '👣', '🐉'];

  const set = $derived($sets.find((s) => s.id === $editingSound) ?? null);
  const sound = $derived(set ? null : ($sounds.find((s) => s.id === $editingSound) ?? null));
  const entity = $derived(set ?? sound);

  const members = $derived(
    set
      ? set.soundIds
          .map((id) => $sounds.find((s) => s.id === id))
          .filter((s): s is Sound => Boolean(s))
      : [],
  );

  function rename(name: string) {
    if (set) updateSet(set.id, { name });
    else if (sound) updateSound(sound.id, { name });
  }

  function pickEmoji(emoji: string) {
    if (set) updateSet(set.id, { emoji });
    else if (sound) updateSound(sound.id, { emoji });
  }

  function setVolume(defaultVolume: number) {
    if (set) updateSet(set.id, { defaultVolume }, true);
    else if (sound) updateSound(sound.id, { defaultVolume }, true);
  }

  async function removeMember(soundId: string) {
    if (!set) return;
    const willDissolve = set.soundIds.length === 2;
    if (willDissolve && !confirm($t('sets.dissolveConfirm'))) return;
    await removeFromSet(set.id, soundId);
    if (willDissolve) editingSound.set(null); // the set id is gone now
  }
</script>

{#if entity}
  <button class="backdrop" aria-label={$t('a11y.close')} onclick={() => editingSound.set(null)}></button>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="soundedit-title" use:trapFocus>
    <h3 id="soundedit-title">{entity.emoji} {entity.name} {#if set}<span class="setbadge">🎲 {set.soundIds.length}</span>{/if}</h3>
    <label>
      {$t('sound.name')}
      <input value={entity.name} onchange={(e) => rename(e.currentTarget.value)} />
    </label>
    <div class="emojis">
      {#each EMOJIS as emoji (emoji)}
        <button class:active={entity.emoji === emoji} onclick={() => pickEmoji(emoji)}>
          {emoji}
        </button>
      {/each}
    </div>
    <div class="colors" role="group" aria-label={$t('a11y.colors')}>
      {#each PAD_COLORS as c (c)}
        <button
          class="swatch"
          class:active={(entity.color ?? 'gold') === c}
          style="--sw: var(--accent-{c})"
          aria-label={$t(`color.${c}`)}
          onclick={() => (set ? updateSet(set.id, { color: c }) : sound && updateSound(sound.id, { color: c }))}
        ></button>
      {/each}
    </div>
    {#if sound}
      <label>
        {$t('sound.type')}
        <select
          value={sound.type}
          onchange={(e) => updateSound(sound.id, { type: e.currentTarget.value as SoundType })}
        >
          <option value="loop">{$t('sound.loop')}</option>
          <option value="oneshot">{$t('sound.oneshot')}</option>
        </select>
      </label>
    {/if}
    <label>
      {$t('pad.volume')}
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={entity.defaultVolume}
        oninput={(e) => setVolume(Number(e.currentTarget.value))}
      />
    </label>
    {#if set}
      <div class="members">
        <span class="members-label">{$t('sets.members')}</span>
        <ul>
          {#each members as member (member.id)}
            <li>
              <button class="preview" aria-label={$t('a11y.preview')} onclick={() => triggerSound(member.id)}>
                {member.emoji}
              </button>
              <span class="member-name">{member.name}</span>
              <button class="rm" aria-label={$t('a11y.remove')} onclick={() => removeMember(member.id)}>✕</button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
    <button class="done" onclick={() => editingSound.set(null)}>{$t('edit.done')}</button>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay);
    z-index: 20;
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 21;
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    padding: 1.2rem;
    width: 22rem;
    max-height: 84vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    box-shadow: var(--shadow-modal);
  }

  h3 {
    margin: 0;
    color: var(--gold);
    font-weight: normal;
  }

  .setbadge {
    color: var(--muted);
    font-size: 0.8rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    color: var(--muted);
    font-size: 0.8rem;
    font-family: var(--font-ui);
  }

  input:not([type='range']),
  select {
    background: var(--gold-faint);
    border: 1px solid var(--panel-border);
    color: var(--text);
    padding: 0.35rem 0.6rem;
    border-radius: 4px;
  }

  .emojis {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.2rem;
  }

  .emojis button {
    padding: 0.3rem;
    border-radius: 4px;
    border: 1px solid transparent;
  }

  .emojis button.active {
    border-color: var(--gold);
    background: var(--gold-faint);
  }

  .colors {
    display: flex;
    gap: 0.35rem;
  }

  .swatch {
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 50%;
    background: var(--sw);
    border: 2px solid transparent;
    padding: 0;
  }

  .swatch.active {
    border-color: var(--text);
  }

  .members {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .members-label {
    color: var(--muted);
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-family: var(--font-ui);
  }

  .members ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .members li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.2rem 0.3rem;
    border-radius: 4px;
  }

  .members li:hover {
    background: var(--gold-faint);
  }

  .member-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.85rem;
  }

  .preview {
    font-size: 1rem;
  }

  .rm {
    color: var(--danger);
    padding: 0 0.2rem;
  }

  .done {
    align-self: flex-end;
    border: 1px solid var(--gold-dim);
    color: var(--gold);
    padding: 0.35rem 1rem;
    border-radius: 4px;
  }
</style>
