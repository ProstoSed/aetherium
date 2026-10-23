import { useEffect, type RefObject } from 'react';

/**
 * Публикует размер элемента CSS-переменной на корне документа: соседние панели встают
 * от фактического размера, а не от числа, подобранного под один язык. Высота нижней панели,
 * например, растёт, когда в длинном языке кнопка «Сейчас» переносится в третью строку.
 */
export function useLayoutVariable(ref: RefObject<HTMLElement | null>, name: string, measure: (rect: DOMRect) => number) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty(name, `${Math.round(measure(element.getBoundingClientRect()))}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      root.style.removeProperty(name);
    };
  }, [ref, name, measure]);
}
