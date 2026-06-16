# SEO Handoff — Hometown AZ Real Estate Site

**Prepared:** June 10, 2026
**Primary domain:** hometownaz.com
**Hosting:** Vercel (static HTML + serverless functions in `/api`)
**Total pages:** 127 HTML pages across 9 communities

---

## Domain Decision (IMPORTANT — do this first)

The primary domain is **hometownaz.com**. The site also has `lonajking.com`
and `suncitywestexperts.com`. Google treats these as separate sites, which
splits ranking authority. To consolidate:

1. Pick hometownaz.com as canonical (done — sitemap & robots now point here).
2. Set up 301 redirects from `lonajking.com/*` and `suncitywestexperts.com/*`
   to the same path on `hometownaz.com`. In Vercel, add the extra domains to
   the project and configure redirects (Vercel dashboard → Domains, or
   `vercel.json` redirects).
3. Once redirects are live, all three URLs work but authority pools into one site.

---

## What's Already Good

- Every page has a unique `<title>` and meta description (better than most sites).
- Every page has exactly one `<h1>`.
- 12 key pages already have JSON-LD structured data (all community landing
  pages, homepage, golf, Del Webb).
- Mobile viewport tag present on all real content pages.
- Clean URL structure, one folder per community.

---

## Done in This Pass

- **Floor plan watermarks** — applied the "LONA KING REALTOR · 623-203-6271"
  diagonal watermark (matching Sun City West's style) to floor plan images that
  lacked it: Sun City (333), PebbleCreek (22), Arizona Traditions (61), Corte
  Bella (21), and the clean Sun City Grand plans (33). Total ~470 images.
  - **Corte Bella note:** these had a faint older "King Realtors" watermark
    underneath; the new watermark layers over it (can't remove baked-in pixels),
    so they're lightly double-marked. Re-source clean originals if it bothers you.
  - **⚠️ Sun City Grand — 1 image still needs a clean replacement:** 9165
    (Verde) still carries the **Coldwell Banker** watermark. Source a clean
    version from livegrandaz.com or suncity.com/grand, then watermark to match.
    All other Grand plans (including the 9 other formerly-Coldwell-Banker plans)
    have been replaced with clean official sources and watermarked.
- **Fee-change notice** added to the SCW Community Fees page.
- **sitemap.xml regenerated** — now lists all 125 indexable pages (was 44).
  Points to hometownaz.com. Redirect stubs excluded.
- **robots.txt updated** to reference the hometownaz.com sitemap.
- **Canonical tags** — all 125 content pages now canonical to hometownaz.com
  (104 retargeted from lonajking/suncitywestexperts, 21 added where missing).
- **Open Graph tags** — added complete OG sets to 60 pages that lacked them;
  every content page now has og:title/description/type/url. Also fixed 5 pages
  whose OG tags had been copy-pasted from the wrong page (showed "Community
  Fees" content on clubhouse/golf/events pages).
- **JSON-LD schema** — added BreadcrumbList + WebPage + RealEstateAgent schema
  to 113 pages that lacked it. All 139 schema blocks validated as correct JSON.
  Existing schema URLs retargeted to hometownaz.com.
- **Duplicate titles** — the two duplicate pairs now resolved via canonical
  consolidation (orphan Corte Bella floor-plans page points to the live one;
  root rec-centers.html points to the Festival original).
- **Titles shortened** — 106 over-long titles trimmed (the
  `| Lona King & Billy Heinzman` suffix shortened to `| Hometown AZ` on interior
  pages; full agent branding kept on the homepage and community landing pages).

## Remaining (judgment calls — left for you/manager)

- **~80 titles still over 60 chars** — these are long because the descriptive
  part itself is keyword-rich (e.g. "Community Fees — APF, Rec Card, Resale
  Transfer & HOA"). Trimming needs human judgment about which keywords to keep;
  an automated cut would drop real search terms. Most are only slightly over and
  Google front-loads the important words anyway. Lowest priority.
- **Meta descriptions outside 70-160 chars (84)** — same reasoning; review with
  search data in hand.
- **Content bug to flag:** the root `rec-centers.html` is a copy of the Sun City
  Festival rec centers page but is linked from Arizona Traditions pages. Worth
  deciding whether Arizona Traditions should have its own rec centers page or
  relink. Canonical now prevents SEO penalty, but the user-facing link is still
  cross-community.

---

## To Do — Priority Order

### 1. Submit to Google Search Console (highest impact, ~15 min)
- Verify ownership of hometownaz.com.
- Submit `https://hometownaz.com/sitemap.xml`.
- Do the same in Bing Webmaster Tools (Bing still matters for older users).
- This is the single biggest step for getting indexed and found.

### 2. Google Business Profile (huge for local 55+ search)
- Claim/optimize the Google Business Profile for the team.
- Link it to hometownaz.com.
- Local pack results drive a large share of "Sun City West realtor" searches.

### 3. Domain redirects (your task — see top of doc)
- 301 redirect lonajking.com and suncitywestexperts.com to hometownaz.com.

### 4. Optional polish (low priority — see "Remaining" above)
- Trim the ~80 still-long titles and off-length meta descriptions with search
  data in hand. Not urgent; keywords are front-loaded.
- Resolve the rec-centers.html cross-community link.

---

## Serverless Functions (`/api`) — Operational Notes

- **`/api/rates.js`** — fetches Freddie Mac weekly mortgage rates for the
  homepage header. No API key needed. After deploy, visit
  `hometownaz.com/api/rates` to confirm it returns real numbers. Note: Freddie
  Mac does not publish a 5/1 ARM rate, so that slot auto-hides.
- **Cookie Hunt functions** — require Vercel KV environment variables. Confirm
  these are set in the Vercel project settings.

---

## Non-SEO Note: Nav Build Script

`build-nav.py` stamps shared nav into pages between `<!-- NAV:START -->` and
`<!-- NAV:END -->` markers, sourcing from each community's `_nav.html`. One
quirk: paths in `_nav.html` are prefixed with the community folder, which is
correct for root-level pages but can double-up if stamped into pages already
inside that folder. The SCW `index.html` is excluded from the script and was
hand-set. Review path handling before running a full nav rebuild.

---

## Watermark Audit (June 12, 2026)

All community floor-plan watermarks were audited against the Sun City West
standard: a large, bold diagonal tile reading **"LONA KING REALTOR · 623-203-6271"**.

**Matching the standard (no action needed):**
- Sun City West (reference) ✓
- Sun City ✓
- PebbleCreek ✓
- Sun City Grand ✓
- Arizona Traditions ✓
- Sun Village ✓ (re-watermarked June 12 — earlier version was too small/faint; now matches)

**Need clean re-source (left as-is by decision — do NOT overlay a second mark):**
- ~~**Sun City Festival**~~ — **FIXED June 12.** Re-sourced the official Del Webb
  "All Series" brochure PDF, rendered the 19 current floor plans (Prelude, Skyline,
  Retreat, Encore, Enchantment series), and watermarked them to the SCW standard.
  The old "Heinzman" watermarked images are replaced, and 6 plans that previously
  showed a placeholder (Audrey, Bayley, Kinsey, Traverse, Venture, Odyssey) now have
  images. Plan data verified accurate against the brochure. Also enriched the
  rec-centers page with the official amenity list from the brochure. NOTE: the
  historical resale plans (Estate/Premier/Classic/Cottage/Holiday — celebration,
  destiny, fiesta, etc.) still carry the old watermark; no clean originals exist for
  those discontinued plans and they are not in the current brochure.
- ~~**Corte Bella**~~ — **FIXED June 12.** Re-sourced clean PDF plans from the
  builder, rendered them, and re-watermarked all 24 images (S + R variants) to the
  standard. The old double-marked images are replaced. Also added the two Villa
  plans (Bellita, Quinta) that previously showed a "not available" placeholder.
  Removed the obsolete PRESIDIO_COLLECTION.jpg sheet.

**Why not just fix them now:** Both Festival and Corte Bella have their watermarks
baked into the only image copies we have — there are no clean (un-watermarked)
originals on hand. A baked-in watermark cannot be removed (the pixels are gone),
and overlaying the standard mark would create the same double-marking Corte Bella
already has. The correct fix is to **re-source clean original floor-plan images**
(from the builder / Del Webb / community sites), then watermark them fresh to match
the standard in one pass. Until then, these two are intentionally left unchanged.
