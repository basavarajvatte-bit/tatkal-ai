import { useState } from 'react';
import type { Booking, BookingStatus, ClassCode } from '../lib/types';
import { useData, saveBooking, deleteBooking, uid } from '../lib/store';
import { CLASSES, fmtDate } from '../lib/time';
import { clean } from '../lib/validate';
import { Card, Empty } from '../components/ui';

export const STATUSES: { v: BookingStatus; l: string; c: string }[] = [
  { v: 'CONFIRMED', l: 'Confirmed', c: 'ok' },
  { v: 'RAC', l: 'RAC', c: 'warn' },
  { v: 'WL', l: 'Waiting List', c: 'warn' },
  { v: 'PAYMENT_PENDING', l: 'Payment Pending', c: 'warn' },
  { v: 'PAYMENT_FAILED', l: 'Payment Failed', c: 'bad' },
  { v: 'BOOKING_FAILED', l: 'Booking Failed', c: 'bad' },
];

const blank = (): Booking => ({ id: uid(), pnr: '', train: '', journey: '', date: '', travelClass: 'SL', status: 'CONFIRMED', note: '', createdAt: Date.now() });

export default function History() {
  const { bookings, journeys } = useData();
  const [edit, setEdit] = useState<Booking | null>(null);
  const [err, setErr] = useState('');

  const startNew = () => {
    const b = blank();
    const j = journeys.find((x) => x.isDefault) ?? journeys[0];
    if (j) Object.assign(b, { journey: `${j.from} → ${j.to}`, date: j.journeyDate, travelClass: j.travelClass, train: j.trains[0] ? `${j.trains[0].number} ${j.trains[0].name}` : '' });
    setErr('');
    setEdit(b);
  };

  const save = () => {
    if (!edit) return;
    const needsPnr = ['CONFIRMED', 'RAC', 'WL'].includes(edit.status);
    if (needsPnr && !/^\d{10}$/.test(edit.pnr)) return setErr('PNR must be 10 digits for Confirmed / RAC / WL');
    if (edit.pnr && !/^\d{10}$/.test(edit.pnr)) return setErr('PNR must be 10 digits');
    saveBooking({ ...edit, train: clean(edit.train, 60), journey: clean(edit.journey, 60), note: clean(edit.note, 120) });
    setEdit(null);
  };

  return (
    <div className="stack">
      <div className="row between">
        <h1>Booking History</h1>
        <button className="btn btn-primary" onClick={startNew}>+ Record</button>
      </div>
      <p className="muted small">Your own records. Tatkal AI does not book tickets – status here is what you enter from IRCTC.</p>

      {edit && (
        <Card title="Booking record">
          <div className="grid2">
            <label className="field"><span>PNR</span><input inputMode="numeric" maxLength={10} value={edit.pnr} onChange={(e) => setEdit({ ...edit, pnr: e.target.value.replace(/\D/g, '') })} /></label>
            <label className="field"><span>Status</span>
              <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as BookingStatus })}>
                {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </label>
          </div>
          <label className="field"><span>Train</span><input value={edit.train} maxLength={60} onChange={(e) => setEdit({ ...edit, train: e.target.value })} /></label>
          <label className="field"><span>Journey</span><input value={edit.journey} maxLength={60} onChange={(e) => setEdit({ ...edit, journey: e.target.value })} /></label>
          <div className="grid2">
            <label className="field"><span>Date</span><input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></label>
            <label className="field"><span>Class</span>
              <select value={edit.travelClass} onChange={(e) => setEdit({ ...edit, travelClass: e.target.value as ClassCode })}>
                {CLASSES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </label>
          </div>
          <label className="field"><span>Note</span><input value={edit.note} maxLength={120} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></label>
          {err && <em className="err">{err}</em>}
          <div className="grid2">
            <button className="btn" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </div>
        </Card>
      )}

      {!bookings.length && !edit && <Card><Empty text="No records yet." /></Card>}
      {bookings.map((b) => {
        const s = STATUSES.find((x) => x.v === b.status)!;
        return (
          <Card key={b.id}>
            <div className="row between">
              <span className="mono strong">{b.pnr ? `PNR ${b.pnr}` : 'No PNR'}</span>
              <span className={`score score-${s.c}`}>{s.l}</span>
            </div>
            <div>{b.train || '—'}</div>
            <div className="muted small">{b.journey || '—'} · {b.date ? fmtDate(b.date) : '—'} · {b.travelClass}</div>
            {b.note && <div className="small">{b.note}</div>}
            <div className="actions">
              <button className="btn btn-sm" onClick={() => { setErr(''); setEdit({ ...b }); }}>Edit</button>
              <button className="btn btn-sm btn-danger" onClick={() => confirm('Delete record?') && deleteBooking(b.id)}>Delete</button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
