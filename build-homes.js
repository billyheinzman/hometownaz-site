#!/usr/bin/env node
/*
 * build-homes.js | Builds a shareable page + QR code for every one of OUR listings.
 *
 * USAGE (from the site folder):
 *     node build-homes.js
 *
 * WHAT IT DOES:
 *   Loads data-listings.js and listings-data-patch.js exactly the way the browser
 *   does, takes every listing flagged isOurListing (active, coming soon, UCB,
 *   pending and recently sold), and writes:
 *
 *     homes/<slug>.html     one page per home  ->  hometownaz.com/homes/<slug>
 *     homes/qr-sheet.html   printable sheet of every active/pending QR code
 *     homes/index.html      sends visitors to our-listings.html
 *     homes/flyers.js       which homes have a flyer PDF (used by Our Listings)
 *
 *   FLYER PDFs: save the flyer (front + back in one PDF) as flyers/<slug>.pdf,
 *   e.g. flyers/15421-sentinel.pdf, then run this script. The "Download Flyer"
 *   button appears on that home's page and in the Our Listings popup.
 *
 *   Slugs are house number + street name, e.g. 17125 N FIRESTONE LN -> 17125-firestone.
 *   They never change, so a QR code printed today keeps working for good.
 *   Sold homes keep their page (marked SOLD, pointing to current listings), so
 *   old flyers and sign riders never hit a dead link.
 *
 * WHEN TO RUN:
 *   After every data refresh (new data-listings.js) or any edit to
 *   listings-data-patch.js. Same habit as build-nav.py. No npm installs needed.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'homes');
const SITE = 'https://hometownaz.com';

// ---- load data the same way the browser does --------------------------------
const ctx = { window: {}, console: { log() {}, warn: console.warn } };
vm.createContext(ctx);
for (const f of ['data-listings.js', 'listings-data-patch.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const A = vm.runInContext('ACTIVE_LISTINGS', ctx);

const BUCKETS = [
  ['active', 'Active'], ['comingSoon', 'Coming Soon'], ['ucb', 'Under Contract'],
  ['pending', 'Under Contract'], ['recentClosings', 'Sold'],
];
const homes = [];
const seen = new Set();
for (const [bucket, label] of BUCKETS) {
  for (const l of A[bucket] || []) {
    if (!l || !l.isOurListing || seen.has(l.mls)) continue;
    seen.add(l.mls);
    homes.push(Object.assign({}, l, { _bucket: bucket, _label: label }));
  }
}

// ---- helpers ------------------------------------------------------------------
const DIRS = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']);
const SUFFIX = { LN: 'Lane', DR: 'Drive', AVE: 'Avenue', ST: 'Street', RD: 'Road', CT: 'Court', CIR: 'Circle',
  WAY: 'Way', BLVD: 'Boulevard', PL: 'Place', TER: 'Terrace', TRL: 'Trail', PKWY: 'Parkway', LOOP: 'Loop' };

function slugOf(addr) {
  const t = String(addr).toUpperCase().replace(/--/g, ' ').trim().split(/\s+/);
  const out = [t[0]];
  for (let i = 1; i < t.length; i++) {
    const w = t[i];
    if (i === 1 && DIRS.has(w)) continue;
    if (SUFFIX[w]) continue;
    out.push(w.replace(/[^A-Z0-9]/g, ''));
  }
  return out.filter(Boolean).join('-').toLowerCase();
}
function cap(w) { return w ? w.charAt(0) + w.slice(1).toLowerCase() : w; }
function prettyAddr(addr) {
  return String(addr).replace(/--/g, '').trim().split(/\s+/).map((w, i) => {
    if (i === 0 || /^\d/.test(w) || /^#/.test(w)) return w.replace(/(\d)(ST|ND|RD|TH)$/, (m, d, s) => d + s.toLowerCase());
    if (DIRS.has(w) && i === 1) return w;
    if (SUFFIX[w]) return SUFFIX[w];
    return cap(w);
  }).join(' ');
}
function community(l) {
  const s = (l.subdiv || '').toUpperCase();
  if (s.includes('SUN CITY GRAND')) return 'The Grand';
  if (s.includes('SUN CITY WEST')) return 'Sun City West';
  if (s.includes('CORTE BELLA')) return 'Corte Bella';
  if (s.includes('SUN CITY') || l.zip === '85351' || l.zip === '85373') return 'Sun City';
  return l.marketing ? cap(l.marketing) : '';
}
function cityOf(l) {
  return { '85375': 'Sun City West', '85374': 'Surprise', '85387': 'Surprise', '85024': 'Phoenix',
    '85351': 'Sun City', '85373': 'Sun City' }[l.zip] || '';
}
function modelName(l) {
  const m = l.marketing && !/^[A-Z]?\d/.test(l.marketing) && !/SUN CITY|HILLSDALE/i.test(l.marketing) ? l.marketing : '';
  const pick = m || (l.model && !/^[A-Z]{0,2}\d/.test(l.model) && !/^PLAN/i.test(l.model) ? l.model : '');
  return pick.replace(/\s+UPDATED$/i, '').split(/\s+/).map(cap).join(' ').replace(/^Lasalle$/, 'LaSalle');
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => n ? '$' + Number(n).toLocaleString('en-US') : '';
const num = n => n ? Number(n).toLocaleString('en-US') : '';
const photos = l => (l.gallery && l.gallery.length ? l.gallery.map(p => '/' + p) : (l.photo ? [l.photo.replace(/^http:\/\//, 'https://')] : []));

// ---- shared page chrome (site colors: green / orange / cream) -----------------
const CSS = `*{box-sizing:border-box;margin:0;padding:0}
:root{--green:#2d3d2e;--orange:#c8622a;--orange-deep:#a14d1f;--cream:#f5f1ea;--border:#ddd6c8;--text:#2a2a2a;--muted:#7a6e60}
body{font-family:'Inter',system-ui,sans-serif;background:var(--cream);color:var(--text);font-size:15px;line-height:1.6}
a{color:var(--orange-deep)}
.top{background:var(--green);color:#fff}.top .in{max-width:1180px;margin:0 auto;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px}
.top a{color:#fff;text-decoration:none;font-weight:600;font-size:14px}.top .brand{font-family:'Merriweather',Georgia,serif;font-size:17px}
.wrap{max-width:1180px;margin:0 auto;padding:24px 20px 48px}
.grid{display:grid;grid-template-columns:1.6fr 1fr;gap:28px}
.gal{position:relative;border-radius:8px;overflow:hidden;background:#e6e0d4;aspect-ratio:4/3}
.gal img{width:100%;height:100%;object-fit:cover;display:block}
.gal .nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.45);color:#fff;border:0;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer}
.gal .prev{left:10px}.gal .next{right:10px}.gal .cnt{position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;padding:3px 9px;border-radius:12px}
.badge{position:absolute;top:12px;left:12px;background:#fff;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:5px 10px;border-radius:4px}
.badge.uc{background:var(--orange);color:#fff}.badge.sold{background:var(--green);color:#fff}
.card{background:#fff;border:1px solid var(--border);border-radius:8px;padding:22px}
.card+.card{margin-top:20px}
.comm{color:var(--orange);font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
h1{font-family:'Merriweather',Georgia,serif;font-size:27px;font-weight:700;line-height:1.25;margin:4px 0 2px}
.muted{color:var(--muted);font-size:13px}
.price{font-size:32px;font-weight:800;margin-top:10px}
.facts{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--border);margin-top:14px}
.facts div{padding:9px 0;border-bottom:1px solid var(--border);font-size:14px}.facts div:nth-child(odd){padding-right:10px}
.facts span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.07em}
.btn{display:inline-block;padding:11px 16px;border:1.5px solid var(--green);border-radius:6px;text-decoration:none;color:var(--green);font-size:14px;font-weight:600;margin:14px 8px 0 0}
.btn.primary{background:var(--orange);border-color:var(--orange);color:#fff}
.btn.flyer{display:block;text-align:center;border-color:var(--orange-deep);color:var(--orange-deep)}
.btn.hc{display:block;text-align:center}
h2{font-family:'Merriweather',Georgia,serif;font-size:20px;margin:28px 0 10px}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.pills span{background:#fff;border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:13px}
#map{height:280px;border-radius:8px;border:1px solid var(--border)}
.qr{width:190px;height:190px;margin:0 auto}.qr svg{width:100%;height:100%;display:block}
.center{text-align:center}
.sold-note{background:#fff;border:1px solid var(--border);border-left:4px solid var(--orange);border-radius:6px;padding:14px 16px;margin-bottom:20px}
footer{border-top:1px solid var(--border);background:#fff;color:var(--muted);font-size:12px}footer .in{max-width:1180px;margin:0 auto;padding:22px 20px 36px}
@media(max-width:860px){.grid{display:flex;flex-direction:column;gap:20px}.grid>.col{display:contents}.gal{order:1}.info{order:2}.about{order:3}.qrc{order:4}.who{order:5}.card+.card{margin-top:0}h1{font-size:23px}.top .brand{font-size:15px}}`;

const HEAD = (title, desc, img, url) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:url" content="${url}">${img ? `<meta property="og:image" content="${esc(img.startsWith('http') ? img : SITE + img)}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Merriweather:wght@700&display=swap" rel="stylesheet">`;
const TOP = `<header class="top"><div class="in"><a class="brand" href="/">Lona King &amp; Billy Heinzman</a><a href="/our-listings.html">All our listings</a></div></header>`;
const FOOT = `<footer><div class="in">Lona King | 623-203-6271 &nbsp;&nbsp; Billy Heinzman | 480-297-3830<br>HomeSmart | (623) 209-3200<br>Listing information is deemed reliable but not guaranteed and should be independently verified. Source: Arizona Regional Multiple Listing Service (ARMLS). Prices and availability subject to change.</div></footer>`;
const QRLIB = `<script src="https://unpkg.com/qrcode-generator@1.4.4/qrcode.js"></script>`;

// ---- per-home pages -----------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
// Flyer PDFs: drop flyers/<slug>.pdf (front + back in one file) and rerun.
const FLYER_DIR = path.join(ROOT, 'flyers');
const hasFlyer = slug => fs.existsSync(path.join(FLYER_DIR, slug + '.pdf'));
const slugs = new Map();
for (const l of homes) {
  let slug = slugOf(l.addr);
  if (slugs.has(slug)) slug += '-' + l.mls;
  slugs.set(slug, l);
  l._slug = slug;
  l._url = `${SITE}/homes/${slug}`;
}

for (const l of homes) {
  const addr = prettyAddr(l.addr), comm = community(l), city = cityOf(l), model = modelName(l);
  const sold = l._bucket === 'recentClosings';
  const pics = photos(l);
  const price = sold && l.soldPrice ? l.soldPrice : l.price;
  const facts = [
    [sold ? 'Sold price' : 'Price', money(price)], ['Status', l._label],
    ['Bedrooms', l.beds], ['Bathrooms', l.baths], ['Living area', l.sqft ? num(l.sqft) + ' sf' : ''],
    ['Lot', l.lotsqft > 1000 ? num(l.lotsqft) + ' sf' : ''], ['Year built', l.yr],
    ['Garage', l.garage ? l.garage + ' car' : (l.carport ? l.carport + ' carport' : '')],
    ['Model', model], ['Home type', l.dwelling], ['MLS #', l.mls],
    ['Closed', sold ? l.closeDate : ''],
  ].filter(f => f[1] !== '' && f[1] != null);
  const pills = [];
  if (comm && comm !== 'Hillsdale') pills.push('55+ community');
  if (l.pool) pills.push('Private pool');
  if (l.golfLot) pills.push('Golf course lot');
  if (l.common) pills.push('Backs to common area');
  if (l.azRoom) pills.push('Arizona room');
  if (l.isPriceReduced) pills.push('Price improved');
  const badgeCls = sold ? ' sold' : (l._bucket === 'active' || l._bucket === 'comingSoon' ? '' : ' uc');
  const desc = `${addr}, ${city} AZ | ${l.beds} bed, ${l.baths} bath, ${num(l.sqft)} sf | ${money(price)} | Lona King & Billy Heinzman, HomeSmart`;
  const flyer = hasFlyer(l._slug) ? `/flyers/${l._slug}.pdf` : '';
  const flyerBtn = flyer ? `<a class="btn flyer" href="${flyer}" target="_blank" rel="noopener" download="${l._slug}-flyer.pdf">&#128196; Download Flyer (PDF)</a>` : '';
  const sms = 'sms:4802973830?&body=' + encodeURIComponent('Hi Billy, I would like to see ' + addr);
  const html = `${HEAD(`${addr} | ${money(price)} | ${comm || city}`, desc, pics[0], l._url)}
<style>${CSS}</style></head><body>${TOP}
<main class="wrap">
${sold ? `<div class="sold-note"><b>This home has sold.</b> Thank you for your interest. <a href="/our-listings.html">See the homes we have for sale now.</a></div>` : ''}
<div class="grid">
 <div class="col">
  <div class="gal" id="gal">${pics.length ? `<img id="galimg" src="${esc(pics[0])}" alt="" onerror="this.style.visibility='hidden'">` : ''}<span class="badge${badgeCls}">${esc(l._label)}</span>
  ${pics.length > 1 ? `<button class="nav prev" onclick="step(-1)" aria-label="Previous photo">&#8249;</button><button class="nav next" onclick="step(1)" aria-label="Next photo">&#8250;</button><span class="cnt" id="cnt">1 / ${pics.length}</span>` : ''}</div>
  <div class="about"><h2>About this home</h2><p>${esc(l.remarks || '')}</p>
  ${pills.length ? `<div class="pills">${pills.map(p => `<span>${esc(p)}</span>`).join('')}</div>` : ''}
  ${l.lat && l.lon ? `<h2>Location</h2><div id="map"></div><p class="muted" style="margin-top:6px"><a href="https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lon}" target="_blank" rel="noopener">Open in Google Maps</a></p>` : ''}</div>
 </div>
 <div class="col">
  <div class="card info"><div class="comm">${esc(comm)}</div><h1>${esc(addr)}</h1><div class="muted">${esc(city)}, AZ ${esc(l.zip || '')}</div>
   <div class="price">${money(price)}</div>
   <div class="facts">${facts.map(f => `<div><span>${f[0]}</span>${esc(f[1])}</div>`).join('')}</div>
   ${sold ? `<a class="btn primary" href="/our-listings.html">See current listings</a>` : `<a class="btn primary" href="tel:+14802973830">Call Billy</a><a class="btn" href="tel:+16232036271">Call Lona</a><a class="btn" href="${sms}">Text to schedule a showing</a>`}
   ${flyerBtn}
   ${l.homesUrl ? `<a class="btn hc" href="${esc(l.homesUrl)}" target="_blank" rel="noopener">&#127968; View on Homes.com</a>` : ''}
  </div>
  <div class="card center qrc"><div class="qr" id="qr" data-url="${l._url}"></div><p class="muted" style="margin-top:8px">Scan or share this home</p><p class="muted"><a id="qrdl" href="#" download="${slug2(l)}-qr.gif">Download QR code</a></p></div>
  <div class="card who"><p><b>Lona King</b><br>623-203-6271 | azlonaking@gmail.com</p><p style="margin-top:10px"><b>Billy Heinzman</b><br>480-297-3830 | billyheinzman@gmail.com</p><p class="muted" style="margin-top:10px">HomeSmart</p></div>
 </div>
</div>
</main>${FOOT}
${QRLIB}<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var P=${JSON.stringify(pics)},i=0;
function step(d){i=(i+d+P.length)%P.length;document.getElementById('galimg').src=P[i];document.getElementById('cnt').textContent=(i+1)+' / '+P.length;}
(function(){var el=document.getElementById('qr');if(window.qrcode){var q=qrcode(0,'M');q.addData(el.dataset.url);q.make();el.innerHTML=q.createSvgTag({cellSize:4,margin:2,scalable:true});document.getElementById('qrdl').href=q.createDataURL(12,4);}})();
${l.lat && l.lon ? `if(window.L){var m=L.map('map',{scrollWheelZoom:false}).setView([${l.lat},${l.lon}],15);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(m);L.marker([${l.lat},${l.lon}]).addTo(m);}` : ''}
</script></body></html>`;
  fs.writeFileSync(path.join(OUT, l._slug + '.html'), html);
}
function slug2(l) { return l._slug; }

// ---- printable QR sheet (white page, thin lines, light on ink) -----------------
const forSale = homes.filter(l => l._bucket !== 'recentClosings');
const tiles = [{ t: 'All our listings', s: 'Full portfolio', u: `${SITE}/our-listings.html` }]
  .concat(forSale.map(l => ({ t: prettyAddr(l.addr), s: `${community(l) || cityOf(l)} | ${money(l.price)} | ${l._label}`, u: l._url })));
fs.writeFileSync(path.join(OUT, 'qr-sheet.html'), `<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR codes | Our Listings</title><meta name="robots" content="noindex"><style>
body{font-family:Helvetica,Arial,sans-serif;margin:24px;color:#2a2a2a}h1{font-weight:400;font-size:22px;margin:0 0 4px}p{color:#7a6e60;margin:0 0 18px;font-size:13px}
.g{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #ccc;border-left:1px solid #ccc}
.t{border-right:1px solid #ccc;border-bottom:1px solid #ccc;padding:16px;text-align:center;font-size:12px;break-inside:avoid}
.q{width:150px;height:150px;margin:0 auto 8px}.q svg{width:100%;height:100%;display:block}.t b{font-size:14px;display:block;margin-bottom:2px}.u{color:#c8622a;font-size:10px;margin-top:4px;word-break:break-all}
@media print{body{margin:.4in}}</style></head><body>
<h1>Our Listings | QR codes</h1><p>Lona King 623-203-6271 | Billy Heinzman 480-297-3830 | HomeSmart | printed from hometownaz.com/homes/qr-sheet</p>
<div class="g">${tiles.map(t => `<div class="t"><div class="q" data-url="${t.u}"></div><b>${esc(t.t)}</b><div>${esc(t.s)}</div><div class="u">${esc(t.u.replace('https://', ''))}</div></div>`).join('')}</div>
${QRLIB}<script>document.querySelectorAll('[data-url]').forEach(function(el){var q=qrcode(0,'M');q.addData(el.dataset.url);q.make();el.innerHTML=q.createSvgTag({cellSize:4,margin:2,scalable:true});});</script></body></html>`);

fs.writeFileSync(path.join(OUT, 'index.html'), `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/our-listings.html"><link rel="canonical" href="${SITE}/our-listings.html"><title>Our Listings</title></head><body><a href="/our-listings.html">Our Listings</a></body></html>`);

// flyer map for the Our Listings popup (keyed by slug)
const FLY = {};
for (const l of homes) if (hasFlyer(l._slug)) FLY[l._slug] = `/flyers/${l._slug}.pdf`;
fs.writeFileSync(path.join(OUT, 'flyers.js'), '// generated by build-homes.js\nwindow.HOME_FLYERS = ' + JSON.stringify(FLY) + ';\n');

// manifest used by the QR image export and for a quick sanity check
fs.writeFileSync(path.join(OUT, 'homes.json'), JSON.stringify(homes.map(l => ({ slug: l._slug, url: l._url, mls: l.mls, addr: prettyAddr(l.addr), status: l._label, price: l.price })), null, 1));
console.log(`build-homes: ${homes.length} pages (${forSale.length} for sale, ${homes.length - forSale.length} sold) -> homes/`);
for (const l of forSale) console.log(`  ${l._label.padEnd(14)} ${l._url}${hasFlyer(l._slug) ? '   [flyer PDF]' : '   (no flyer yet)'}`);
