import type { Train } from './types';
import { durationMin } from './time';

export type SortMode = 'preference' | 'fastest' | 'earliest' | 'arrival';

const toMin = (hhmm: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? +m[1] * 60 + +m[2] : null;
};

/** Circular distance between two clock times, in minutes. */
const clockGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 1440;
  return Math.min(d, 1440 - d);
};

export function sortTrains(trains: Train[], mode: SortMode, preferredArrival = '08:00'): Train[] {
  const withIdx = trains.map((t, i) => ({ t, i }));
  const big = Number.MAX_SAFE_INTEGER;
  const key = ({ t, i }: { t: Train; i: number }): number => {
    if (mode === 'fastest') return durationMin(t.dep, t.arr, t.arrDays) ?? big;
    if (mode === 'earliest') return toMin(t.dep) ?? big;
    if (mode === 'arrival') {
      const a = toMin(t.arr);
      const p = toMin(preferredArrival);
      return a == null || p == null ? big : clockGap(a, p);
    }
    return i;
  };
  return withIdx.sort((a, b) => key(a) - key(b) || a.i - b.i).map((x) => x.t);
}

/**
 * Simple, explainable "smart" score (0–100) for alternatives: shorter trips and arrivals
 * near the preferred time score higher. No paid AI; fully offline.
 */
export function smartScore(t: Train, all: Train[], preferredArrival = '08:00'): number | null {
  const d = durationMin(t.dep, t.arr, t.arrDays);
  if (d == null) return null;
  const ds = all.map((x) => durationMin(x.dep, x.arr, x.arrDays)).filter((x): x is number => x != null);
  const min = Math.min(...ds);
  const max = Math.max(...ds);
  const speed = max === min ? 1 : 1 - (d - min) / (max - min);
  const a = toMin(t.arr);
  const p = toMin(preferredArrival);
  const arrival = a == null || p == null ? 0.5 : 1 - clockGap(a, p) / 720;
  return Math.round((speed * 0.6 + arrival * 0.4) * 100);
}
