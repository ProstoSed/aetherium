import { Orbit } from 'lucide-react';
import { useRef } from 'react';
import { BODIES, MOON_MEAN_DISTANCE_KM, type BodyId } from '../data/bodies';
import { PLANET_ELEMENTS } from '../data/orbitalElements';
import { useI18n, type Messages } from '../i18n';
import { formatDistance } from '../i18n/format';
import { numberText } from '../i18n/numbers';
import { BodyOrb } from './BodyOrb';
import { useObservatory, useObservatoryState } from './observatoryContext';
import { useLayoutVariable } from './useLayoutVariable';
import { useOccluder } from './useOccluder';

/** Подпись под названием: среднее расстояние от Солнца по большой полуоси — порядок тел виден сразу. */
function distanceCaption(t: Messages, id: BodyId): string {
  if (id === 'sun') return t.rail.sunCaption;
  if (id === 'moon') return t.rail.moonCaption(formatDistance(t, MOON_MEAN_DISTANCE_KM));
  return t.units.au(numberText(t.locale)(PLANET_ELEMENTS[id].epoch.semiMajorAxis, 2));
}

/** Размер миниатюры: у Сатурна в кадре кольца, диск в ней мельче — миниатюра крупнее. */
const THUMB_SIZE: Partial<Record<BodyId, number>> = { sun: 34, moon: 24, saturn: 46, uranus: 40 };

const rightEdgeOf = (rect: DOMRect) => rect.right;

export function BodyRail() {
  const observatory = useObservatory();
  const { t } = useI18n();
  const focused = useObservatoryState(s => s.focused);
  const selected = useObservatoryState(s => s.selected);
  const railRef = useRef<HTMLElement>(null);
  useOccluder(railRef, true);
  useLayoutVariable(railRef, '--rail-right', rightEdgeOf);

  return (
    <nav className="body-rail" aria-label={t.rail.label} ref={railRef}>
      <button type="button" className={`rail-item rail-overview ${!focused ? 'is-active' : ''}`} onClick={() => observatory.overview()}>
        <span className="rail-thumb"><Orbit size={18} strokeWidth={1.4} /></span>
        <span className="rail-text">
          <span className="rail-name">{t.rail.overview}</span>
        </span>
      </button>
      {BODIES.map(body => (
        <button
          key={body.id}
          type="button"
          data-body={body.id}
          className={`rail-item ${body.parent === 'earth' ? 'is-satellite' : ''} ${focused === body.id ? 'is-active' : ''} ${selected === body.id ? 'is-selected' : ''}`}
          onClick={() => observatory.focus(body.id)}
        >
          <span className="rail-thumb">
            <BodyOrb id={body.id} size={THUMB_SIZE[body.id] ?? 30} />
          </span>
          <span className="rail-text">
            <span className="rail-name">{t.bodies[body.id].name}</span>
            <span className="rail-caption numeric">{distanceCaption(t, body.id)}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}
