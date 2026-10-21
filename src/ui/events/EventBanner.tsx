import { Square } from 'lucide-react';
import { useRef } from 'react';
import { EVENT_BY_ID, INTENSITY_CLASS } from '../../data/events';
import { useI18n } from '../../i18n';
import { useFrame, useObservatory, useObservatoryState, writeText } from '../observatoryContext';
import { EventIcon } from './EventIcon';

/** Идущее событие: название, прогресс, оставшееся время и остановка. */
export function EventBanner() {
  const observatory = useObservatory();
  const { t } = useI18n();
  const activeId = useObservatoryState(s => s.activeEvent);
  const progressRef = useRef<HTMLSpanElement>(null);
  const remainingRef = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef<HTMLSpanElement>(null);

  useFrame(frame => {
    progressRef.current?.style.setProperty('--progress', frame.eventProgress.toFixed(4));
    writeText(remainingRef.current, t.units.seconds(Math.ceil(frame.eventRemaining)));
    writeText(phaseRef.current, frame.eventProgress > 0.75 ? t.eventsUi.settling : t.eventsUi.inProgress);
  });

  if (!activeId) return null;
  const info = EVENT_BY_ID[activeId];

  return (
    <div className={`event-banner intensity-${INTENSITY_CLASS[info.intensity]}`} role="status">
      <span className="banner-icon"><EventIcon icon={info.icon} size={20} /></span>
      <div className="banner-body">
        <span className="banner-phase" ref={phaseRef}>{t.eventsUi.inProgress}</span>
        <strong className="banner-name">{t.events[info.id].name}</strong>
        <span className="banner-progress" ref={progressRef} aria-hidden="true" />
      </div>
      <span className="banner-remaining" ref={remainingRef} />
      <button type="button" className="banner-stop" title={t.eventsUi.stop} aria-label={t.eventsUi.stop} onClick={() => observatory.stopEvent()}>
        <Square size={13} fill="currentColor" strokeWidth={0} />
      </button>
    </div>
  );
}
