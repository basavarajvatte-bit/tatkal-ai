import { useSyncExternalStore } from 'react';
import type { AppData, Booking, Journey, PaxGroup, Profile, Settings } from './types';
import { tatkalOpening, istDate } from './time';
import { now } from './clock';

/**
 * All data stays on this device (localStorage). Nothing is sent to any server.
 * IRCTC passwords, OTPs, CVVs, UPI PINs and Aadhaar numbers have no fields and are never stored.
 */
const KEY = 'tatkal-ai:data:v1';

const EMPTY: AppData = {
  version: 1,
  journeys: [],
  bookings: [],
  profiles: [],
  groups: [],
  settings: { notifications: true, preferredArrival: '08:00', reminderMinutes: [45, 15, 1, 0] },
};

/** Valid reminder list: whole minutes 0–180, unique, largest first, max 8. */
export function cleanReminderMinutes(v: unknown): number[] {
  if (!Array.isArray(v)) return [...EMPTY.settings.reminderMinutes];
  const list = [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 180))].sort((a, b) => b - a).slice(0, 8);
  return list.length ? list : [...EMPTY.settings.reminderMinutes];
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return sanitize(JSON.parse(raw));
  } catch {
    return EMPTY;
  }
}

export function sanitize(input: unknown): AppData {
  const d = (input ?? {}) as Partial<AppData>;
  return {
    version: 1,
    journeys: Array.isArray(d.journeys) ? d.journeys.filter((j) => j && typeof j.id === 'string') : [],
    bookings: Array.isArray(d.bookings) ? d.bookings.filter((b) => b && typeof b.id === 'string') : [],
    profiles: Array.isArray(d.profiles) ? d.profiles.filter((p) => p && typeof p.id === 'string').map((p) => ({ ...p, active: p.active !== false })) : [],
    groups: Array.isArray(d.groups)
      ? d.groups.filter((g) => g && typeof g.id === 'string' && Array.isArray(g.profileIds)).map((g) => ({ id: g.id, name: String(g.name ?? '').slice(0, 30), profileIds: g.profileIds.filter((x) => typeof x === 'string') }))
      : [],
    settings: { ...EMPTY.settings, ...(d.settings ?? {}), reminderMinutes: cleanReminderMinutes(d.settings?.reminderMinutes) },
  };
}

let data: AppData = load();
const listeners = new Set<() => void>();

function commit(next: AppData) {
  data = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    alert('Could not save: device storage is full or blocked.');
  }
  listeners.forEach((l) => l());
}

window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    data = load();
    listeners.forEach((l) => l());
  }
});

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const useData = () => useSyncExternalStore(subscribe, () => data);
export const getData = () => data;

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

export function saveJourney(j: Journey) {
  const exists = data.journeys.some((x) => x.id === j.id);
  let journeys = exists ? data.journeys.map((x) => (x.id === j.id ? j : x)) : [...data.journeys, j];
  if (j.isDefault) journeys = journeys.map((x) => ({ ...x, isDefault: x.id === j.id }));
  if (!journeys.some((x) => x.isDefault) && journeys.length) journeys[0] = { ...journeys[0], isDefault: true };
  commit({ ...data, journeys });
}

export function deleteJourney(id: string) {
  let journeys = data.journeys.filter((x) => x.id !== id);
  if (journeys.length && !journeys.some((x) => x.isDefault)) journeys = journeys.map((x, i) => ({ ...x, isDefault: i === 0 }));
  commit({ ...data, journeys });
}

export function duplicateJourney(id: string): string | null {
  const src = data.journeys.find((x) => x.id === id);
  if (!src) return null;
  const copy: Journey = {
    ...structuredClone(src),
    id: uid(),
    label: `${src.label || `${src.from} → ${src.to}`} (copy)`,
    isDefault: false,
    passengers: src.passengers.map((p) => ({ ...p, id: uid() })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  commit({ ...data, journeys: [...data.journeys, copy] });
  return copy.id;
}

export function setJourneyActive(id: string, active: boolean) {
  commit({ ...data, journeys: data.journeys.map((x) => (x.id === id ? { ...x, active, updatedAt: Date.now() } : x)) });
}

/* ---------- Passenger profiles & groups ---------- */

export function saveProfile(p: Profile) {
  const exists = data.profiles.some((x) => x.id === p.id);
  const profiles = exists ? data.profiles.map((x) => (x.id === p.id ? p : x)) : [...data.profiles, p];
  commit({ ...data, profiles });
}

export function deleteProfile(id: string) {
  commit({
    ...data,
    profiles: data.profiles.filter((x) => x.id !== id),
    groups: data.groups.map((g) => ({ ...g, profileIds: g.profileIds.filter((x) => x !== id) })),
  });
}

export function saveGroup(g: PaxGroup) {
  const exists = data.groups.some((x) => x.id === g.id);
  const groups = exists ? data.groups.map((x) => (x.id === g.id ? g : x)) : [...data.groups, g];
  commit({ ...data, groups });
}

export function deleteGroup(id: string) {
  commit({ ...data, groups: data.groups.filter((x) => x.id !== id) });
}

export function setDefaultJourney(id: string) {
  commit({ ...data, journeys: data.journeys.map((x) => ({ ...x, isDefault: x.id === id })) });
}

export function saveBooking(b: Booking) {
  const exists = data.bookings.some((x) => x.id === b.id);
  const bookings = exists ? data.bookings.map((x) => (x.id === b.id ? b : x)) : [b, ...data.bookings];
  commit({ ...data, bookings });
}

export function deleteBooking(id: string) {
  commit({ ...data, bookings: data.bookings.filter((x) => x.id !== id) });
}

export function saveSettings(s: Partial<Settings>) {
  commit({ ...data, settings: { ...data.settings, ...s } });
}

export function replaceAll(next: AppData) {
  commit(sanitize(next));
}

export function clearAll() {
  commit(EMPTY);
}

export function opening(j: Journey) {
  return tatkalOpening(j.journeyDate, j.travelClass, j.boardingDay);
}

/** Journeys whose travel date is today or later (IST), soonest booking-opening first. */
export function upcomingJourneys(list: Journey[], at = now()): Journey[] {
  const today = istDate(at);
  return list
    .filter((j) => j.journeyDate >= today && j.active !== false)
    .sort((a, b) => opening(a).epoch - opening(b).epoch);
}

/** The journey to focus on: default if upcoming, else the soonest upcoming. */
export function focusJourney(list: Journey[], at = now()): Journey | null {
  const up = upcomingJourneys(list, at);
  // Prefer a journey whose window opened < 2h ago or is still ahead.
  const live = up.filter((j) => opening(j).epoch > at - 2 * 3_600_000);
  const pool = live.length ? live : up;
  return pool.find((j) => j.isDefault) ?? pool[0] ?? null;
}

export function blankJourney(): Journey {
  return {
    id: uid(),
    label: '',
    from: '',
    to: '',
    boarding: '',
    journeyDate: '',
    boardingDay: 1,
    travelClass: 'SL',
    quota: 'TQ',
    trains: [],
    passengers: [{ id: uid(), name: '', age: null, gender: '', berth: 'NP' }],
    checks: { irctcAccount: false, aadhaar: false, payment: false },
    isDefault: data.journeys.length === 0,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
