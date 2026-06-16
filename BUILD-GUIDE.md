# Site Build & Maintenance Guide

This site is **pure static HTML** — no build step is required to deploy.
But there are a few helper scripts that keep things in sync as the site grows.

---

## The shared navigation system

Every Sun City West sub-page shows the same 17-button navigation grid
(Floor Plans, Market Intel, Community Fees, etc.). Instead of editing 18+
HTML files every time you want to add or rename a nav item, the nav lives
in **one file** and gets stamped into every page.

### Files involved

| File | Purpose |
|---|---|
| `_nav.html` | **Single source of truth** for the nav. Edit this. |
| `build-nav.py` | Reads `_nav.html` and stamps it into every page. Run this after editing. |
| `*.html` (each page) | Has `<!-- NAV:START -->` / `<!-- NAV:END -->` markers where the nav gets injected. |

### Daily workflow

**To add or rename a nav item:**

1. Open `_nav.html`
2. Add or edit the `<a href="...">` link
3. Run `python3 build-nav.py`
4. Done — every page now has the updated nav

**To check what would change without writing files:**

```bash
python3 build-nav.py --check
```

**To add the nav to a brand new page:**

Wherever you want the nav to render in the new page's HTML, paste:

```html
<!-- NAV:START -->
<!-- NAV:END -->
```

Then run `python3 build-nav.py` and the nav gets stamped in.

### Current-page highlighting

The build script automatically detects which page is which and adds a
`scw-nav-btn-current` class to the link matching the current filename.
That's what makes each page show its own nav button highlighted.

The CSS for `.scw-nav-btn-current` (white background, orange border, no
hover lift) is already included on every page.

---

## Sitemap

`sitemap.xml` lists all 22 site pages with priority + change-frequency
hints for search engines. `robots.txt` points to it.

**When to regenerate:** When you add a new page or significantly change
content. To regenerate, edit the `priorities` dict at the top of the
script I used to make it (see git history or re-run the inline script
in `build-nav.py`'s sibling location).

For now, just edit `sitemap.xml` by hand when adding a page — add a
`<url>` block matching the others.

---

## Photo compression

`compress-listing-photos.sh` — drop in a folder of new MLS photos, run with
an MLS number, and it picks 12, resizes to 1600px, and installs them at
`images/listings/<MLS>/01.jpg`–`12.jpg`. See the script's header comment
for usage.

---

## Cookie hunt

The Starbucks cookie-hunt feature uses 3 Vercel serverless functions in
`/api/` plus Vercel KV. See `COOKIE-HUNT-SETUP.md` for the one-time setup.

---

## Deploying

Drop the whole folder into your Vercel repo (or upload to your host).
There is no build step — every `.html` file is its own deliverable.

Just remember: **after editing `_nav.html`, run `python3 build-nav.py`
BEFORE deploying.** Otherwise the pages won't have the new nav.
