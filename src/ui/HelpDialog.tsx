import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);

  return (
    <div className="dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <button ref={closeRef} type="button" className="card-close" aria-label={t.help.close} onClick={onClose}>
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
    </div>
  );
}
