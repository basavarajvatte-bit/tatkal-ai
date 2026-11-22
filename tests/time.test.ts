import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tatkalOpening, istEpoch, fmtCountdown, durationMin, addDays, isValidISODate, istDate } from '../src/lib/time';
import { sortTrains, smartScore } from '../src/lib/rank';
import { passengerErrors, trainErrors } from '../src/lib/validate';

test('Sleeper opens 11:00 IST the day before', () => {
  const o = tatkalOpening('2026-11-25', 'SL');
  assert.equal(o.openDate, '2026-11-24');
  assert.equal(o.hour, 11);
  assert.equal(new Date(o.epoch).toISOString(), '2026-11-24T05:30:00.000Z');
});

test('AC opens 10:00 IST', () => {
  for (const c of ['1A', '2A', '3A', '3E', 'CC', 'EC'] as const) {
    const o = tatkalOpening('2026-11-25', c);
    assert.equal(new Date(o.epoch).toISOString(), '2026-11-24T04:30:00.000Z', c);
  }
  assert.equal(tatkalOpening('2026-11-25', '2S').hour, 11);
});

test('boarding on day 2 shifts opening one more day', () => {
  const o = tatkalOpening('2026-11-25', 'SL', 2);
  assert.equal(o.trainStartDate, '2026-11-24');
  assert.equal(o.openDate, '2026-11-23');
});

test('month / year / leap boundaries', () => {
  assert.equal(tatkalOpening('2027-01-01', 'SL').openDate, '2026-12-31');
  assert.equal(tatkalOpening('2028-03-01', 'SL').openDate, '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('IST conversion', () => {
  assert.equal(istEpoch('2026-11-24', 0), Date.UTC(2026, 10, 23, 18, 30));
  assert.equal(istDate(Date.UTC(2026, 10, 23, 18, 30)), '2026-11-24');
  assert.equal(istDate(Date.UTC(2026, 10, 23, 18, 29)), '2026-11-23');
});

test('countdown formatting', () => {
  assert.equal(fmtCountdown(12 * 60_000 + 45_000 + 7), '00:12:45.007');
  assert.equal(fmtCountdown(26 * 3_600_000, false), '26:00:00');
  assert.equal(fmtCountdown(-1500), '-00:00:01.500');
});

test('dates & durations', () => {
  assert.ok(isValidISODate('2028-02-29'));
  assert.ok(!isValidISODate('2026-02-30'));
  assert.equal(durationMin('22:30', '06:15', 1), 465);
  assert.equal(durationMin('22:30', '06:15', 0), null);
});

test('train sorting & score', () => {
  const t = [
    { number: '11111', name: 'A', dep: '21:00', arr: '07:00', arrDays: 1 },
    { number: '22222', name: 'B', dep: '18:00', arr: '02:00', arrDays: 1 },
    { number: '33333', name: 'C', dep: '23:00', arr: '06:00', arrDays: 1 },
  ];
  assert.deepEqual(sortTrains(t, 'fastest').map((x) => x.number), ['33333', '22222', '11111']);
  assert.deepEqual(sortTrains(t, 'earliest').map((x) => x.number), ['22222', '11111', '33333']);
  assert.deepEqual(sortTrains(t, 'arrival', '07:00').map((x) => x.number), ['11111', '33333', '22222']);
  assert.deepEqual(sortTrains(t, 'preference').map((x) => x.number), ['11111', '22222', '33333']);
  const s = smartScore(t[2], t, '07:00')!;
  assert.ok(s > smartScore(t[1], t, '07:00')!);
});

test('validation', () => {
  assert.equal(passengerErrors({ id: '1', name: 'Ramesh Patil', age: 40, gender: 'M', berth: 'LB' }).length, 0);
  assert.ok(passengerErrors({ id: '1', name: '', age: 0, gender: '', berth: 'NP' }).length >= 3);
  assert.ok(trainErrors({ number: '1234', name: 'x', dep: '', arr: '', arrDays: 0 }).length > 0);
});
