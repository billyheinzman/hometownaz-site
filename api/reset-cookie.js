// /api/reset-cookie.js
// Re-opens the cookie hunt by deleting the "claimed" record.
// Protected by a simple secret in the URL: /api/reset-cookie?secret=YOUR_SECRET
//
// Setup: in Vercel project → Settings → Environment Variables, add
//   COOKIE_RESET_SECRET = (any long random string you choose)
// Then visit: https://yoursite.com/api/reset-cookie?secret=YOUR_SECRET

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const secret = process.env.COOKIE_RESET_SECRET;
  const provided = (req.query && req.query.secret) || '';

  if (!secret) {
    res.status(503).json({ ok: false, error: 'reset_secret_not_configured' });
    return;
  }
  if (provided !== secret) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    res.status(503).json({ ok: false, error: 'kv_not_configured' });
    return;
  }

  try {
    const r = await fetch(`${kvUrl}/del/cookie_claimed`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${kvToken}` }
    });
    if (!r.ok) {
      res.status(500).json({ ok: false, error: 'kv_error' });
      return;
    }
    res.status(200).json({ ok: true, message: 'Cookie hunt re-opened!' });
  } catch (err) {
    console.error('reset-cookie error:', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}
