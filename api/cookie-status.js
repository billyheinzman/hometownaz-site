// /api/cookie-status.js
// Returns { claimed: true|false, claimedAt: ISO date or null }
//
// Persistence: this uses Vercel KV (Redis-backed key/value store).
// To enable: in your Vercel project dashboard → Storage → Create KV Database
// → connect it to this project. Vercel will auto-inject KV_REST_API_URL and
// KV_REST_API_TOKEN env vars.
//
// If KV is NOT set up, this function falls back to "never claimed" and the
// claim endpoint will return success but won't persist across cold starts.
// That means the cookie hunt still works for the first claim per region,
// but won't be globally consistent. Set up Vercel KV for real one-winner behavior.

export default async function handler(req, res) {
  // CORS headers — allow same-origin only is the default; we set permissive for any *.vercel.app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const status = await getClaimStatus();
    res.status(200).json(status);
  } catch (err) {
    console.error('cookie-status error:', err);
    res.status(200).json({ claimed: false, claimedAt: null, fallback: true });
  }
}

async function getClaimStatus() {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return { claimed: false, claimedAt: null, kvConfigured: false };
  }
  const r = await fetch(`${kvUrl}/get/cookie_claimed`, {
    headers: { 'Authorization': `Bearer ${kvToken}` }
  });
  if (!r.ok) throw new Error(`KV GET failed: ${r.status}`);
  const data = await r.json();
  const value = data.result;
  if (!value) return { claimed: false, claimedAt: null, kvConfigured: true };
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return { claimed: !!parsed.claimed, claimedAt: parsed.claimedAt || null, kvConfigured: true };
  } catch {
    return { claimed: true, claimedAt: null, kvConfigured: true };
  }
}
