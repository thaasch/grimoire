import type { Lang } from './i18n';

const ROWS: string[][] = [
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM'],
];

export const PAD_CODES: string[] = ROWS.flat();

export function padKeyCode(position: number): string | null {
  return PAD_CODES[position] ?? null;
}

export function padIndexForCode(code: string): number | null {
  const index = PAD_CODES.indexOf(code);
  return index === -1 ? null : index;
}

// KeyboardEvent.code names physical positions using the US layout; on a
// German QWERTZ keyboard the physical KeyZ position prints "Y" and vice versa.
const DE_LABELS: Record<string, string> = { KeyY: 'Z', KeyZ: 'Y' };

export function keyLabel(code: string, lang: Lang): string {
  if (lang === 'de' && DE_LABELS[code]) return DE_LABELS[code];
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Key')) return code.slice(3);
  return code;
}

export function isTypingTarget(el: unknown): boolean {
  const target = el as { tagName?: string; isContentEditable?: boolean } | null;
  const tag = target?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable === true;
}
