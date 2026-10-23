import { useEffect, type RefObject } from 'react';
import { useObservatory } from './observatoryContext';

/**
 * Сообщает движку, что элемент закрывает часть сцены: под ним не рисуются подписи тел,
 * а при framing кадр держит центр внимания в свободной от таких элементов полосе.
 * key — значение, при смене которого элемент появляется заново (например, выбранное тело
 * у карточки, которая без выбора не рисуется вовсе).
 */
export function useOccluder(ref: RefObject<HTMLElement | null>, framing: boolean, key: unknown = null) {
  const observatory = useObservatory();
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return observatory.addOccluder(element, framing);
  }, [observatory, ref, framing, key]);
}
