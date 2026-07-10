import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debouncedPersist, flushPersist, guard } from '../src/lib/persist';
import { toasts } from '../src/lib/toasts';

beforeEach(() => {
  vi.useFakeTimers();
  toasts.set([]);
});

afterEach(async () => {
  await flushPersist();
  vi.useRealTimers();
});

describe('debouncedPersist', () => {
  it('coalesces a burst into a single trailing write', async () => {
    const writes: number[] = [];
    for (let i = 1; i <= 5; i++) {
      debouncedPersist('vol', async () => {
        writes.push(i);
      });
    }
    expect(writes).toEqual([]);
    await vi.advanceTimersByTimeAsync(300);
    expect(writes).toEqual([5]); // only the last write ran
  });

  it('debounces per key independently', async () => {
    const ran: string[] = [];
    debouncedPersist('a', async () => {
      ran.push('a');
    });
    debouncedPersist('b', async () => {
      ran.push('b');
    });
    await vi.advanceTimersByTimeAsync(300);
    expect(ran.sort()).toEqual(['a', 'b']);
  });

  it('flushPersist runs pending writes immediately', async () => {
    const ran: string[] = [];
    debouncedPersist('a', async () => {
      ran.push('a');
    });
    await flushPersist();
    expect(ran).toEqual(['a']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ran).toEqual(['a']); // not run twice
  });
});

describe('guard', () => {
  it('passes through the resolved value', async () => {
    expect(await guard(Promise.resolve(42))).toBe(42);
    expect(get(toasts)).toEqual([]);
  });

  it('catches rejections and toasts instead of throwing', async () => {
    const result = await guard(Promise.reject(new Error('disk fell off')));
    expect(result).toBeUndefined();
    expect(get(toasts)).toHaveLength(1);
    expect(get(toasts)[0].kind).toBe('error');
  });

  it('accepts a thunk', async () => {
    expect(await guard(async () => 'ok')).toBe('ok');
  });

  it('uses the saveFailed key for non-quota errors', async () => {
    await guard(Promise.reject(new Error('boom')));
    expect(get(toasts)[0].key).toBe('toast.saveFailed');
  });
});
