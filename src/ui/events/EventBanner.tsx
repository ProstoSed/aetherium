import { Crosshair, Square } from 'lucide-react';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { EVENT_BY_ID, INTENSITY_CLASS } from '../../data/events';
import { useI18n } from '../../i18n';
import { useFrame, useObservatory, useObservatoryState, writeText } from '../observatoryContext';
import { useOccluder } from '../useOccluder';
import { EventIcon } from './EventIcon';

/** Совпадает с узкой раскладкой в CSS: там баннер стоит под лентой тел, и места хватает всегда. */
const NARROW_LAYOUT = '(max-width: 760px)';
/** Уже этого баннер не помещается в промежуток верхней панели без сильного обрезания названия. */
const MIN_BANNER_WIDTH_PX = 340;
const GAP_PX = 16;

/**
 * Баннер стоит в промежутке между названием и инструментами верхней панели. Ширина промежутка
 * зависит от языка (подписи переключателя масштаба) и окна, поэтому меряется: если баннер туда
 * не помещается, он опускается под панель, а не наезжает на переключатель.
 */
function useBannerPlacement(bannerRef: RefObject<HTMLDivElement | null>, language: string) {
  useLayoutEffect(() => {
    const banner = bannerRef.current;
    const brand = document.querySelector('.top-bar .brand');
    const tools = document.querySelector('.top-bar .top-tools');
    if (!banner || !brand || !tools) return;
    const narrow = window.matchMedia(NARROW_LAYOUT);

    const place = () => {
      if (narrow.matches) {
        banner.style.removeProperty('left');
        banner.style.removeProperty('max-width');
        banner.classList.remove('is-lowered');
        return;
      }
      const left = brand.getBoundingClientRect().right + GAP_PX;
      const right = tools.getBoundingClientRect().left - GAP_PX;
      let fits = right - left >= MIN_BANNER_WIDTH_PX;
      if (fits) {
        banner.classList.remove('is-lowered');
        banner.style.left = `${(left + right) / 2}px`;
        banner.style.maxWidth = `${right - left}px`;
        // Промежуток есть, но название в нём обрезалось бы — под панелью оно поместится целиком.
        const name = banner.querySelector<HTMLElement>('.banner-name');
        fits = !name || name.scrollWidth <= name.clientWidth;
      }
      if (!fits) {
        banner.classList.add('is-lowered');
        banner.style.removeProperty('left');
        banner.style.removeProperty('max-width');
      }
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(brand);
    observer.observe(tools);
    observer.observe(document.documentElement);
    narrow.addEventListener('change', place);
    return () => {
      observer.disconnect();
      narrow.removeEventListener('change', place);
    };
  }, [bannerRef, language]);
}

/** Идущее событие: название, прогресс, оставшееся время и остановка. */
export function EventBanner() {
  const observatory = useObservatory();
  const { t, language } = useI18n();
  const activeId = useObservatoryState(s => s.activeEvent);
  const awayFromEvent = useObservatoryState(s => s.focused !== s.eventFocus);
  const bannerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const remainingRef = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef<HTMLSpanElement>(null);
  useBannerPlacement(bannerRef, `${language}:${activeId}`);
  useOccluder(bannerRef, true, activeId);

  useFrame(frame => {
    progressRef.current?.style.setProperty('--progress', frame.eventProgress.toFixed(4));
    writeText(remainingRef.current, t.units.seconds(Math.ceil(frame.eventRemaining)));
    writeText(phaseRef.current, frame.eventProgress > 0.75 ? t.eventsUi.settling : t.eventsUi.inProgress);
  });

  if (!activeId) return null;
  const info = EVENT_BY_ID[activeId];
  const name = t.events[info.id].name;

  // Живая область объявляет только название и фазу: секунды, переписываемые каждую секунду,
  // читались бы вслух без остановки.
  return (
    <div ref={bannerRef} className={`event-banner intensity-${INTENSITY_CLASS[info.intensity]}`} role="status">
      <span className="banner-icon"><EventIcon icon={info.icon} size={20} /></span>
      <div className="banner-body">
        <span className="banner-phase" ref={phaseRef}>{t.eventsUi.inProgress}</span>
        <strong className="banner-name" title={name}>{name}</strong>
        <span className="banner-progress" ref={progressRef} aria-hidden="true" />
      </div>
      <span className="banner-remaining" ref={remainingRef} aria-hidden="true" />
      {awayFromEvent && (
        <button type="button" className="banner-stop" title={t.eventsUi.showEvent} aria-label={t.eventsUi.showEvent} onClick={() => observatory.showEvent()}>
          <Crosshair size={15} strokeWidth={1.8} />
        </button>
      )}
      <button type="button" className="banner-stop" title={t.eventsUi.stop} aria-label={t.eventsUi.stop} onClick={() => observatory.stopEvent()}>
        <Square size={13} fill="currentColor" strokeWidth={0} />
      </button>
    </div>
  );
}
