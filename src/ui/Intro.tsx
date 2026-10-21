import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';

const COUNTDOWN = [3, 2, 1];
const STEP_MS = 620;
const TITLE_MIN_MS = 1200;
const REPEAT_TITLE_MIN_MS = 350;
const LEAVE_MS = 750;
const SEEN_KEY = 'aetherium.intro-seen';

type Phase = 'countdown' | 'title' | 'leaving' | 'done';

function introAlreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Ракорд с обратным отсчётом, затем название. Название держится, пока сцена не готова
 * (запекание поверхностей и сборка шейдеров), и показывает прогресс — заставка не делает вид,
 * что всё загрузилось, когда за ней ещё чёрный экран. Щелчок или клавиша пропускают отсчёт.
 */
export function Intro({ progress, ready }: { progress: number; ready: boolean }) {
  const { t } = useI18n();
  const [seenBefore] = useState(introAlreadySeen);
  const [phase, setPhase] = useState<Phase>(seenBefore ? 'title' : 'countdown');
  const [step, setStep] = useState(0);
  const [titleShownAt, setTitleShownAt] = useState(() => performance.now());

  useEffect(() => {
    if (phase !== 'countdown') return;
    const timer = setTimeout(() => {
      if (step + 1 < COUNTDOWN.length) setStep(step + 1);
      else {
        setPhase('title');
        setTitleShownAt(performance.now());
      }
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [phase, step]);

  useEffect(() => {
    if (phase !== 'title' || !ready) return;
    const minimum = seenBefore ? REPEAT_TITLE_MIN_MS : TITLE_MIN_MS;
    const wait = Math.max(0, minimum - (performance.now() - titleShownAt));
    const timer = setTimeout(() => setPhase('leaving'), wait);
    return () => clearTimeout(timer);
  }, [phase, ready, seenBefore, titleShownAt]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* приватный режим: заставка просто покажется снова */ }
    const timer = setTimeout(() => setPhase('done'), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    const skip = () => {
      setPhase('title');
      setTitleShownAt(performance.now() - TITLE_MIN_MS);
    };
    window.addEventListener('keydown', skip, { once: true });
    return () => window.removeEventListener('keydown', skip);
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      className={`intro phase-${phase}`}
      onPointerDown={() => { if (phase === 'countdown') { setPhase('title'); setTitleShownAt(performance.now() - TITLE_MIN_MS); } }}
      role="status"
      aria-live="polite"
      aria-label={ready ? t.intro.readyLabel : t.intro.loadingLabel}
    >
      {phase === 'countdown' ? (
        <div className="leader" key={step} aria-hidden="true">
          <span className="leader-cross" />
          <span className="leader-sweep" />
          <span className="leader-circle" />
          <span className="leader-number">{COUNTDOWN[step]}</span>
        </div>
      ) : (
        <div className="intro-title">
          <span className="intro-rule" />
          <h1>Aetherium</h1>
          <p>{t.brand.tagline}</p>
          <div className="intro-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${ready ? 1 : Math.max(0.04, progress)})` }} />
          </div>
          <span className="intro-status">{ready ? t.intro.ready : t.intro.developing}</span>
        </div>
      )}
      <span className="intro-grain" aria-hidden="true" />
    </div>
  );
}
