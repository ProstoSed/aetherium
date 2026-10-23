import { Crosshair, X } from 'lucide-react';
import { useRef } from 'react';
import { BODY_BY_ID } from '../data/bodies';
import { useI18n } from '../i18n';
import { formatAu, formatDistance, formatFact, formatLightTime } from '../i18n/format';
import { BodyOrb } from './BodyOrb';
import { useOccluder } from './useOccluder';
import { useFrame, useObservatory, useObservatoryState, writeText } from './observatoryContext';

/** Карточка выбранного тела. Расстояния живые: считаются по орбитам на текущую дату симуляции. */
export function BodyCard() {
  const observatory = useObservatory();
  const { t } = useI18n();
  const selected = useObservatoryState(s => s.selected);
  const focused = useObservatoryState(s => s.focused);
  const eventRunning = useObservatoryState(s => s.activeEvent !== null);
  const fromSun = useRef<HTMLElement>(null);
  const fromEarth = useRef<HTMLElement>(null);
  const lightTime = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  useOccluder(cardRef, true, selected);

  useFrame(frame => {
    if (frame.selectedFromSunAu !== null) writeText(fromSun.current, formatAu(t, frame.selectedFromSunAu));
    if (frame.selectedFromEarthKm !== null) {
      writeText(fromEarth.current, formatDistance(t, frame.selectedFromEarthKm));
      writeText(lightTime.current, formatLightTime(t, frame.selectedFromEarthKm));
    }
  });

  if (!selected) return null;
  const body = BODY_BY_ID[selected];
  const text = t.bodies[selected];
  const hasSunDistance = selected !== 'sun';
  const hasEarthDistance = selected !== 'sun' && selected !== 'earth';

  return (
    <aside className={`body-card ${eventRunning ? 'is-compact' : ''}`} key={selected} ref={cardRef} aria-label={t.card.label(text.name)}>
      <button type="button" className="card-close" aria-label={t.card.close} onClick={() => observatory.select(null)}>
        <X size={16} strokeWidth={1.6} />
      </button>

      <div className="card-hero">
        <BodyOrb id={selected} size={selected === 'saturn' || selected === 'uranus' ? 104 : 84} />
        <div>
          <p className="card-kind">{text.kind}</p>
          <h2 className="card-name">{text.name}</h2>
        </div>
      </div>

      <p className="card-description">{text.description}</p>

      {(hasSunDistance || hasEarthDistance) && (
        <dl className="card-live">
          {hasSunDistance && (
            <div>
              <dt>{t.card.fromSun}</dt>
              <dd ref={fromSun} />
            </div>
          )}
          {hasEarthDistance && (
            <div>
              <dt>{t.card.fromEarth}</dt>
              <dd ref={fromEarth} />
            </div>
          )}
          {hasEarthDistance && (
            <div>
              <dt>{t.card.lightTime}</dt>
              <dd ref={lightTime} />
            </div>
          )}
        </dl>
      )}

      <dl className="card-facts">
        {body.facts.map(fact => {
          const { label, value } = formatFact(t, fact);
          return (
            <div key={fact.kind}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          );
        })}
      </dl>

      {focused !== selected && (
        <button type="button" className="primary-button" onClick={() => observatory.focus(selected)}>
          <Crosshair size={16} strokeWidth={1.8} />
          {t.card.flyTo}
        </button>
      )}
    </aside>
  );
}
