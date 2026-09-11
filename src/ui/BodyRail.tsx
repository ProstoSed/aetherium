import { Orbit } from 'lucide-react';
import { BODIES, type BodyId } from '../data/bodies';
import { PLANET_ELEMENTS } from '../data/orbitalElements';
import { BodyOrb } from './BodyOrb';
import { useObservatory, useObservatoryState } from './observatoryContext';

const auFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/** Подпись под названием: среднее расстояние от Солнца по большой полуоси — порядок тел виден сразу. */
function distanceCaption(id: BodyId): string {
  if (id === 'sun') return 'центр системы';
  if (id === 'moon') return '384 400 км от Земли';
  const axis = PLANET_ELEMENTS[id].epoch.semiMajorAxis;
  return `${auFormat.format(axis)} а. е.`;
}

/** Размер миниатюры: у Сатурна в кадре кольца, диск в ней мельче — миниатюра крупнее. */
const THUMB_SIZE: Partial<Record<BodyId, number>> = { sun: 34, moon: 24, saturn: 46, uranus: 40 };

export function BodyRail() {
  const observatory = useObservatory();
  const focused = useObservatoryState(s => s.focused);
  const selected = useObservatoryState(s => s.selected);

  return (
    <nav className="body-rail" aria-label="Небесные тела">
      <button type="button" className={`rail-item rail-overview ${!focused ? 'is-active' : ''}`} onClick={() => observatory.overview()}>
        <span className="rail-thumb"><Orbit size={18} strokeWidth={1.4} /></span>
        <span className="rail-text">
          <span className="rail-name">Вся система</span>
        </span>
      </button>
      {BODIES.map(body => (
        <button
          key={body.id}
          type="button"
          className={`rail-item ${body.parent === 'earth' ? 'is-satellite' : ''} ${focused === body.id ? 'is-active' : ''} ${selected === body.id ? 'is-selected' : ''}`}
          onClick={() => observatory.focus(body.id)}
        >
          <span className="rail-thumb">
            <BodyOrb id={body.id} size={THUMB_SIZE[body.id] ?? 30} />
          </span>
          <span className="rail-text">
            <span className="rail-name">{body.name}</span>
            <span className="rail-caption numeric">{distanceCaption(body.id)}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}
