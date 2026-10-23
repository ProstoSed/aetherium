import { Sparkles } from 'lucide-react';
import { useRef } from 'react';
import { useI18n } from '../../i18n';
import { formatCountdown } from '../../i18n/format';
import { useFrame, useObservatoryState, writeText } from '../observatoryContext';
import { useOccluder } from '../useOccluder';

const RING_RADIUS = 21;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** Кнопка каталога событий. Кольцо вокруг — сколько осталось до следующего автособытия. */
export function EventLauncher({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const autoEvents = useObservatoryState(s => s.autoEvents);
  const interval = useObservatoryState(s => s.autoInterval);
  const scaleMode = useObservatoryState(s => s.scaleMode);
  const active = useObservatoryState(s => s.activeEvent);
  const ringRef = useRef<SVGCircleElement>(null);
  const countdownRef = useRef<HTMLSpanElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  useOccluder(launcherRef, true);
  const counting = autoEvents && !active && scaleMode === 'cinematic';

  useFrame(frame => {
    if (!counting) return;
    const share = Math.max(0, Math.min(1, frame.autoCountdown / interval));
    ringRef.current?.setAttribute('stroke-dashoffset', (RING_LENGTH * (1 - share)).toFixed(1));
    writeText(countdownRef.current, formatCountdown(frame.autoCountdown));
  });

  return (
    <button type="button" ref={launcherRef} className={`event-launcher ${open ? 'is-open' : ''}`} onClick={onToggle} aria-expanded={open}>
      <span className="launcher-emblem">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r={RING_RADIUS} className="launcher-track" />
          {counting && <circle ref={ringRef} cx="24" cy="24" r={RING_RADIUS} className="launcher-ring" strokeDasharray={RING_LENGTH} />}
        </svg>
        <Sparkles size={18} strokeWidth={1.5} />
      </span>
      <span className="launcher-text">
        <strong>{t.eventsUi.title}</strong>
        <span>{counting ? <>{t.eventsUi.nextIn} <span ref={countdownRef} className="numeric" /></> : active ? t.eventsUi.running : t.eventsUi.choose}</span>
      </span>
    </button>
  );
}
