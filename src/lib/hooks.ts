import { useEffect, useState, useSyncExternalStore } from 'react';
import { getClock, now, subscribeClock } from './clock';
import { checkIrctc } from './readiness';

export const useClock = () => useSyncExternalStore(subscribeClock, getClock);

/** Re-render every `ms` (default 1s) with the corrected time. */
export function useNow(ms = 1000) {
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setT(now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

export function useOnline() {
  const [on, setOn] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return on;
}

let irctcCache: { at: number; ok: boolean } | null = null;
export function useIrctcReachable(online: boolean) {
  const [ok, setOk] = useState<boolean | null>(irctcCache?.ok ?? null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!online) {
      setOk(false);
      return;
    }
    if (irctcCache && Date.now() - irctcCache.at < 5 * 60_000 && tick === 0) {
      setOk(irctcCache.ok);
      return;
    }
    let live = true;
    void checkIrctc().then((r) => {
      irctcCache = { at: Date.now(), ok: r };
      if (live) setOk(r);
    });
    return () => {
      live = false;
    };
  }, [online, tick]);
  return [ok, () => setTick((x) => x + 1)] as const;
}

/** Ask the browser to keep the screen on (booking mode). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const req = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen');
      } catch {
        /* not allowed */
      }
    };
    void req();
    const onVis = () => document.visibilityState === 'visible' && void req();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
