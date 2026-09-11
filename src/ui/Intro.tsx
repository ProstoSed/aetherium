import { useEffect, useState } from 'react';

const COUNTDOWN = [3, 2, 1];
const STEP_MS = 620;
const TITLE_MS = 1500;
const SEEN_KEY = 'aetherium.intro-seen';

function introAlreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Ракорд с обратным отсчётом, затем название. Показывается раз за сеанс; любой щелчок или клавиша — пропуск. */
export function Intro() {
  const [step, setStep] = useState(() => (introAlreadySeen() ? COUNTDOWN.length + 1 : 0));
  const done = step > COUNTDOWN.length;

  useEffect(() => {
    if (done) {
      try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* приватный режим: просто покажем снова */ }
      return;
    }
    const delay = step < COUNTDOWN.length ? STEP_MS : TITLE_MS;
    const timer = setTimeout(() => setStep(value => value + 1), delay);
    const skip = () => setStep(COUNTDOWN.length + 1);
    window.addEventListener('keydown', skip, { once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', skip);
    };
  }, [step, done]);

  if (done) return null;
  const showingTitle = step === COUNTDOWN.length;

  return (
    <div className={`intro ${showingTitle ? 'is-title' : ''}`} onPointerDown={() => setStep(COUNTDOWN.length + 1)} aria-hidden="true">
      {showingTitle ? (
        <div className="intro-title">
          <span className="intro-rule" />
          <h1>Aetherium</h1>
          <p>механика неба</p>
          <span className="intro-rule" />
        </div>
      ) : (
        <div className="leader" key={step}>
          <span className="leader-cross" />
          <span className="leader-sweep" />
          <span className="leader-circle" />
          <span className="leader-number">{COUNTDOWN[step]}</span>
        </div>
      )}
      <span className="intro-grain" />
    </div>
  );
}
