// /api/claim-cookie.js
// Atomic claim: only succeeds if not already claimed.
// Body: { name, email } — minimal, just to log who got it
// Returns: { success: true } or { success: false, error: 'already_claimed' }
//
// Persistence via Vercel KV (see /api/cookie-status.js header for setup).

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'method_not_allowed' });
    return;
  }

  const body = req.body || {};
  const name = (body.name || '').toString().slice(0, 200);
  const email = (body.email || '').toString().slice(0, 200);

  if (!name || !email) {
    res.status(400).json({ success: false, error: 'missing_fields' });
    return;
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    // KV not configured — let the claim through, but warn.
    res.status(200).json({ success: true, kvConfigured: false });
    return;
  }

  try {
    // Atomic SET with NX (only if key doesn't already exist)
    const record = JSON.stringify({
      claimed: true,
      claimedAt: new Date().toISOString(),
      name: name,
      email: email
    });

    const r = await fetch(`${kvUrl}/set/cookie_claimed?nx=1`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kvToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(record)
    });

    if (!r.ok) {
      const t = await r.text();
      console.error('KV SET failed:', r.status, t);
      res.status(500).json({ success: false, error: 'kv_error' });
      return;
    }

    const data = await r.json();
    // Upstash NX semantics: data.result === 'OK' if set; null if already existed
    if (data.result === 'OK') {
      res.status(200).json({ success: true });
    } else {
      res.status(200).json({ success: false, error: 'already_claimed' });
    }
  } catch (err) {
    console.error('claim-cookie error:', err);
    res.status(500).json({ success: false, error: 'server_error' });
  }
}
