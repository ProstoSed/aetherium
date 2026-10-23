/** Свободная полоса уже этой доли кадра — центрировать в ней бессмысленно, кадр остаётся как есть. */
const MIN_FREE_SHARE = 0.1;

/**
 * Вертикальная середина самой высокой полосы кадра, не закрытой панелями, — доля высоты от верха.
 * `covered` — отрезки [верх, низ] в пикселях, которые панели закрывают в центральном столбце экрана.
 */
export function freeBandCenter(covered: readonly (readonly [number, number])[], height: number): number {
  const sorted = [...covered].sort((a, b) => a[0] - b[0]);
  let best = { top: 0, bottom: 0 };
  let cursor = 0;
  for (const [top, bottom] of sorted) {
    if (top > cursor && top - cursor > best.bottom - best.top) best = { top: cursor, bottom: top };
    cursor = Math.max(cursor, bottom);
  }
  if (height - cursor > best.bottom - best.top) best = { top: cursor, bottom: height };
  if (best.bottom - best.top < height * MIN_FREE_SHARE) return 0.5;
  return (best.top + best.bottom) / 2 / height;
}
