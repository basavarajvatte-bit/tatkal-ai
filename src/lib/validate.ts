import type { Journey, Passenger, Train } from './types';
import { isValidISODate, durationMin } from './time';

export const MAX_TATKAL_PASSENGERS = 4;
export const TRAIN_NO_RE = /^\d{5}$/;
export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const NAME_RE = /^[A-Za-z][A-Za-z .'-]{1,15}$/;

export const clean = (s: string, max = 40) => s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

export function passengerErrors(p: Passenger): string[] {
  const e: string[] = [];
  if (!NAME_RE.test(p.name.trim())) e.push('Name: 2–16 letters (IRCTC limit)');
  if (p.age == null || !Number.isInteger(p.age) || p.age < 1 || p.age > 125) e.push('Age: 1–125');
  else if (p.age < 5) e.push('Child under 5: no ticket needed, add as infant on IRCTC');
  if (!p.gender) e.push('Gender required');
  return e;
}

export function trainErrors(t: Train): string[] {
  const e: string[] = [];
  if (!TRAIN_NO_RE.test(t.number)) e.push('Train number must be 5 digits');
  if (!t.name.trim()) e.push('Train name required');
  if (t.dep && !TIME_RE.test(t.dep)) e.push('Departure must be HH:MM');
  if (t.arr && !TIME_RE.test(t.arr)) e.push('Arrival must be HH:MM');
  if (t.dep && t.arr && TIME_RE.test(t.dep) && TIME_RE.test(t.arr) && durationMin(t.dep, t.arr, t.arrDays) == null)
    e.push('Arrival is before departure – set "+days"');
  return e;
}

export function journeyErrors(j: Journey): Record<string, string> {
  const e: Record<string, string> = {};
  if (!j.from.trim()) e.from = 'Required';
  if (!j.to.trim()) e.to = 'Required';
  if (j.from.trim() && j.from.trim().toUpperCase() === j.to.trim().toUpperCase()) e.to = 'Must differ from "From"';
  if (!isValidISODate(j.journeyDate)) e.journeyDate = 'Pick a valid date';
  if (j.boardingDay < 1 || j.boardingDay > 4) e.boardingDay = '1–4';
  if (j.passengers.length > MAX_TATKAL_PASSENGERS) e.passengers = `Tatkal allows max ${MAX_TATKAL_PASSENGERS} per PNR`;
  return e;
}
