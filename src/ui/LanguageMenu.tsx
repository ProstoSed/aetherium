import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { i18n, useI18n } from '../i18n';
import { LANGUAGE_NAMES, LANGUAGES, type Language } from '../i18n/languages';

/** Короткая метка на кнопке: код языка, у китайского — иероглиф, его код читатель не узнает. */
const BUTTON_MARK: Record<Language, string> = { en: 'EN', ru: 'RU', de: 'DE', fr: 'FR', zh: '中' };

/**
 * Выбор языка: кнопка с кодом текущего языка и список языков их собственными названиями.
 * Клавиатура — как у меню по WAI-ARIA: фокус сразу на текущем языке, стрелки и Home/End
 * ходят по списку, Esc и выбор возвращают фокус на кнопку.
 */
export function LanguageMenu() {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    // Перехват на погружении: Esc должен закрыть только список, а не заодно панель или карточку под ним.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close(true);
    };
    window.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeOnEscape, true);
    return () => {
      window.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [open]);

  const choose = (next: Language) => {
    i18n.setLanguage(next);
    close(true);
  };

  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = { ArrowDown: current + 1, ArrowUp: current - 1, Home: 0, End: items.length - 1 }[event.key];
    if (event.key === 'Tab') setOpen(false);
    if (next === undefined) return;
    event.preventDefault();
    items[(next + items.length) % items.length]?.focus();
  };

  return (
    <div className="language-menu" ref={rootRef}>
      <button
        ref={buttonRef}
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
        <div className="language-list" role="menu" aria-label={t.topBar.language} ref={listRef} onKeyDown={moveFocus}>
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
