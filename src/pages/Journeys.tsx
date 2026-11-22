import { useData, opening, deleteJourney, duplicateJourney, setDefaultJourney, setJourneyActive } from '../lib/store';
import { fmtDate, fmtHour, istDate } from '../lib/time';
import { now } from '../lib/clock';
import { Card, Empty, JourneyLine } from '../components/ui';

export default function Journeys() {
  const { journeys } = useData();
  const today = istDate(now());
  const sorted = [...journeys].sort((a, b) => (a.journeyDate < today ? 1 : 0) - (b.journeyDate < today ? 1 : 0) || a.journeyDate.localeCompare(b.journeyDate));

  return (
    <div className="stack">
      <div className="row between">
        <h1>My Journeys</h1>
        <a className="btn btn-primary" href="#/trains">+ New</a>
      </div>
      {!sorted.length && <Card><Empty text="No journeys saved yet." /></Card>}
      {sorted.map((j) => {
        const o = opening(j);
        const past = j.journeyDate && j.journeyDate < today;
        const off = j.active === false;
        return (
          <Card key={j.id} className={past || off ? 'dim' : ''}>
            <div className="row between">
              <span className="strong">{j.label || `${j.from} → ${j.to}`}</span>
              {j.isDefault && <span className="chip">Default</span>}
              {past && <span className="chip chip-muted">Past</span>}
              {off && <span className="chip chip-muted">Off</span>}
            </div>
            <JourneyLine j={j} />
            <div className="muted small">
              Travel {fmtDate(j.journeyDate)} · Opens {j.journeyDate ? `${fmtDate(o.openDate)} ${fmtHour(o.hour)}` : '—'} · {j.passengers.length} pax · {j.trains.some((t) => t.number) ? `Train ${j.trains.map((t) => t.number).filter(Boolean).join(', ')}` : '0 train(s)'}
            </div>
            <div className="actions">
              <a className="btn btn-sm" href={`#/booking/${j.id}`}>Book mode</a>
              <a className="btn btn-sm" href={`#/journeys/${j.id}`}>Edit</a>
              <button
                className="btn btn-sm"
                onClick={() => {
                  const id = duplicateJourney(j.id);
                  if (id) location.hash = `#/journeys/${id}`;
                }}
              >
                Duplicate
              </button>
              <button className="btn btn-sm" onClick={() => setJourneyActive(j.id, off)}>{off ? 'Activate' : 'Deactivate'}</button>
              {!j.isDefault && <button className="btn btn-sm" onClick={() => setDefaultJourney(j.id)}>Set default</button>}
              <button className="btn btn-sm btn-danger" onClick={() => confirm('Delete this journey?') && deleteJourney(j.id)}>Delete</button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
