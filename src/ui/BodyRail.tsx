import { Orbit } from 'lucide-react';
import { BODIES } from '../data/bodies';
import { BodyOrb } from './BodyOrb';
import { useObservatory, useObservatoryState } from './observatoryContext';

/** Список тел: щелчок — перелёт к телу. Порядок — от Солнца, Луна рядом с Землёй. */
export function BodyRail() {
  const observatory = useObservatory();
  const focused = useObservatoryState(s => s.focused);
  const selected = useObservatoryState(s => s.selected);

  return (
    <nav className="body-rail" aria-label="Небесные тела">
      <button type="button" className={`rail-item rail-overview ${!focused ? 'is-active' : ''}`} onClick={() => observatory.overview()}>
        <span className="rail-icon"><Orbit size={18} strokeWidth={1.4} /></span>
        <span className="rail-name">Вся система</span>
      </button>
      <span className="rail-divider" aria-hidden="true" />
      {BODIES.map(body => (
        <button
          key={body.id}
          type="button"
          className={`rail-item ${body.parent === 'earth' ? 'is-satellite' : ''} ${focused === body.id ? 'is-active' : ''} ${selected === body.id ? 'is-selected' : ''}`}
          onClick={() => observatory.focus(body.id)}
        >
          <BodyOrb id={body.id} size={body.id === 'sun' ? 20 : body.parent === 'earth' ? 12 : 16} />
          <span className="rail-name">{body.name}</span>
        </button>
      ))}
    </nav>
  );
}
