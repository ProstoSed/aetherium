import { Play, ScrollText, X } from 'lucide-react';
import { useState } from 'react';
import { EVENTS, INTENSITY_CLASS, type EventInfo } from '../../data/events';
import { useI18n } from '../../i18n';
import { formatDate } from '../../i18n/format';
import { useObservatory, useObservatoryState } from '../observatoryContext';
import { EventIcon } from './EventIcon';

type Tab = 'scenarios' | 'chronicle';

/** Каталог сценариев и хроника текущего сеанса. */
export function EventsSheet({ onClose }: { onClose: () => void }) {
  const observatory = useObservatory();
  const { t } = useI18n();
  const active = useObservatoryState(s => s.activeEvent);
  const history = useObservatoryState(s => s.history);
  const [tab, setTab] = useState<Tab>('scenarios');

  const launch = (event: EventInfo) => {
    observatory.startEvent(event.id);
    onClose();
  };

  return (
    <section className="events-sheet" role="dialog" aria-modal="false" aria-label={t.eventsUi.title}>
      <header className="sheet-header">
        <div className="sheet-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'scenarios'} className={tab === 'scenarios' ? 'is-active' : ''} onClick={() => setTab('scenarios')}>
            {t.eventsUi.scenarios}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'chronicle'} className={tab === 'chronicle' ? 'is-active' : ''} onClick={() => setTab('chronicle')}>
            {t.eventsUi.chronicle} {history.length > 0 && <span className="tab-count numeric">{history.length}</span>}
          </button>
        </div>
        <button type="button" className="sheet-close" aria-label={t.eventsUi.close} onClick={onClose}>
          <X size={18} strokeWidth={1.6} />
        </button>
      </header>

      {tab === 'scenarios' ? (
        <div className="event-grid">
          {EVENTS.map((event, index) => (
            <button
              key={event.id}
              type="button"
              className={`event-card event-${event.id} intensity-${INTENSITY_CLASS[event.intensity]} ${active === event.id ? 'is-running' : ''}`}
              style={{ '--stagger': index } as React.CSSProperties}
              onClick={() => launch(event)}
            >
              <span className="event-art" aria-hidden="true"><i /><b /><em /></span>
              <span className="event-card-body">
                <span className="event-card-top">
                  <EventIcon icon={event.icon} size={15} />
                  <span className="event-intensity">{t.intensity[event.intensity]}</span>
                  <span className="event-duration numeric">{t.units.seconds(event.durationSec)}</span>
                </span>
                <strong className="event-card-name">{t.events[event.id].name}</strong>
                <span className="event-card-text">{t.events[event.id].description}</span>
              </span>
              <span className="event-card-play" aria-hidden="true"><Play size={13} fill="currentColor" strokeWidth={0} /></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="chronicle">
          {history.length === 0 ? (
            <div className="chronicle-empty">
              <ScrollText size={28} strokeWidth={1.2} />
              <p>{t.eventsUi.chronicleEmpty}</p>
            </div>
          ) : (
            <>
              <ol className="chronicle-list">
                {history.map(entry => {
                  const event = t.events[entry.eventId];
                  return (
                    <li key={entry.key}>
                      <time>{formatDate(t, entry.julianDate)}</time>
                      <strong>{entry.outcome === 'started' ? event.name : t.eventsUi[entry.outcome](event.name)}</strong>
                      <span>{entry.outcome === 'started' ? event.description : t.eventsUi.orbitsRestored}</span>
                    </li>
                  );
                })}
              </ol>
              <button type="button" className="text-button" onClick={() => observatory.clearHistory()}>{t.eventsUi.clearChronicle}</button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
