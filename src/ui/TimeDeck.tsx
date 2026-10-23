import { CalendarClock, Pause, Play, Rewind } from 'lucide-react';
import { useRef } from 'react';
import { ELEMENTS_VALID_FROM_YEAR, ELEMENTS_VALID_TO_YEAR } from '../data/orbitalElements';
import { SPEED_PRESETS } from '../engine/SimulationClock';
import { useI18n } from '../i18n';
import { dateFromJulianDate } from '../physics/time';
import { useFrame, useObservatory, useObservatoryState, writeText } from './observatoryContext';
import { useOccluder } from './useOccluder';

/** Время: пауза, обратный ход, скорость ступенями и дата. */
export function TimeDeck() {
  const observatory = useObservatory();
  const { t } = useI18n();
  const paused = useObservatoryState(s => s.paused);
  const reversed = useObservatoryState(s => s.reversed);
  const speedId = useObservatoryState(s => s.speedId);
  const dateRef = useRef<HTMLSpanElement>(null);
  const accuracyRef = useRef<HTMLSpanElement>(null);
  const deckRef = useRef<HTMLElement>(null);
  useOccluder(deckRef, true);
  const speedIndex = SPEED_PRESETS.findIndex(p => p.id === speedId);
  const speedText = t.speeds[SPEED_PRESETS[speedIndex].id];

  useFrame(frame => {
    writeText(dateRef.current, frame.dateText);
    const year = dateFromJulianDate(frame.julianDate).getUTCFullYear();
    const outside = year < ELEMENTS_VALID_FROM_YEAR || year > ELEMENTS_VALID_TO_YEAR;
    if (accuracyRef.current && accuracyRef.current.hidden === outside) accuracyRef.current.hidden = !outside;
  });

  return (
    <section className="time-deck" aria-label={t.time.deck} ref={deckRef}>
      <div className="deck-buttons">
        <button type="button" className={`deck-button ${reversed ? 'is-on' : ''}`} title={reversed ? t.time.reverseOn : t.time.reverseOff} aria-label={t.time.reverse} aria-pressed={reversed} onClick={() => observatory.setReversed(!reversed)}>
          <Rewind size={17} strokeWidth={1.7} />
        </button>
        <button type="button" className="deck-play" title={paused ? t.time.playHint : t.time.pauseHint} aria-label={paused ? t.time.play : t.time.pause} onClick={() => observatory.setPaused(!paused)}>
          {paused ? <Play size={20} fill="currentColor" strokeWidth={0} /> : <Pause size={20} fill="currentColor" strokeWidth={0} />}
        </button>
      </div>

      <div className="deck-speed">
        <div className="deck-speed-label">
          <span>{t.time.speed}</span>
          <strong>{speedText}</strong>
        </div>
        <input
          type="range"
          min={0}
          max={SPEED_PRESETS.length - 1}
          step={1}
          value={speedIndex}
          aria-label={t.time.speedLabel}
          aria-valuetext={speedText}
          onChange={event => observatory.setSpeed(SPEED_PRESETS[Number(event.target.value)].id)}
          style={{ '--fill': `${(speedIndex / (SPEED_PRESETS.length - 1)) * 100}%` } as React.CSSProperties}
        />
      </div>

      <div className="deck-date">
        <span className="deck-date-value" ref={dateRef} />
        <span className="deck-date-note" ref={accuracyRef} hidden>
          {t.time.extrapolated(t.year(ELEMENTS_VALID_FROM_YEAR), t.year(ELEMENTS_VALID_TO_YEAR))}
        </span>
      </div>

      <button type="button" className="deck-now" onClick={() => observatory.jumpToNow()} title={t.time.nowHint}>
        <CalendarClock size={16} strokeWidth={1.7} />
        {t.time.now}
      </button>
    </section>
  );
}
