// Vercel serverless function: returns server time in ms (UTC epoch).
// Used by the countdown to correct the phone's clock. No data is stored.
export default function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.status(200).json({ now: Date.now() });
}
