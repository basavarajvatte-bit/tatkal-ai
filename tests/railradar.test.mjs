import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTrain, parseDuration, parseRunDays, parseClasses } from '../api/_lib/railradar.js';

const sample = {
  train: {
    number: '12919', name: 'Malwa SF Express', type: 'Superfast Express', category: 'Express',
    source: { code: 'DADN', name: 'Dr. Ambedkar Nagar' }, destination: { code: 'SVDK', name: 'Shri Mata Vaishno Devi Katra' },
    runDays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true },
    distance: 1950, duration: '33:50', classes: ['1A', '2A', '3A', '3E', 'SL'],
  },
  route: [
    { sequence: 1, station: { code: 'DADN', name: 'Dr. Ambedkar Nagar' }, isHalt: true, platform: 3, arrival: null, departure: '11:50', departureDay: 1, distance: 0 },
    { sequence: 2, station: { code: 'XYZ', name: 'Pass Through' }, isHalt: false, arrival: '11:58', departure: '11:58', departureDay: 1, distance: 10 },
    { sequence: 3, station: { code: 'INDB', name: 'Indore Jn' }, isHalt: true, platform: 4, arrival: '12:05', arrivalDay: 1, departure: '12:15', departureDay: 1, distance: 21.1 },
    { sequence: 3, station: { code: 'INDB', name: 'Indore Jn' }, isHalt: true, arrival: '12:05', arrivalDay: 1, departure: '12:15', departureDay: 1, distance: 21.1 },
    { sequence: 4, station: { code: 'NDLS', name: 'New Delhi' }, isHalt: true, arrival: '23:55', arrivalDay: 1, departure: '00:10', departureDay: 2, distance: 900 },
    { sequence: 5, station: { code: 'SVDK', name: 'Katra' }, isHalt: true, arrival: '21:40', arrivalDay: 2, departure: null, distance: 1950 },
  ],
};

test('normalizes a good response', () => {
  const t = normalizeTrain(sample, '12919');
  assert.equal(t.name, 'Malwa SF Express');
  assert.equal(t.stops.length, 4); // pass-through and duplicate removed
  assert.equal(t.stops[1].halt, 10);
  assert.equal(t.stops[2].halt, 15); // across midnight
  assert.equal(t.stops[2].day, 2);
  assert.equal(t.stops[2].arrDay, 1);
  assert.equal(t.durationMin, 33 * 60 + 50);
  assert.equal(t.runDays.length, 7);
  assert.deepEqual(t.classes, ['1A', '2A', '3A', '3E', 'SL']);
});

test('rejects a record for a different train number', () => {
  assert.equal(normalizeTrain(sample, '12115'), null);
});

test('rejects empty / broken data', () => {
  assert.equal(normalizeTrain(null, '12919'), null);
  assert.equal(normalizeTrain({ train: { number: '12919', name: 'X' }, route: [] }, '12919'), null);
});

test('parsers', () => {
  assert.equal(parseDuration('12h 30m'), 750);
  assert.equal(parseDuration(90), 90);
  assert.equal(parseDuration('—'), null);
  assert.deepEqual(parseRunDays(['Mon', 'Wed']), ['mon', 'wed']);
  assert.equal(parseRunDays('Daily').length, 7);
  assert.deepEqual(parseClasses([{ code: 'sl' }, '3A', 'XX']), ['3A', 'SL']);
});
