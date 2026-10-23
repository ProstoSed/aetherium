import { useEffect, type RefObject } from 'react';

/**
 * Фокус для всплывающей панели: при открытии — на первый элемент по селектору, при закрытии —
 * обратно туда, где он был до открытия (обычно на кнопку, открывшую панель). Без этого после Esc
 * фокус падает на body, и с клавиатуры приходится заново искать место на странице.
 */
export function usePanelFocus(panelRef: RefObject<HTMLElement | null>, initialSelector: string) {
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLElement>(initialSelector)?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [panelRef, initialSelector]);
}
