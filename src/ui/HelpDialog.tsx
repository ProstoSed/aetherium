import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

const CONTROLS: [string, string][] = [
  ['Левая кнопка, один палец', 'вращать вид'],
  ['Колесо, два пальца', 'приблизить и отдалить'],
  ['Правая кнопка', 'сдвинуть центр обзора'],
  ['Щелчок по телу или подписи', 'сведения о теле'],
  ['Пробел', 'пауза'],
  ['Esc', 'закрыть панель'],
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);

  return (
    <div className="dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <button ref={closeRef} type="button" className="card-close" aria-label="Закрыть" onClick={onClose}>
          <X size={16} strokeWidth={1.6} />
        </button>
        <h2 id="help-title" className="dialog-title">Как смотреть</h2>

        <dl className="help-controls">
          {CONTROLS.map(([input, action]) => (
            <div key={input}>
              <dt>{input}</dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>

        <div className="help-notes">
          <p>
            <strong>Орбиты настоящие.</strong> Положения планет считаются по кеплеровым элементам JPL на выбранную дату:
            эллипсы, наклоны, прецессия перигелиев. Точность — доли градуса в 1800–2050 годах, дальше — экстраполяция.
          </p>
          <p>
            <strong>Наглядный масштаб</strong> сжимает расстояния и размеры, чтобы вся система помещалась в кадр.
            <strong> Истинный</strong> показывает пропорции как есть: Земля с орбиты Марса — меньше пикселя, поэтому тела отмечены кружками.
          </p>
          <p>
            <strong>Помехи плёнки</strong> зависят от того, куда вы смотрите: у Солнца — пересвет и марево, у Юпитера — радиация,
            у Нептуна — иней и слабый сигнал. События вымышлены, но опираются на настоящую механику.
          </p>
        </div>
      </section>
    </div>
  );
}
