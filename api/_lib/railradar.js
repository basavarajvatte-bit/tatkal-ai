// Turns a RailRadar /v1/trains/{number} response into Tatkal AI's own TrainInfo shape.
// Pure function (no network) so it can be unit-tested. Returns null if the data is not trustworthy.

const CLASS_CODES = ['1A', '2A', '3A', '3E', 'SL', '2S', 'CC', 'EC'];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)/;

const str = (v, max = 80) => (typeof v === 'string' ? v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

export function parseTime(v) {
  if (typeof v !== 'string') return null;
  const m = TIME_RE.exec(v.trim());
  return m ? `${m[1]}:${m[2]}` : null;
}

/** Minutes from a number, "HH:MM", "12h 30m" or "750 min". */
export function parseDuration(v) {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.round(v);
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  let m = /^(\d{1,3}):([0-5]\d)$/.exec(s);
  if (m) return +m[1] * 60 + +m[2];
  m = /^(?:(\d{1,3})\s*h[a-z]*)?\s*(?:(\d{1,2})\s*m[a-z]*)?$/.exec(s);
  if (m && (m[1] || m[2])) return (+(m[1] || 0)) * 60 + +(m[2] || 0);
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** ['mon', ...] from an object {mon:true}, an array, or a string like "Mon,Tue" / "Daily". */
export function parseRunDays(v) {
  if (Array.isArray(v)) {
    const set = new Set(v.map((d) => str(String(d)).toLowerCase().slice(0, 3)));
    return DAY_KEYS.filter((d) => set.has(d));
  }
  if (v && typeof v === 'object') {
    const lower = Object.fromEntries(Object.entries(v).map(([k, val]) => [k.toLowerCase().slice(0, 3), val]));
    return DAY_KEYS.filter((d) => lower[d] === true || lower[d] === 1 || lower[d] === 'Y' || lower[d] === 'y');
  }
  if (typeof v === 'string') {
    if (/daily|all days/i.test(v)) return [...DAY_KEYS];
    const s = v.toLowerCase();
    return DAY_KEYS.filter((d) => s.includes(d));
  }
  return [];
}

export function parseClasses(...lists) {
  const found = new Set();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const c of list) {
      const code = str(typeof c === 'string' ? c : c?.code ?? c?.classCode ?? c?.class ?? '', 4).toUpperCase();
      if (CLASS_CODES.includes(code)) found.add(code);
    }
  }
  return CLASS_CODES.filter((c) => found.has(c));
}

function minutesOf(t) {
  return t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : null;
}

export function normalizeTrain(data, requestedNo) {
  const t = data?.train;
  const route = Array.isArray(data?.route) ? data.route : [];
  if (!t || typeof t !== 'object') return null;
  const number = str(String(t.number ?? ''), 5);
  // Guard against a wrong/duplicate record coming back for a different train.
  if (number !== requestedNo) return null;
  const name = str(t.name);
  if (!name) return null;

  const seen = new Set();
  const stops = [];
  for (const s of route) {
    if (s && s.isHalt === false) continue; // only stations where the train stops
    const code = str(s?.station?.code ?? s?.stationCode ?? '', 8).toUpperCase();
    if (!code) continue;
    const arr = parseTime(s.arrival);
    const dep = parseTime(s.departure);
    const depDay = num(s.departureDay) ?? num(s.arrivalDay) ?? num(s.day) ?? 1;
    const arrDay = num(s.arrivalDay) ?? depDay;
    const key = `${code}:${arrDay}:${arr ?? ''}`;
    if (seen.has(key)) continue; // duplicate stop
    seen.add(key);
    let halt = null;
    if (arr && dep) {
      let h = minutesOf(dep) - minutesOf(arr) + (depDay - arrDay) * 1440;
      if (h < 0) h += 1440;
      halt = h;
    }
    stops.push({
      code,
      name: str(s?.station?.name ?? s?.stationName ?? code),
      arr,
      dep,
      day: Math.max(1, Math.round(depDay)),
      arrDay: Math.max(1, Math.round(arrDay)),
      distance: num(s.distance),
      halt,
      platform: s.platform != null && s.platform !== '' ? str(String(s.platform), 6) : null,
    });
  }
  if (stops.length < 2) return null;

  const first = stops[0];
  const last = stops[stops.length - 1];
  return {
    number,
    name,
    type: str(t.type, 40) || null,
    category: str(t.category, 40) || null,
    from: { code: str(t.source?.code, 8).toUpperCase() || first.code, name: str(t.source?.name) || first.name },
    to: { code: str(t.destination?.code, 8).toUpperCase() || last.code, name: str(t.destination?.name) || last.name },
    distanceKm: num(t.distance) ?? last.distance,
    durationMin: parseDuration(t.duration),
    runDays: parseRunDays(t.runDays),
    classes: parseClasses(t.availableClasses, t.classes),
    pantry: typeof t.hasPantry === 'boolean' ? t.hasPantry : null,
    stops,
    source: 'RailRadar (independent, not Indian Railways)',
    fetchedAt: Date.now(),
  };
}
