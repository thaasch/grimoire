import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { detectLang, lang, t } from '../src/lib/i18n';

describe('i18n', () => {
  it('translates keys in the active language', () => {
    lang.set('de');
    expect(get(t)('mixer.stopAll')).toBe('Alles stoppen');
    lang.set('en');
    expect(get(t)('mixer.stopAll')).toBe('Stop all');
  });

  it('interpolates variables', () => {
    lang.set('de');
    expect(get(t)('scenes.defaultName', { n: 3 })).toBe('Szene 3');
  });

  it('detects German browser languages, defaults to English', () => {
    expect(detectLang('de-DE')).toBe('de');
    expect(detectLang('de')).toBe('de');
    expect(detectLang('en-US')).toBe('en');
    expect(detectLang('fr')).toBe('en');
  });
});
