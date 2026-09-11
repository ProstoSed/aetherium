import { CalendarClock, Pause, Play, Rewind } from 'lucide-react';
import { useRef } from 'react';
import { ELEMENTS_VALID_FROM_YEAR, ELEMENTS_VALID_TO_YEAR } from '../data/orbitalElements';
import { SPEED_PRESETS } from '../engine/SimulationClock';
import { dateFromJulianDate } from '../physics/time';
import { useFrame, useObservatory, useObservatoryState, writeText } from './observatoryContext';

/** Время: пауза, обратный ход, скорость ступенями и дата. */
export function TimeDeck() {
  const observatory = useObservatory();
  const paused = useObservatoryState(s => s.paused);
  const reversed = useObservatoryState(s => s.reversed);
  const speedId = useObservatoryState(s => s.speedId);
  const dateRef = useRef<HTMLSpanElement>(null);
  const accuracyRef = useRef<HTMLSpanElement>(null);
  const speedIndex = SPEED_PRESETS.findIndex(p => p.id === speedId);

  useFrame(frame => {
    writeText(dateRef.current, frame.dateText);
    const year = dateFromJulianDate(frame.julianDate).getUTCFullYear();
    const outside = year < ELEMENTS_VALID_FROM_YEAR || year > ELEMENTS_VALID_TO_YEAR;
    if (accuracyRef.current && accuracyRef.current.hidden === outside) accuracyRef.current.hidden = !outside;
  });

  return (
    <section className="time-deck" aria-label="Ход времени">
      <div className="deck-buttons">
        <button type="button" className={`deck-button ${reversed ? 'is-on' : ''}`} title={reversed ? 'Время идёт назад' : 'Пустить время назад'} aria-label="Обратный ход" aria-pressed={reversed} onClick={() => observatory.setReversed(!reversed)}>
          <Rewind size={17} strokeWidth={1.7} />
        </button>
        <button type="button" className="deck-play" title={paused ? 'Продолжить (пробел)' : 'Пауза (пробел)'} aria-label={paused ? 'Продолжить' : 'Пауза'} onClick={() => observatory.setPaused(!paused)}>
          {paused ? <Play size={20} fill="currentColor" strokeWidth={0} /> : <Pause size={20} fill="currentColor" strokeWidth={0} />}
        </button>
      </div>

      <div className="deck-speed">
        <div className="deck-speed-label">
          <span>Скорость</span>
          <strong>{SPEED_PRESETS[speedIndex].label}</strong>
        </div>
        <input
          type="range"
          min={0}
          max={SPEED_PRESETS.length - 1}
          step={1}
          value={speedIndex}
          aria-label="Скорость времени"
          aria-valuetext={SPEED_PRESETS[speedIndex].label}
          onChange={event => observatory.setSpeed(SPEED_PRESETS[Number(event.target.value)].id)}
          style={{ '--fill': `${(speedIndex / (SPEED_PRESETS.length - 1)) * 100}%` } as React.CSSProperties}
        />
      </div>

      <div className="deck-date">
        <span className="deck-date-value" ref={dateRef} />
        <span className="deck-date-note" ref={accuracyRef} hidden>
          вне {ELEMENTS_VALID_FROM_YEAR}–{ELEMENTS_VALID_TO_YEAR}: орбиты экстраполированы
        </span>
      </div>

      <button type="button" className="deck-now" onClick={() => observatory.jumpToNow()} title="Вернуться к сегодняшнему дню">
        <CalendarClock size={16} strokeWidth={1.7} />
        Сейчас
      </button>
    </section>
  );
}
