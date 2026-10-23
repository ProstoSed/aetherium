import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useObservatoryState } from './observatoryContext';

const SEEN_KEY = 'aetherium.first-steps-seen';
/** Подсказка появляется, когда заставка уже ушла, и не висит дольше, чем нужно, чтобы её прочесть. */
const SHOW_AFTER_MS = 1800;
const HIDE_AFTER_MS = 14000;

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* приватный режим: подсказка покажется ещё раз */ }
}

/**
 * Одноразовая подсказка для первого посещения: что здесь можно делать. Уходит сама,
 * по кнопке или как только посетитель выбрал тело или запустил событие — значит, уже понял.
 */
export function FirstSteps() {
  const { t } = useI18n();
  const ready = useObservatoryState(s => s.ready);
  const acted = useObservatoryState(s => s.selected !== null || s.activeEvent !== null);
  const [phase, setPhase] = useState<'waiting' | 'shown' | 'gone'>(() => (alreadySeen() ? 'gone' : 'waiting'));

  useEffect(() => {
    if (phase !== 'waiting' || !ready) return;
    const timer = setTimeout(() => setPhase('shown'), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [phase, ready]);

  useEffect(() => {
    if (phase !== 'shown') return;
    markSeen();
    const timer = setTimeout(() => setPhase('gone'), HIDE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (acted && phase !== 'gone') {
      markSeen();
      setPhase('gone');
    }
  }, [acted, phase]);

  if (phase !== 'shown') return null;
  return (
    <div className="first-steps" role="status">
      <p>{t.firstSteps.text}</p>
      <button type="button" className="text-button" onClick={() => setPhase('gone')}>{t.firstSteps.dismiss}</button>
    </div>
  );
}
