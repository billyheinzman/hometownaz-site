# 🍪 Cookie Hunt — Vercel Setup

The cookie hunt uses 3 Vercel serverless functions (in `/api/`) plus Vercel KV
(a free Redis-backed key/value store) to ensure only **one** person globally
can claim the cookie. This is set up once, then runs forever.

---

## Step 1 — Create Vercel KV database (one-time)

1. Go to your Vercel project dashboard
2. Click the **Storage** tab
3. Click **Create Database** → choose **KV** (Redis)
4. Name it anything (e.g. `cookie-hunt-kv`)
5. Click **Create**
6. On the next screen, click **Connect Project** → pick this site
7. Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars

That's it for KV.

---

## Step 2 — Set the reset secret (one-time)

So you can re-open the hunt whenever you want:

1. Vercel project → **Settings** → **Environment Variables**
2. Add a new variable:
   - Name: `COOKIE_RESET_SECRET`
   - Value: any long random string (e.g. `kjh2391jksdf9281hjkfg`)
   - Environment: Production
3. Save
4. Trigger a redeploy (Deployments tab → ⋮ → Redeploy) so the new env var loads

**Keep this secret somewhere safe** — only you should know it.

---

## How it works

- **`/api/cookie-status`** — Called when scw-del-webb.html loads. Returns
  `{ claimed: true/false }`. If true, the 🍪 doesn't render and the promo
  banner on index.html shows "GIVEAWAY CLOSED" instead.

- **`/api/claim-cookie`** — Called when someone submits the form. Uses an
  atomic SET-if-not-exists in KV, so only the first POST wins. Returns
  `{ success: true }` for the winner, `{ success: false, error: 'already_claimed' }`
  for everyone after.

- **`/api/reset-cookie?secret=YOUR_SECRET`** — Hit this URL in your browser
  to re-open the hunt. Returns `{ ok: true }` on success. Bookmark this URL.

---

## Testing locally (optional)

If KV isn't configured (e.g. local dev), the functions fail gracefully:
`/api/cookie-status` always returns "not claimed" and `/api/claim-cookie`
returns success without persisting. That means the cookie hunt works in
development but doesn't enforce "first one wins" until KV is set up in prod.

---

## What you'll see when someone wins

The form POSTs to `/api/claim-cookie` first (to lock the giveaway), then
fires off a `mailto:` to `billyheinzman@gmail.com` with all their info.
The winner's browser opens their email app with the message pre-filled.
They hit Send, you get the email with their address.

If for any reason they don't actually hit Send, the giveaway is still
"claimed" in KV (so the cookie is gone for everyone else). You can re-open
with the reset URL if that happens.

---

## Costs

- Vercel KV free tier: 30,000 commands/month, 256MB storage. The cookie
  hunt uses ~2 commands per claim + 1 GET per page view. You won't come
  close to the limit.
- Vercel serverless functions: free tier is 100,000 invocations/month.
  Again, you won't come close.

Total cost: **$0**.
