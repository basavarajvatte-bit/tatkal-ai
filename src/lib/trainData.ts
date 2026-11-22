import type { ClassCode } from './types';

/** One halting station on a train's route (scheduled timetable, not live). */
export interface Stop {
  code: string;
  name: string;
  arr: string | null; // HH:MM, null at origin
  dep: string | null; // HH:MM, null at destination
  day: number; // run day of departure (1 = day the train starts)
  arrDay: number;
  distance: number | null; // km from origin
  halt: number | null; // minutes
  platform: string | null;
}

export interface TrainInfo {
  number: string;
  name: string;
  type: string | null;
  category: string | null;
  from: { code: string; name: string };
  to: { code: string; name: string };
  distanceKm: number | null;
  durationMin: number | null;
  runDays: string[]; // 'mon'..'sun'
  classes: ClassCode[];
  pantry: boolean | null;
  stops: Stop[];
  source: string;
  fetchedAt: number;
}

export type SearchError = { code: 'INVALID' | 'NOT_FOUND' | 'NO_KEY' | 'KEY_REJECTED' | 'LIMIT' | 'UPSTREAM' | 'OFFLINE' | 'TIMEOUT'; message: string };
export interface SearchResult {
  train?: TrainInfo;
  error?: SearchError;
  /** Shown from this device's saved copy. */
  fromCache?: boolean;
  /** Saved copy is older than STALE_MS – timetable may have changed. */
  stale?: boolean;
}

const KEY = 'tatkal-ai:trains:v1';
const API_KEY = 'tatkal-ai:railradar-key';

/** User's own RailRadar key, kept only on this device (not in backups). */
export function getApiKey(): string {
  try {
    return localStorage.getItem(API_KEY) ?? '';
  } catch {
    return '';
  }
}
export function setApiKey(v: string) {
  try {
    const k = v.trim();
    if (k) localStorage.setItem(API_KEY, k);
    else localStorage.removeItem(API_KEY);
  } catch {
    /* storage blocked */
  }
}
const FRESH_MS = 24 * 3_600_000; // reuse without asking the server
export const STALE_MS = 7 * 24 * 3_600_000; // warn after this
const MAX_SAVED = 40;

function readAll(): Record<string, TrainInfo> {
  try {
    const raw = localStorage.getItem(KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function writeOne(t: TrainInfo) {
  const all = readAll();
  all[t.number] = t;
  const keys = Object.keys(all).sort((a, b) => all[b].fetchedAt - all[a].fetchedAt);
  for (const k of keys.slice(MAX_SAVED)) delete all[k];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage full – search still works, just not cached */
  }
}

const isTrain = (t: unknown): t is TrainInfo =>
  !!t && typeof t === 'object' && typeof (t as TrainInfo).number === 'string' && Array.isArray((t as TrainInfo).stops) && (t as TrainInfo).stops.length >= 2;

export function getCachedTrain(no: string): TrainInfo | null {
  const t = readAll()[no];
  return isTrain(t) ? t : null;
}

export const isStale = (t: TrainInfo, at = Date.now()) => at - t.fetchedAt > STALE_MS;

export async function searchTrain(no: string, force = false): Promise<SearchResult> {
  if (!/^\d{5}$/.test(no)) return { error: { code: 'INVALID', message: 'Train number must be 5 digits' } };
  const cached = getCachedTrain(no);
  if (cached && !force && Date.now() - cached.fetchedAt < FRESH_MS) return { train: cached, fromCache: true };

  const fallback = (error: SearchError): SearchResult =>
    cached ? { train: cached, fromCache: true, stale: isStale(cached), error } : { error };

  if (!navigator.onLine) return fallback({ code: 'OFFLINE', message: 'No internet connection' });

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const key = getApiKey();
    const r = await fetch(`/api/train?no=${no}`, { signal: ctl.signal, headers: key ? { 'X-RailRadar-Key': key } : {} });
    const body = await r.json().catch(() => null);
    if (r.ok && body?.ok && isTrain(body.train) && body.train.number === no) {
      writeOne(body.train);
      return { train: body.train };
    }
    const code = (body?.code ?? 'UPSTREAM') as SearchError['code'];
    // A definite "not found" must never show an old copy as if it were valid.
    if (code === 'NOT_FOUND') return { error: { code, message: 'TRAIN NOT FOUND' } };
    return fallback({ code, message: body?.message ?? `Server error (${r.status})` });
  } catch (e) {
    const timeout = (e as Error)?.name === 'AbortError';
    return fallback({ code: timeout ? 'TIMEOUT' : 'OFFLINE', message: timeout ? 'Server took too long to reply' : 'Could not reach the server' });
  } finally {
    clearTimeout(timer);
  }
}

const DAY_ORDER = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABEL: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

export function fmtRunDays(days: string[]): string {
  if (!days.length) return 'Not available';
  if (days.length === 7) return 'Daily';
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].filter((d) => days.includes(d)).map((d) => DAY_LABEL[d]).join(', ');
}

/** Does the train start from its origin on this calendar date (YYYY-MM-DD)? null = unknown. */
export function runsOn(t: TrainInfo, startDate: string): boolean | null {
  if (!t.runDays.length || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  const [y, m, d] = startDate.split('-').map(Number);
  return t.runDays.includes(DAY_ORDER[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]);
}
