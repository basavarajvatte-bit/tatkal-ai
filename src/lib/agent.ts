import type { Booking, Journey } from './types';
import type { TrainInfo } from './trainData';
import { runsOn } from './trainData';
import { addDays, classLabel, fmtDate, isValidISODate, tatkalOpening, fmtHour } from './time';
import { MAX_TATKAL_PASSENGERS, passengerErrors } from './validate';

/** One thing the agent found while checking a plan. */
export interface Finding {
  level: 'ok' | 'warn' | 'block';
  text: string;
  fix?: { label: string; href: string };
}

/** "SOLAPUR JN (SUR)" → "SUR" */
export const stationCode = (s: string) => /\(([A-Z0-9]{1,8})\)\s*$/.exec(s.trim().toUpperCase())?.[1] ?? null;

const BOOKED: Booking['status'][] = ['CONFIRMED', 'RAC', 'WL'];

/** A ticket already recorded for this plan (to stop a second booking by mistake). */
export const existingBooking = (j: Journey, bookings: Booking[]) =>
  bookings.find((b) => b.journeyId === j.id && BOOKED.includes(b.status)) ?? null;

/** Check one train of the plan against its real timetable. */
export function verifyTrain(j: Journey, t: TrainInfo, isPreferred: boolean): Finding[] {
  const f: Finding[] = [];
  const edit = { label: 'Plan theek karo', href: `#/journeys/${j.id}` };
  const name = `${t.number} ${t.name}`;
  const fromCode = stationCode(j.from);
  const toCode = stationCode(j.to);
  const bi = fromCode ? t.stops.findIndex((s) => s.code === fromCode) : -1;
  const di = toCode ? t.stops.findIndex((s) => s.code === toCode) : -1;

  if (fromCode && bi < 0) f.push({ level: isPreferred ? 'block' : 'warn', text: `${name} ${fromCode} station pe nahi rukti`, fix: edit });
  if (toCode && di < 0) f.push({ level: isPreferred ? 'block' : 'warn', text: `${name} ${toCode} station pe nahi rukti`, fix: edit });
  if (bi >= 0 && di >= 0 && di <= bi) f.push({ level: 'block', text: `${name}: destination boarding se pehle aata hai`, fix: edit });

  // Boarding day decides the Tatkal date – the most important check.
  const day = bi >= 0 ? t.stops[bi].day : isPreferred ? j.boardingDay : null;
  if (isPreferred && bi >= 0 && t.stops[bi].day !== j.boardingDay && isValidISODate(j.journeyDate)) {
    const right = tatkalOpening(j.journeyDate, j.travelClass, t.stops[bi].day);
    f.push({
      level: 'block',
      text: `Train ${fromCode} pe day ${t.stops[bi].day} ko pahunchti hai, plan mein day ${j.boardingDay} likha hai. Sahi Tatkal time: ${fmtDate(right.openDate)} ${fmtHour(right.hour)}`,
      fix: edit,
    });
  }

  if (day != null && isValidISODate(j.journeyDate)) {
    const start = addDays(j.journeyDate, -(day - 1));
    const runs = runsOn(t, start);
    if (runs === false) f.push({ level: isPreferred ? 'block' : 'warn', text: `${name} ${fmtDate(start)} ko nahi chalti`, fix: edit });
    else if (runs && isPreferred) f.push({ level: 'ok', text: `${name} us din chalti hai` });
  }

  if (t.classes.length && !t.classes.includes(j.travelClass))
    f.push({ level: isPreferred ? 'block' : 'warn', text: `${name} mein ${classLabel(j.travelClass)} nahi hai`, fix: edit });
  else if (t.classes.length && isPreferred) f.push({ level: 'ok', text: `${classLabel(j.travelClass)} is train mein hai` });

  return f;
}

/** Everything the agent checks about a plan (train data passed in, null = couldn't get it). */
export function planFindings(j: Journey, trains: Record<string, TrainInfo | null | undefined>, bookings: Booking[], now: number): Finding[] {
  const f: Finding[] = [];
  const edit = { label: 'Plan theek karo', href: `#/journeys/${j.id}` };

  const done = existingBooking(j, bookings);
  if (done) f.push({ level: 'block', text: `Is plan ka ticket pehle se save hai (PNR ${done.pnr || '—'}, ${done.status}). Dobara book mat karo.`, fix: { label: 'History dekho', href: '#/history' } });

  if (!isValidISODate(j.journeyDate)) f.push({ level: 'block', text: 'Journey date nahi hai', fix: edit });
  else {
    const o = tatkalOpening(j.journeyDate, j.travelClass, j.boardingDay);
    if (now > o.epoch + 6 * 3_600_000) f.push({ level: 'warn', text: 'Tatkal ka time kaafi pehle nikal chuka hai – seats shayad khatam' });
  }

  const pax = j.passengers;
  if (!pax.length) f.push({ level: 'block', text: 'Koi passenger nahi', fix: edit });
  else if (pax.length > MAX_TATKAL_PASSENGERS) f.push({ level: 'block', text: `Tatkal mein max ${MAX_TATKAL_PASSENGERS} passenger`, fix: edit });
  else {
    const bad = pax.filter((p) => passengerErrors(p).length);
    if (bad.length) f.push({ level: 'block', text: `Passenger details adhuri: ${bad.map((p) => p.name || 'No name').join(', ')}`, fix: edit });
    else f.push({ level: 'ok', text: `${pax.length} passenger ready` });
  }

  const list = j.trains.filter((t) => /^\d{5}$/.test(t.number));
  if (!list.length) f.push({ level: 'block', text: 'Koi train nahi chuni', fix: { label: 'Train search karo', href: '#/trains' } });
  list.forEach((t, i) => {
    const info = trains[t.number];
    if (info) f.push(...verifyTrain(j, info, i === 0));
    else if (info === null && i === 0) f.push({ level: 'warn', text: `Train ${t.number} ki details check nahi ho payi – NTES pe ek baar dekh lo` });
  });
  if (list.length === 1) f.push({ level: 'warn', text: 'Koi backup train nahi – preferred full hui toh doosri ready nahi', fix: edit });

  if (!j.checks.irctcAccount) f.push({ level: 'warn', text: 'IRCTC login check nahi kiya', fix: edit });
  if (!j.checks.aadhaar) f.push({ level: 'warn', text: 'IRCTC account Aadhaar verified hai? (Tatkal ke liye zaroori)', fix: edit });
  if (!j.checks.payment) f.push({ level: 'warn', text: 'UPI / payment ready hai?', fix: edit });

  return f;
}

/** Android Chrome: open the official IRCTC Rail Connect app; falls back to the website if not installed. */
export function irctcAppUrl(web: string) {
  const path = web.replace(/^https:\/\//, '');
  return `intent://${path}#Intent;scheme=https;package=cris.org.in.prs.ima;S.browser_fallback_url=${encodeURIComponent(web)};end`;
}
export const isAndroid = () => /android/i.test(navigator.userAgent);
export const PNR_URL = 'https://www.indianrail.gov.in/enquiry/PNR/PnrEnquiry.html';
