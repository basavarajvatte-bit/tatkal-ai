import { useState } from 'react';
import { useData, focusJourney, opening } from '../lib/store';
import { fmtDate, fmtHour, istClock, classLabel } from '../lib/time';
import { useNow, useWakeLock } from '../lib/hooks';
import { Countdown } from '../components/Countdown';
import { Card, Empty, JourneyLine, OpenIrctcButton, SyncStatus, TrainRow } from '../components/ui';
import { ReadinessList } from '../components/Readiness';
import { toast } from '../lib/notify';
import type { Journey } from '../lib/types';

/** Stage by minutes left (works for 10:00 AC and 11:00 non-AC alike). */
function stage(msLeft: number) {
  const m = msLeft / 60_000;
  if (msLeft <= 0) return { key: 'open', text: 'Booking window is OPEN – go!' };
  if (m <= 1) return { key: 'go', text: 'Open IRCTC now and stay on the booking page' };
  if (m <= 2) return { key: 'count', text: 'Final countdown – log in to IRCTC' };
  if (m <= 5) return { key: 'report', text: 'Final readiness report' };
  if (m <= 10) return { key: 'check', text: 'Preparation checklist' };
  return { key: 'early', text: 'Get ready before the window opens' };
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copied`);
  } catch {
    toast('Copy not allowed by browser');
  }
}

const passengerText = (j: Journey) =>
  j.passengers.map((p, i) => `${i + 1}. ${p.name}, ${p.age ?? '?'}, ${p.gender || '?'}, ${p.berth}${p.food ? `, ${p.food}` : ''}`).join('\n');

export default function Booking({ id }: { id?: string }) {
  const data = useData();
  const j = (id && data.journeys.find((x) => x.id === id)) || focusJourney(data.journeys);
  const t = useNow(1000);
  const [active, setActive] = useState(0);
  useWakeLock(!!j);

  if (!j) return <Card><Empty text="No upcoming journey." action={<a className="btn btn-primary" href="#/journeys/new">+ Create journey</a>} /></Card>;

  const o = opening(j);
  const left = o.epoch - t;
  const s = stage(left);
  const train = j.trains[active] ?? j.trains[0];
  const bigCountdown = left <= 2 * 60_000 || s.key === 'early';

  return (
    <div className={`stack booking stage-${s.key}`}>
      <div className="row between">
        <h1>Booking Assistant</h1>
        <span className="mono small">IST {istClock(t)}</span>
      </div>

      <Card className="hero">
        <JourneyLine j={j} />
        <div className="muted small">{fmtDate(j.journeyDate)} · {classLabel(j.travelClass)} · Opens {fmtDate(o.openDate)} {fmtHour(o.hour)} IST</div>
        <div className={`stage-banner sb-${s.key}`}>{s.text}</div>
        <Countdown target={o.epoch} size={bigCountdown ? 'xl' : 'lg'} />
        <OpenIrctcButton big pulse={left <= 60_000} />
        <SyncStatus />
      </Card>

      {train && (
        <Card title="Selected train" right={<button className="btn btn-sm" onClick={() => copy(train.number, 'Train number')}>Copy no.</button>}>
          <TrainRow t={train} tag={active === 0 ? 'Preferred' : `Backup ${active}`} />
        </Card>
      )}

      {j.trains.length > 1 && (
        <Card title="Primary full? Switch instantly">
          <p className="muted small">Tap a backup – details stay ready. Tatkal AI never books on its own.</p>
          <div className="seg wrap">
            {j.trains.map((tr, i) => (
              <button key={i} className={i === active ? 'on' : ''} onClick={() => setActive(i)}>
                {i === 0 ? '★ ' : ''}{tr.number || `Train ${i + 1}`}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card title={`Passengers (${j.passengers.length})`} right={<button className="btn btn-sm" onClick={() => copy(passengerText(j), 'Passenger list')}>Copy all</button>}>
        <ol className="pax">
          {j.passengers.map((p) => (
            <li key={p.id}>
              <span className="strong">{p.name || '—'}</span>
              <span className="muted">{p.age ?? '?'} · {p.gender || '?'} · {p.berth}{p.food ? ` · ${p.food}` : ''}</span>
            </li>
          ))}
        </ol>
        <p className="muted small">On IRCTC use “Add from Master List” for the fastest entry. Enter OTP, CAPTCHA and payment yourself.</p>
      </Card>

      <Card title={s.key === 'report' || s.key === 'count' || s.key === 'go' ? 'Final readiness report' : 'Preparation checklist'}>
        <ReadinessList j={j} />
      </Card>

      {left <= 0 && (
        <Card title="After booking">
          <p className="small">Got a PNR (or it failed)? Record it so you have the real status.</p>
          <a className="btn btn-block" href="#/history">Record result</a>
        </Card>
      )}
    </div>
  );
}
