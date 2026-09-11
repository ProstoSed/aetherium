import { Square } from 'lucide-react';
import { useRef } from 'react';
import { EVENT_BY_ID } from '../../data/events';
import { useFrame, useObservatory, useObservatoryState, writeText } from '../observatoryContext';
import { EventIcon } from './EventIcon';

/** Идущее событие: название, прогресс, оставшееся время и остановка. */
export function EventBanner() {
  const observatory = useObservatory();
  const activeId = useObservatoryState(s => s.activeEvent);
  const progressRef = useRef<HTMLSpanElement>(null);
  const remainingRef = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef<HTMLSpanElement>(null);

  useFrame(frame => {
    progressRef.current?.style.setProperty('--progress', frame.eventProgress.toFixed(4));
    writeText(remainingRef.current, `${Math.ceil(frame.eventRemaining)} с`);
    writeText(phaseRef.current, frame.eventProgress > 0.75 ? 'Возвращение к равновесию' : 'Идёт событие');
  });

  if (!activeId) return null;
  const info = EVENT_BY_ID[activeId];

  return (
    <div className={`event-banner intensity-${info.intensity === 'разрушительное' ? 'high' : info.intensity === 'сильное' ? 'mid' : 'low'}`} role="status">
      <span className="banner-icon"><EventIcon icon={info.icon} size={20} /></span>
      <div className="banner-body">
        <span className="banner-phase" ref={phaseRef}>Идёт событие</span>
        <strong className="banner-name">{info.name}</strong>
        <span className="banner-progress" ref={progressRef} aria-hidden="true" />
      </div>
      <span className="banner-remaining" ref={remainingRef} />
      <button type="button" className="banner-stop" title="Остановить событие" aria-label="Остановить событие" onClick={() => observatory.stopEvent()}>
        <Square size={13} fill="currentColor" strokeWidth={0} />
      </button>
    </div>
  );
}
