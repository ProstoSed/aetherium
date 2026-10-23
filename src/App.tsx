import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Ambience } from './audio/Ambience';
import { Observatory } from './engine/Observatory';
import { useI18n } from './i18n';
import { BodyCard } from './ui/BodyCard';
import { BodyRail } from './ui/BodyRail';
import { EventBanner } from './ui/events/EventBanner';
import { EventLauncher } from './ui/events/EventLauncher';
import { EventsSheet } from './ui/events/EventsSheet';
import { FirstSteps } from './ui/FirstSteps';
import { HelpDialog } from './ui/HelpDialog';
import { Intro } from './ui/Intro';
import { ObservatoryContext, useFrame, useObservatory } from './ui/observatoryContext';
import { SettingsPanel } from './ui/SettingsPanel';
import { TimeDeck } from './ui/TimeDeck';
import { TopBar } from './ui/TopBar';
import { useLayoutVariable } from './ui/useLayoutVariable';

type Panel = 'events' | 'settings' | 'help' | null;

const heightOf = (rect: DOMRect) => rect.height;

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const [observatory, setObservatory] = useState<Observatory | null>(null);
  const [failed, setFailed] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    let instance: Observatory | null = null;
    let cancelled = false;
    // Движок создаётся после того, как заставка успела отрисоваться: иначе его подготовка
    // пришлась бы на тот же кадр, и отсчёт появился бы с задержкой.
    const frame = requestAnimationFrame(() => {
      setTimeout(() => {
        if (cancelled) return;
        try {
          instance = new Observatory(stageRef.current!, labelsRef.current!, hudRef.current!);
          setObservatory(instance);
        } catch (error) {
          console.error(error);
          setFailed(true);
        }
      }, 0);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      instance?.dispose();
    };
  }, []);

  const loading = useLoadingState(observatory);

  return (
    <div className="app">
      <div className="stage" ref={stageRef} />
      <div className="hud" ref={hudRef}>
        <div className="scene-labels" ref={labelsRef} />
        {observatory && (
          <ObservatoryContext.Provider value={observatory}>
            <Hud />
          </ObservatoryContext.Provider>
        )}
        {failed && (
          <div className="webgl-error">
            <strong>{t.webglError.title}</strong>
            <span>{t.webglError.hint}</span>
          </div>
        )}
      </div>
      <Intro progress={loading.progress} ready={loading.ready || failed} />
    </div>
  );
}

const NOT_LOADED = { progress: 0, ready: false };

/** Прогресс подготовки сцены — для заставки, которая живёт и до создания движка. */
function useLoadingState(observatory: Observatory | null) {
  const progress = useSyncExternalStore(
    listener => observatory?.store.subscribe(listener) ?? (() => {}),
    () => observatory?.store.get().loadProgress ?? NOT_LOADED.progress,
  );
  const ready = useSyncExternalStore(
    listener => observatory?.store.subscribe(listener) ?? (() => {}),
    () => observatory?.store.get().ready ?? NOT_LOADED.ready,
  );
  return { progress, ready };
}

function Hud() {
  const [panel, setPanel] = useState<Panel>(null);
  const [soundOn, setSoundOn] = useState(false);
  const ambience = useRef<Ambience | null>(null);
  const bottomBarRef = useRef<HTMLElement>(null);
  useLayoutVariable(bottomBarRef, '--bottom-bar-height', heightOf);

  useEffect(() => () => ambience.current?.dispose(), []);

  useFrame(frame => {
    if (!ambience.current?.enabled) return;
    const tension = frame.eventProgress > 0 ? Math.sin(Math.PI * frame.eventProgress) : 0;
    ambience.current.setTension(tension);
  });

  const toggle = (next: Panel) => setPanel(current => (current === next ? null : next));

  const toggleSound = async () => {
    ambience.current ??= new Ambience();
    if (soundOn) await ambience.current.disable();
    else await ambience.current.enable();
    setSoundOn(!soundOn);
  };

  return (
    <>
      <KeyboardShortcuts panelOpen={panel !== null} onClosePanel={() => setPanel(null)} />
      <TopBar soundOn={soundOn} onToggleSound={toggleSound} onOpenSettings={() => toggle('settings')} onOpenHelp={() => toggle('help')} settingsOpen={panel === 'settings'} />
      <EventBanner />
      <BodyRail />
      <BodyCard />
      <FirstSteps />
      <footer className="bottom-bar" ref={bottomBarRef}>
        <TimeDeck />
        <EventLauncher open={panel === 'events'} onToggle={() => toggle('events')} />
      </footer>
      {panel === 'settings' && <SettingsPanel />}
      {panel === 'events' && <EventsSheet onClose={() => setPanel(null)} />}
      {panel === 'help' && <HelpDialog onClose={() => setPanel(null)} />}
    </>
  );
}

/**
 * Пробел — пауза, Esc — закрыть панель, а если панелей нет — карточку тела. Esc, уже обработанный
 * всплывающим списком (defaultPrevented), дальше не идёт: иначе одно нажатие закрыло бы и список, и карточку.
 * Пробел не перехватывается только в полях и переключателях, где он меняет значение. На кнопках
 * перехватывается: после щелчка по планете фокус остаётся на кнопке, и пробел повторял бы перелёт
 * вместо паузы. Кнопки по-прежнему нажимаются Enter. Пока сцена не готова, пробел принадлежит
 * заставке — он пропускает отсчёт и не должен заодно ставить симуляцию на паузу.
 */
function KeyboardShortcuts({ panelOpen, onClosePanel }: { panelOpen: boolean; onClosePanel: () => void }) {
  const observatory = useObservatory();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        if (panelOpen) onClosePanel();
        else observatory.select(null);
        return;
      }
      const target = event.target as HTMLElement;
      const editing = target.closest('input, select, textarea');
      if (event.code === 'Space' && !editing && observatory.store.get().ready) {
        event.preventDefault();
        observatory.setPaused(!observatory.store.get().paused);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [observatory, panelOpen, onClosePanel]);
  return null;
}
