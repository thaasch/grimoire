import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismiss, toast, toasts } from '../src/lib/toasts';

beforeEach(() => {
  toasts.set([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('toasts', () => {
  it('toast appends entries with incrementing ids and vars', () => {
    toast('toast.added', { n: 2 });
    toast('toast.quota');
    const list = get(toasts);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ key: 'toast.added', vars: { n: 2 }, kind: 'info' });
    expect(list[1]).toMatchObject({ key: 'toast.quota', vars: {}, kind: 'info' });
    expect(list[1].id).toBeGreaterThan(list[0].id);
  });

  it('dismiss removes the toast with the given id', () => {
    toast('toast.added');
    toast('toast.quota');
    const [first, second] = get(toasts);
    dismiss(first.id);
    expect(get(toasts)).toEqual([second]);
  });

  it('auto-dismisses after 5 seconds', () => {
    vi.useFakeTimers();
    try {
      toast('toast.added');
      expect(get(toasts)).toHaveLength(1);
      vi.advanceTimersByTime(5000);
      expect(get(toasts)).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
