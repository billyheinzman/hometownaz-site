# /sun-city-grand/

This folder holds all The Grand pages.

## Files in this folder

- `_nav.html` — the SG-specific sub-nav (Floor Plans, Market Intel, Community
  Fees, etc.) shared across all SG pages. Edit this when adding/renaming
  an SG sub-page, then run `python3 ../build-nav.py`.
- `_template.html` — base page template all new SG pages start from.
  Contains hero, breadcrumb, nav-markers, footer. Has `{{PLACEHOLDER}}`
  tokens to fill in.
- `CONTENT-PROMPTS.md` — the master prompt list for collecting content
  from Billy/Lona. Each SG page has a section here describing what's
  needed before it can be built.
- `images/` — SG-specific images (community photos, floor plans, etc.)

## Pages (built as content arrives)

### Built ✅
_(none yet)_

### Planned (20 total)
- `index.html` — SG landing page (everything in one page)
- `floor-plans.html` — all SG floor plan models
- `our-listings.html` — current SG listings (or filter the root one)
- `market-intel.html` — multi-year market trends
- `monthly-closings.html` — every SG closing by month
- `community-fees.html` — what it costs to live there
- `cost-calculator.html` — true cost of ownership tool
- `buyer-budget.html` — what can I afford tool
- `del-webb.html` — SG history (1996-2004 Lona's era)
- `events.html` — community events calendar
- `golf.html` — Granite Falls + other courses
- `rec-centers.html` — Cimarron Center + amenities
- `club-finder.html` — all clubs
- `things-to-do.html` — restaurants/bars/shops near SG
- `relocation.html` — for out-of-state buyers
- `solar.html` — solar in SG
- `vendors.html` — vetted contractors
- `ask-anything.html` — AI assistant (placeholder)

## Adding a new SG page (workflow)

1. Copy `_template.html` to the new filename (e.g. `golf.html`)
2. Fill in the `{{PLACEHOLDER}}` tokens (title, description, headline, lede, etc.)
3. Write the page content where `{{PAGE_CONTENT}}` is
4. Run `python3 ../build-nav.py` from the project root — this stamps the
   nav into the new page automatically
5. The new page will appear with the current-page highlight on its own
   nav button
