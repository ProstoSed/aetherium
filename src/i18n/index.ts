import { useSyncExternalStore } from 'react';
import { detectLanguage, saveLanguage, type Language } from './languages';
import { de } from './messages/de';
import { en, type Messages } from './messages/en';
import { fr } from './messages/fr';
import { ru } from './messages/ru';
import { zh } from './messages/zh';

export type { Language } from './languages';
export type { Messages } from './messages/en';

const MESSAGES: Record<Language, Messages> = { en, ru, de, fr, zh };

/**
 * Текущий язык — отдельное хранилище, а не часть состояния обсерватории: его читают и
 * интерфейс (через useI18n), и движок (подписи тел, названия созвездий, дата в кадре),
 * а заставке он нужен ещё до того, как движок создан.
 */
let current: Language = detectLanguage();
const listeners = new Set<() => void>();

function applyToDocument() {
  const messages = MESSAGES[current];
  document.documentElement.lang = messages.locale;
  document.title = messages.document.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', messages.document.description);
}

applyToDocument();

export const i18n = {
  get language(): Language {
    return current;
  },
  get messages(): Messages {
    return MESSAGES[current];
  },
  setLanguage(language: Language) {
    if (language === current) return;
    current = language;
    saveLanguage(language);
    applyToDocument();
    listeners.forEach(listener => listener());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const getLanguage = () => current;

/** Словарь текущего языка; компонент перерисуется при смене языка. */
export function useI18n(): { t: Messages; language: Language } {
  const language = useSyncExternalStore(i18n.subscribe, getLanguage);
  return { t: MESSAGES[language], language };
}
