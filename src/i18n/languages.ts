/** Языки интерфейса. Китайский — упрощённое письмо (zh-CN). */
export const LANGUAGES = ['en', 'ru', 'de', 'fr', 'zh'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Названия языков на них самих: человек ищет в списке свой язык, а не перевод его названия. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  ru: 'Русский',
  de: 'Deutsch',
  fr: 'Français',
  zh: '简体中文',
};

const STORAGE_KEY = 'aetherium.language';
const FALLBACK: Language = 'en';

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Сохранённый выбор, иначе первый подходящий язык браузера, иначе английский. */
export function detectLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // Хранилище недоступно (приватный режим) — язык берётся из браузера.
  }
  const preferred = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language];
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLanguage(base)) return base;
  }
  return FALLBACK;
}

export function saveLanguage(language: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Без хранилища выбор живёт до перезагрузки.
  }
}
