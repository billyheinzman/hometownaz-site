// ============================================================
// LISTINGS DATA PATCH — applies after data-listings.js loads
// Rewritten 2026-08-20. Last hand-update 2026-09-19 (99th Ave closed 9/12).
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
      status: 'active', photo: '',
      lat: 33.6565, lon: -112.0395, zip: '85024',
      subdiv: 'HILLSDALE LOT 1-106 TR A',
      remarks: 'Single-level Hillsdale home on a cul-de-sac lot. New in 2026: roof, HVAC, water heater and every kitchen appliance. Granite counters in the kitchen and both baths, tile in the main living areas, laminate in the bedrooms, fresh paint and new fixtures throughout. PebbleTec pool with new pump, filter and valve, resurfaced decking, and a fenced gated yard. Video doorbell and cameras convey.',
      garage: 2, carport: 0, pool: true, azRoom: false, golfLot: false, common: false,
      agency: 'HomeSmart (CRIL38)', agent: 'Lona King',
      isOurListing: true, isPriceReduced: false, isNewListing: false,
      url: 'https://www.homes.com/property/1948-e-morrow-dr-phoenix-az/d9vt50tsqmte1/?dk=p6myz7k4dt3pd'
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
