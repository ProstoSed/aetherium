import { useEffect, useRef, useState } from 'react';
import { Ambience } from './audio/Ambience';
import { Observatory } from './engine/Observatory';
import { BodyCard } from './ui/BodyCard';
import { BodyRail } from './ui/BodyRail';
import { EventBanner } from './ui/events/EventBanner';
import { EventLauncher } from './ui/events/EventLauncher';
import { EventsSheet } from './ui/events/EventsSheet';
import { HelpDialog } from './ui/HelpDialog';
import { Intro } from './ui/Intro';
import { ObservatoryContext, useFrame, useObservatory } from './ui/observatoryContext';
import { SettingsPanel } from './ui/SettingsPanel';
import { TimeDeck } from './ui/TimeDeck';
import { TopBar } from './ui/TopBar';

type Panel = 'events' | 'settings' | 'help' | null;

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const [observatory, setObservatory] = useState<Observatory | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let instance: Observatory;
    try {
      instance = new Observatory(stageRef.current!, labelsRef.current!, hudRef.current!);
    } catch (error) {
      console.error(error);
      setFailed(true);
      return;
    }
    setObservatory(instance);
    return () => instance.dispose();
  }, []);

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
            <strong>Нужен WebGL 2</strong>
            <span>Включите аппаратное ускорение в настройках браузера и перезагрузите страницу.</span>
          </div>
        )}
      </div>
      <Intro />
    </div>
  );
}

function Hud() {
  const [panel, setPanel] = useState<Panel>(null);
  const [soundOn, setSoundOn] = useState(false);
  const ambience = useRef<Ambience | null>(null);

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
      <KeyboardShortcuts onEscape={() => setPanel(null)} />
      <TopBar soundOn={soundOn} onToggleSound={toggleSound} onOpenSettings={() => toggle('settings')} onOpenHelp={() => toggle('help')} settingsOpen={panel === 'settings'} />
      <EventBanner />
      <BodyRail />
      <BodyCard />
      <footer className="bottom-bar">
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
 * Пробел — пауза, Esc — закрыть панель. Пробел не перехватывается только в полях и переключателях,
 * где он меняет значение. На кнопках перехватывается: после щелчка по планете фокус остаётся
 * на кнопке, и пробел повторял бы перелёт вместо паузы. Кнопки по-прежнему нажимаются Enter.
 */
function KeyboardShortcuts({ onEscape }: { onEscape: () => void }) {
  const observatory = useObservatory();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape();
      const target = event.target as HTMLElement;
      const editing = target.closest('input, select, textarea');
      if (event.code === 'Space' && !editing) {
        event.preventDefault();
        observatory.setPaused(!observatory.store.get().paused);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [observatory, onEscape]);
  return null;
}
