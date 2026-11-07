// ============================================================
// LISTINGS DATA PATCH — applies after data-listings.js loads
// Rewritten 2026-08-20. Last hand-update 2026-11-07 (added 17125 N Firestone Ln,
// real photo + map pin for 1948 E Morrow Dr, remarks text cleanup,
// Homes.com links, STATUS_FIX section for mid-week status changes).
//
// What this file does NOW:
//   1. Attaches locally-hosted 12-photo galleries (images/listings/<mls>/01..12.jpg)
//      to our own listings, wherever the MLS feed put them.
//   2. Injects listings of ours that are OUTSIDE the Sun City West export
//      (different city = never in textexport__37), so they still appear on
//      our-listings.html.
//
// What it NO LONGER does (and must never do again):
//   • It does not override price, beds, baths, sqft, or status from stale data.
//     Those come from the MLS refresh. The old version was pinned to a
//     5/16/2026 export and was still showing SOLD homes as ACTIVE.
//   • It does not force listings into a bucket. The feed decides.
//
// Idempotent — safe to load twice.
// ============================================================
(function () {
  if (typeof ACTIVE_LISTINGS === 'undefined' || !ACTIVE_LISTINGS) {
    console.warn('[listings-patch] ACTIVE_LISTINGS not found — load this AFTER data-listings.js');
    return;
  }
  ACTIVE_LISTINGS.active = ACTIVE_LISTINGS.active || [];
  ACTIVE_LISTINGS.pending = ACTIVE_LISTINGS.pending || [];
  ACTIVE_LISTINGS.ucb = ACTIVE_LISTINGS.ucb || [];
  ACTIVE_LISTINGS.recentClosings = ACTIVE_LISTINGS.recentClosings || [];

  // --- 1. Local photo galleries -------------------------------------------
  // Add an MLS number here only after images/listings/<mls>/01.jpg..12.jpg exist.
  var GALLERIES = [
    '6908216', // 14418 W GUNSIGHT DR
    '6945254', // 15119 W LAS BRIZAS LN
    '6949374', // 19511 N 143RD DR
    '6970611', // 15808 W HERITAGE DR
    '6980826', // 14141 W ROBERTSON DR
    '6995008', // 17404 N 99TH AVE #102  (Sun City — injected below)
    '7012683', // 14430 W PARADA DR
    '7015019', // 14029 W RICO DR
    '7027759'  // 12429 W EVENINGSIDE DR
  ];

  function gal(mls) {
    var g = [];
    for (var i = 1; i <= 12; i++) g.push('images/listings/' + mls + '/' + (i < 10 ? '0' : '') + i + '.jpg');
    return g;
  }

  // --- 2. Our listings that live outside the SCW MLS export ----------------
  // Update these by hand when status or price changes — nothing else refreshes them.
  var OFF_FEED = [
    {
      // 1948 E Morrow Dr, Phoenix 85024 | MLS 7086407, listed 10/1/2026.
      // Phoenix address, so it never appears in the Sun City West or Surprise
      // exports. Update price/status here by hand until it closes.
      // NOTE: lat/lon below are APPROXIMATE (Hillsdale, N Phoenix). Replace with
      // the real Geo Lat/Geo Lon from ARMLS so the map pin lands on the house.
      _bucket: 'active',
      mls: '7086407',
      addr: '1948 E MORROW DR',
      price: 574900,
      origPrice: 574900,
      type: 'SF', dwelling: 'Single Family Residence',
      beds: 3, baths: 2, sqft: 1586, psf: 362.48, yr: 1988,
      dom: 19, lotsqft: 8568,
      model: '', marketing: 'Hillsdale',
      status: 'active', photo: 'https://cdn.photos.sparkplatform.com/az/20260929001956529866000000.jpg',
      lat: 33.657908, lon: -112.040344, zip: '85024',   // real Geo Lat/Lon from ARMLS export 11/7/2026
      subdiv: 'HILLSDALE LOT 1-106 TR A',
      remarks: 'Single-level Hillsdale home on a cul-de-sac lot. New in 2026: roof, HVAC, water heater and every kitchen appliance. Granite counters in the kitchen and both baths, tile in the main living areas, laminate in the bedrooms, fresh paint and new fixtures throughout. PebbleTec pool with new pump, filter and valve, resurfaced decking, and a fenced gated yard. Video doorbell and cameras convey.',
      garage: 2, carport: 0, pool: true, azRoom: false, golfLot: false, common: false,
      agency: 'HomeSmart (CRIL38)', agent: 'Lona King',
      isOurListing: true, isPriceReduced: false, isNewListing: false,
      url: 'https://www.homes.com/property/1948-e-morrow-dr-phoenix-az/d9vt50tsqmte1/?dk=p6myz7k4dt3pd'
    },
    {
      // 17125 N Firestone Ln, Surprise 85374 | MLS 7101295, on market 11/3/2026.
      // Sun City Grand (The Grand), so it never appears in the Sun City West export.
      // Update price/status here by hand until it closes.
      _bucket: 'active',
      mls: '7101295',
      addr: '17125 N FIRESTONE LN',
      price: 369900,
      origPrice: 369900,
      type: 'SF', dwelling: 'Single Family Residence',
      beds: 2, baths: 2, sqft: 1495, psf: 247.42, yr: 2001,
      dom: 4, lotsqft: 4949,
      model: 'G9173', marketing: 'JUNIPER',
      status: 'active', photo: 'https://cdn.photos.sparkplatform.com/az/20261101180511089509000000.jpg',
      lat: 33.639973, lon: -112.396573, zip: '85374',
      subdiv: 'SUN CITY GRAND QUAIL RUN',
      remarks: 'Easy living in The Grand! This Juniper plan in Quail Run offers 2 bedrooms plus an office, 2 baths, 1,495 sq ft and a 2 car garage. New roof underlayment in 2025 means one less thing to worry about. The kitchen features maple raised panel cabinets with cathedral uppers, granite counters and stainless appliances, open to a sunny breakfast nook with a designer light. Relax by the gas fireplace and media wall in the great room. The primary suite offers a bay window, dual sinks, a walk-in closet and a private door to the covered patio. Roller shutters, sun screens and security doors add comfort and peace of mind. Low care desert landscaping and no neighbors directly behind. Golf, pools, fitness centers and clubs are all close by.',
      garage: 2, carport: 0, pool: false, azRoom: false, golfLot: false, common: true,
      agency: 'HomeSmart (CRIL38)', agent: 'Lona King',
      isOurListing: true, isPriceReduced: false, isNewListing: true
    },
    {
      _bucket: 'recentClosings',          // closed 9/12/2026, $190,000
      mls: '6995008',
      addr: '17404 N 99TH AVE #102',
      price: 190000,
      origPrice: 214900,
      type: 'CN', dwelling: 'Apartment Style/Flat',
      beds: 1, baths: 1, sqft: 832, psf: 228.37, yr: 1985,
      dom: 160, lotsqft: 0,
      model: 'PLAN A', marketing: 'The Heritage',
      status: 'closed', photo: '',
      lat: 33.639, lon: -112.271, zip: '85373',
      subdiv: 'HERITAGE SUN CITY',
      remarks: 'Single-level Heritage condo in Sun City with covered parking and community amenities.',
      garage: 0, carport: 1, pool: false, azRoom: false, golfLot: false, common: false,
      agency: 'HomeSmart (CRIL38)', agent: 'Lona King',
      isOurListing: true, isPriceReduced: false, isNewListing: false,
      soldPrice: 190000, soldRatio: 0.8841, closeDate: '2026-09-12'
    }
  ];

  function findByMls(mls) {
    var buckets = ['active', 'pending', 'ucb', 'recentClosings'];
    for (var b = 0; b < buckets.length; b++) {
      var arr = ACTIVE_LISTINGS[buckets[b]];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].mls === mls) return { arr: arr, idx: i, bucket: buckets[b] };
      }
    }
    return null;
  }

  OFF_FEED.forEach(function (src) {
    if (findByMls(src.mls)) return;              // feed has it now — feed wins
    var entry = Object.assign({}, src);
    var bucket = entry._bucket;
    delete entry._bucket;
    ACTIVE_LISTINGS[bucket].push(entry);
  });

  // --- 2b. Status corrections ---------------------------------------------
  // Use when a listing's status changed after the last ARMLS export.
  // Remove the line once a fresh data-listings.js shows the new status.
  var STATUS_FIX = {
    // '7095507': 'active'   // example: 15626 W Heritage Dr went back on market 11/6/2026
  };
  Object.keys(STATUS_FIX).forEach(function (mls) {
    var hit = findByMls(mls), to = STATUS_FIX[mls];
    if (!hit || hit.bucket === to) return;
    var l = hit.arr.splice(hit.idx, 1)[0];
    l.status = to;
    if (to === 'active') { delete l.acceptingBackups; }
    ACTIVE_LISTINGS[to].push(l);
  });

  // --- 2c. Homes.com listing pages ----------------------------------------
  // Homes.com URLs carry an ID that can't be built from the address, so each
  // one is listed here (copied from Lona's Homes.com agent profile).
  var HOMES_COM = {
    '7095582': '14854-w-domingo-ln-sun-city-west-az/0frtlfyv9l8le/',
    '7098038': '15421-w-sentinel-dr-sun-city-west-az/jpvbs14zrf4bj/',
    '7088722': '13664-w-ravenswood-dr-sun-city-west-az/b9vjx47zy0ed5/',
    '7098041': '12931-w-prospect-dr-sun-city-west-az/b882p28pk4nl6/',
    '7095502': '13607-w-pyracantha-dr-sun-city-west-az/c1hbn2qk1jgrq/',
    '7095507': '15626-w-heritage-dr-sun-city-west-az-unit-45/m8zs0ngnktzz5/',
    '7086407': '1948-e-morrow-dr-phoenix-az/d9vt50tsqmte1/',
    '7101295': '17125-n-firestone-ln-surprise-az/q7py51yk0d5qv/',
    '7080792': '19949-n-greenview-dr-sun-city-west-az/k5zj0csycbfn5/'
  };
  var HOMES_COM_BY_ADDR = {   // listings whose MLS # isn't handy: matched by street address
    '19614 N BELLWOOD DR': '19614-n-bellwood-dr-sun-city-west-az/d6mhfglcygl3g/',
    '14412 W ROBERTSON DR': '14412-w-robertson-dr-sun-city-west-az/26h4l298kb6w1/',
    '22002 N ACAPULCO DR': '22002-n-acapulco-dr-sun-city-west-az/563gh5rlncx6l/',
    '14912 W YOSEMITE DR': '14912-w-yosemite-dr-sun-city-west-az/ddzfgt8t9ctte/',
    '15119 W LAS BRIZAS LN': '15119-w-las-brizas-ln-sun-city-west-az/lq4tqh0qxw4rp/',
    '19638 N BELLWOOD DR': '19638-n-bellwood-dr-sun-city-west-az/71h0cq76y56hl/',
    '15808 W HERITAGE DR': '15808-w-heritage-dr-sun-city-west-az/9njhzwey1x2mn/',
    '14420 W SENTINEL DR': '14420-w-sentinel-dr-sun-city-west-az/b09llb32wx34e/',
    '19511 N 143RD DR': '19511-n-143rd-dr-sun-city-west-az/pc9m7w3xbx2b8/'
  };
  ['active', 'pending', 'ucb', 'recentClosings'].forEach(function (b) {
    ACTIVE_LISTINGS[b].forEach(function (l) {
      if (!l) return;
      var path = HOMES_COM[l.mls] || HOMES_COM_BY_ADDR[String(l.addr || '').toUpperCase()];
      if (path) l.homesUrl = 'https://www.homes.com/property/' + path;
    });
  });

  // --- 3. Text cleanup ----------------------------------------------------
  // Some MLS remarks were pasted from a PDF and lost their "fi", "ff" and "ffi"
  // letter pairs ("Sa ord", "you will nd"). Repair the known words in OUR
  // listings only. Text cleanup only; never touches price, status or facts.
  var LIGATURE_FIX = [
    [/\bSa ord\b/g, 'Safford'], [/\bo ers\b/g, 'offers'], [/\bo ce\b/g, 'office'],
    [/ ows\b/g, ' flows'], [/\b tness\b/g, ' fitness'], [/ tness\b/g, ' fitness'],
    [/\b(will|special|a) nd\b/g, '$1 find'], [/  +/g, ' ']
  ];
  ['active', 'pending', 'ucb', 'recentClosings'].forEach(function (b) {
    ACTIVE_LISTINGS[b].forEach(function (l) {
      if (!l || !l.isOurListing || !l.remarks) return;
      LIGATURE_FIX.forEach(function (f) { l.remarks = l.remarks.replace(f[0], f[1]); });
    });
  });

  GALLERIES.forEach(function (mls) {
    var found = findByMls(mls);
    if (found) found.arr[found.idx].gallery = gal(mls);
  });

  console.log('[listings-patch] galleries attached · ours active:',
    ACTIVE_LISTINGS.active.filter(function (l) { return l.isOurListing; }).length,
    '· pending:',
    ACTIVE_LISTINGS.pending.filter(function (l) { return l.isOurListing; }).length,
    '· closed:',
    ACTIVE_LISTINGS.recentClosings.filter(function (l) { return l.isOurListing; }).length);
})();
