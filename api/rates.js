// /api/rates.js
// Fetches current mortgage rates (Freddie Mac PMMS) and returns clean JSON.
//
// WHY: the browser can't fetch Freddie Mac directly (CORS). This runs server-side.
// CACHING: cached at the edge for 12 hours so it's not re-fetched on every load.
//
// Freddie Mac publishes 30-yr and 15-yr fixed only — no 5/1 ARM. The header
// hides the ARM slot automatically when fiveOneArm comes back null.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=86400');
  res.setHeader('Content-Type', 'application/json');

  // Safety-net fallback values (used only if the fetch fails). Update occasionally.
  let rates = {
    thirtyYear: null,
    fifteenYear: null,
    fiveOneArm: null,   // Freddie Mac doesn't publish this — stays null
    asOf: null,
    source: 'Freddie Mac PMMS',
  };

  try {
    const fmUrl = 'https://www.freddiemac.com/pmms/docs/PMMS_history.csv';
    const resp = await fetch(fmUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (resp.ok) {
      const csv = await resp.text();
      const lines = csv.trim().split('\n').filter(Boolean);
      const last = lines[lines.length - 1].split(',');
      // PMMS_history.csv columns: date, 30yr, 15yr (+ historical extras)
      const date = (last[0] || '').trim();
      const thirty = parseFloat(last[1]);
      const fifteen = parseFloat(last[2]);
      if (!isNaN(thirty)) rates.thirtyYear = thirty;
      if (!isNaN(fifteen)) rates.fifteenYear = fifteen;
      if (date) {
        const d = new Date(date);
        rates.asOf = isNaN(d.getTime())
          ? date
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }
  } catch (e) {
    // fall through with nulls; header keeps its existing displayed values
  }

  return res.status(200).json(rates);
}
