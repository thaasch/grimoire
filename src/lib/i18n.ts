import { derived, writable } from 'svelte/store';

export type Lang = 'de' | 'en';

const de = {
  'scenes.new': 'Neue Szene',
  'scenes.defaultName': 'Szene {n}',
  'scenes.rename': 'Umbenennen',
  'scenes.delete': 'Löschen',
  'scenes.deleteConfirm': 'Szene "{name}" wirklich löschen?',
  'stage.dropHint': 'Dateien hierher ziehen',
  'search.placeholder': 'Suchen…',
  'search.fromLibrary': 'Aus der Bibliothek',
  'library.title': 'Bibliothek',
  'library.empty': 'Noch keine Sounds — Audiodateien einfach ins Fenster ziehen',
  'library.addToScene': 'Zur Szene',
  'library.export': 'Exportieren',
  'library.import': 'Importieren',
  'library.deleteConfirm': '"{name}" endgültig löschen? Er wird aus allen Szenen entfernt.',
  'mixer.nothing': 'Nichts spielt',
  'mixer.stopAll': 'Alles stoppen',
  'mixer.master': 'Master',
  'mixer.enableAudio': 'Klicken zum Aktivieren',
  'pad.volume': 'Lautstärke',
  'pad.autoplay': 'Autostart bei Szenenwechsel',
  'pad.remove': 'Aus Szene entfernen',
  'pad.editSound': 'Sound bearbeiten',
  'pad.broken': 'Datei fehlt',
  'edit.mode': 'Bearbeiten',
  'edit.done': 'Fertig',
  'sound.name': 'Name',
  'sound.type': 'Typ',
  'sound.loop': 'Loop',
  'sound.oneshot': 'Einmalig',
  'toast.added': '{n} Sound(s) hinzugefügt',
  'toast.unsupported': '"{name}" konnte nicht gelesen werden',
  'toast.quota': 'Speicher voll — bitte exportieren und aufräumen',
  'toast.imported': '{sounds} Sounds, {scenes} Szenen importiert',
  'app.unsupported': 'Dieser Browser unterstützt kein Web Audio — bitte einen aktuellen Browser verwenden.',
} as const;

export type TranslationKey = keyof typeof de;

const en: Record<TranslationKey, string> = {
  'scenes.new': 'New scene',
  'scenes.defaultName': 'Scene {n}',
  'scenes.rename': 'Rename',
  'scenes.delete': 'Delete',
  'scenes.deleteConfirm': 'Really delete scene "{name}"?',
  'stage.dropHint': 'Drop files here',
  'search.placeholder': 'Search…',
  'search.fromLibrary': 'From the library',
  'library.title': 'Library',
  'library.empty': 'No sounds yet — just drag audio files into the window',
  'library.addToScene': 'To scene',
  'library.export': 'Export',
  'library.import': 'Import',
  'library.deleteConfirm': 'Delete "{name}" permanently? It will be removed from all scenes.',
  'mixer.nothing': 'Nothing playing',
  'mixer.stopAll': 'Stop all',
  'mixer.master': 'Master',
  'mixer.enableAudio': 'Click to enable audio',
  'pad.volume': 'Volume',
  'pad.autoplay': 'Autoplay on scene switch',
  'pad.remove': 'Remove from scene',
  'pad.editSound': 'Edit sound',
  'pad.broken': 'File missing',
  'edit.mode': 'Edit',
  'edit.done': 'Done',
  'sound.name': 'Name',
  'sound.type': 'Type',
  'sound.loop': 'Loop',
  'sound.oneshot': 'One-shot',
  'toast.added': '{n} sound(s) added',
  'toast.unsupported': 'Could not read "{name}"',
  'toast.quota': 'Storage full — please export and clean up',
  'toast.imported': 'Imported {sounds} sounds, {scenes} scenes',
  'app.unsupported': 'This browser does not support Web Audio — please use a current browser.',
};

const dictionaries: Record<Lang, Record<TranslationKey, string>> = { de, en };

export const lang = writable<Lang>('de');

export const t = derived(
  lang,
  ($lang) =>
    (key: TranslationKey, vars: Record<string, string | number> = {}): string => {
      let text: string = dictionaries[$lang][key] ?? de[key] ?? key;
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
      return text;
    },
);

export function detectLang(
  navLang = typeof navigator !== 'undefined' ? navigator.language : 'en',
): Lang {
  return navLang?.toLowerCase().startsWith('de') ? 'de' : 'en';
}
