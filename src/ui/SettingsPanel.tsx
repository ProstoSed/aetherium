import type { QualityMode } from '../engine/AdaptiveQuality';
import { useI18n } from '../i18n';
import type { FilmIntensity } from '../lens/LensDirector';
import { useObservatory, useObservatoryState } from './observatoryContext';

const FILM_LEVELS: FilmIntensity[] = ['off', 'soft', 'strong'];
const AUTO_INTERVALS_SECONDS = [60, 120, 300];
const QUALITY_MODES: QualityMode[] = ['auto', 'high', 'low'];

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint: string }) {
  return (
    <label className="setting-row">
      <span className="setting-text">
        <strong>{label}</strong>
        <span>{hint}</span>
      </span>
      <input type="checkbox" className="switch" role="switch" checked={checked} onChange={event => onChange(event.target.checked)} />
    </label>
  );
}

function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(option => (
        <button key={option.value} type="button" role="radio" aria-checked={option.value === value} className={option.value === value ? 'is-active' : ''} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsPanel() {
  const observatory = useObservatory();
  const { t } = useI18n();
  const s = useObservatoryState(state => state);
  const update = observatory.updateSettings.bind(observatory);
  const text = t.settings;

  return (
    <section className="settings-panel" aria-label={text.title}>
      <h3 className="panel-title">{text.view}</h3>
      <Switch label={text.orbits.label} hint={text.orbits.hint} checked={s.showOrbits} onChange={v => update({ showOrbits: v })} />
      <Switch label={text.labels.label} hint={text.labels.hint} checked={s.showLabels} onChange={v => update({ showLabels: v })} />
      <Switch label={text.asteroids.label} hint={text.asteroids.hint} checked={s.showAsteroids} onChange={v => update({ showAsteroids: v })} />
      <Switch label={text.constellations.label} hint={text.constellations.hint} checked={s.showConstellations} onChange={v => update({ showConstellations: v })} />

      <h3 className="panel-title">{text.film}</h3>
      <Segmented<FilmIntensity> label={text.filmStrength} value={s.film} onChange={v => update({ film: v })}
        options={FILM_LEVELS.map(value => ({ value, label: text.filmOptions[value] }))} />

      <h3 className="panel-title">{text.events}</h3>
      <Switch label={text.autoEvents.label} hint={text.autoEvents.hint} checked={s.autoEvents} onChange={v => update({ autoEvents: v })} />
      <Segmented<number> label={text.autoInterval} value={s.autoInterval} onChange={v => update({ autoInterval: v })}
        options={AUTO_INTERVALS_SECONDS.map(value => ({ value, label: text.minutes(value / 60) }))} />

      <h3 className="panel-title">{text.quality}</h3>
      <Segmented<QualityMode> label={text.qualityLabel} value={s.quality} onChange={v => update({ quality: v })}
        options={QUALITY_MODES.map(value => ({ value, label: text.qualityOptions[value] }))} />
    </section>
  );
}
