import { useSyncExternalStore } from 'react';
import type { AppData, Booking, Journey, Settings } from './types';
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
  settings: { notifications: true, preferredArrival: '08:00' },
};

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
    settings: { ...EMPTY.settings, ...(d.settings ?? {}) },
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
    .filter((j) => j.journeyDate >= today)
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
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
