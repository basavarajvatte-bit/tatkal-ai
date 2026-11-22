import { useMemo, useState } from 'react';
import type { ClassCode, Journey, Quota } from '../lib/types';
import { getCachedTrain, runsOn } from '../lib/trainData';
import { useData, getData, saveJourney, saveGroup, uid } from '../lib/store';
import { CLASSES, addDays, classLabel, fmtDate, fmtHour, istDate, isValidISODate, tatkalOpening } from '../lib/time';
import { MAX_TATKAL_PASSENGERS, passengerErrors, clean } from '../lib/validate';
import { berthLabel } from '../lib/labels';
import { now } from '../lib/clock';
import { Card, Empty } from '../components/ui';

/** "BOOK THIS TRAIN" form: date, stations from the real route, class, quota, passengers → saved booking plan. */
export default function PlanNew({ no }: { no: string }) {
  const train = useMemo(() => getCachedTrain(no), [no]);
  const { profiles, groups } = useData();
  const today = istDate(now());
  const stops = train?.stops ?? [];

  const [date, setDate] = useState('');
  const [bi, setBi] = useState(0);
  const [di, setDi] = useState(Math.max(1, stops.length - 1));
  const [cls, setCls] = useState<ClassCode>(train?.classes.includes('SL') ? 'SL' : train?.classes[0] ?? 'SL');
  const [quota, setQuota] = useState<Quota>('TQ');
  const [sel, setSel] = useState<string[]>([]);
  const [groupId, setGroupId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [tried, setTried] = useState(false);

  if (!train)
    return (
      <Card>
        <Empty text={`Train ${no} ki details phone mein nahi hain. Pehle train search karo.`} action={<a className="btn btn-primary" href={`#/train/${no}`}>Search {no}</a>} />
      </Card>
    );

  const board = stops[bi];
  const dest = stops[di];
  const classes = train.classes.length ? train.classes : CLASSES.map((c) => c.code);
  const active = profiles.filter((p) => p.active);
  const chosen = sel.map((id) => profiles.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);

  const dateOk = isValidISODate(date);
  const startDate = dateOk ? addDays(date, -(board.day - 1)) : '';
  const runs = dateOk ? runsOn(train, startDate) : null;
  const o = dateOk ? tatkalOpening(date, cls, board.day) : null;
  const pastOpen = o && o.epoch < now();

  const errs: Record<string, string> = {};
  if (!dateOk) errs.date = 'Date chuno';
  else if (runs === false) errs.date = `Ye train ${fmtDate(startDate)} ko apne pehle station se nahi chalti`;
  if (di <= bi) errs.dest = 'Destination boarding ke baad wala station hona chahiye';
  if (!chosen.length) errs.pax = 'Kam se kam 1 passenger chuno';
  if (chosen.length > MAX_TATKAL_PASSENGERS) errs.pax = `Tatkal mein max ${MAX_TATKAL_PASSENGERS} passenger`;
  const badPax = chosen.filter((p) => passengerErrors(p).length);

  const toggle = (id: string) => {
    setGroupId('');
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_TATKAL_PASSENGERS ? s : [...s, id]));
  };

  const applyGroup = (id: string) => {
    setGroupId(id);
    const g = groups.find((x) => x.id === id);
    if (g) setSel(g.profileIds.filter((pid) => profiles.some((p) => p.id === pid && p.active)).slice(0, MAX_TATKAL_PASSENGERS));
  };

  const addGroup = () => {
    const name = clean(groupName, 30);
    if (!name || !sel.length) return;
    const g = { id: uid(), name, profileIds: [...sel] };
    saveGroup(g);
    setGroupId(g.id);
    setGroupName('');
  };

  const save = () => {
    setTried(true);
    if (Object.keys(errs).length) {
      document.querySelector('.err')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const j: Journey = {
      id: uid(),
      label: `${board.name} → ${dest.name}`.slice(0, 40),
      from: `${board.name} (${board.code})`.slice(0, 40).toUpperCase(),
      to: `${dest.name} (${dest.code})`.slice(0, 40).toUpperCase(),
      boarding: '',
      journeyDate: date,
      boardingDay: board.day,
      travelClass: cls,
      quota,
      trains: [
        {
          number: train.number,
          name: train.name.slice(0, 50),
          dep: board.dep ?? '',
          arr: dest.arr ?? '',
          arrDays: Math.max(0, dest.arrDay - board.day),
          route: `${train.from.code} → ${train.to.code}`,
        },
      ],
      passengers: chosen.map((p) => ({ id: uid(), name: p.name, age: p.age, gender: p.gender, berth: p.berth, food: p.food })),
      profileIds: chosen.map((p) => p.id),
      groupId: groupId || undefined,
      checks: { irctcAccount: false, aadhaar: false, payment: false },
      isDefault: getData().journeys.length === 0,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveJourney(j);
    location.hash = '#/journeys';
  };

  return (
    <div className="stack">
      <div className="row between">
        <h1>Booking plan</h1>
        <a className="link" href={`#/train/${no}`}>Back</a>
      </div>

      <Card>
        <div className="eyebrow">{train.number}</div>
        <div className="strong">{train.name}</div>
      </Card>

      <Card title="Journey">
        <label className="field">
          <span>Journey date (boarding station se) *</span>
          <input type="date" value={date} min={today} max={addDays(today, 120)} onChange={(e) => setDate(e.target.value)} />
          {tried && errs.date ? <em className="err">{errs.date}</em> : runs === false && <em className="err">{errs.date}</em>}
        </label>
        <label className="field">
          <span>Boarding station *</span>
          <select
            value={bi}
            onChange={(e) => {
              const v = +e.target.value;
              setBi(v);
              if (di <= v) setDi(Math.min(stops.length - 1, v + 1));
            }}
          >
            {stops.slice(0, -1).map((s, i) => (
              <option key={i} value={i}>{s.name} ({s.code}) · {s.dep ?? '—'}{s.day > 1 ? ` · day ${s.day}` : ''}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Destination station *</span>
          <select value={di} onChange={(e) => setDi(+e.target.value)}>
            {stops.map((s, i) => i > bi && (
              <option key={i} value={i}>{s.name} ({s.code}) · {s.arr ?? '—'}{s.arrDay > 1 ? ` · day ${s.arrDay}` : ''}</option>
            ))}
          </select>
          {tried && errs.dest && <em className="err">{errs.dest}</em>}
        </label>
        <div className="grid2">
          <label className="field">
            <span>Class *</span>
            <select value={cls} onChange={(e) => setCls(e.target.value as ClassCode)}>
              {classes.map((c) => <option key={c} value={c}>{classLabel(c)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Quota</span>
            <select value={quota} onChange={(e) => setQuota(e.target.value as Quota)}>
              <option value="TQ">Tatkal</option>
              <option value="PT">Premium Tatkal</option>
            </select>
          </label>
        </div>
        {!train.classes.length && <p className="muted small">Is train ki class list nahi mili, isliye saari classes dikha rahe hain. IRCTC pe check karo.</p>}
        {quota === 'PT' && <p className="muted small">Premium Tatkal sirf kuch trains mein hota hai. IRCTC pe quota list mein dikhe tabhi chunna.</p>}
        {o && (
          <div className={`note ${pastOpen ? 'note-warn' : ''}`}>
            Tatkal khulega: <b>{fmtDate(o.openDate)}, {fmtHour(o.hour)} IST</b>
            {pastOpen && ' – ye time nikal chuka hai.'}
            <div className="muted small">Train apne pehle station {train.from.code} se {fmtDate(o.trainStartDate)} ko chalti hai – usi se gina gaya hai.</div>
          </div>
        )}
      </Card>

      <Card title={`Select passengers (${chosen.length}/${MAX_TATKAL_PASSENGERS})`} right={<a className="link" href="#/passengers">Manage</a>}>
        {groups.length > 0 && (
          <label className="field">
            <span>Saved group</span>
            <select value={groupId} onChange={(e) => applyGroup(e.target.value)}>
              <option value="">— Group chuno —</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.profileIds.length})</option>)}
            </select>
          </label>
        )}
        {active.length ? (
          active.map((p) => (
            <label key={p.id} className="check">
              <input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} disabled={!sel.includes(p.id) && sel.length >= MAX_TATKAL_PASSENGERS} />
              <span>{p.name || 'No name'} · {p.age ?? '?'} · {p.gender || '?'} · {berthLabel(p.berth)}</span>
            </label>
          ))
        ) : (
          <Empty text="Koi saved passenger nahi hai." action={<a className="btn btn-sm" href="#/passengers">+ Passenger jodo</a>} />
        )}
        {tried && errs.pax && <em className="err">{errs.pax}</em>}
        {badPax.length > 0 && <em className="err soft">Details adhuri: {badPax.map((p) => p.name || 'No name').join(', ')} – People page pe theek karo</em>}
        {sel.length > 0 && (
          <div className="row gap mt">
            <input className="grow input-sm" placeholder="Group ka naam (Family)" maxLength={30} value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            <button className="btn btn-sm" onClick={addGroup} disabled={!groupName.trim()}>SAVE PASSENGER GROUP</button>
          </div>
        )}
      </Card>

      {chosen.length > 0 && dateOk && (
        <Card title="Summary">
          <dl className="facts">
            <div><dt>Train</dt><dd>{train.number}</dd></div>
            <div><dt>Date</dt><dd>{fmtDate(date)}</dd></div>
            <div><dt>From</dt><dd>{board.name}</dd></div>
            <div><dt>To</dt><dd>{dest.name}</dd></div>
            <div><dt>Class</dt><dd>{classLabel(cls)}</dd></div>
            <div><dt>Quota</dt><dd>{quota === 'TQ' ? 'Tatkal' : 'Premium Tatkal'}</dd></div>
          </dl>
          <ol className="small">{chosen.map((p) => <li key={p.id}>{p.name}</li>)}</ol>
          <p className="muted small">Booking IRCTC pe aap khud karoge. Wahan bhi yahi passengers chunna.</p>
        </Card>
      )}

      <div className="sticky-save">
        <button className="btn btn-primary btn-block btn-lg" onClick={save}>SAVE BOOKING PLAN</button>
      </div>
    </div>
  );
}
