import type { ClassCode } from './types';

/** IST is a fixed UTC+05:30 offset (no daylight saving). */
export const IST_OFFSET_MS = 330 * 60_000;

export const CLASSES: { code: ClassCode; label: string }[] = [
  { code: 'SL', label: 'Sleeper (SL)' },
  { code: '3A', label: 'AC 3 Tier (3A)' },
  { code: '2A', label: 'AC 2 Tier (2A)' },
  { code: '1A', label: 'AC First (1A)' },
  { code: '3E', label: 'AC 3 Economy (3E)' },
  { code: 'CC', label: 'AC Chair Car (CC)' },
  { code: 'EC', label: 'Exec Chair Car (EC)' },
  { code: '2S', label: 'Second Sitting (2S)' },
];

const AC: ReadonlySet<ClassCode> = new Set<ClassCode>(['1A', '2A', '3A', '3E', 'CC', 'EC']);

export const isAC = (c: ClassCode) => AC.has(c);
/** Tatkal opens 10:00 IST for AC classes, 11:00 IST for non-AC. */
export const openHourIST = (c: ClassCode) => (isAC(c) ? 10 : 11);
export const classLabel = (c: ClassCode) => CLASSES.find((x) => x.code === c)?.label ?? c;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidISODate(iso: string): boolean {
  const m = ISO_RE.exec(iso);
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** Calendar arithmetic on YYYY-MM-DD strings (timezone-free). */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Epoch ms of a wall-clock time in IST. */
export function istEpoch(iso: string, hour: number, minute = 0): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d, hour, minute) - IST_OFFSET_MS;
}

/** IST calendar date (YYYY-MM-DD) for an epoch. */
export function istDate(epoch: number): string {
  return new Date(epoch + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function istClock(epoch: number): string {
  const t = new Date(epoch + IST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`;
}

export interface TatkalOpening {
  trainStartDate: string;
  openDate: string;
  hour: number;
  epoch: number;
}

/**
 * Tatkal opens one day before the train's journey date *from its originating station*,
 * excluding the journey date. If you board on day 2 of the train's run, the train started
 * a day earlier, so booking opens one day earlier too.
 */
export function tatkalOpening(journeyDate: string, travelClass: ClassCode, boardingDay = 1): TatkalOpening {
  const day = Math.max(1, Math.floor(boardingDay) || 1);
  const trainStartDate = addDays(journeyDate, -(day - 1));
  const openDate = addDays(trainStartDate, -1);
  const hour = openHourIST(travelClass);
  return { trainStartDate, openDate, hour, epoch: istEpoch(openDate, hour) };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function fmtDate(iso: string): string {
  if (!isValidISODate(iso)) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[wd]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export function fmtHour(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(h12).padStart(2, '0')}:00 ${hour < 12 ? 'AM' : 'PM'}`;
}

export interface CountdownParts {
  negative: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  millis: number;
}

export function splitMs(ms: number): CountdownParts {
  const negative = ms < 0;
  let r = Math.abs(Math.trunc(ms));
  const days = Math.floor(r / 86_400_000);
  r -= days * 86_400_000;
  const hours = Math.floor(r / 3_600_000);
  r -= hours * 3_600_000;
  const minutes = Math.floor(r / 60_000);
  r -= minutes * 60_000;
  const seconds = Math.floor(r / 1000);
  return { negative, days, hours, minutes, seconds, millis: r - seconds * 1000 };
}

export function fmtCountdown(ms: number, withMs = true): string {
  const p = splitMs(ms);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const hh = p.days * 24 + p.hours;
  const base = `${pad(hh)}:${pad(p.minutes)}:${pad(p.seconds)}`;
  return (p.negative ? '-' : '') + (withMs ? `${base}.${pad(p.millis, 3)}` : base);
}

/** Minutes between HH:MM times with day offset. */
export function durationMin(dep: string, arr: string, arrDays: number): number | null {
  const re = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const a = re.exec(dep);
  const b = re.exec(arr);
  if (!a || !b) return null;
  const d = +a[1] * 60 + +a[2];
  const r = +b[1] * 60 + +b[2] + Math.max(0, arrDays) * 1440;
  const diff = r - d;
  return diff > 0 ? diff : null;
}

export function fmtDuration(min: number | null): string {
  if (min == null) return '—';
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}
