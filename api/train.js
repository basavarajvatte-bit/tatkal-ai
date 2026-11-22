// Vercel serverless function: GET /api/train?no=12115
// Looks up a train's timetable from RailRadar.
// Key: RAILRADAR_API_KEY environment variable, or else the user's own key sent from the app in the
// X-RailRadar-Key header (saved only on their phone). The key is never stored or logged here.
import { normalizeTrain } from './_lib/railradar.js';

const MEM_TTL = 6 * 3_600_000;
const mem = new Map(); // warm-instance cache: trainNo -> { at, train }

function send(res, status, body, cache = 'no-store') {
  res.setHeader('Cache-Control', cache);
  res.status(status).json(body);
}

export default async function handler(req, res) {
  const no = String(req.query?.no ?? '').trim();
  if (!/^\d{5}$/.test(no)) return send(res, 400, { ok: false, code: 'INVALID', message: 'Train number must be 5 digits' });

  const fromUser = String(req.headers?.['x-railradar-key'] ?? '').trim();
  const key = process.env.RAILRADAR_API_KEY || (/^[A-Za-z0-9._~+/=-]{8,200}$/.test(fromUser) ? fromUser : '');
  if (!key) return send(res, 503, { ok: false, code: 'NO_KEY', message: 'Train search is not set up yet (API key missing)' });

  const hit = mem.get(no);
  if (hit && Date.now() - hit.at < MEM_TTL) {
    return send(res, 200, { ok: true, train: hit.train }, 'public, s-maxage=86400, stale-while-revalidate=604800');
  }

  let last = 'unknown';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`https://api.railradar.in/v1/trains/${no}?haltsOnly=true`, {
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(4500),
      });
      if (r.status === 404) return send(res, 404, { ok: false, code: 'NOT_FOUND', message: 'TRAIN NOT FOUND' });
      if (r.status === 401 || r.status === 403) return send(res, 502, { ok: false, code: 'KEY_REJECTED', message: 'Train data provider rejected the API key' });
      if (r.status === 429) return send(res, 429, { ok: false, code: 'LIMIT', message: 'Free search limit reached for now' });
      if (!r.ok) {
        last = `HTTP ${r.status}`;
        continue;
      }
      const body = await r.json().catch(() => null);
      if (!body || body.success === false) {
        const msg = String(body?.error?.code ?? body?.error?.message ?? '');
        if (/not.?found/i.test(msg)) return send(res, 404, { ok: false, code: 'NOT_FOUND', message: 'TRAIN NOT FOUND' });
        last = 'bad response';
        continue;
      }
      const train = normalizeTrain(body.data, no);
      if (!train) return send(res, 404, { ok: false, code: 'NOT_FOUND', message: 'TRAIN NOT FOUND' });
      mem.set(no, { at: Date.now(), train });
      if (mem.size > 500) mem.delete(mem.keys().next().value);
      return send(res, 200, { ok: true, train }, 'public, s-maxage=86400, stale-while-revalidate=604800');
    } catch (e) {
      last = e?.name === 'TimeoutError' ? 'timeout' : 'network';
    }
  }
  console.error(`train lookup failed for ${no}: ${last}`);
  return send(res, 502, { ok: false, code: 'UPSTREAM', message: `Train data provider not responding (${last})` });
}
