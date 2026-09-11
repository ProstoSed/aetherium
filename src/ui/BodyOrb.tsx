import type { CSSProperties } from 'react';
import type { BodyId } from '../data/bodies';
import { BODY_BY_ID } from '../data/bodies';

/**
 * Маленький шар тела для списков и карточки: освещённая сторона, терминатор и
 * атмосферный край — одним CSS, без картинок. У Солнца свечение, у Сатурна кольцо.
 */
export function BodyOrb({ id, size = 22 }: { id: BodyId; size?: number }) {
  const style = { '--orb-color': BODY_BY_ID[id].color, '--orb-size': `${size}px` } as CSSProperties;
  return (
    <span className={`orb orb-${id}`} style={style} aria-hidden="true">
      <span className="orb-sphere" />
      {id === 'saturn' && <span className="orb-ring" />}
    </span>
  );
}
