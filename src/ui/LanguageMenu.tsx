import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { i18n, useI18n } from '../i18n';
import { LANGUAGE_NAMES, LANGUAGES, type Language } from '../i18n/languages';

/** Короткая метка на кнопке: код языка, у китайского — иероглиф, его код читатель не узнает. */
const BUTTON_MARK: Record<Language, string> = { en: 'EN', ru: 'RU', de: 'DE', fr: 'FR', zh: '中' };

/** Выбор языка: кнопка с кодом текущего языка и список языков их собственными названиями. */
export function LanguageMenu() {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const choose = (next: Language) => {
    i18n.setLanguage(next);
    setOpen(false);
  };

  return (
    <div className="language-menu" ref={rootRef}>
      <button
        type="button"
        className={`tool-button language-button ${open ? 'is-on' : ''}`}
        title={t.topBar.language}
        aria-label={`${t.topBar.language}: ${LANGUAGE_NAMES[language]}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="language-mark" lang={language}>{BUTTON_MARK[language]}</span>
      </button>
      {open && (
        <div className="language-list" role="menu" aria-label={t.topBar.language}>
          {LANGUAGES.map(option => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === language}
              className={option === language ? 'is-active' : ''}
              lang={option}
              onClick={() => choose(option)}
            >
              <span>{LANGUAGE_NAMES[option]}</span>
              {option === language && <Check size={15} strokeWidth={2} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
