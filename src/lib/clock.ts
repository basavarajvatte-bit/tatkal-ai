/**
 * Server-synchronised clock.
 * - Samples /api/time (falls back to the HTTP Date header) several times, keeps the
 *   lowest-latency sample (NTP-style: offset = server - (send + rtt/2)).
 * - Countdown ticks locally from Date.now() + offset: no continuous polling.
 * - Watches for device clock jumps by comparing wall-clock and monotonic deltas.
 */
export type ClockSource = 'server' | 'header' | 'device';

export interface ClockState {
  offset: number; // ms to add to Date.now()
  rtt: number | null; // round trip of best sample, ms
  lastSync: number | null; // corrected epoch of last successful sync
  source: ClockSource;
  syncing: boolean;
  jumpDetected: boolean;
  error: string | null;
}

const KEY = 'tatkal-ai:clock';
let state: ClockState = {
  offset: 0,
  rtt: null,
  lastSync: null,
  source: 'device',
  syncing: false,
  jumpDetected: false,
  error: null,
};

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved && typeof saved.offset === 'number') {
    state = { ...state, offset: saved.offset, rtt: saved.rtt ?? null, lastSync: saved.lastSync ?? null, source: saved.source ?? 'device' };
  }
} catch {
  /* storage unavailable */
}

const listeners = new Set<() => void>();
function set(patch: Partial<ClockState>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify({ offset: state.offset, rtt: state.rtt, lastSync: state.lastSync, source: state.source }));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export const getClock = () => state;
export function subscribeClock(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Corrected current epoch ms. */
export const now = () => Date.now() + state.offset;

interface Sample {
  offset: number;
  rtt: number;
  source: ClockSource;
}

async function sampleOnce(): Promise<Sample | null> {
  const wall0 = Date.now();
  const t0 = performance.now();
  try {
    const res = await fetch(`/api/time?t=${t0.toFixed(0)}`, { cache: 'no-store' });
    const rtt = performance.now() - t0;
    const mid = wall0 + rtt / 2;
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
      const j = await res.json();
      if (typeof j?.now === 'number') return { offset: j.now - mid, rtt, source: 'server' };
    }
    const dh = res.headers.get('date');
    if (dh) {
      const server = Date.parse(dh);
      // Date header has 1-second resolution; +500ms centres the error.
      if (!Number.isNaN(server)) return { offset: server + 500 - mid, rtt, source: 'header' };
    }
  } catch {
    /* offline */
  }
  return null;
}

let inflight: Promise<void> | null = null;

export function syncClock(samples = 5): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    set({ syncing: true, error: null });
    const got: Sample[] = [];
    for (let i = 0; i < samples; i++) {
      const s = await sampleOnce();
      if (s) got.push(s);
    }
    if (!got.length) {
      set({ syncing: false, error: navigator.onLine ? 'Time server not reachable' : 'Offline' });
      return;
    }
    const pool = got.some((s) => s.source === 'server') ? got.filter((s) => s.source === 'server') : got;
    const best = pool.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    set({ offset: Math.round(best.offset), rtt: Math.round(best.rtt), source: best.source, lastSync: Date.now() + best.offset, syncing: false, jumpDetected: false });
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

let started = false;
/** Start background housekeeping (call once). */
export function startClock() {
  if (started) return;
  started = true;
  void syncClock();
  let lastWall = Date.now();
  let lastMono = performance.now();
  setInterval(() => {
    const w = Date.now();
    const m = performance.now();
    const jump = Math.abs(w - lastWall - (m - lastMono));
    lastWall = w;
    lastMono = m;
    // >1.5s mismatch while page is visible = device clock was changed (or device slept).
    if (jump > 1500 && document.visibilityState === 'visible') {
      set({ jumpDetected: true });
      void syncClock();
    }
  }, 2000);
  window.addEventListener('online', () => void syncClock());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const age = state.lastSync == null ? Infinity : now() - state.lastSync;
      if (age > 5 * 60_000) void syncClock();
    }
  });
  // Light refresh every 15 minutes while open (not polling the countdown).
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncClock(3);
  }, 15 * 60_000);
}
