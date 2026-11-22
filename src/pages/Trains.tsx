import { useState } from 'react';
import { useData, focusJourney } from '../lib/store';
import { sortTrains, smartScore, type SortMode } from '../lib/rank';
import { fmtDate } from '../lib/time';
import { Card, Empty, IRCTC_URL, TrainRow } from '../components/ui';

const NTES_URL = 'https://enquiry.indianrail.gov.in/mntes/';

const MODES: { v: SortMode; l: string }[] = [
  { v: 'preference', l: 'My order' },
  { v: 'fastest', l: 'Fastest' },
  { v: 'earliest', l: 'Earliest dep.' },
  { v: 'arrival', l: 'Best arrival' },
];

export default function Trains() {
  const data = useData();
  const focus = focusJourney(data.journeys);
  const [jid, setJid] = useState(focus?.id ?? data.journeys[0]?.id ?? '');
  const [mode, setMode] = useState<SortMode>('preference');
  const j = data.journeys.find((x) => x.id === jid) ?? null;
  const pref = data.settings.preferredArrival;

  return (
    <div className="stack">
      <h1>Find Trains</h1>

      <Card title="Search official sources">
        <p className="small">
          There is no free official public API for live seats. To stay accurate, Tatkal AI <b>never shows availability it cannot verify</b>.
          Search on the official sites, then save your chosen trains in the journey.
        </p>
        <div className="grid2">
          <a className="btn" href={IRCTC_URL} target="_blank" rel="noopener noreferrer">IRCTC search ↗</a>
          <a className="btn" href={NTES_URL} target="_blank" rel="noopener noreferrer">NTES timetable ↗</a>
        </div>
      </Card>

      {!data.journeys.length ? (
        <Card><Empty text="Save a journey first to compare its trains." action={<a className="btn btn-primary" href="#/journeys/new">+ Create journey</a>} /></Card>
      ) : (
        <Card title="Compare my trains">
          <label className="field">
            <span>Journey</span>
            <select value={jid} onChange={(e) => setJid(e.target.value)}>
              {data.journeys.map((x) => (
                <option key={x.id} value={x.id}>{x.label || `${x.from} → ${x.to}`} · {fmtDate(x.journeyDate)}</option>
              ))}
            </select>
          </label>
          <div className="seg" role="tablist">
            {MODES.map((m) => (
              <button key={m.v} role="tab" aria-selected={mode === m.v} className={mode === m.v ? 'on' : ''} onClick={() => setMode(m.v)}>{m.l}</button>
            ))}
          </div>
          {mode === 'arrival' && <p className="muted small">Preferred arrival {pref} (change in Settings).</p>}
          {j && j.trains.length ? (
            sortTrains(j.trains, mode, pref).map((t) => {
              const idx = j.trains.indexOf(t);
              return <TrainRow key={idx} t={t} tag={idx === 0 ? 'Preferred' : `Backup ${idx}`} score={smartScore(t, j.trains, pref)} />;
            })
          ) : (
            <Empty text="No trains in this journey." action={j && <a className="btn btn-sm" href={`#/journeys/${j.id}`}>Add trains</a>} />
          )}
          <p className="muted small">Score = 60% speed + 40% closeness to preferred arrival. Times are as you saved them – re-check on NTES for changes.</p>
        </Card>
      )}
    </div>
  );
}
