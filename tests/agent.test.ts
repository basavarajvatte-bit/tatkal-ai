import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planFindings, verifyTrain, stationCode, existingBooking } from '../src/lib/agent';
import type { Journey } from '../src/lib/types';
import type { TrainInfo } from '../src/lib/trainData';

const train: TrainInfo = {
  number: '12115', name: 'Siddheshwar', type: null, category: null,
  from: { code: 'CSMT', name: 'Mumbai' }, to: { code: 'SUR', name: 'Solapur' },
  distanceKm: 455, durationMin: 545, runDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], classes: ['3A', 'SL'], pantry: null,
  stops: [
    { code: 'CSMT', name: 'Mumbai', arr: null, dep: '22:05', day: 1, arrDay: 1, distance: 0, halt: null, platform: null },
    { code: 'PUNE', name: 'Pune', arr: '01:45', dep: '01:50', day: 2, arrDay: 2, distance: 192, halt: 5, platform: null },
    { code: 'SUR', name: 'Solapur', arr: '07:10', dep: null, day: 2, arrDay: 2, distance: 455, halt: null, platform: null },
  ],
  source: 'test', fetchedAt: 0,
};
const j = (p: Partial<Journey> = {}): Journey => ({
  id: 'j1', label: '', from: 'PUNE JN (PUNE)', to: 'SOLAPUR (SUR)', boarding: '', journeyDate: '2026-12-10', boardingDay: 2,
  travelClass: 'SL', quota: 'TQ', trains: [{ number: '12115', name: 'S', dep: '01:50', arr: '07:10', arrDays: 0 }],
  passengers: [{ id: 'p', name: 'Rahul', age: 30, gender: 'M', berth: 'LB' }],
  checks: { irctcAccount: true, aadhaar: true, payment: true }, isDefault: true, createdAt: 0, updatedAt: 0, ...p,
});

test('station code parse', () => {
  assert.equal(stationCode('SOLAPUR JN (SUR)'), 'SUR');
  assert.equal(stationCode('PUNE'), null);
});

test('good plan has no blockers', () => {
  const f = verifyTrain(j(), train, true);
  assert.equal(f.filter((x) => x.level === 'block').length, 0);
});

test('wrong boarding day is blocked (wrong Tatkal date)', () => {
  const f = verifyTrain(j({ boardingDay: 1 }), train, true);
  assert.ok(f.some((x) => x.level === 'block' && x.text.includes('day 2')));
});

test('class not on train / wrong direction blocked', () => {
  assert.ok(verifyTrain(j({ travelClass: '1A' }), train, true).some((x) => x.level === 'block'));
  assert.ok(verifyTrain(j({ from: 'SOLAPUR (SUR)', to: 'PUNE JN (PUNE)' }), train, true).some((x) => x.text.includes('pehle aata')));
});

test('existing booking blocks a second booking', () => {
  const b = [{ id: 'b', pnr: '1234567890', train: '', journey: '', date: '', travelClass: 'SL' as const, status: 'CONFIRMED' as const, note: '', journeyId: 'j1', createdAt: 0 }];
  assert.ok(existingBooking(j(), b));
  const f = planFindings(j(), { '12115': train }, b, 0);
  assert.ok(f[0].level === 'block' && f[0].text.includes('Dobara'));
});
