import { useEffect, useState } from 'react';
import { searchTrain, fmtRunDays, type SearchResult } from '../lib/trainData';
import { classLabel, fmtDuration } from '../lib/time';
import { Card, Empty } from '../components/ui';
import { TrainSearch } from '../components/TrainSearch';

export const NTES_URL = 'https://enquiry.indianrail.gov.in/mntes/';

function fmtWhen(epoch: number) {
  return new Date(epoch).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** What to do when the automatic lookup can't help. */
function Fallback({ no }: { no: string }) {
  return (
    <div className="grid2 mt">
      <a className="btn" href={NTES_URL} target="_blank" rel="noopener noreferrer">NTES pe dekho ↗</a>
      <a className="btn" href={`#/journeys/new?train=${no}`}>Khud bharo</a>
    </div>
  );
}

export default function TrainDetails({ no }: { no: string }) {
  const [res, setRes] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = (force = false) => {
    setLoading(true);
    void searchTrain(no, force).then((r) => {
      setRes(r);
      setLoading(false);
    });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => load(), [no]);

  if (loading && !res) return <div className="stack"><TrainSearch initial={no} /><div className="loading">Train {no} dhundh rahe hain…</div></div>;

  const t = res?.train;
  const err = res?.error;

  if (!t)
    return (
      <div className="stack">
        <TrainSearch initial={no} />
        <Card>
          {err?.code === 'NOT_FOUND' || err?.code === 'INVALID' ? (
            <Empty text={err.code === 'NOT_FOUND' ? `TRAIN NOT FOUND. ${no} number ki koi train nahi mili – number check karo.` : err.message} />
          ) : (
            <>
              <h2>Details abhi nahi mil payi</h2>
              <p className="small">
                {err?.code === 'NO_KEY'
                  ? 'Train search ki key abhi nahi daali gayi hai. Settings mein RailRadar key daalo.'
                  : err?.code === 'LIMIT'
                    ? 'Is mahine ki free search limit khatam ho gayi.'
                    : err?.code === 'KEY_REJECTED'
                      ? 'RailRadar key galat hai ya band ho gayi hai. Settings mein sahi key daalo.'
                      : err?.message ?? 'Kuch gadbad hui.'}
              </p>
              <p className="muted small">Official NTES site pe train dekho, phir journey khud bhar lo.</p>
              {(err?.code === 'NO_KEY' || err?.code === 'KEY_REJECTED') && <a className="btn btn-primary btn-block mb" href="#/settings">Settings mein key daalo</a>}
              <button className="btn btn-sm" onClick={() => load(true)} disabled={loading}>{loading ? 'Try ho raha hai…' : 'Phir se try karo'}</button>
            </>
          )}
          <Fallback no={no} />
        </Card>
      </div>
    );

  const first = t.stops[0];
  const last = t.stops[t.stops.length - 1];

  return (
    <div className="stack">
      <TrainSearch initial={no} />

      {res?.fromCache && err && (
        <div className={`note ${res.stale ? 'note-warn' : ''}`}>
          Phone mein save ki hui copy dikha rahe hain ({fmtWhen(t.fetchedAt)}). {err.message}.
          {res.stale && ' Ye purani hai – timetable badal sakta hai, NTES pe zaroor check karo.'}
        </div>
      )}

      <Card className="hero">
        <div className="eyebrow">{t.number}</div>
        <h1>{t.name}</h1>
        <div className="jline">
          <span className="strong">{t.from.name}</span>
          <span className="arrow">→</span>
          <span className="strong">{t.to.name}</span>
        </div>
        <dl className="facts">
          <div><dt>Departure</dt><dd>{first.dep ?? '—'} ({first.code})</dd></div>
          <div><dt>Arrival</dt><dd>{last.arr ?? '—'}{last.arrDay > 1 ? ` (day ${last.arrDay})` : ''} ({last.code})</dd></div>
          <div><dt>Journey duration</dt><dd>{fmtDuration(t.durationMin)}</dd></div>
          <div><dt>Distance</dt><dd>{t.distanceKm != null ? `${Math.round(t.distanceKm)} km` : '—'}</dd></div>
          <div><dt>Running days</dt><dd>{fmtRunDays(t.runDays)}</dd></div>
          <div><dt>Type</dt><dd>{[t.type, t.category].filter(Boolean).join(' · ') || '—'}</dd></div>
          {t.pantry != null && <div><dt>Pantry</dt><dd>{t.pantry ? 'Yes' : 'No'}</dd></div>}
        </dl>
      </Card>

      <Card title="Available classes">
        {t.classes.length ? (
          <div className="chips">{t.classes.map((c) => <span key={c} className="chip">{classLabel(c)}</span>)}</div>
        ) : (
          <p className="muted small">Class ki jaankari nahi mili. IRCTC pe check karo.</p>
        )}
      </Card>

      <Card title={`Complete train route (${t.stops.length} stops)`}>
        <p className="muted small">Ye <b>scheduled timetable</b> hai, live status nahi. Platform badal sakta hai.</p>
        <div className="route" role="table" aria-label="Route">
          <div className="stop stop-h" role="row">
            <span>Station</span><span>Arr</span><span>Dep</span><span>Halt</span><span>Day</span><span>Km</span>
          </div>
          {t.stops.map((s, i) => (
            <div className="stop" role="row" key={`${s.code}-${i}`}>
              <span className="stop-name">
                <b className="mono">{s.code}</b> {s.name}
                {s.platform && <span className="muted small"> · PF {s.platform}</span>}
              </span>
              <span className="mono">{s.arr ?? 'Start'}</span>
              <span className="mono">{s.dep ?? 'End'}</span>
              <span className="mono">{s.halt != null ? `${s.halt}m` : '—'}</span>
              <span className="mono">{s.day}</span>
              <span className="mono">{s.distance != null ? Math.round(s.distance) : '—'}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Live running status">
        <p className="small">Live location aur late hone ki jaankari official NTES pe dekho.</p>
        <a className="btn btn-block" href={NTES_URL} target="_blank" rel="noopener noreferrer">NTES live status ↗</a>
      </Card>

      <p className="muted small center">
        Source: {t.source} · Updated {fmtWhen(t.fetchedAt)}
        {!loading && <> · <button className="linkbtn" onClick={() => load(true)}>Refresh</button></>}
      </p>

      <div className="sticky-save">
        <a className="btn btn-primary btn-block btn-lg" href={`#/plan/${t.number}`}>BOOK THIS TRAIN</a>
      </div>
    </div>
  );
}
