import { get, writable, type Writable } from 'svelte/store';
import type { Sound } from './types';

export interface Instance {
  id: string;
  soundId: string;
  loop: boolean;
  volume: number; // target volume of the instance gain, 0..1
  startedAt: number; // ctx.currentTime at start
  duration: number; // buffer duration in seconds
  stopping: boolean;
}

export type Engine = ReturnType<typeof createEngine>;

export function createEngine(createContext: () => AudioContext = () => new AudioContext()) {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let masterVolume = 0.8;
  let counter = 0;
  const buffers = new Map<string, AudioBuffer>();
  const nodes = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();
  const playing: Writable<Instance[]> = writable([]);
  const unlocked = writable(false);

  function ensure(): AudioContext {
    if (!ctx) {
      ctx = createContext();
      master = ctx.createGain();
      master.gain.value = masterVolume;
      master.connect(ctx.destination);
      if (ctx.state === 'running') unlocked.set(true);
    }
    return ctx;
  }

  async function unlock(): Promise<void> {
    const c = ensure();
    if (c.state !== 'running') await c.resume();
    unlocked.set(true);
  }

  function now(): number {
    return ctx ? ctx.currentTime : 0;
  }

  async function decode(data: ArrayBuffer): Promise<AudioBuffer> {
    // decodeAudioData detaches its input — always hand it a copy
    return ensure().decodeAudioData(data.slice(0));
  }

  function hasBuffer(soundId: string): boolean {
    return buffers.has(soundId);
  }

  function setBuffer(soundId: string, buffer: AudioBuffer): void {
    buffers.set(soundId, buffer);
  }

  function removeBuffer(soundId: string): void {
    buffers.delete(soundId);
  }

  function clearBuffers(): void {
    buffers.clear();
  }

  function play(sound: Sound, volume = sound.defaultVolume, fadeIn = 0): string | null {
    const c = ensure();
    const buffer = buffers.get(sound.id);
    if (!buffer) return null;
    const id = `inst-${++counter}`;
    const gain = c.createGain();
    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(volume, c.currentTime + fadeIn);
    } else {
      gain.gain.setValueAtTime(volume, c.currentTime);
    }
    gain.connect(master!);
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.loop = sound.type === 'loop';
    source.connect(gain);
    source.onended = () => removeInstance(id);
    source.start();
    nodes.set(id, { source, gain });
    playing.update((list) => [
      ...list,
      {
        id,
        soundId: sound.id,
        loop: source.loop,
        volume,
        startedAt: c.currentTime,
        duration: buffer.duration,
        stopping: false,
      },
    ]);
    return id;
  }

  function removeInstance(id: string): void {
    const entry = nodes.get(id);
    if (entry) {
      entry.gain.disconnect();
      entry.source.disconnect();
    }
    nodes.delete(id);
    playing.update((list) => list.filter((i) => i.id !== id));
  }

  function setInstanceVolume(id: string, volume: number): void {
    const entry = nodes.get(id);
    if (!entry || !ctx) return;
    const instance = get(playing).find((i) => i.id === id);
    if (instance?.stopping) return;
    entry.gain.gain.cancelScheduledValues(ctx.currentTime);
    entry.gain.gain.setValueAtTime(volume, ctx.currentTime);
    playing.update((list) => list.map((i) => (i.id === id ? { ...i, volume } : i)));
  }

  function setMasterVolume(volume: number): void {
    masterVolume = volume;
    if (master && ctx) master.gain.setValueAtTime(volume, ctx.currentTime);
  }

  function stop(id: string, fade = 0.3): void {
    const entry = nodes.get(id);
    if (!entry || !ctx) return;
    const t = ctx.currentTime;
    const current = entry.gain.gain.value; // current interpolated gain in real browsers
    entry.gain.gain.cancelScheduledValues(t);
    entry.gain.gain.setValueAtTime(current, t);
    entry.gain.gain.linearRampToValueAtTime(0, t + fade);
    try {
      entry.source.stop(t + fade);
    } catch {
      // source may never have started or already been stopped
    }
    playing.update((list) => list.map((i) => (i.id === id ? { ...i, stopping: true } : i)));
  }

  function stopAll(fade = 1.5): void {
    for (const instance of get(playing)) {
      if (!instance.stopping) stop(instance.id, fade);
    }
  }

  function stopLoops(fade = 1.5): void {
    for (const instance of get(playing)) {
      if (instance.loop && !instance.stopping) stop(instance.id, fade);
    }
  }

  function stopSound(soundId: string, fade = 0.3): void {
    for (const instance of get(playing)) {
      if (instance.soundId === soundId && !instance.stopping) stop(instance.id, fade);
    }
  }

  function isSoundPlaying(soundId: string): boolean {
    return get(playing).some((i) => i.soundId === soundId && !i.stopping);
  }

  return {
    playing,
    unlocked,
    unlock,
    now,
    decode,
    hasBuffer,
    setBuffer,
    removeBuffer,
    clearBuffers,
    play,
    stop,
    stopAll,
    stopLoops,
    stopSound,
    isSoundPlaying,
    setInstanceVolume,
    setMasterVolume,
  };
}

export const engine = createEngine();
