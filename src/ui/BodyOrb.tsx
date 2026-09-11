import type { CSSProperties } from 'react';
import type { BodyId } from '../data/bodies';
import { BODY_BY_ID } from '../data/bodies';
import { useObservatoryState } from './observatoryContext';

/**
 * Изображение тела. Пока сцена запекает поверхности, показывается CSS-шар; затем — снимок
 * того же тела из сцены, отрисованный его настоящим материалом.
 */
export function BodyOrb({ id, size = 22 }: { id: BodyId; size?: number }) {
  const thumbnail = useObservatoryState(s => s.thumbnails[id]);
  const style = { '--orb-color': BODY_BY_ID[id].color, '--orb-size': `${size}px` } as CSSProperties;
  return (
    <span className={`orb orb-${id} ${thumbnail ? 'has-image' : ''}`} style={style} aria-hidden="true">
      {thumbnail ? <img className="orb-image" src={thumbnail} alt="" draggable={false} /> : <span className="orb-sphere" />}
    </span>
  );
}
