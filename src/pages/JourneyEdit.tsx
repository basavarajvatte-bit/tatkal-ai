import { useMemo, useState } from 'react';
import type { Berth, ClassCode, Gender, Journey, Passenger, Quota, Train } from '../lib/types';
import { blankJourney, getData, saveJourney, uid, opening } from '../lib/store';
import { CLASSES, fmtDate, fmtHour, isValidISODate, istDate, addDays } from '../lib/time';
import { clean, journeyErrors, MAX_TATKAL_PASSENGERS, passengerErrors, trainErrors } from '../lib/validate';
import { now } from '../lib/clock';
import { Card } from '../components/ui';

const BERTHS: { v: Berth; l: string }[] = [
  { v: 'NP', l: 'No preference' },
  { v: 'LB', l: 'Lower' },
  { v: 'MB', l: 'Middle' },
  { v: 'UB', l: 'Upper' },
  { v: 'SL', l: 'Side lower' },
  { v: 'SU', l: 'Side upper' },
  { v: 'WS', l: 'Window (chair car)' },
];
const QUOTAS: { v: Quota; l: string }[] = [
  { v: 'TQ', l: 'Tatkal (TQ)' },
  { v: 'PT', l: 'Premium Tatkal (PT)' },
  { v: 'GN', l: 'General (GN)' },
];

const blankTrain = (): Train => ({ number: '', name: '', dep: '', arr: '', arrDays: 0, route: '' });

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <em className="err">{error}</em>}
    </label>
  );
}

export default function JourneyEdit({ id }: { id: string }) {
  const initial = useMemo<Journey | null>(() => {
    if (id === 'new') return blankJourney();
    const found = getData().journeys.find((x) => x.id === id);
    return found ? structuredClone(found) : null;
  }, [id]);
  const [j, setJ] = useState<Journey | null>(initial);
  const [tried, setTried] = useState(false);

  if (!j) return <Card><p>Journey not found.</p><a href="#/journeys">Back</a></Card>;

  const set = (patch: Partial<Journey>) => setJ({ ...j, ...patch });
  const setP = (i: number, patch: Partial<Passenger>) => set({ passengers: j.passengers.map((p, k) => (k === i ? { ...p, ...patch } : p)) });
  const setT = (i: number, patch: Partial<Train>) => set({ trains: j.trains.map((t, k) => (k === i ? { ...t, ...patch } : t)) });
  const moveT = (i: number, d: -1 | 1) => {
    const arr = [...j.trains];
    const k = i + d;
    if (k < 0 || k >= arr.length) return;
    [arr[i], arr[k]] = [arr[k], arr[i]];
    set({ trains: arr });
  };

  const errs = journeyErrors(j);
  const pErrs = j.passengers.map(passengerErrors);
  const tErrs = j.trains.map(trainErrors);
  const today = istDate(now());
  const o = isValidISODate(j.journeyDate) ? opening(j) : null;
  const pastOpen = o && o.epoch < now();

  const save = () => {
    setTried(true);
    if (Object.keys(errs).length || tErrs.some((e) => e.length)) {
      document.querySelector('.err')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // Passenger issues don't block saving; readiness shows them.
    saveJourney({
      ...j,
      label: clean(j.label),
      from: clean(j.from).toUpperCase(),
      to: clean(j.to).toUpperCase(),
      boarding: clean(j.boarding).toUpperCase(),
      passengers: j.passengers.map((p) => ({ ...p, name: clean(p.name, 16) })),
      trains: j.trains.map((t) => ({ ...t, name: clean(t.name, 50), route: clean(t.route ?? '', 120) })),
      updatedAt: Date.now(),
    });
    location.hash = '#/journeys';
  };

  return (
    <div className="stack">
      <div className="row between">
        <h1>{id === 'new' ? 'New journey' : 'Edit journey'}</h1>
        <a className="link" href="#/journeys">Cancel</a>
      </div>

      <Card title="Journey">
        <Field label="Name (optional)">
          <input value={j.label} maxLength={40} placeholder="e.g. Home trip" onChange={(e) => set({ label: e.target.value })} />
        </Field>
        <div className="grid2">
          <Field label="From station *" error={tried ? errs.from : undefined}>
            <input value={j.from} maxLength={40} placeholder="MUMBAI CSMT (CSMT)" autoCapitalize="characters" onChange={(e) => set({ from: e.target.value })} />
          </Field>
          <Field label="To station *" error={tried ? errs.to : undefined}>
            <input value={j.to} maxLength={40} placeholder="SOLAPUR (SUR)" autoCapitalize="characters" onChange={(e) => set({ to: e.target.value })} />
          </Field>
        </div>
        <div className="grid2">
          <Field label="Journey date *" error={tried ? errs.journeyDate : undefined}>
            <input type="date" value={j.journeyDate} min={today} max={addDays(today, 120)} onChange={(e) => set({ journeyDate: e.target.value })} />
          </Field>
          <Field label="Boarding station">
            <input value={j.boarding} maxLength={40} placeholder="Same as From" autoCapitalize="characters" onChange={(e) => set({ boarding: e.target.value })} />
          </Field>
        </div>
        <div className="grid2">
          <Field label="Class *">
            <select value={j.travelClass} onChange={(e) => set({ travelClass: e.target.value as ClassCode })}>
              {CLASSES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Quota">
            <select value={j.quota} onChange={(e) => set({ quota: e.target.value as Quota })}>
              {QUOTAS.map((q) => <option key={q.v} value={q.v}>{q.l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Train reaches my boarding station on" error={tried ? errs.boardingDay : undefined}>
          <select value={j.boardingDay} onChange={(e) => set({ boardingDay: +e.target.value })}>
            <option value={1}>Day 1 – same day it starts (most common)</option>
            <option value={2}>Day 2 – train started the previous day</option>
            <option value={3}>Day 3</option>
            <option value={4}>Day 4</option>
          </select>
        </Field>
        {o && (
          <div className={`note ${pastOpen ? 'note-warn' : ''}`}>
            Tatkal opens <b>{fmtDate(o.openDate)}, {fmtHour(o.hour)} IST</b>
            {pastOpen && ' – this time has already passed.'}
            <div className="muted small">Counted from the train's start date at its origin station.</div>
          </div>
        )}
      </Card>

      <Card title={`Trains (${j.trains.length}/4)`} right={j.trains.length < 4 && <button className="btn btn-sm" onClick={() => set({ trains: [...j.trains, blankTrain()] })}>+ Add</button>}>
        <p className="muted small">First = preferred, rest = backups. Copy details from the official IRCTC / NTES timetable.</p>
        {j.trains.map((t, i) => (
          <div className="subcard" key={i}>
            <div className="row between">
              <span className="chip">{i === 0 ? 'Preferred' : `Backup ${i}`}</span>
              <div className="row gap">
                <button className="btn btn-xs" disabled={i === 0} onClick={() => moveT(i, -1)} aria-label="Move up">↑</button>
                <button className="btn btn-xs" disabled={i === j.trains.length - 1} onClick={() => moveT(i, 1)} aria-label="Move down">↓</button>
                <button className="btn btn-xs btn-danger" onClick={() => set({ trains: j.trains.filter((_, k) => k !== i) })}>Remove</button>
              </div>
            </div>
            <div className="grid2">
              <Field label="Train no.">
                <input inputMode="numeric" maxLength={5} value={t.number} placeholder="12115" onChange={(e) => setT(i, { number: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label="Train name">
                <input value={t.name} maxLength={50} placeholder="Siddheshwar Exp" onChange={(e) => setT(i, { name: e.target.value })} />
              </Field>
            </div>
            <div className="grid3">
              <Field label="Departs"><input type="time" value={t.dep} onChange={(e) => setT(i, { dep: e.target.value })} /></Field>
              <Field label="Arrives"><input type="time" value={t.arr} onChange={(e) => setT(i, { arr: e.target.value })} /></Field>
              <Field label="+days">
                <select value={t.arrDays} onChange={(e) => setT(i, { arrDays: +e.target.value })}>
                  <option value={0}>Same</option><option value={1}>+1</option><option value={2}>+2</option><option value={3}>+3</option>
                </select>
              </Field>
            </div>
            <Field label="Route / note (optional)"><input value={t.route ?? ''} maxLength={120} onChange={(e) => setT(i, { route: e.target.value })} /></Field>
            {tried && tErrs[i].map((e) => <em key={e} className="err">{e}</em>)}
          </div>
        ))}
      </Card>

      <Card
        title={`Passengers (${j.passengers.length}/${MAX_TATKAL_PASSENGERS})`}
        right={j.passengers.length < MAX_TATKAL_PASSENGERS && (
          <button className="btn btn-sm" onClick={() => set({ passengers: [...j.passengers, { id: uid(), name: '', age: null, gender: '', berth: 'NP' }] })}>+ Add</button>
        )}
      >
        <p className="muted small">Name exactly as on ID proof. Saved only on this device.</p>
        {errs.passengers && <em className="err">{errs.passengers}</em>}
        {j.passengers.map((p, i) => (
          <div className="subcard" key={p.id}>
            <div className="row between">
              <span className="chip chip-muted">Passenger {i + 1}</span>
              {j.passengers.length > 1 && <button className="btn btn-xs btn-danger" onClick={() => set({ passengers: j.passengers.filter((_, k) => k !== i) })}>Remove</button>}
            </div>
            <Field label="Full name">
              <input value={p.name} maxLength={16} autoComplete="off" onChange={(e) => setP(i, { name: e.target.value })} />
            </Field>
            <div className="grid3">
              <Field label="Age">
                <input inputMode="numeric" maxLength={3} value={p.age ?? ''} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setP(i, { age: v ? +v : null }); }} />
              </Field>
              <Field label="Gender">
                <select value={p.gender} onChange={(e) => setP(i, { gender: e.target.value as Gender })}>
                  <option value="">—</option><option value="M">Male</option><option value="F">Female</option><option value="T">Transgender</option>
                </select>
              </Field>
              <Field label="Berth">
                <select value={p.berth} onChange={(e) => setP(i, { berth: e.target.value as Berth })}>
                  {BERTHS.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Food / other (optional)">
              <input value={p.food ?? ''} maxLength={30} placeholder="Veg / No food" onChange={(e) => setP(i, { food: e.target.value })} />
            </Field>
            {pErrs[i].length > 0 && (tried || p.name) && <em className="err soft">{pErrs[i].join(' · ')}</em>}
          </div>
        ))}
      </Card>

      <Card title="Before booking day">
        {(['irctcAccount', 'aadhaar', 'payment'] as const).map((k) => (
          <label key={k} className="check">
            <input type="checkbox" checked={j.checks[k]} onChange={(e) => set({ checks: { ...j.checks, [k]: e.target.checked } })} />
            <span>{k === 'irctcAccount' ? 'I can log in to my IRCTC account' : k === 'aadhaar' ? 'My IRCTC account is Aadhaar-verified (needed for Tatkal)' : 'My UPI / card payment is ready'}</span>
          </label>
        ))}
        <label className="check">
          <input type="checkbox" checked={j.isDefault} onChange={(e) => set({ isDefault: e.target.checked })} />
          <span>Set as default journey</span>
        </label>
        <p className="muted small">Tatkal AI never asks for or stores passwords, OTPs, CVV, UPI PIN or Aadhaar numbers.</p>
      </Card>

      <div className="sticky-save">
        <button className="btn btn-primary btn-block btn-lg" onClick={save}>Save journey</button>
      </div>
    </div>
  );
}
