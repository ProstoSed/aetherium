import { Crosshair, X } from 'lucide-react';
import { useRef } from 'react';
import { BODY_BY_ID } from '../data/bodies';
import { BodyOrb } from './BodyOrb';
import { formatAu, formatKm, formatLightTime } from './format';
import { useFrame, useObservatory, useObservatoryState, writeText } from './observatoryContext';

/** Карточка выбранного тела. Расстояния живые: считаются по орбитам на текущую дату симуляции. */
export function BodyCard() {
  const observatory = useObservatory();
  const selected = useObservatoryState(s => s.selected);
  const focused = useObservatoryState(s => s.focused);
  const fromSun = useRef<HTMLElement>(null);
  const fromEarth = useRef<HTMLElement>(null);
  const lightTime = useRef<HTMLElement>(null);

  useFrame(frame => {
    if (frame.selectedFromSunAu !== null) writeText(fromSun.current, formatAu(frame.selectedFromSunAu));
    if (frame.selectedFromEarthKm !== null) {
      writeText(fromEarth.current, formatKm(frame.selectedFromEarthKm));
      writeText(lightTime.current, formatLightTime(frame.selectedFromEarthKm));
    }
  });

  if (!selected) return null;
  const body = BODY_BY_ID[selected];
  const hasSunDistance = selected !== 'sun';
  const hasEarthDistance = selected !== 'sun' && selected !== 'earth';

  return (
    <aside className="body-card" key={selected} aria-label={`Сведения: ${body.name}`}>
      <button type="button" className="card-close" aria-label="Закрыть карточку" onClick={() => observatory.select(null)}>
        <X size={16} strokeWidth={1.6} />
      </button>

      <div className="card-hero">
        <BodyOrb id={selected} size={76} />
        <div>
          <p className="card-kind">{body.kind}</p>
          <h2 className="card-name">{body.name}</h2>
        </div>
      </div>

      <p className="card-description">{body.description}</p>

      {(hasSunDistance || hasEarthDistance) && (
        <dl className="card-live">
          {hasSunDistance && (
            <div>
              <dt>До Солнца сейчас</dt>
              <dd ref={fromSun} />
            </div>
          )}
          {hasEarthDistance && (
            <div>
              <dt>До Земли сейчас</dt>
              <dd ref={fromEarth} />
            </div>
          )}
          {hasEarthDistance && (
            <div>
              <dt>Свет от Земли идёт</dt>
              <dd ref={lightTime} />
            </div>
          )}
        </dl>
      )}

      <dl className="card-facts">
        {body.facts.map(fact => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      {focused !== selected && (
        <button type="button" className="primary-button" onClick={() => observatory.focus(selected)}>
          <Crosshair size={16} strokeWidth={1.8} />
          Лететь к телу
        </button>
      )}
    </aside>
  );
}
