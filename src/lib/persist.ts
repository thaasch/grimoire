import { toast } from './toasts';

const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; write: () => Promise<void> }>();

export function debouncedPersist(key: string, write: () => Promise<void>, delay = 300): void {
  const existing = pending.get(key);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    pending.delete(key);
    void guard(write);
  }, delay);
  pending.set(key, { timer, write });
}

export async function flushPersist(): Promise<void> {
  const entries = [...pending.values()];
  pending.clear();
  for (const { timer } of entries) clearTimeout(timer);
  for (const { write } of entries) await guard(write);
}

export async function guard<T>(work: Promise<T> | (() => Promise<T>)): Promise<T | undefined> {
  try {
    return await (typeof work === 'function' ? work() : work);
  } catch (error) {
    const quota = error instanceof DOMException && error.name === 'QuotaExceededError';
    toast(quota ? 'toast.quota' : 'toast.saveFailed', {}, 'error');
    return undefined;
  }
}
