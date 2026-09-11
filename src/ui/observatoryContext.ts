import { createContext, useContext, useEffect, useRef } from 'react';
import type { FrameInfo, Observatory, ObservatoryState } from '../engine/Observatory';
import { useStore } from '../engine/store';

export const ObservatoryContext = createContext<Observatory | null>(null);

export function useObservatory(): Observatory {
  const observatory = useContext(ObservatoryContext);
  if (!observatory) throw new Error('useObservatory вызван вне ObservatoryContext');
  return observatory;
}

export function useObservatoryState<S>(selector: (state: ObservatoryState) => S): S {
  return useStore(useObservatory().store, selector);
}

/**
 * Подписка на кадр движка. Обработчик должен писать в DOM сам (через ref) и только
 * при изменении — вызов setState отсюда вернул бы перерисовку React на каждый кадр.
 */
export function useFrame(listener: (frame: FrameInfo) => void) {
  const observatory = useObservatory();
  const latest = useRef(listener);
  latest.current = listener;
  useEffect(() => {
    const handler = (frame: FrameInfo) => latest.current(frame);
    observatory.frameListeners.add(handler);
    return () => { observatory.frameListeners.delete(handler); };
  }, [observatory]);
}

/** Записывает текст в узел, только если он изменился: лишняя запись — лишний пересчёт раскладки. */
export function writeText(node: HTMLElement | null, text: string) {
  if (node && node.textContent !== text) node.textContent = text;
}
