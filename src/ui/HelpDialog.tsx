import { X } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import { useOccluder } from './useOccluder';

/**
 * Справка — нативный модальный <dialog>: showModal() даёт верхний слой, ловушку фокуса и инертный фон.
 * Сам <dialog> растянут на весь экран и служит затемнением: щелчок по нему мимо карточки закрывает окно.
 * Esc приходит событием cancel; закрытие всё равно идёт через onClose, чтобы состояние оставалось в React.
 */
export function HelpDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useOccluder(dialogRef, false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="dialog-backdrop"
      aria-labelledby="help-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="help-dialog">
        <button type="button" className="card-close" aria-label={t.help.close} onClick={onClose} autoFocus>
          <X size={16} strokeWidth={1.6} />
        </button>
        <h2 id="help-title" className="dialog-title">{t.help.title}</h2>

        <dl className="help-controls">
          {t.help.controls.map(([input, action]) => (
            <div key={input}>
              <dt>{input}</dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>

        <div className="help-notes">
          {t.help.notes.map((paragraph, index) => (
            <p key={index}>
              {paragraph.map(part => (
                <span key={part.strong}>
                  <strong>{part.strong}</strong>
                  {part.text}
                </span>
              ))}
            </p>
          ))}
        </div>
      </section>
    </dialog>
  );
}
