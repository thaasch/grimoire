import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/lib/engine';
import type { Sound } from '../src/lib/types';
import { MockAudioContext } from './mocks/audio';

const FAKE_BUFFER = { duration: 42 } as unknown as AudioBuffer;

function makeSound(over: Partial<Sound> = {}): Sound {
  return {
    id: 's1',
    name: 'Fire',
    emoji: '🔥',
    type: 'loop',
    defaultVolume: 0.8,
    duration: 42,
    mimeType: 'audio/mpeg',
    createdAt: 0,
    ...over,
  };
}

function setup() {
  const ctx = new MockAudioContext();
  const engine = createEngine(() => ctx as unknown as AudioContext);
  return { ctx, engine };
}

describe('engine.play', () => {
  it('wires source → instance gain → master and reports the instance', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    const id = engine.play(makeSound());
    expect(id).not.toBeNull();
    // gains[0] is the master (created in ensure()), gains[1] the instance gain
    expect(ctx.gains).toHaveLength(2);
    expect(ctx.gains[0].connections).toContain(ctx.destination);
    expect(ctx.gains[1].connections).toContain(ctx.gains[0]);
    expect(ctx.sources[0].connections).toContain(ctx.gains[1]);
    expect(ctx.sources[0].loop).toBe(true);
    expect(ctx.sources[0].started).toEqual([0]);
    const list = get(engine.playing);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ soundId: 's1', loop: true, volume: 0.8, stopping: false });
  });

  it('returns null when no buffer is loaded', () => {
    const { engine } = setup();
    expect(engine.play(makeSound())).toBeNull();
    expect(get(engine.playing)).toEqual([]);
  });

  it('one-shots do not loop', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    engine.play(makeSound({ type: 'oneshot' }));
    expect(ctx.sources[0].loop).toBe(false);
  });

  it('fadeIn ramps gain from 0 to the target volume', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    engine.play(makeSound(), 0.6, 1.5);
    const events = ctx.gains[1].gain.events;
    expect(events).toContainEqual({ type: 'set', value: 0, time: 0 });
    expect(events).toContainEqual({ type: 'ramp', value: 0.6, time: 1.5 });
  });
});

describe('engine.stop', () => {
  it('fades to zero, schedules source.stop, marks stopping; onended removes', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    const id = engine.play(makeSound())!;
    engine.stop(id, 0.3);
    const events = ctx.gains[1].gain.events;
    expect(events).toContainEqual({ type: 'ramp', value: 0, time: 0.3 });
    expect(ctx.sources[0].stopped).toEqual([0.3]);
    expect(get(engine.playing)[0].stopping).toBe(true);
    ctx.sources[0].onended!();
    expect(get(engine.playing)).toEqual([]);
  });

  it('stopAll fades everything with the 1.5s default', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    engine.setBuffer('s2', FAKE_BUFFER);
    engine.play(makeSound());
    engine.play(makeSound({ id: 's2', type: 'oneshot' }));
    engine.stopAll();
    expect(ctx.sources[0].stopped).toEqual([1.5]);
    expect(ctx.sources[1].stopped).toEqual([1.5]);
  });

  it('stopLoops leaves one-shots running', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    engine.setBuffer('s2', FAKE_BUFFER);
    engine.play(makeSound());
    engine.play(makeSound({ id: 's2', type: 'oneshot' }));
    engine.stopLoops();
    expect(ctx.sources[0].stopped).toEqual([1.5]);
    expect(ctx.sources[1].stopped).toEqual([]);
  });

  it('stop during fade-in holds the current interpolated gain instead of jumping to the target volume', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    const id = engine.play(makeSound(), 0.6, 1.5)!;
    // Simulate the ramp being mid-flight in a real browser.
    ctx.gains[1].gain.value = 0.25;
    engine.stop(id, 0.3);
    const events = ctx.gains[1].gain.events;
    const cancelIndex = events.findIndex((e) => e.type === 'cancel');
    expect(cancelIndex).toBeGreaterThanOrEqual(0);
    expect(events.slice(cancelIndex + 1)).toEqual([
      { type: 'set', value: 0.25, time: 0 },
      { type: 'ramp', value: 0, time: 0.3 },
    ]);
  });

  it('stopAll skips instances that are already stopping', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    const id = engine.play(makeSound())!;
    engine.stop(id, 0.3);
    engine.stopAll();
    expect(ctx.sources[0].stopped).toEqual([0.3]);
  });
});

describe('engine volumes and queries', () => {
  it('setInstanceVolume updates the gain param and the store', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    const id = engine.play(makeSound())!;
    engine.setInstanceVolume(id, 0.25);
    expect(ctx.gains[1].gain.events).toContainEqual({ type: 'set', value: 0.25, time: 0 });
    expect(get(engine.playing)[0].volume).toBe(0.25);
  });

  it('setInstanceVolume is a no-op on a stopping instance', () => {
    const { ctx, engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    const id = engine.play(makeSound())!;
    engine.stop(id, 0.3);
    const eventsBefore = ctx.gains[1].gain.events.length;
    engine.setInstanceVolume(id, 0.9);
    expect(ctx.gains[1].gain.events).toHaveLength(eventsBefore);
    expect(get(engine.playing)[0].volume).toBe(0.8);
  });

  it('setMasterVolume before first playback applies when the context is created', () => {
    const { ctx, engine } = setup();
    engine.setMasterVolume(0.5);
    engine.setBuffer('s1', FAKE_BUFFER);
    engine.play(makeSound());
    expect(ctx.gains[0].gain.value).toBe(0.5);
  });

  it('isSoundPlaying ignores stopping instances; stopSound stops all of a sound', () => {
    const { engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    const id = engine.play(makeSound())!;
    expect(engine.isSoundPlaying('s1')).toBe(true);
    engine.stopSound('s1');
    expect(engine.isSoundPlaying('s1')).toBe(false);
    expect(get(engine.playing)[0].id).toBe(id); // still fading, just marked stopping
  });

  it('unlock resumes a suspended context', async () => {
    const { ctx, engine } = setup();
    expect(get(engine.unlocked)).toBe(false);
    await engine.unlock();
    expect(ctx.state).toBe('running');
    expect(get(engine.unlocked)).toBe(true);
  });

  it('removeBuffer/clearBuffers evict the cache', () => {
    const { engine } = setup();
    engine.setBuffer('s1', FAKE_BUFFER);
    expect(engine.hasBuffer('s1')).toBe(true);
    engine.removeBuffer('s1');
    expect(engine.hasBuffer('s1')).toBe(false);
    expect(engine.play(makeSound())).toBeNull();

    engine.setBuffer('s1', FAKE_BUFFER);
    engine.setBuffer('s2', FAKE_BUFFER);
    expect(engine.hasBuffer('s1')).toBe(true);
    expect(engine.hasBuffer('s2')).toBe(true);
    engine.clearBuffers();
    expect(engine.hasBuffer('s1')).toBe(false);
    expect(engine.hasBuffer('s2')).toBe(false);
  });
});
