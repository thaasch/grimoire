import { describe, expect, it } from 'vitest';
import { isTypingTarget, keyLabel, PAD_CODES, padIndexForCode, padKeyCode } from '../src/lib/hotkeys';

describe('hotkeys', () => {
  it('maps grid positions to keyboard rows', () => {
    expect(padKeyCode(0)).toBe('Digit1');
    expect(padKeyCode(9)).toBe('Digit0');
    expect(padKeyCode(10)).toBe('KeyQ');
    expect(padKeyCode(20)).toBe('KeyA');
    expect(padKeyCode(29)).toBe('KeyZ');
    expect(padKeyCode(35)).toBe('KeyM');
    expect(padKeyCode(36)).toBeNull();
    expect(PAD_CODES).toHaveLength(36);
  });

  it('maps codes back to positions', () => {
    expect(padIndexForCode('Digit1')).toBe(0);
    expect(padIndexForCode('KeyQ')).toBe(10);
    expect(padIndexForCode('Escape')).toBeNull();
  });

  it('labels physical keys per language layout', () => {
    expect(keyLabel('Digit1', 'de')).toBe('1');
    expect(keyLabel('KeyQ', 'en')).toBe('Q');
    expect(keyLabel('KeyZ', 'de')).toBe('Y'); // physical Z position prints Y on QWERTZ
    expect(keyLabel('KeyZ', 'en')).toBe('Z');
    expect(keyLabel('KeyY', 'de')).toBe('Z');
  });

  it('detects typing targets', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
