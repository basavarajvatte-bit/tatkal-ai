import { now } from './clock';

/**
 * Reminders fire while the app is open (or kept in the background by the browser).
 * Background delivery when the app is fully closed needs a push server – not promised here.
 */
export const REMINDER_MINUTES = [15, 5, 2, 1, 0] as const;

export type Toast = { id: number; text: string };
const toastListeners = new Set<(t: Toast) => void>();
export function onToast(fn: (t: Toast) => void) {
  toastListeners.add(fn);
  return () => toastListeners.delete(fn);
}
let toastId = 0;
export function toast(text: string) {
  const t = { id: ++toastId, text };
  toastListeners.forEach((l) => l(t));
}

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const permission = (): NotificationPermission | 'unsupported' =>
  notificationsSupported() ? Notification.permission : 'unsupported';

export async function askPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function notify(title: string, body: string) {
  toast(`${title} – ${body}`);
  if (permission() !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: title });
    else new Notification(title, { body, icon: '/icons/icon-192.png' });
  } catch {
    /* in-app toast already shown */
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* ignore */
  }
}

let timers: number[] = [];
const fired = new Set<string>();

/** (Re)schedule reminders for one booking opening. */
export function scheduleReminders(openEpoch: number, label: string, incomplete: () => string[]) {
  timers.forEach(clearTimeout);
  timers = [];
  for (const m of REMINDER_MINUTES) {
    const at = openEpoch - m * 60_000;
    const delay = at - now();
    const key = `${openEpoch}:${m}`;
    if (fired.has(key) || delay < -30_000 || delay > 24 * 3_600_000) continue;
    timers.push(
      window.setTimeout(() => {
        fired.add(key);
        if (m === 0) {
          void notify('Tatkal booking is OPEN', `${label}: open IRCTC now`);
          return;
        }
        void notify(`${m} min to Tatkal`, label);
        const miss = incomplete();
        if (m === 15 && miss.length) void notify('Preparation incomplete', miss.slice(0, 3).join(', '));
      }, Math.max(0, delay)),
    );
  }
}
