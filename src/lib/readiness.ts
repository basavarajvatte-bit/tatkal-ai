import type { Journey } from './types';
import { journeyErrors, passengerErrors, trainErrors } from './validate';

export interface CheckItem {
  key: string;
  label: string;
  ok: boolean;
  hint: string;
  fix: { label: string; href?: string; action?: 'irctcAccount' | 'aadhaar' | 'payment' | 'sync' | 'retry' };
}

export interface Env {
  online: boolean;
  clockSynced: boolean;
  irctcReachable: boolean | null;
}

export function readiness(j: Journey, env: Env) {
  const edit = `#/journeys/${j.id}`;
  const primary = j.trains[0];
  const items: CheckItem[] = [
    {
      key: 'journey',
      label: 'Journey details complete',
      ok: Object.keys(journeyErrors(j)).length === 0,
      hint: 'From, To, date',
      fix: { label: 'Fill journey', href: edit },
    },
    {
      key: 'passengers',
      label: 'Passenger details complete',
      ok: j.passengers.length > 0 && j.passengers.every((p) => passengerErrors(p).length === 0),
      hint: `${j.passengers.length} passenger(s)`,
      fix: { label: 'Fix passengers', href: edit },
    },
    {
      key: 'primary',
      label: 'Preferred train selected',
      ok: !!primary && trainErrors(primary).length === 0,
      hint: primary ? `${primary.number} ${primary.name}` : 'None',
      fix: { label: 'Add train', href: edit },
    },
    {
      key: 'backup',
      label: 'Backup train selected',
      ok: j.trains.slice(1).some((t) => trainErrors(t).length === 0),
      hint: `${Math.max(0, j.trains.length - 1)} backup(s)`,
      fix: { label: 'Add backup', href: edit },
    },
    {
      key: 'class',
      label: 'Travel class selected',
      ok: !!j.travelClass,
      hint: j.travelClass,
      fix: { label: 'Choose class', href: edit },
    },
    {
      key: 'irctc',
      label: 'IRCTC account ready (I can log in)',
      ok: j.checks.irctcAccount,
      hint: 'Confirm yourself',
      fix: { label: 'Yes, ready', action: 'irctcAccount' },
    },
    {
      key: 'aadhaar',
      label: 'Aadhaar linked & verified on IRCTC',
      ok: j.checks.aadhaar,
      hint: 'Tatkal needs Aadhaar OTP',
      fix: { label: 'Yes, verified', action: 'aadhaar' },
    },
    {
      key: 'payment',
      label: 'Payment method ready (UPI / card)',
      ok: j.checks.payment,
      hint: 'Never stored here',
      fix: { label: 'Yes, ready', action: 'payment' },
    },
    {
      key: 'internet',
      label: 'Internet connected',
      ok: env.online,
      hint: env.online ? 'Online' : 'Offline',
      fix: { label: 'Retry', action: 'retry' },
    },
    {
      key: 'clock',
      label: 'Clock synced with server',
      ok: env.clockSynced,
      hint: 'Accurate countdown',
      fix: { label: 'Sync now', action: 'sync' },
    },
    {
      key: 'irctcSite',
      label: 'IRCTC website reachable',
      ok: env.irctcReachable === true,
      hint: env.irctcReachable == null ? 'Not checked' : env.irctcReachable ? 'Reachable' : 'Not reachable',
      fix: { label: 'Check again', action: 'retry' },
    },
  ];
  const done = items.filter((i) => i.ok).length;
  const score = Math.round((done / items.length) * 100);
  return { items, score, ready: score === 100, missing: items.filter((i) => !i.ok) };
}

/** Best-effort reachability (opaque no-cors request; success = network path works). */
export async function checkIrctc(timeoutMs = 6000): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    await fetch('https://www.irctc.co.in/favicon.ico', { mode: 'no-cors', cache: 'no-store', signal: ctl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}
