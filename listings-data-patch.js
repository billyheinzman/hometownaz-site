// ============================================================
// LISTINGS DATA PATCH — applies after scw-data.js loads
// • Refreshes the 8 current listings with 12-photo galleries (01.jpg..12.jpg)
// • Fixes 6995008 address (was "17404 N 99TH AVE --", now "17404 N 99TH AVE #102")
// • Uses the same field names as scw-data.js: addr, yr, psf, marketing, type
// • Moves 7012683 (Parada) into pending if it isn't there
// • Idempotent — safe to load even if already applied
// ============================================================
(function(){
  if (typeof ACTIVE_LISTINGS === 'undefined' || !ACTIVE_LISTINGS) {
    console.warn('[listings-patch] ACTIVE_LISTINGS not found — load this AFTER scw-data.js');
    return;
  }
  if (!ACTIVE_LISTINGS.active)         ACTIVE_LISTINGS.active = [];
  if (!ACTIVE_LISTINGS.pending)        ACTIVE_LISTINGS.pending = [];
  if (!ACTIVE_LISTINGS.recentClosings) ACTIVE_LISTINGS.recentClosings = [];

  function gal(mls){
    var g = [];
    for (var i = 1; i <= 12; i++){
      g.push('images/listings/' + mls + '/' + (i<10?'0':'') + i + '.jpg');
    }
    return g;
  }

  // 8 listings from the 5/16/2026 flexmls export
  // Field names match the existing scw-data.js schema: addr, yr, psf, marketing, type
  // _bucket says where the listing should live (active/pending)
  var DATA = {
    // ACTIVE
    '6995008': {
      _bucket: 'active', mls: '6995008',
      addr: '17404 N 99TH AVE #102',  // fixed from "17404 N 99TH AVE --"
      price: 214900, type: 'SF',
      beds: 1, baths: 1, sqft: 832, psf: 258.29, yr: 1985,
      model: 'PLAN A', marketing: 'The Heritage',
      zip: '85373', isOurListing: true
    },
    '6949374': {
      _bucket: 'active', mls: '6949374',
      addr: '19511 N 143RD DR',
      price: 299000, type: 'GT',
      beds: 2, baths: 2, sqft: 1866, psf: 160.24, yr: 1987,
      model: 'D8523', marketing: 'ASPEN',
      zip: '85375', isOurListing: true
    },
    '7027759': {
      _bucket: 'active', mls: '7027759',
      addr: '12429 W EVENINGSIDE DR',
      price: 379000, type: 'SF',
      beds: 2, baths: 2, sqft: 1600, psf: 236.88, yr: 1984,
      model: 'H832', marketing: 'EXPANDED KAIBAB',
      zip: '85375', isOurListing: true
    },
    '6970611': {
      _bucket: 'active', mls: '6970611',
      addr: '15808 W HERITAGE DR',
      price: 439000, type: 'SF',
      beds: 2, baths: 3, sqft: 1900, psf: 231.05, yr: 1993,
      model: 'P2605', marketing: 'Ventana',
      zip: '85375', isOurListing: true,
      origPrice: 459900, isPriceReduced: true,
      dom: 144
    },
    '6945254': {
      _bucket: 'active', mls: '6945254',
      addr: '15119 W LAS BRIZAS LN',
      price: 449000, type: 'SF',
      beds: 3, baths: 2, sqft: 1893, psf: 237.19, yr: 1996,
      model: 'P2619', marketing: 'Prescott',
      zip: '85375', isOurListing: true
    },
    '7015019': {
      _bucket: 'active', mls: '7015019',
      addr: '14029 W RICO DR',
      price: 469000, type: 'SF',
      beds: 2, baths: 2, sqft: 1792, psf: 261.72, yr: 1995,
      model: 'CUSTOM', marketing: 'BEAUTIFUL REMODEL',
      zip: '85375', isOurListing: true
    },
    // PENDING
    '7012683': {
      _bucket: 'pending', mls: '7012683',
      addr: '14430 W PARADA DR',
      price: 625000, type: 'SF',
      beds: 2, baths: 3, sqft: 2207, psf: 283.19, yr: 1994,
      model: 'P2606', marketing: 'Pinetop Expanded Golf',
      zip: '85375', isOurListing: true
    },
  };

  function findByMls(mls){
    var buckets = ['active','pending','recentClosings'];
    for (var b = 0; b < buckets.length; b++){
      var arr = ACTIVE_LISTINGS[buckets[b]];
      for (var i = 0; i < arr.length; i++){
        if (arr[i] && arr[i].mls === mls) return { arr: arr, idx: i, bucket: buckets[b] };
      }
    }
    return null;
  }

  Object.keys(DATA).forEach(function(mls){
    var src = DATA[mls];
    var targetBucket = src._bucket;
    var found = findByMls(mls);
    var gallery = gal(mls);

    if (found){
      var existing = found.arr[found.idx];
      var merged = Object.assign({}, existing, src);
      merged.gallery = gallery;
      delete merged._bucket;
      if (found.bucket !== targetBucket){
        found.arr.splice(found.idx, 1);
        ACTIVE_LISTINGS[targetBucket].push(merged);
      } else {
        found.arr[found.idx] = merged;
      }
    } else {
      var entry = Object.assign({}, src);
      entry.gallery = gallery;
      delete entry._bucket;
      ACTIVE_LISTINGS[targetBucket].push(entry);
    }
  });

  console.log('[listings-patch] Applied. Active:',
    ACTIVE_LISTINGS.active.filter(function(l){return l.isOurListing;}).length,
    '· Pending:',
    ACTIVE_LISTINGS.pending.filter(function(l){return l.isOurListing;}).length
  );
})();
