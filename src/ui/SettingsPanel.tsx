import type { QualityMode } from '../engine/AdaptiveQuality';
import type { FilmIntensity } from '../lens/LensDirector';
import { useObservatory, useObservatoryState } from './observatoryContext';

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
  const s = useObservatoryState(state => state);
  const update = observatory.updateSettings.bind(observatory);

  return (
    <section className="settings-panel" aria-label="Настройки">
      <h3 className="panel-title">Вид</h3>
      <Switch label="Орбиты" hint="Настоящие эллипсы на текущую дату" checked={s.showOrbits} onChange={v => update({ showOrbits: v })} />
      <Switch label="Подписи" hint="Названия тел в сцене" checked={s.showLabels} onChange={v => update({ showLabels: v })} />
      <Switch label="Пояс астероидов" hint="7000 тел со своими орбитами" checked={s.showAsteroids} onChange={v => update({ showAsteroids: v })} />
      <Switch label="Созвездия" hint="Линии и названия по каталогу МАС" checked={s.showConstellations} onChange={v => update({ showConstellations: v })} />

      <h3 className="panel-title">Плёнка и объектив</h3>
      <Segmented<FilmIntensity> label="Сила помех" value={s.film} onChange={v => update({ film: v })}
        options={[{ value: 'off', label: 'Выкл' }, { value: 'soft', label: 'Мягко' }, { value: 'strong', label: 'Сильно' }]} />

      <h3 className="panel-title">События</h3>
      <Switch label="Сами по себе" hint="Случайный сценарий после паузы" checked={s.autoEvents} onChange={v => update({ autoEvents: v })} />
      <Segmented<number> label="Пауза между событиями" value={s.autoInterval} onChange={v => update({ autoInterval: v })}
        options={[{ value: 60, label: '1 мин' }, { value: 120, label: '2 мин' }, { value: 300, label: '5 мин' }]} />

      <h3 className="panel-title">Качество</h3>
      <Segmented<QualityMode> label="Качество отрисовки" value={s.quality} onChange={v => update({ quality: v })}
        options={[{ value: 'auto', label: 'Авто' }, { value: 'high', label: 'Высокое' }, { value: 'low', label: 'Экономное' }]} />
    </section>
  );
}
