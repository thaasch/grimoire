import { writable } from 'svelte/store';
import type { TranslationKey } from './i18n';

export interface Toast {
  id: number;
  key: TranslationKey;
  vars: Record<string, string | number>;
  kind: 'info' | 'error';
}

let nextId = 0;

export const toasts = writable<Toast[]>([]);

export function toast(
  key: TranslationKey,
  vars: Record<string, string | number> = {},
  kind: 'info' | 'error' = 'info',
): void {
  const id = ++nextId;
  toasts.update((list) => [...list, { id, key, vars, kind }]);
  setTimeout(() => dismiss(id), 5000);
}

export function dismiss(id: number): void {
  toasts.update((list) => list.filter((t) => t.id !== id));
}
