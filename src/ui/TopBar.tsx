import { CircleHelp, Film, Maximize, Minimize, Settings2, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import type { FilmIntensity } from '../lens/LensDirector';
import { LanguageMenu } from './LanguageMenu';
import { useObservatory, useObservatoryState } from './observatoryContext';

const FILM_NEXT: Record<FilmIntensity, FilmIntensity> = { off: 'soft', soft: 'strong', strong: 'off' };

type Props = {
  soundOn: boolean;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  settingsOpen: boolean;
};

export function TopBar({ soundOn, onToggleSound, onOpenSettings, onOpenHelp, settingsOpen }: Props) {
  const observatory = useObservatory();
  const { t } = useI18n();
  const scaleMode = useObservatoryState(s => s.scaleMode);
  const film = useObservatoryState(s => s.film);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <header className="top-bar">
      <button className="brand" type="button" onClick={() => observatory.overview()} title={t.topBar.overview}>
        <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="4.2" className="brand-sun" />
          <ellipse cx="20" cy="20" rx="17" ry="7" className="brand-orbit" transform="rotate(-24 20 20)" />
          <ellipse cx="20" cy="20" rx="11" ry="4.5" className="brand-orbit" transform="rotate(-24 20 20)" />
          <circle cx="35.2" cy="13.4" r="1.9" className="brand-planet" />
        </svg>
        <span className="brand-text">
          <span className="brand-name">Aetherium</span>
          <span className="brand-tagline">{t.brand.tagline}</span>
        </span>
      </button>

      <div className="top-tools">
        <div className="scale-toggle" role="radiogroup" aria-label={t.topBar.scale}>
          <button type="button" role="radio" aria-checked={scaleMode === 'cinematic'} className={scaleMode === 'cinematic' ? 'is-active' : ''} onClick={() => observatory.setScaleMode('cinematic')}>
            {t.topBar.illustrative}
          </button>
          <button type="button" role="radio" aria-checked={scaleMode === 'true'} className={scaleMode === 'true' ? 'is-active' : ''} onClick={() => observatory.setScaleMode('true')}>
            <span className="scale-toggle-long">{t.topBar.trueScaleLong}</span>
            <span className="scale-toggle-short">{t.topBar.trueScaleShort}</span>
          </button>
          <span className="scale-toggle-thumb" data-mode={scaleMode} aria-hidden="true" />
        </div>

        <div className="tool-group">
          <LanguageMenu />
          <button type="button" className={`tool-button film-${film}`} title={t.topBar.film[film]} aria-label={t.topBar.film[film]} onClick={() => observatory.updateSettings({ film: FILM_NEXT[film] })}>
            <Film size={18} strokeWidth={1.6} />
            <span className="film-dots" aria-hidden="true"><i /><i /></span>
          </button>
          <button type="button" className={`tool-button ${soundOn ? 'is-on' : ''}`} title={soundOn ? t.topBar.soundOff : t.topBar.soundOn} aria-label={soundOn ? t.topBar.soundOff : t.topBar.soundOn} onClick={onToggleSound}>
            {soundOn ? <Volume2 size={18} strokeWidth={1.6} /> : <VolumeX size={18} strokeWidth={1.6} />}
          </button>
          <button type="button" className={`tool-button tool-settings ${settingsOpen ? 'is-on' : ''}`} title={t.topBar.settings} aria-label={t.topBar.settings} aria-expanded={settingsOpen} onClick={onOpenSettings}>
            <Settings2 size={18} strokeWidth={1.6} />
          </button>
          <button type="button" className="tool-button tool-help" title={t.topBar.help} aria-label={t.topBar.help} onClick={onOpenHelp}>
            <CircleHelp size={18} strokeWidth={1.6} />
          </button>
          <button type="button" className="tool-button tool-fullscreen" title={fullscreen ? t.topBar.exitFullscreen : t.topBar.fullscreen} aria-label={fullscreen ? t.topBar.exitFullscreen : t.topBar.fullscreen} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize size={18} strokeWidth={1.6} /> : <Maximize size={18} strokeWidth={1.6} />}
          </button>
        </div>
      </div>
    </header>
  );
}
