import { useEffect, useMemo, useState } from 'react';
import type { BookingStatus } from '../lib/types';
import { useData, focusJourney, upcomingJourneys, opening, saveBooking, uid } from '../lib/store';
import { searchTrain, type TrainInfo } from '../lib/trainData';
import { planFindings, existingBooking, irctcAppUrl, isAndroid, PNR_URL, type Finding } from '../lib/agent';
import { classLabel, fmtDate, fmtHour, istClock } from '../lib/time';
import { useNow, useOnline, useWakeLock, useIrctcReachable, useClock } from '../lib/hooks';
import { askPermission, permission, toast } from '../lib/notify';
import { syncClock } from '../lib/clock';
import { Countdown } from '../components/Countdown';
import { Card, Empty, IRCTC_URL, TrainRow } from '../components/ui';

type Phase = { key: string; title: string; text: string };

function phase(msLeft: number): Phase {
  const m = msLeft / 60_000;
  if (msLeft <= 0) return { key: 'open', title: 'BOOKING KHUL GAYI', text: 'IRCTC kholo aur abhi book karo. CAPTCHA, OTP aur payment aap khud karoge.' };
  if (m <= 2) return { key: 'final', title: 'Final countdown', text: 'IRCTC mein login karke train search page pe ruko. 11:00 pe Book Now dabana.' };
  if (m <= 15) return { key: 'login', title: 'Ab login karo', text: 'IRCTC kholo aur login kar lo. Passenger list "Master List" mein ready rakho.' };
  if (m <= 45) return { key: 'ready', title: 'Taiyar ho jao', text: 'Phone charge, internet on, UPI app check kar lo.' };
  return { key: 'early', title: 'Agent nazar rakh raha hai', text: 'Sab check ho raha hai. Reminder time pe aayega – app khuli rakhna.' };
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copy ho gaya`);
  } catch {
    toast('Browser ne copy allow nahi kiya');
  }
}

const RESULTS: { v: BookingStatus; l: string; pnr: boolean }[] = [
  { v: 'CONFIRMED', l: 'Confirm mila', pnr: true },
  { v: 'RAC', l: 'RAC', pnr: true },
  { v: 'WL', l: 'Waiting', pnr: true },
  { v: 'PAYMENT_FAILED', l: 'Payment fail', pnr: false },
  { v: 'BOOKING_FAILED', l: 'Nahi hua', pnr: false },
];

function FindingRow({ f }: { f: Finding }) {
  return (
    <div className={`finding f-${f.level}`}>
      <span aria-hidden>{f.level === 'ok' ? '✓' : f.level === 'warn' ? '!' : '✕'}</span>
      <span className="grow">{f.text}</span>
      {f.fix && f.level !== 'ok' && <a className="btn btn-xs" href={f.fix.href}>{f.fix.label}</a>}
    </div>
  );
}

/** One screen that picks the next plan, checks everything, counts down and hands over to official IRCTC. */
export default function Agent({ id }: { id?: string }) {
  const data = useData();
  const t = useNow(1000);
  const online = useOnline();
  const clock = useClock();
  const [irctcOk, recheckIrctc] = useIrctcReachable(online);
  const upcoming = upcomingJourneys(data.journeys, t);
  const [pick, setPick] = useState(id ?? '');
  const j = data.journeys.find((x) => x.id === pick) ?? focusJourney(data.journeys, t);
  const [active, setActive] = useState(0);
  const [infos, setInfos] = useState<Record<string, TrainInfo | null>>({});
  const [checking, setChecking] = useState(false);
  const [perm, setPerm] = useState(permission());
  const [result, setResult] = useState<BookingStatus | null>(null);
  const [pnr, setPnr] = useState('');
  const [pnrErr, setPnrErr] = useState('');
  useWakeLock(!!j);

  const trainNos = j ? j.trains.map((x) => x.number).filter((n) => /^\d{5}$/.test(n)).join(',') : '';
  useEffect(() => {
    if (!trainNos) return;
    let live = true;
    setChecking(true);
    void Promise.all(trainNos.split(',').map(async (no) => [no, (await searchTrain(no)).train ?? null] as const)).then((pairs) => {
      if (!live) return;
      setInfos(Object.fromEntries(pairs));
      setChecking(false);
    });
    return () => {
      live = false;
    };
  }, [trainNos]);

  const findings = useMemo(() => (j ? planFindings(j, infos, data.bookings, t) : []), [j, infos, data.bookings, Math.floor(t / 60_000)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!j)
    return (
      <Card>
        <Empty text="Koi aane wali booking nahi hai. Pehle train search karke booking plan banao." action={<a className="btn btn-primary" href="#/trains">Train search karo</a>} />
      </Card>
    );

  const o = opening(j);
  const left = o.epoch - t;
  const ph = phase(left);
  const train = j.trains[active] ?? j.trains[0];
  const done = existingBooking(j, data.bookings);
  const blocks = findings.filter((f) => f.level === 'block');
  const warns = findings.filter((f) => f.level === 'warn');
  const oks = findings.filter((f) => f.level === 'ok');
  const env: Finding[] = [
    online ? { level: 'ok', text: 'Internet chal raha hai' } : { level: 'block', text: 'Internet band hai – WiFi / data on karo' },
    clock.source !== 'device' ? { level: 'ok', text: 'Ghadi server se mili hui hai' } : { level: 'warn', text: 'Ghadi server se sync nahi – Sync dabao' },
    irctcOk === false ? { level: 'warn', text: 'IRCTC site abhi nahi khul rahi – thodi der mein phir check karo' } : irctcOk ? { level: 'ok', text: 'IRCTC site khul rahi hai' } : { level: 'warn', text: 'IRCTC check ho raha hai…' },
  ];
  const paxText = j.passengers.map((p, i) => `${i + 1}. ${p.name}, ${p.age ?? '?'}, ${p.gender || '?'}, ${p.berth}`).join('\n');
  const android = isAndroid();

  const record = () => {
    if (!result) return;
    const need = RESULTS.find((r) => r.v === result)?.pnr;
    if (need && !/^\d{10}$/.test(pnr)) return setPnrErr('PNR 10 digit ka hota hai');
    saveBooking({
      id: uid(),
      pnr: need ? pnr : '',
      train: train ? `${train.number} ${train.name}`.slice(0, 60) : '',
      journey: `${j.from} → ${j.to}`.slice(0, 60),
      date: j.journeyDate,
      travelClass: j.travelClass,
      status: result,
      note: '',
      journeyId: j.id,
      createdAt: Date.now(),
    });
    setResult(null);
    setPnr('');
    setPnrErr('');
    toast('Result save ho gaya');
  };

  return (
    <div className={`stack booking stage-${ph.key === 'open' ? 'open' : ph.key === 'final' ? 'count' : 'early'}`}>
      <div className="row between">
        <h1>Tatkal Agent</h1>
        <span className="mono small">IST {istClock(t)}</span>
      </div>

      {upcoming.length > 1 && (
        <label className="field">
          <span>Kaunsi booking?</span>
          <select value={j.id} onChange={(e) => { setPick(e.target.value); setActive(0); setInfos({}); }}>
            {upcoming.map((x) => <option key={x.id} value={x.id}>{x.label || `${x.from} → ${x.to}`} · {fmtDate(x.journeyDate)}</option>)}
          </select>
        </label>
      )}

      <Card className="hero">
        <div className="eyebrow">{ph.title}</div>
        <p className="small">{ph.text}</p>
        <div className="muted small">{j.from} → {j.to} · {classLabel(j.travelClass)} · {fmtDate(j.journeyDate)}</div>
        <div className="muted small">Tatkal khulega: <b>{fmtDate(o.openDate)}, {fmtHour(o.hour)} IST</b></div>
        <Countdown target={o.epoch} size={left <= 2 * 60_000 ? 'xl' : 'lg'} />
        {done ? (
          <div className="note">Ticket save hai: PNR {done.pnr || '—'} ({done.status}). Dobara book mat karna.</div>
        ) : (
          <>
            {android && (
              <a className={`btn btn-primary btn-block btn-xl ${left <= 60_000 ? 'pulse' : ''}`} href={irctcAppUrl(IRCTC_URL)}>IRCTC APP KHOLO ↗</a>
            )}
            <a className={`btn ${android ? '' : 'btn-primary btn-xl'} btn-block mt`} href={IRCTC_URL} target="_blank" rel="noopener noreferrer">IRCTC WEBSITE KHOLO ↗</a>
          </>
        )}
      </Card>

      <Card title={checking ? 'Agent check kar raha hai…' : blocks.length ? `${blocks.length} problem – pehle theek karo` : warns.length ? 'Lagbhag ready' : 'Sab ready ✓'}>
        {[...blocks, ...env.filter((e) => e.level === 'block'), ...warns, ...env.filter((e) => e.level === 'warn')].map((f, i) => <FindingRow key={i} f={f} />)}
        {[...oks, ...env.filter((e) => e.level === 'ok')].map((f, i) => <FindingRow key={`ok${i}`} f={f} />)}
        <div className="grid2 mt">
          <button className="btn btn-sm" onClick={() => { void syncClock(); recheckIrctc(); }}>Phir se check karo</button>
          {perm !== 'granted' && perm !== 'unsupported' ? (
            <button className="btn btn-sm" onClick={async () => setPerm(await askPermission())}>Notification on karo</button>
          ) : (
            <span className="muted small center">{perm === 'granted' ? 'Notification on ✓' : 'Notification support nahi'}</span>
          )}
        </div>
      </Card>

      {train && (
        <Card title="Kaunsi train book karni hai" right={<button className="btn btn-sm" onClick={() => copy(train.number, 'Train number')}>Copy no.</button>}>
          <TrainRow t={train} tag={active === 0 ? 'Preferred' : `Backup ${active}`} />
          {j.trains.length > 1 && (
            <>
              <p className="muted small">Preferred mein seat nahi? Backup pe tap karo – agent khud train nahi badlega.</p>
              <div className="seg wrap">
                {j.trains.map((tr, i) => (
                  <button key={i} className={i === active ? 'on' : ''} onClick={() => setActive(i)}>{i === 0 ? '★ ' : ''}{tr.number || `Train ${i + 1}`}</button>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      <Card title={`Final summary · ${j.passengers.length} passenger`} right={<button className="btn btn-sm" onClick={() => copy(paxText, 'Passenger list')}>Copy</button>}>
        <dl className="facts">
          <div><dt>Train</dt><dd>{train?.number || '—'}</dd></div>
          <div><dt>Date</dt><dd>{fmtDate(j.journeyDate)}</dd></div>
          <div><dt>From</dt><dd>{j.from}</dd></div>
          <div><dt>To</dt><dd>{j.to}</dd></div>
          <div><dt>Class</dt><dd>{classLabel(j.travelClass)}</dd></div>
          <div><dt>Quota</dt><dd>{j.quota === 'TQ' ? 'Tatkal' : j.quota === 'PT' ? 'Premium Tatkal' : 'General'}</dd></div>
        </dl>
        <ol className="pax">
          {j.passengers.map((p) => (
            <li key={p.id}><span className="strong">{p.name || '—'}</span> <span className="muted">{p.age ?? '?'} · {p.gender || '?'} · {p.berth}</span></li>
          ))}
        </ol>
        <p className="muted small">IRCTC pe "Add from Master List" se passenger sabse jaldi aate hain.</p>
      </Card>

      {left <= 0 && !done && (
        <Card title="Booking ka result">
          <p className="small">IRCTC pe jo hua, wahi chuno. Ye sirf aapka record hai.</p>
          <div className="seg wrap">
            {RESULTS.map((r) => <button key={r.v} className={result === r.v ? 'on' : ''} onClick={() => { setResult(r.v); setPnrErr(''); }}>{r.l}</button>)}
          </div>
          {result && RESULTS.find((r) => r.v === result)?.pnr && (
            <label className="field">
              <span>PNR (10 digit)</span>
              <input inputMode="numeric" maxLength={10} value={pnr} onChange={(e) => setPnr(e.target.value.replace(/\D/g, ''))} />
              {pnrErr && <em className="err">{pnrErr}</em>}
            </label>
          )}
          {result === 'PAYMENT_FAILED' && (
            <div className="note note-warn">Paisa kat gaya ho toh dobara book karne se pehle IRCTC mein <b>My Transactions → Booked Ticket History</b> dekho. Ticket ban gaya ho sakta hai.</div>
          )}
          {result && <button className="btn btn-primary btn-block mt" onClick={record}>Save result</button>}
        </Card>
      )}

      {done && (
        <a className="btn btn-block" href={PNR_URL} target="_blank" rel="noopener noreferrer">PNR status (official) ↗</a>
      )}

      <p className="muted small center">Agent sirf taiyari aur time sambhalta hai. Login, CAPTCHA, OTP aur payment IRCTC pe aap khud karte ho – ye IRCTC ka niyam hai.</p>
    </div>
  );
}
