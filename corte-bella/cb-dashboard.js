
// ══════════════════════════════════════════════════════════════════════
//  MARKET INTELLIGENCE DASHBOARD — multi-year comparison + global search
// ══════════════════════════════════════════════════════════════════════

// Order of months for iteration
var MI_MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
var MI_MONTH_FULL = {jan:'January',feb:'February',mar:'March',apr:'April',may:'May',jun:'June',jul:'July',aug:'August',sep:'September',oct:'October',nov:'November',dec:'December'};
var MI_MONTH_SHORT = {jan:'Jan',feb:'Feb',mar:'Mar',apr:'Apr',may:'May',jun:'Jun',jul:'Jul',aug:'Aug',sep:'Sep',oct:'Oct',nov:'Nov',dec:'Dec'};
var MI_MONTH_NUM = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};

// Current state for each mode
var miYoyMetric = 'count';   // count | avg | psf | dom
var miSearchSort = {col:'date', asc:false};
var miSearchAll = null;       // cached flat list of all sales

// ── Helpers ───────────────────────────────────────────────────────────
function miFmtMoney(n) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + Math.round(n/1000) + 'K';
  return '$' + Math.round(n).toLocaleString();
}
function miFmtMoneyFull(n) {
  return '$' + Math.round(n).toLocaleString();
}
function miFmtPct(delta) {
  if (delta == null || isNaN(delta)) return '—';
  var s = (delta > 0 ? '+' : '') + delta.toFixed(1) + '%';
  return s;
}
function miDeltaClass(delta, inverse) {
  // inverse=true means a negative delta is good (e.g. DOM: lower is better)
  if (delta == null || isNaN(delta) || Math.abs(delta) < 0.5) return 'delta-flat';
  if (inverse) return delta < 0 ? 'delta-up' : 'delta-down';
  return delta > 0 ? 'delta-up' : 'delta-down';
}
function miDeltaArrow(delta, inverse) {
  if (delta == null || isNaN(delta) || Math.abs(delta) < 0.5) return '→';
  if (inverse) return delta < 0 ? '↓' : '↑';
  return delta > 0 ? '↑' : '↓';
}

// Aggregate raw stats for a year
function miAggYear(yearStr) {
  var ds = YEAR_DATASETS[yearStr];
  if (!ds) return null;
  var count = 0, vol = 0, sumPsf = 0, psfN = 0, sumDom = 0, domN = 0, sumSqft = 0;
  MI_MONTH_KEYS.forEach(function(k){
    if (!ds[k] || !ds[k].data) return;
    ds[k].data.forEach(function(r){
      count++;
      vol += r.price;
      sumSqft += r.sqft;
      if (r.psf > 0) { sumPsf += r.psf; psfN++; }
      sumDom += r.dom; domN++;
    });
  });
  return {
    count: count,
    vol: vol,
    avgPrice: count ? vol/count : 0,
    avgPsf: psfN ? sumPsf/psfN : 0,
    avgDom: domN ? sumDom/domN : 0,
    avgSqft: count ? sumSqft/count : 0
  };
}

// Aggregate raw stats for a single month (year + month key)
function miAggMonth(yearStr, mKey) {
  var ds = YEAR_DATASETS[yearStr];
  if (!ds || !ds[mKey] || !ds[mKey].data) return null;
  var rows = ds[mKey].data;
  var count = rows.length;
  var vol = 0, sumPsf = 0, psfN = 0, sumDom = 0, domN = 0;
  rows.forEach(function(r){
    vol += r.price;
    if (r.psf > 0) { sumPsf += r.psf; psfN++; }
    sumDom += r.dom; domN++;
  });
  return {
    count: count,
    vol: vol,
    avgPrice: count ? vol/count : 0,
    avgPsf: psfN ? sumPsf/psfN : 0,
    avgDom: domN ? sumDom/domN : 0
  };
}

// ── Open / close ─────────────────────────────────────────────────────
function openMarketIntel() {
  document.getElementById('ytdModal').style.display = 'flex';
  // Set the dynamic closings count in the header
  var miHdr = document.getElementById('miHeaderClosings');
  if (miHdr) miHdr.textContent = buildSearchAll().length.toLocaleString();
  // Default: YoY view
  showMIMode('yoy');
}
function closeMarketIntel() {
  document.getElementById('ytdModal').style.display = 'none';
}

// ── Mode switching ────────────────────────────────────────────────────
function showMIMode(mode) {
  document.querySelectorAll('.mi-panel').forEach(function(p){ p.style.display = 'none'; });
  document.querySelectorAll('.mi-tab').forEach(function(t){ t.classList.remove('active'); });
  document.getElementById('mi-' + mode).style.display = 'block';
  document.querySelectorAll('.mi-tab[data-mode="' + mode + '"]').forEach(function(t){ t.classList.add('active'); });

  // Update top header KPIs based on mode
  renderHeaderKpis(mode);

  if (mode === 'yoy') {
    // Make sure single-month dropdowns are hidden/shown correctly based on current period
    onYoyPickerChange(); // also calls renderYoY
  }
  if (mode === 'trends') {
    // default to current year if it exists, else 2025
    var yearSel = document.getElementById('trendsYear');
    if (currentYear && YEAR_DATASETS[currentYear]) yearSel.value = currentYear;
    renderTrends();
  }
  if (mode === 'compare') {
    // Pre-fill A=current tab in 2025, B=current tab in 2026 (if both exist) — most useful default
    var aMo = document.getElementById('cmpAMonth');
    var aYr = document.getElementById('cmpAYear');
    var bMo = document.getElementById('cmpBMonth');
    var bYr = document.getElementById('cmpBYear');
    if (currentTab) { aMo.value = currentTab; bMo.value = currentTab; }
    aYr.value = '2025'; bYr.value = '2026';
    renderCompare();
  }
  if (mode === 'search') renderSearch();
  if (mode === 'insights') renderInsights();
  if (mode === 'estimator')   { initEstimator(); renderEstimator(); }
  if (mode === 'timemachine') { initTimeMachine(); renderTimeMachine(); }
  if (mode === 'heatmap')     { renderHeatMap(); }
  if (mode === 'showdown')    { initShowdown(); renderShowdown(); }
  if (mode === 'crystalball') { renderCrystalBall(); }
  if (mode === 'prophistory') { renderPropHistory(); }
  if (mode === 'streets')     { renderStreetIndex(); }
  if (mode === 'active')      { renderActiveMI(); }
  if (mode === 'closings')    { renderClosings(); }
  if (mode === 'pricing')     { initPricingPower(); renderPricingPower(); }
  if (mode === 'leaderboard') { renderLeaderboard(); }
  if (mode === 'concessions') { renderConcessions(); }
  if (mode === 'floorplans')  { renderFloorPlans(); }
  if (mode === 'pdfreport')   { renderQuarterlyReport(); }
}

// ── Header KPIs ───────────────────────────────────────────────────────
function renderHeaderKpis(mode) {
  var el = document.getElementById('miHeaderKpis');
  if (!el) return;
  // Aggregate across ALL years available in the dataset (auto-includes new years when added)
  var all = buildSearchAll();
  if (!all.length) { el.innerHTML = ''; return; }
  var totalCount = all.length;
  var totalVol = all.reduce(function(a, r){ return a + r.price; }, 0);
  var avgPrice = totalVol / totalCount;
  var avgPsf = all.reduce(function(a, r){ return a + r.psf; }, 0) / totalCount;
  var avgDom = all.reduce(function(a, r){ return a + r.dom; }, 0) / totalCount;
  // Determine the year range covered for the label
  var years = Object.keys(YEAR_DATASETS).filter(function(y){
    return Object.values(YEAR_DATASETS[y] || {}).some(function(m){ return m && m.data && m.data.length; });
  }).sort();
  var yrLabel = years.length === 1 ? years[0] : (years[0] + '–' + years[years.length-1]);

  var kpis = [
    {n: totalCount.toLocaleString(),       lbl: 'Total Sales (' + yrLabel + ')', tip: 'Every closed sale across all years currently loaded — the foundation of every tool here.'},
    {n: miFmtMoney(avgPrice),              lbl: 'Avg Price',                     tip: 'Average closing price across all ' + totalCount.toLocaleString() + ' tracked sales.'},
    {n: '$' + Math.round(avgPsf),          lbl: 'Avg $/Sq Ft',                   tip: 'Average price per square foot — the most reliable cross-model value indicator.'},
    {n: Math.round(avgDom) + ' days',      lbl: 'Avg DOM',                       tip: 'Average days on market from listing to close. Lower = hotter market.'},
    {n: miFmtMoney(totalVol),              lbl: 'Total Volume',                  tip: 'Cumulative dollar value of every sale tracked. The size of Corte Bella housing economy.'}
  ];
  el.innerHTML = kpis.map(function(k, i){
    var border = i < kpis.length-1 ? 'border-right:1px solid rgba(255,255,255,.1);' : '';
    return '<div data-tip-pos="below" data-tip="' + k.tip.replace(/"/g, '&quot;') + '" style="padding:10px 14px;background:rgba(255,255,255,.08);' + border + 'text-align:center;cursor:help;">' +
      '<div style="font-family:\'Merriweather\',serif;font-size:1.3rem;font-weight:700;color:#e8a070;">' + k.n + '</div>' +
      '<div style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.5);margin-top:2px;">' + k.lbl + '</div>' +
    '</div>';
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════
//  YEAR-OVER-YEAR (period-vs-period, fully flexible)
// ══════════════════════════════════════════════════════════════════════

// Period definitions — return list of month keys
var PERIOD_DEFS = {
  full: ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],
  q1:   ['jan','feb','mar'],
  q2:   ['apr','may','jun'],
  q3:   ['jul','aug','sep'],
  q4:   ['oct','nov','dec'],
  h1:   ['jan','feb','mar','apr','may','jun'],
  h2:   ['jul','aug','sep','oct','nov','dec']
};
var PERIOD_LABELS = {
  full: 'Full Year', q1: 'Q1', q2: 'Q2', q3: 'Q3', q4: 'Q4',
  h1: 'H1', h2: 'H2', ytd: 'YTD', month: 'Month'
};

// Resolve a (year, period, singleMonth) selection into {keys, label}
function miResolvePeriod(year, period, singleMonth) {
  var ds = YEAR_DATASETS[year];
  if (!ds) return {keys: [], label: 'No Data'};

  if (period === 'month' && singleMonth) {
    return {keys: [singleMonth], label: MI_MONTH_FULL[singleMonth]};
  }
  if (period === 'ytd') {
    // YTD = months that have data in BOTH selected years (apples-to-apples)
    // We need access to both years to compute this — caller passes other year context via global pickers
    var otherYear = (year === '2025') ? document.getElementById('yoyBYear').value : document.getElementById('yoyAYear').value;
    if (otherYear === year) {
      // Fallback: just use months that have data in this year
      var keys = MI_MONTH_KEYS.filter(function(k){ return ds[k] && ds[k].data; });
      return {keys: keys, label: 'YTD ' + (keys.length ? MI_MONTH_SHORT[keys[0]] + '–' + MI_MONTH_SHORT[keys[keys.length-1]] : '')};
    }
    var otherDs = YEAR_DATASETS[otherYear];
    var keysBoth = MI_MONTH_KEYS.filter(function(k){
      return ds[k] && ds[k].data && otherDs && otherDs[k] && otherDs[k].data;
    });
    return {keys: keysBoth, label: 'YTD ' + (keysBoth.length ? MI_MONTH_SHORT[keysBoth[0]] + '–' + MI_MONTH_SHORT[keysBoth[keysBoth.length-1]] : 'no overlap')};
  }
  var defKeys = PERIOD_DEFS[period] || PERIOD_DEFS.full;
  // Restrict to months that actually have data
  var availKeys = defKeys.filter(function(k){ return ds[k] && ds[k].data; });
  return {keys: availKeys, label: PERIOD_LABELS[period] || period};
}

// Aggregate stats over a list of month keys for a year
function miAggKeys(year, keys) {
  var ds = YEAR_DATASETS[year];
  if (!ds || !keys.length) return null;
  var count = 0, vol = 0, sumPsf = 0, psfN = 0, sumDom = 0, domN = 0, sumSqft = 0;
  keys.forEach(function(k){
    if (!ds[k] || !ds[k].data) return;
    ds[k].data.forEach(function(r){
      count++;
      vol += r.price;
      sumSqft += r.sqft;
      if (r.psf > 0) { sumPsf += r.psf; psfN++; }
      sumDom += r.dom; domN++;
    });
  });
  if (!count) return null;
  return {
    count: count, vol: vol,
    avgPrice: vol/count,
    avgPsf: psfN ? sumPsf/psfN : 0,
    avgDom: domN ? sumDom/domN : 0,
    avgSqft: sumSqft/count
  };
}

// Toggle the single-month dropdown visibility based on period selection
function onYoyPickerChange() {
  var aPeriod = document.getElementById('yoyAPeriod').value;
  var bPeriod = document.getElementById('yoyBPeriod').value;
  document.getElementById('yoyAMonth').style.display = (aPeriod === 'month') ? 'block' : 'none';
  document.getElementById('yoyBMonth').style.display = (bPeriod === 'month') ? 'block' : 'none';
  renderYoY();
}

// Quick presets
function applyYoyPreset(preset) {
  var ay = document.getElementById('yoyAYear');
  var ap = document.getElementById('yoyAPeriod');
  var by = document.getElementById('yoyBYear');
  var bp = document.getElementById('yoyBPeriod');
  if (preset === 'ytd') {
    ay.value = '2025'; ap.value = 'ytd';
    by.value = '2026'; bp.value = 'ytd';
  } else if (preset === 'full') {
    ay.value = '2025'; ap.value = 'full';
    by.value = '2026'; bp.value = 'full';
  } else if (preset === 'q1') {
    ay.value = '2025'; ap.value = 'q1';
    by.value = '2026'; bp.value = 'q1';
  } else if (preset === 'halves') {
    ay.value = '2025'; ap.value = 'h1';
    by.value = '2025'; bp.value = 'h2';
  }
  onYoyPickerChange();
}

function renderYoY() {
  var aYear = document.getElementById('yoyAYear').value;
  var bYear = document.getElementById('yoyBYear').value;
  var aPeriod = document.getElementById('yoyAPeriod').value;
  var bPeriod = document.getElementById('yoyBPeriod').value;
  var aMonth = document.getElementById('yoyAMonth').value;
  var bMonth = document.getElementById('yoyBMonth').value;

  var pa = miResolvePeriod(aYear, aPeriod, aMonth);
  var pb = miResolvePeriod(bYear, bPeriod, bMonth);

  var aAgg = miAggKeys(aYear, pa.keys);
  var bAgg = miAggKeys(bYear, pb.keys);

  // Build labels
  var aLabel = aYear + ' · ' + pa.label;
  var bLabel = bYear + ' · ' + pb.label;

  function delta(now, prev) { return prev ? ((now - prev) / prev * 100) : null; }

  // KPI cards
  var kpiCards = [
    {lbl:'Sales Count', va: aAgg?aAgg.count.toLocaleString():'—', vb: bAgg?bAgg.count.toLocaleString():'—', d: aAgg&&bAgg?delta(bAgg.count, aAgg.count):null, inv:false},
    {lbl:'Avg Price',   va: aAgg?miFmtMoney(aAgg.avgPrice):'—',   vb: bAgg?miFmtMoney(bAgg.avgPrice):'—', d: aAgg&&bAgg?delta(bAgg.avgPrice, aAgg.avgPrice):null, inv:false},
    {lbl:'Avg $/Sq Ft', va: aAgg?'$'+Math.round(aAgg.avgPsf):'—', vb: bAgg?'$'+Math.round(bAgg.avgPsf):'—', d: aAgg&&bAgg?delta(bAgg.avgPsf, aAgg.avgPsf):null, inv:false},
    {lbl:'Avg DOM',     va: aAgg?Math.round(aAgg.avgDom)+'d':'—', vb: bAgg?Math.round(bAgg.avgDom)+'d':'—', d: aAgg&&bAgg?delta(bAgg.avgDom, aAgg.avgDom):null, inv:true},
    {lbl:'Total Volume',va: aAgg?miFmtMoney(aAgg.vol):'—',        vb: bAgg?miFmtMoney(bAgg.vol):'—', d: aAgg&&bAgg?delta(bAgg.vol, aAgg.vol):null, inv:false}
  ];

  document.getElementById('miYoyKpis').innerHTML = kpiCards.map(function(c){
    var dClass = miDeltaClass(c.d, c.inv);
    var dArrow = miDeltaArrow(c.d, c.inv);
    var deltaTxt = c.d != null ? (dArrow + ' ' + miFmtPct(c.d) + ' Δ') : '—';
    return '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px 14px;">' +
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:10px;">' + c.lbl + '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px;">' +
        '<div><div style="font-size:9px;color:var(--muted);font-weight:700;letter-spacing:.05em;">' + aLabel + '</div><div style="font-family:\'Merriweather\',serif;font-size:1.1rem;color:var(--sage);font-weight:700;">' + c.va + '</div></div>' +
        '<div style="text-align:right;"><div style="font-size:9px;color:var(--muted);font-weight:700;letter-spacing:.05em;">' + bLabel + '</div><div style="font-family:\'Merriweather\',serif;font-size:1.1rem;color:var(--orange);font-weight:700;">' + c.vb + '</div></div>' +
      '</div>' +
      '<div style="border-top:1px solid var(--border);padding-top:6px;text-align:center;font-size:11px;" class="' + dClass + '">' + deltaTxt + '</div>' +
    '</div>';
  }).join('');

  // Chart title + legend
  document.getElementById('yoyChartTitle').textContent = 'Trend Comparison — ' + aLabel + ' vs ' + bLabel;
  document.getElementById('yoyChartSub').textContent = 'Each line shows monthly values across the selected period. Switch metric using the buttons.';
  document.getElementById('yoyChartLegend').innerHTML =
    '<span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:14px;height:3px;background:var(--sage);display:inline-block;border-radius:2px;"></span>' + aLabel + '</span>' +
    '<span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:14px;height:3px;background:var(--orange);display:inline-block;border-radius:2px;"></span>' + bLabel + '</span>';

  // Render chart with period context
  drawYoyChart(aYear, pa.keys, bYear, pb.keys);

  // Summary table
  document.getElementById('yoySummaryTitle').textContent = aLabel + ' vs ' + bLabel + ' — Detail';
  var rows = aAgg && bAgg ? [
    {lbl:'Total Sales',     va:aAgg.count.toLocaleString(),                  vb:bAgg.count.toLocaleString(),                   d:delta(bAgg.count, aAgg.count),       inv:false, note:''},
    {lbl:'Avg Sale Price',  va:miFmtMoney(aAgg.avgPrice),                    vb:miFmtMoney(bAgg.avgPrice),                     d:delta(bAgg.avgPrice, aAgg.avgPrice), inv:false, note:''},
    {lbl:'Avg $/Sq Ft',     va:'$'+Math.round(aAgg.avgPsf),                  vb:'$'+Math.round(bAgg.avgPsf),                   d:delta(bAgg.avgPsf, aAgg.avgPsf),     inv:false, note:''},
    {lbl:'Avg DOM',         va:Math.round(aAgg.avgDom)+' days',              vb:Math.round(bAgg.avgDom)+' days',               d:delta(bAgg.avgDom, aAgg.avgDom),     inv:true,  note:'Lower is better'},
    {lbl:'Avg Sq Ft Sold',  va:Math.round(aAgg.avgSqft).toLocaleString(),    vb:Math.round(bAgg.avgSqft).toLocaleString(),     d:delta(bAgg.avgSqft, aAgg.avgSqft),   inv:false, note:''},
    {lbl:'Total Volume',    va:miFmtMoney(aAgg.vol),                         vb:miFmtMoney(bAgg.vol),                          d:delta(bAgg.vol, aAgg.vol),           inv:false, note:''},
    {lbl:'Months Counted',  va:pa.keys.length+' month'+(pa.keys.length===1?'':'s'), vb:pb.keys.length+' month'+(pb.keys.length===1?'':'s'), d:null, inv:false, note:'Range scope'}
  ] : [];

  var tableHtml;
  if (!rows.length) {
    tableHtml = '<div style="padding:30px;text-align:center;color:var(--muted);">No data available for the selected periods.</div>';
  } else {
    tableHtml = '<div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 0.8fr 1.2fr;gap:0;font-size:12px;">' +
      '<div style="padding:8px 10px;font-weight:700;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid var(--border);">Metric</div>' +
      '<div style="padding:8px 10px;font-weight:700;color:var(--sage);font-size:10px;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid var(--border);text-align:right;">' + aLabel + '</div>' +
      '<div style="padding:8px 10px;font-weight:700;color:var(--orange);font-size:10px;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid var(--border);text-align:right;">' + bLabel + '</div>' +
      '<div style="padding:8px 10px;font-weight:700;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid var(--border);text-align:right;">Δ</div>' +
      '<div style="padding:8px 10px;font-weight:700;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid var(--border);">Note</div>';
    rows.forEach(function(r){
      var dClass = r.d != null ? miDeltaClass(r.d, r.inv) : '';
      var dArrow = r.d != null ? miDeltaArrow(r.d, r.inv) : '';
      var dTxt = r.d != null ? (dArrow + ' ' + miFmtPct(r.d)) : '—';
      tableHtml += '<div style="padding:10px;border-bottom:1px solid var(--border);font-weight:600;">' + r.lbl + '</div>' +
        '<div style="padding:10px;border-bottom:1px solid var(--border);text-align:right;color:var(--sage);font-weight:700;">' + r.va + '</div>' +
        '<div style="padding:10px;border-bottom:1px solid var(--border);text-align:right;color:var(--orange);font-weight:700;">' + r.vb + '</div>' +
        '<div style="padding:10px;border-bottom:1px solid var(--border);text-align:right;" class="' + dClass + '">' + dTxt + '</div>' +
        '<div style="padding:10px;border-bottom:1px solid var(--border);font-size:11px;color:var(--muted);font-style:italic;">' + (r.note || '') + '</div>';
    });
    tableHtml += '</div>';
  }
  document.getElementById('yoySummaryGrid').innerHTML = tableHtml;
}

function setYoyMetric(metric) {
  miYoyMetric = metric;
  document.querySelectorAll('.yoy-metric').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-metric') === metric);
  });
  // Re-render full YoY so the chart redraws with current period selection
  var aYear = document.getElementById('yoyAYear').value;
  var bYear = document.getElementById('yoyBYear').value;
  var aPeriod = document.getElementById('yoyAPeriod').value;
  var bPeriod = document.getElementById('yoyBPeriod').value;
  var aMonth = document.getElementById('yoyAMonth').value;
  var bMonth = document.getElementById('yoyBMonth').value;
  var pa = miResolvePeriod(aYear, aPeriod, aMonth);
  var pb = miResolvePeriod(bYear, bPeriod, bMonth);
  drawYoyChart(aYear, pa.keys, bYear, pb.keys);
}

// Period-aware chart. Plots both series across the UNION of months in either period,
// so when ranges differ the user can see exactly where each one starts/ends.
function drawYoyChart(aYear, aKeys, bYear, bKeys) {
  var container = document.getElementById('yoyChartContainer');
  if (!container) return;
  var metricLabel = {count:'Sales Count', avg:'Avg Price', psf:'Avg $/Sq Ft', dom:'Avg DOM (days)'}[miYoyMetric];

  // Use union of months across both periods, in calendar order
  var unionSet = {};
  aKeys.forEach(function(k){ unionSet[k] = true; });
  bKeys.forEach(function(k){ unionSet[k] = true; });
  var unionKeys = MI_MONTH_KEYS.filter(function(k){ return unionSet[k]; });

  if (!unionKeys.length) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);">No overlap to plot.</div>';
    return;
  }

  function pull(year, k, includeFlag) {
    if (!includeFlag[k]) return null;
    var m = miAggMonth(year, k);
    if (!m || !m.count) return null;
    if (miYoyMetric === 'count') return m.count;
    if (miYoyMetric === 'avg') return m.avgPrice;
    if (miYoyMetric === 'psf') return m.avgPsf;
    if (miYoyMetric === 'dom') return m.avgDom;
    return null;
  }
  var aSet = {}; aKeys.forEach(function(k){ aSet[k] = true; });
  var bSet = {}; bKeys.forEach(function(k){ bSet[k] = true; });

  var vA = unionKeys.map(function(k){ return pull(aYear, k, aSet); });
  var vB = unionKeys.map(function(k){ return pull(bYear, k, bSet); });

  var allVals = vA.concat(vB).filter(function(v){ return v != null; });
  if (!allVals.length) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);">No data in selected periods.</div>';
    return;
  }
  var maxV = Math.max.apply(null, allVals), minV = Math.min.apply(null, allVals);
  if (maxV === minV) maxV = minV + 1;
  // Pad scale so labels don't clip
  var pad = (maxV - minV) * 0.12;
  maxV += pad;

  var W = 820, H = 280, padL = 60, padR = 20, padT = 20, padB = 40;
  var plotW = W - padL - padR, plotH = H - padT - padB;
  var n = unionKeys.length;
  var xStep = n > 1 ? plotW / (n - 1) : 0;

  function fmt(v){
    if (v == null) return '';
    if (miYoyMetric === 'count') return Math.round(v);
    if (miYoyMetric === 'avg') return miFmtMoney(v);
    if (miYoyMetric === 'psf') return '$' + Math.round(v);
    if (miYoyMetric === 'dom') return Math.round(v);
    return v;
  }

  function buildSeries(arr, color) {
    var pts = [];
    arr.forEach(function(v, i){
      if (v == null) return;
      var x = padL + (n === 1 ? plotW/2 : i * xStep);
      var y = padT + (1 - (v - minV) / (maxV - minV)) * plotH;
      pts.push({x:x, y:y, v:v});
    });
    if (!pts.length) return '';
    var path = '';
    pts.forEach(function(p, i){
      path += (i === 0 ? 'M' : ' L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
    });
    var dots = '';
    pts.forEach(function(p){
      dots += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4" fill="' + color + '"/>';
      dots += '<text x="' + p.x.toFixed(1) + '" y="' + (p.y - 9).toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="700" fill="' + color + '">' + fmt(p.v) + '</text>';
    });
    return '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' + dots;
  }

  // Y-axis ticks
  var ticks = '';
  for (var i = 0; i <= 4; i++) {
    var v = minV + (maxV - minV) * (i / 4);
    var y = padT + (1 - i / 4) * plotH;
    ticks += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="#e0d8c8" stroke-dasharray="2,3"/>';
    ticks += '<text x="' + (padL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="#888" font-weight="600">' + fmt(v) + '</text>';
  }

  // X-axis labels
  var xLabels = '';
  unionKeys.forEach(function(k, i){
    var x = padL + (n === 1 ? plotW/2 : i * xStep);
    xLabels += '<text x="' + x.toFixed(1) + '" y="' + (H - padB + 18) + '" text-anchor="middle" font-size="10" fill="#666" font-weight="600">' + MI_MONTH_SHORT[k] + '</text>';
  });

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">' +
    '<rect x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + plotH + '" fill="#fafaf6" rx="4"/>' +
    ticks +
    buildSeries(vA, '#4a7c59') +
    buildSeries(vB, '#c8622a') +
    xLabels +
    '<text x="' + (padL - 50) + '" y="' + (padT + plotH/2) + '" text-anchor="middle" font-size="10" fill="#666" font-weight="700" transform="rotate(-90, ' + (padL - 50) + ', ' + (padT + plotH/2) + ')">' + metricLabel + '</text>' +
  '</svg>';
  container.innerHTML = svg;
}

// ══════════════════════════════════════════════════════════════════════
//  MONTHLY TRENDS (single year, with PROPER bar chart)
// ══════════════════════════════════════════════════════════════════════
function renderTrends() {
  var year = document.getElementById('trendsYear').value;
  var ds = YEAR_DATASETS[year];
  if (!ds) return;

  // Collect months with data
  var active = MI_MONTH_KEYS.filter(function(k){ return ds[k] && ds[k].data; });
  if (!active.length) {
    document.getElementById('trendsCards').innerHTML = '<div style="padding:30px;text-align:center;color:var(--muted);">No data for ' + year + ' yet.</div>';
    document.getElementById('trendsBarChart').innerHTML = '';
    return;
  }

  document.getElementById('trendsSubhead').textContent = 'Click any card to view that month\'s full data · ' + year;

  // Find best (highest count) month for trophy
  var bestKey = active.reduce(function(best, k){
    return ds[k].count > ds[best].count ? k : best;
  }, active[0]);

  // Cards
  var cardsEl = document.getElementById('trendsCards');
  cardsEl.style.gridTemplateColumns = 'repeat(4, 1fr)';
  var cardsHtml = '';
  active.forEach(function(k){
    var m = ds[k];
    var trophy = (k === bestKey) ? ' 🏆' : '';
    var psfNum = parseInt(String(m.psf).replace(/[^0-9]/g, ''), 10) || 0;
    var domNum = m.avgDomNum || 0;
    var domColor = domNum > 90 ? '#c62828' : (domNum < 75 ? 'var(--sage)' : 'var(--orange)');
    cardsHtml += '<div onclick="closeMarketIntel();switchYear(\'' + year + '\');setTimeout(function(){switchTab(\'' + k + '\');},50)" style="background:var(--cream);border-radius:8px;padding:12px;border:2px solid var(--border);cursor:pointer;transition:all .15s;" onmouseover="this.style.borderColor=\'var(--orange)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.transform=\'translateY(0)\'">' +
      '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);">' + MI_MONTH_FULL[k] + trophy + '</div>' +
      '<div style="font-family:\'Merriweather\',serif;font-size:1.4rem;font-weight:700;color:var(--green);margin:4px 0;">' + m.count + '</div>' +
      '<div style="font-size:11px;color:var(--muted);">sales · ' + m.avg + ' avg</div>' +
      '<div style="display:flex;align-items:center;gap:4px;margin-top:6px;"><div style="height:4px;background:var(--sage);border-radius:2px;flex:1;"></div><span style="font-size:10px;color:var(--sage);font-weight:700;">' + m.psf + '/sf</span></div>' +
      '<div style="font-size:10px;color:' + domColor + ';margin-top:4px;">⏱ ' + domNum + ' day avg DOM</div>' +
      '</div>';
  });
  cardsEl.innerHTML = cardsHtml;

  // PROPER bar chart with SVG — no overlapping labels
  drawTrendsBar(year, active, ds);
}

function drawTrendsBar(year, active, ds) {
  var psfValues = active.map(function(k){
    return parseInt(String(ds[k].psf).replace(/[^0-9]/g, ''), 10) || 0;
  });
  var minV = Math.min.apply(null, psfValues), maxV = Math.max.apply(null, psfValues);
  if (maxV === minV) maxV = minV + 1;

  var W = 800, H = 220, padL = 40, padR = 20, padT = 30, padB = 40;
  var plotW = W - padL - padR, plotH = H - padT - padB;
  var n = active.length;
  var slotW = plotW / n;
  var barW = slotW * 0.62;
  var barOffset = (slotW - barW) / 2;

  // Detect trend
  var first = psfValues[0], last = psfValues[psfValues.length-1];
  var trend = last > first * 1.02 ? 'Upward Movement' : (last < first * 0.98 ? 'Cooling Trend' : 'Stable');
  document.getElementById('trendsBarTitle').textContent = '$/Sq Ft by Month — ' + trend + ' · ' + year;

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">';

  // Background grid
  for (var t = 0; t <= 4; t++) {
    var v = minV + (maxV - minV) * (t / 4);
    var y = padT + (1 - t / 4) * plotH;
    svg += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="#e0d8c8" stroke-dasharray="2,3"/>';
    svg += '<text x="' + (padL - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="#999" font-weight="600">$' + Math.round(v) + '</text>';
  }

  active.forEach(function(k, i){
    var v = psfValues[i];
    var x = padL + i * slotW + barOffset;
    var ratio = (v - minV) / (maxV - minV);
    var barH = Math.max(6, ratio * plotH);
    var barY = padT + plotH - barH;
    var color = ratio > 0.65 ? 'var(--orange)' : 'var(--sage)';
    var fillColor = ratio > 0.65 ? '#c8622a' : '#4a7c59';

    svg += '<rect x="' + x.toFixed(1) + '" y="' + barY.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + barH.toFixed(1) + '" rx="3" fill="' + fillColor + '"/>';
    // Value label ABOVE bar with proper spacing
    svg += '<text x="' + (x + barW/2).toFixed(1) + '" y="' + (barY - 6).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="700" fill="' + fillColor + '">$' + v + '</text>';
    // Month label BELOW chart area, never overlapping
    svg += '<text x="' + (x + barW/2).toFixed(1) + '" y="' + (H - padB + 16) + '" text-anchor="middle" font-size="10" fill="#666" font-weight="600">' + MI_MONTH_SHORT[k] + '</text>';
  });

  svg += '</svg>';
  document.getElementById('trendsBarChart').innerHTML = svg;
}

// ══════════════════════════════════════════════════════════════════════
//  CUSTOM COMPARE (any month any year vs any month any year)
// ══════════════════════════════════════════════════════════════════════

function applyCmpPreset(preset) {
  var aM = document.getElementById('cmpAMonth');
  var aY = document.getElementById('cmpAYear');
  var bM = document.getElementById('cmpBMonth');
  var bY = document.getElementById('cmpBYear');
  if (preset === 'apr-yoy')          { aM.value = 'apr'; aY.value = '2025'; bM.value = 'apr'; bY.value = '2026'; }
  else if (preset === 'jan-yoy')     { aM.value = 'jan'; aY.value = '2025'; bM.value = 'jan'; bY.value = '2026'; }
  else if (preset === 'peak-vs-slow'){ aM.value = 'apr'; aY.value = '2025'; bM.value = 'aug'; bY.value = '2025'; }
  else if (preset === 'start-end-2025'){ aM.value = 'jan'; aY.value = '2025'; bM.value = 'dec'; bY.value = '2025'; }
  renderCompare();
}

function renderCompare() {
  var aM = document.getElementById('cmpAMonth').value;
  var aY = document.getElementById('cmpAYear').value;
  var bM = document.getElementById('cmpBMonth').value;
  var bY = document.getElementById('cmpBYear').value;

  var aData = miAggMonth(aY, aM);
  var bData = miAggMonth(bY, bM);
  var aLbl = MI_MONTH_FULL[aM] + ' ' + aY;
  var bLbl = MI_MONTH_FULL[bM] + ' ' + bY;

  var content = document.getElementById('compareContent');
  if (!aData && !bData) {
    content.innerHTML = '<div style="padding:30px;text-align:center;color:var(--muted);">No data available for either selection.</div>';
    return;
  }

  function delta(now, prev) { return prev ? ((now - prev) / prev * 100) : null; }

  var rows = [
    {lbl:'Sales Count',  va:aData?aData.count.toLocaleString():'—',           vb:bData?bData.count.toLocaleString():'—',           d:aData&&bData?delta(bData.count, aData.count):null,       inv:false},
    {lbl:'Avg Price',    va:aData?miFmtMoney(aData.avgPrice):'—',             vb:bData?miFmtMoney(bData.avgPrice):'—',             d:aData&&bData?delta(bData.avgPrice, aData.avgPrice):null, inv:false},
    {lbl:'Avg $/Sq Ft',  va:aData?'$'+Math.round(aData.avgPsf):'—',           vb:bData?'$'+Math.round(bData.avgPsf):'—',           d:aData&&bData?delta(bData.avgPsf, aData.avgPsf):null,     inv:false},
    {lbl:'Avg DOM',      va:aData?Math.round(aData.avgDom)+' days':'—',       vb:bData?Math.round(bData.avgDom)+' days':'—',       d:aData&&bData?delta(bData.avgDom, aData.avgDom):null,     inv:true},
    {lbl:'Total Volume', va:aData?miFmtMoney(aData.vol):'—',                  vb:bData?miFmtMoney(bData.vol):'—',                  d:aData&&bData?delta(bData.vol, aData.vol):null,           inv:false}
  ];

  var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">';
  // Side A
  html += '<div style="background:#e8f0e8;border:2px solid var(--sage);border-radius:10px;padding:16px;">' +
    '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--sage);margin-bottom:8px;">' + aLbl + '</div>';
  if (aData) {
    html += '<div style="font-family:\'Merriweather\',serif;font-size:2rem;font-weight:700;color:var(--green);margin-bottom:6px;">' + aData.count + ' <span style="font-size:.6em;color:var(--muted);">closings</span></div>' +
      '<div style="font-size:13px;color:var(--text);line-height:1.7;">' +
      '<strong>' + miFmtMoney(aData.avgPrice) + '</strong> avg · <strong>$' + Math.round(aData.avgPsf) + '</strong>/sf<br>' +
      '<strong>' + Math.round(aData.avgDom) + ' days</strong> avg DOM · <strong>' + miFmtMoney(aData.vol) + '</strong> total</div>';
  } else {
    html += '<div style="font-style:italic;color:var(--muted);padding:20px 0;">No data</div>';
  }
  html += '</div>';
  // Side B
  html += '<div style="background:#fde4d3;border:2px solid var(--orange);border-radius:10px;padding:16px;">' +
    '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--orange);margin-bottom:8px;">' + bLbl + '</div>';
  if (bData) {
    html += '<div style="font-family:\'Merriweather\',serif;font-size:2rem;font-weight:700;color:var(--green);margin-bottom:6px;">' + bData.count + ' <span style="font-size:.6em;color:var(--muted);">closings</span></div>' +
      '<div style="font-size:13px;color:var(--text);line-height:1.7;">' +
      '<strong>' + miFmtMoney(bData.avgPrice) + '</strong> avg · <strong>$' + Math.round(bData.avgPsf) + '</strong>/sf<br>' +
      '<strong>' + Math.round(bData.avgDom) + ' days</strong> avg DOM · <strong>' + miFmtMoney(bData.vol) + '</strong> total</div>';
  } else {
    html += '<div style="font-style:italic;color:var(--muted);padding:20px 0;">No data</div>';
  }
  html += '</div></div>';

  // Delta table — header is dynamic now (could be YoY, sequential, or random combo)
  var changeLabel = (aY === bY) ? 'Δ (same year)' : (aM === bM ? 'YoY Change' : 'Δ');
  html += '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;overflow:hidden;">' +
    '<div style="display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;background:var(--green);color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">' +
      '<div style="padding:10px 12px;">Metric</div>' +
      '<div style="padding:10px 12px;text-align:right;">' + aLbl + '</div>' +
      '<div style="padding:10px 12px;text-align:right;">' + bLbl + '</div>' +
      '<div style="padding:10px 12px;text-align:right;">' + changeLabel + '</div>' +
    '</div>';
  rows.forEach(function(r){
    var dClass = r.d != null ? miDeltaClass(r.d, r.inv) : '';
    var dArrow = r.d != null ? miDeltaArrow(r.d, r.inv) : '';
    html += '<div style="display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;border-top:1px solid var(--border);font-size:12px;">' +
      '<div style="padding:10px 12px;font-weight:600;">' + r.lbl + '</div>' +
      '<div style="padding:10px 12px;text-align:right;color:var(--sage);font-weight:700;">' + r.va + '</div>' +
      '<div style="padding:10px 12px;text-align:right;color:var(--orange);font-weight:700;">' + r.vb + '</div>' +
      '<div style="padding:10px 12px;text-align:right;" class="' + dClass + '">' + (r.d != null ? dArrow + ' ' + miFmtPct(r.d) : '—') + '</div>' +
    '</div>';
  });
  html += '</div>';

  content.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════
//  GLOBAL SEARCH
// ══════════════════════════════════════════════════════════════════════
function buildSearchAll() {
  if (miSearchAll !== null) return miSearchAll;
  var all = [];
  // Iterate every year that has data in the registry — auto-includes 2016-2019 once added
  Object.keys(YEAR_DATASETS).sort().forEach(function(year){
    var ds = YEAR_DATASETS[year];
    if (!ds) return;
    MI_MONTH_KEYS.forEach(function(mKey){
      if (!ds[mKey] || !ds[mKey].data) return;
      ds[mKey].data.forEach(function(r){
        all.push({
          year: year,
          month: mKey,
          monthNum: MI_MONTH_NUM[mKey],
          date: parseInt(year) * 100 + MI_MONTH_NUM[mKey],
          addr: r.addr,
          price: r.price,
          type: r.type,
          beds: r.beds,
          baths: r.baths,
          sqft: r.sqft,
          psf: r.psf,
          yr: r.yr,
          dom: r.dom,
          model: r.model,
          name: r.name
        });
      });
    });
  });
  miSearchAll = all;
  return all;
}

function renderSearch() {
  var all = buildSearchAll();
  var q = (document.getElementById('srchText').value || '').toLowerCase().trim();
  var year = document.getElementById('srchYear').value;
  var month = document.getElementById('srchMonth').value;
  var type = document.getElementById('srchType').value;
  var price = document.getElementById('srchPrice').value;
  var beds = document.getElementById('srchBeds').value;
  var baths = document.getElementById('srchBaths').value;
  var sqft = document.getElementById('srchSqft').value;
  var yrBuilt = document.getElementById('srchYrBuilt').value;
  var dom = document.getElementById('srchDom').value;

  var filtered = all.filter(function(r){
    if (year && r.year !== year) return false;
    if (month && r.month !== month) return false;
    if (type && r.type !== type) return false;
    if (beds) {
      if (beds === '4') { if (r.beds < 4) return false; }
      else { if (r.beds !== parseInt(beds)) return false; }
    }
    if (baths) {
      if (baths === '3+') { if (r.baths < 3) return false; }
      else { if (r.baths !== parseFloat(baths)) return false; }
    }
    if (price) {
      if (price === 'u300' && r.price >= 300000) return false;
      if (price === '300-400' && (r.price < 300000 || r.price >= 400000)) return false;
      if (price === '400-500' && (r.price < 400000 || r.price >= 500000)) return false;
      if (price === '500-600' && (r.price < 500000 || r.price >= 600000)) return false;
      if (price === '600+' && r.price < 600000) return false;
    }
    if (sqft === 'u1200' && r.sqft >= 1200) return false;
    if (sqft === '1200-1600' && (r.sqft < 1200 || r.sqft >= 1600)) return false;
    if (sqft === '1600-2000' && (r.sqft < 1600 || r.sqft >= 2000)) return false;
    if (sqft === '2000-2500' && (r.sqft < 2000 || r.sqft >= 2500)) return false;
    if (sqft === '2500+' && r.sqft < 2500) return false;
    if (yrBuilt === '1970s' && (r.yr < 1970 || r.yr >= 1980)) return false;
    if (yrBuilt === '1980s' && (r.yr < 1980 || r.yr >= 1990)) return false;
    if (yrBuilt === '1990s' && (r.yr < 1990 || r.yr >= 2000)) return false;
    if (yrBuilt === '2000s' && (r.yr < 2000 || r.yr >= 2010)) return false;
    if (yrBuilt === '2010+' && r.yr < 2010) return false;
    if (dom === 'fast' && r.dom > 14) return false;
    if (dom === 'normal' && (r.dom < 15 || r.dom > 60)) return false;
    if (dom === 'slow' && r.dom <= 60) return false;
    if (q) {
      var hay = (r.addr + ' ' + r.model + ' ' + r.name + ' ' + r.type).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  // Sort
  var col = miSearchSort.col, asc = miSearchSort.asc;
  filtered.sort(function(a, b){
    var av = a[col], bv = b[col];
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if (av < bv) return asc ? -1 : 1;
    if (av > bv) return asc ? 1 : -1;
    return 0;
  });

  document.getElementById('searchCount').textContent = filtered.length.toLocaleString() + ' result' + (filtered.length===1?'':'s') + (filtered.length > 100 ? ' (showing top 100)' : '');
  var titleEl = document.getElementById('searchHeaderTitle');
  if (titleEl) titleEl.textContent = 'Search ' + all.length.toLocaleString() + ' Closed Sales';
  var miHdr = document.getElementById('miHeaderClosings');
  if (miHdr) miHdr.textContent = all.length.toLocaleString();

  var top = filtered.slice(0, 100);
  var body = document.getElementById('searchBody');

  if (!top.length) {
    body.innerHTML = '<tr><td colspan="10" style="padding:30px;text-align:center;color:var(--muted);">No matches. Try clearing some filters.</td></tr>';
    return;
  }

  var html = '';
  top.forEach(function(r){
    var domColor = r.dom <= 14 ? '#2e7d32' : (r.dom > 60 ? '#c62828' : '#f57f17');
    html += '<tr>' +
      '<td style="white-space:nowrap;"><span class="year-pill year-pill-' + r.year + '">' + MI_MONTH_SHORT[r.month] + " '" + r.year.slice(2) + '</span></td>' +
      '<td>' + r.addr + '</td>' +
      '<td style="text-align:right;font-weight:700;">' + miFmtMoneyFull(r.price) + '</td>' +
      '<td style="text-align:center;font-weight:700;color:var(--green);">' + r.type + '</td>' +
      '<td style="text-align:center;">' + r.beds + '/' + r.baths + '</td>' +
      '<td style="text-align:right;">' + r.sqft.toLocaleString() + '</td>' +
      '<td style="text-align:right;">$' + Math.round(r.psf) + '</td>' +
      '<td style="text-align:center;">' + r.yr + '</td>' +
      '<td style="text-align:right;color:' + domColor + ';font-weight:700;">' + r.dom + 'd</td>' +
      '<td style="font-size:10px;color:var(--muted);">' + (r.model || r.name || '') + '</td>' +
    '</tr>';
  });
  body.innerHTML = html;
}

function sortSearch(col) {
  if (miSearchSort.col === col) {
    miSearchSort.asc = !miSearchSort.asc;
  } else {
    miSearchSort.col = col;
    miSearchSort.asc = (col === 'addr' || col === 'type' || col === 'model');
  }
  renderSearch();
}

function clearSearch() {
  ['srchText','srchYear','srchMonth','srchType','srchPrice','srchBeds','srchBaths','srchSqft','srchYrBuilt','srchDom'].forEach(function(id){
    document.getElementById(id).value = '';
  });
  renderSearch();
}

// ══════════════════════════════════════════════════════════════════════
//  INSIGHTS
// ══════════════════════════════════════════════════════════════════════
function renderInsights() {
  var a25 = miAggYear('2025'), a26 = miAggYear('2026');
  var all = buildSearchAll();

  // Top performers
  var biggestSale = all.reduce(function(a, b){ return b.price > a.price ? b : a; }, all[0]);
  var bestPsfDeal = all.filter(function(r){ return r.psf >= 100; }).reduce(function(a, b){ return b.psf < a.psf ? b : a; }, all[0]);
  var fastestSale = all.filter(function(r){ return r.dom > 0; }).reduce(function(a, b){ return b.dom < a.dom ? b : a; }, all[0]);
  var fastestZero = all.filter(function(r){ return r.dom === 0; }).sort(function(a, b){ return b.price - a.price; })[0];

  // Seasonality (2025 only — full data)
  var byMonth25 = {};
  MI_MONTH_KEYS.forEach(function(k){
    var m = miAggMonth('2025', k);
    if (m) byMonth25[k] = m;
  });
  var counts = MI_MONTH_KEYS.map(function(k){ return byMonth25[k] ? byMonth25[k].count : 0; });
  var maxCountMo = MI_MONTH_KEYS[counts.indexOf(Math.max.apply(null, counts))];
  var minCountMo = MI_MONTH_KEYS[counts.indexOf(Math.min.apply(null, counts.filter(function(c){return c>0;})))];

  // Per-month YoY where both years have data
  var bothMonths = MI_MONTH_KEYS.filter(function(k){
    return YEAR_DATASETS['2025'][k] && YEAR_DATASETS['2025'][k].data &&
           YEAR_DATASETS['2026'][k] && YEAR_DATASETS['2026'][k].data;
  });

  var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">';

  // YoY Performance Card
  if (a25 && a26 && bothMonths.length) {
    var ytd25Count = 0, ytd25Vol = 0;
    bothMonths.forEach(function(k){
      var d = YEAR_DATASETS['2025'][k].data;
      ytd25Count += d.length;
      d.forEach(function(r){ ytd25Vol += r.price; });
    });
    var ytd26Count = 0, ytd26Vol = 0;
    bothMonths.forEach(function(k){
      var d = YEAR_DATASETS['2026'][k].data;
      ytd26Count += d.length;
      d.forEach(function(r){ ytd26Vol += r.price; });
    });
    var countDelta = (ytd26Count - ytd25Count) / ytd25Count * 100;
    var volDelta = (ytd26Vol - ytd25Vol) / ytd25Vol * 100;
    var pace = countDelta > 5 ? 'accelerating' : (countDelta < -5 ? 'cooling' : 'steady');
    var paceColor = countDelta > 5 ? 'var(--sage)' : (countDelta < -5 ? '#c62828' : 'var(--orange)');

    html += '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:16px;border-left:4px solid ' + paceColor + ';">' +
      '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px;">📈 Market Pace 2026 vs 2025</div>' +
      '<div style="font-family:\'Merriweather\',serif;font-size:1.3rem;font-weight:700;color:' + paceColor + ';margin-bottom:8px;text-transform:capitalize;">' + pace + '</div>' +
      '<div style="font-size:12px;color:var(--text);line-height:1.7;">Through the same months in both years, sales count is <strong>' + miFmtPct(countDelta) + '</strong> and total volume is <strong>' + miFmtPct(volDelta) + '</strong>. ' +
      (countDelta > 0 ? 'Buyers are showing up.' : (countDelta < 0 ? 'Activity has slowed compared to last year.' : 'Activity is on par with last year.')) +
      '</div></div>';
  }

  // Seasonality card
  if (maxCountMo && minCountMo) {
    html += '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:16px;border-left:4px solid var(--orange);">' +
      '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px;">🌡️ 2025 Seasonality</div>' +
      '<div style="font-family:\'Merriweather\',serif;font-size:1.3rem;font-weight:700;color:var(--green);margin-bottom:8px;">Peak: ' + MI_MONTH_FULL[maxCountMo] + ' · Slow: ' + MI_MONTH_FULL[minCountMo] + '</div>' +
      '<div style="font-size:12px;color:var(--text);line-height:1.7;"><strong>' + MI_MONTH_FULL[maxCountMo] + '</strong> closed <strong>' + byMonth25[maxCountMo].count + '</strong> homes — the busiest month of 2025. <strong>' + MI_MONTH_FULL[minCountMo] + '</strong> was slowest at <strong>' + byMonth25[minCountMo].count + '</strong>. Plan listings around buyer demand.</div></div>';
  }

  // Standout records
  if (biggestSale) {
    html += '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:16px;border-left:4px solid var(--sage);">' +
      '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px;">💰 Biggest Sale (2025–2026)</div>' +
      '<div style="font-family:\'Merriweather\',serif;font-size:1.3rem;font-weight:700;color:var(--green);margin-bottom:8px;">' + miFmtMoneyFull(biggestSale.price) + '</div>' +
      '<div style="font-size:12px;color:var(--text);line-height:1.7;"><strong>' + biggestSale.addr + '</strong><br>' +
      biggestSale.beds + ' bed / ' + biggestSale.baths + ' bath · ' + biggestSale.sqft.toLocaleString() + ' sq ft · built ' + biggestSale.yr + ' · closed ' + MI_MONTH_FULL[biggestSale.month] + ' ' + biggestSale.year + '</div></div>';
  }
  if (bestPsfDeal) {
    html += '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:16px;border-left:4px solid #7c5cbf;">' +
      '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px;">🎯 Best Value $/Sq Ft (2025–2026)</div>' +
      '<div style="font-family:\'Merriweather\',serif;font-size:1.3rem;font-weight:700;color:var(--green);margin-bottom:8px;">$' + bestPsfDeal.psf.toFixed(2) + '/sf</div>' +
      '<div style="font-size:12px;color:var(--text);line-height:1.7;"><strong>' + bestPsfDeal.addr + '</strong><br>' +
      'Sold for ' + miFmtMoneyFull(bestPsfDeal.price) + ' · ' + bestPsfDeal.sqft.toLocaleString() + ' sq ft · built ' + bestPsfDeal.yr + ' · closed ' + MI_MONTH_FULL[bestPsfDeal.month] + ' ' + bestPsfDeal.year + '</div></div>';
  }

  html += '</div>';

  // Per-month YoY mini table
  if (bothMonths.length > 0) {
    html += '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:16px;">' +
      '<div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:4px;">Month-by-Month YoY Performance</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:14px;">Direct comparison for months with data in both years</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:0;font-size:11px;">' +
      '<div style="padding:8px 10px;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:2px solid var(--border);">Month</div>' +
      '<div style="padding:8px 10px;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--sage);border-bottom:2px solid var(--border);text-align:right;">2025 Sales</div>' +
      '<div style="padding:8px 10px;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--orange);border-bottom:2px solid var(--border);text-align:right;">2026 Sales</div>' +
      '<div style="padding:8px 10px;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:2px solid var(--border);text-align:right;">Sales Δ</div>' +
      '<div style="padding:8px 10px;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:2px solid var(--border);text-align:right;">$/SF Δ</div>';
    bothMonths.forEach(function(k){
      var m25 = miAggMonth('2025', k), m26 = miAggMonth('2026', k);
      var cd = (m26.count - m25.count) / m25.count * 100;
      var pd = (m26.avgPsf - m25.avgPsf) / m25.avgPsf * 100;
      html += '<div style="padding:9px 10px;border-bottom:1px solid var(--border);font-weight:600;">' + MI_MONTH_FULL[k] + '</div>' +
        '<div style="padding:9px 10px;border-bottom:1px solid var(--border);text-align:right;color:var(--sage);">' + m25.count + '</div>' +
        '<div style="padding:9px 10px;border-bottom:1px solid var(--border);text-align:right;color:var(--orange);">' + m26.count + '</div>' +
        '<div style="padding:9px 10px;border-bottom:1px solid var(--border);text-align:right;" class="' + miDeltaClass(cd) + '">' + miDeltaArrow(cd) + ' ' + miFmtPct(cd) + '</div>' +
        '<div style="padding:9px 10px;border-bottom:1px solid var(--border);text-align:right;" class="' + miDeltaClass(pd) + '">' + miDeltaArrow(pd) + ' ' + miFmtPct(pd) + '</div>';
    });
    html += '</div></div>';
  }

  document.getElementById('insightsContent').innerHTML = html;
}
// ══════════════════════════════════════════════════════════════════════
//  MARKET INTELLIGENCE — 5 NEW FEATURES (Estimator, Time Machine,
//  Heat Map, Showdown, Crystal Ball)
// ══════════════════════════════════════════════════════════════════════

// ─── Shared helpers ───────────────────────────────────────────────────

// Build a cached registry of all unique models with their record counts.
// Skips empty model strings and very-rare ones.
var MI_MODEL_INDEX = null;
function miBuildModelIndex() {
  if (MI_MODEL_INDEX) return MI_MODEL_INDEX;
  var all = buildSearchAll();
  var bins = {};
  all.forEach(function(r){
    // Use whichever of model/name has actual content; prefer model
    var raw = (r.model || r.name || '').trim();
    if (!raw) return;
    // Normalize: strip leading code-prefixes that are pure noise like "P2603 "
    // Keep the human-readable part, but also keep the original for lookup
    var key = miNormalizeModel(raw);
    if (!key) return;
    if (!bins[key]) bins[key] = { key: key, display: key, count: 0, records: [] };
    bins[key].count++;
    bins[key].records.push(r);
  });
  // Filter to models with at least 3 records (statistical floor)
  var arr = Object.values(bins).filter(function(b){ return b.count >= 3; });
  arr.sort(function(a, b){ return b.count - a.count; });
  MI_MODEL_INDEX = arr;
  return arr;
}

// Normalize a model string into a canonical key.
// Strips Del Webb code prefixes (P2603, H2506, C2666, S2673, D7622, G8533, V2553, etc.),
// strips trailing modifiers ("Expanded", "Modified", "Custom"), trims and title-cases.
function miNormalizeModel(s) {
  if (!s) return '';
  var x = String(s).trim();
  // Strip leading model codes like "P2603 ", "H-7651 ", "C2666 ", "S2671 "
  x = x.replace(/^[A-Z]+[-]?\d+[A-Z]?\s*/i, '').trim();
  // Strip trailing decorations (we still want the base name to group)
  x = x.replace(/[-—,/]\s*(expanded|extended|modified|custom|remodeled|expnd|exp|mod|custom)\b.*$/i, '').trim();
  x = x.replace(/\b(expanded|extended|modified|custom|remodeled|expnd|exp|mod)\b\s*$/i, '').trim();
  // Cleanup whitespace
  x = x.replace(/\s+/g, ' ').trim();
  // Skip totally generic catchalls
  if (!x) return '';
  var lower = x.toLowerCase();
  if (lower === 'corte bella' || lower === 'del webb' || lower === '--') return '';
  if (lower.startsWith('garden ap') || lower.startsWith('vacation')) return '';
  if (lower === 'modified' || lower === 'expanded' || lower === 'custom') return '';
  // Title-case but preserve all-caps short codes
  if (x.length <= 3 && x === x.toUpperCase()) return x;
  return x.replace(/\b\w/g, function(c){ return c.toUpperCase(); }).replace(/\B\w/g, function(c){ return c.toLowerCase(); });
}

// Get model records by canonical key
function miModelRecords(key) {
  var idx = miBuildModelIndex();
  var bin = idx.find(function(b){ return b.key === key; });
  return bin ? bin.records : [];
}

// Aggregate stats for a set of records
function miAggRecords(records) {
  if (!records || !records.length) return null;
  var prices = records.map(function(r){ return r.price; }).sort(function(a,b){return a-b;});
  var doms = records.map(function(r){ return r.dom; });
  var psfs = records.map(function(r){ return r.psf; });
  var sqfts = records.map(function(r){ return r.sqft; });
  var yrs = records.map(function(r){ return r.yr; });
  var n = records.length;
  return {
    n: n,
    minPrice: prices[0],
    maxPrice: prices[n-1],
    medianPrice: prices[Math.floor(n/2)],
    avgPrice: Math.round(prices.reduce(function(a,b){return a+b;},0)/n),
    avgDom: Math.round(doms.reduce(function(a,b){return a+b;},0)/n),
    avgPsf: Math.round(psfs.reduce(function(a,b){return a+b;},0)/n),
    avgSqft: Math.round(sqfts.reduce(function(a,b){return a+b;},0)/n),
    avgYr: Math.round(yrs.reduce(function(a,b){return a+b;},0)/n),
    p25Price: prices[Math.floor(n*0.25)],
    p75Price: prices[Math.floor(n*0.75)],
  };
}

// Format helpers (reuse miFmtMoneyShort via inline formatting)
function miFmtMoney(n) {
  if (n >= 1000000000) return '$' + (n/1000000000).toFixed(2).replace(/\.00$/,'') + 'B';
  if (n >= 1000000) return '$' + (n/1000000).toFixed(2).replace(/\.00$/,'') + 'M';
  if (n >= 1000) return '$' + Math.round(n/1000).toLocaleString() + 'K';
  return '$' + Math.round(n).toLocaleString();
}
function miFmtMoneyExact(n) { return '$' + Math.round(n).toLocaleString(); }
function miFmtSqft(n) { return Math.round(n).toLocaleString() + ' sf'; }

/**
 * Compute a comp-based valuation range. Used by both the Estimator tab
 * and the Property History tab (for showing a current-value projection
 * at the bottom of an address lookup).
 *
 * @param {Object} params { model, sqft, yr, beds, baths, condition }
 * @returns {Object|null} { low, mid, high, n, conf, weightedPsf, subjectSqft, comps } or null if insufficient data
 */
function miComputeValuation(params) {
  var model = params.model || '';
  var sqft = params.sqft || null;
  var yr = params.yr || null;
  var beds = params.beds || '';
  var baths = params.baths || '';
  var cond = params.condition || 'market';

  if (!model && !sqft && !yr) return null;

  var all = buildSearchAll();
  var pool = all.slice();

  if (model) {
    var modelRecs = miModelRecords(model);
    // Only trust the model if (a) we found enough records AND (b) the model name looks like a real Del Webb name
    // (contains letters, isn't a code like "H 788" or "P-2603")
    var looksLikeRealModel = /^[A-Z][a-z]+/.test(model) && model.length >= 4;
    if (modelRecs.length >= 5 && looksLikeRealModel) pool = modelRecs;
  }
  if (sqft) pool = pool.filter(function(r){ return Math.abs(r.sqft - sqft) <= Math.max(250, sqft * 0.20); });
  if (yr)   pool = pool.filter(function(r){ return Math.abs(r.yr - yr) <= 10; });
  if (beds) pool = pool.filter(function(r){
    if (beds === '4') return r.beds >= 4;
    return r.beds === parseInt(beds);
  });
  if (baths) pool = pool.filter(function(r){
    if (baths === '3+') return r.baths >= 3;
    return r.baths === parseFloat(baths);
  });

  // Relax if too thin
  if (pool.length < 5) {
    pool = all.slice();
    if (sqft) pool = pool.filter(function(r){ return Math.abs(r.sqft - sqft) <= sqft * 0.30; });
    if (yr)   pool = pool.filter(function(r){ return Math.abs(r.yr - yr) <= 15; });
  }

  if (pool.length < 3) return null;

  var n = pool.length;
  var conf = n >= 30 ? 'high' : (n >= 10 ? 'med' : 'low');

  // Recency weighting — newer comps count more
  var yearWeights = { '2020':0.4, '2021':0.5, '2022':0.6, '2023':0.7, '2024':0.85, '2025':0.95, '2026':1.0 };
  var weighted = pool.map(function(r){ return { psf: r.psf, w: yearWeights[r.year] || 0.5, rec: r }; });
  weighted.sort(function(a,b){ return b.w - a.w; });
  var top = weighted.slice(0, Math.min(30, weighted.length));
  var totalW = top.reduce(function(a,b){ return a + b.w; }, 0);
  var weightedPsf = top.reduce(function(a,b){ return a + b.psf * b.w; }, 0) / totalW;

  var subjectSqft = sqft || (pool.reduce(function(a,r){ return a + r.sqft; }, 0) / pool.length);
  var baseValue = weightedPsf * subjectSqft;

  var condMult = { 'market':1.0, 'updated':1.08, 'premium':1.15, 'dated':0.92 }[cond] || 1.0;
  var midValue = baseValue * condMult;

  var bandPct = conf === 'high' ? 0.07 : (conf === 'med' ? 0.10 : 0.15);

  // Find best 5 comps for evidence display
  var bestComps = pool.slice().sort(function(a,b){
    var aw = (yearWeights[a.year] || 0.5);
    var bw = (yearWeights[b.year] || 0.5);
    var aSim = sqft ? (1 - Math.abs(a.sqft - sqft) / sqft) : 0.5;
    var bSim = sqft ? (1 - Math.abs(b.sqft - sqft) / sqft) : 0.5;
    return (bw * 0.5 + bSim * 0.5) - (aw * 0.5 + aSim * 0.5);
  }).slice(0, 5);

  return {
    low: midValue * (1 - bandPct),
    mid: midValue,
    high: midValue * (1 + bandPct),
    n: n,
    conf: conf,
    weightedPsf: weightedPsf,
    subjectSqft: subjectSqft,
    comps: bestComps
  };
}

// Lead capture component (returns HTML string)
function miLeadCaptureHtml(context) {
  return '<div class="mi-lead-card">' +
    '<div class="mi-lead-title">📬 Want this in a polished PDF report?</div>' +
    '<div class="mi-lead-sub">' +
      'Get a customized Corte Bella market report — including these results, plus comparable sales detail, and Lona\'s expert read on what it means for ' +
      (context || 'your situation') + '. Free, no obligation.' +
    '</div>' +
    '<div id="leadFormWrap-' + context.replace(/\s+/g,'_') + '">' +
      '<div class="mi-lead-form">' +
        '<input type="text" id="leadName-' + context.replace(/\s+/g,'_') + '" placeholder="Your name" />' +
        '<input type="email" id="leadEmail-' + context.replace(/\s+/g,'_') + '" placeholder="Email address" />' +
        '<input type="tel" id="leadPhone-' + context.replace(/\s+/g,'_') + '" placeholder="Phone (optional)" />' +
        '<button onclick="miSubmitLead(\'' + context.replace(/\s+/g,'_').replace(/'/g,"\\'") + '\')">Send My Report →</button>' +
      '</div>' +
    '</div>' +
    '</div>';
}

function miSubmitLead(ctx) {
  var name = document.getElementById('leadName-' + ctx).value.trim();
  var email = document.getElementById('leadEmail-' + ctx).value.trim();
  var phone = document.getElementById('leadPhone-' + ctx).value.trim();
  if (!name || !email) {
    alert('Please enter at least your name and email.');
    return;
  }
  // Build mailto fallback (no backend required — everything stays client-side)
  var subject = 'Corte Bella Market Report Request — ' + name;
  var body = 'Hi Lona & Billy,\n\nI just used your Market Intelligence tool and would love a personalized PDF report.\n\n' +
             'Name: ' + name + '\n' +
             'Email: ' + email + '\n' +
             (phone ? 'Phone: ' + phone + '\n' : '') +
             '\nContext: ' + ctx.replace(/_/g,' ') + '\n\nThanks!';
  var mailto = 'mailto:lona@hometownaz.com?cc=billy@hometownaz.com&subject=' +
    encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

  document.getElementById('leadFormWrap-' + ctx).innerHTML =
    '<div class="mi-lead-success">' +
      '<strong>Thanks, ' + name.split(' ')[0] + '! 🎉</strong><br>' +
      'Your email client should open in a moment. If it doesn\'t, you can reach Lona directly at ' +
      '<a href="mailto:lona@hometownaz.com" style="color:#fff;text-decoration:underline;">lona@hometownaz.com</a> ' +
      'or call <a href="tel:+16232036271" style="color:#fff;text-decoration:underline;">(623) 203-6271</a>.' +
    '</div>';
  // Fire mailto in a new window so it doesn't navigate away
  window.location.href = mailto;
}

// ══════════════════════════════════════════════════════════════════════
//  🏠 ESTIMATOR
// ══════════════════════════════════════════════════════════════════════

function initEstimator() {
  var sel = document.getElementById('estModel');
  if (!sel || sel.options.length > 1) return; // already populated
  var idx = miBuildModelIndex();
  // Populate model dropdown sorted by frequency
  idx.slice(0, 80).forEach(function(b){
    var o = document.createElement('option');
    o.value = b.key;
    o.textContent = b.display + '  (' + b.count + ' sold)';
    sel.appendChild(o);
  });
  // Update header count
  var totalEl = document.getElementById('estTotalCount');
  if (totalEl) totalEl.textContent = buildSearchAll().length.toLocaleString();
}

function renderEstimator() {
  var model = document.getElementById('estModel').value;
  var sqft = parseInt(document.getElementById('estSqft').value) || null;
  var yr = parseInt(document.getElementById('estYear').value) || null;
  var beds = document.getElementById('estBeds').value;
  var baths = document.getElementById('estBaths').value;
  var cond = document.getElementById('estCondition').value;

  var resultEl = document.getElementById('estResult');
  var leadEl = document.getElementById('estLeadCapture');

  if (!model && !sqft && !yr) {
    resultEl.innerHTML = '<div style="background:#fdf9f1;border:1px dashed var(--border);border-radius:10px;padding:20px;text-align:center;color:var(--muted);font-size:13px;">' +
      '👆 Pick a model, or enter sq ft / year built to get an instant estimate.</div>';
    leadEl.innerHTML = '';
    return;
  }

  // Build candidate comp pool
  var all = buildSearchAll();
  var pool = all.slice();

  // Prefer recent sales — weight by recency
  // Stage 1: hard filters
  if (model) {
    var modelRecs = miModelRecords(model);
    if (modelRecs.length >= 5) {
      pool = modelRecs;
    } else {
      // Fallback: use sqft/yr filters even if model is chosen
      pool = all.slice();
    }
  }
  if (sqft) {
    pool = pool.filter(function(r){
      return Math.abs(r.sqft - sqft) <= Math.max(250, sqft * 0.20);
    });
  }
  if (yr) {
    pool = pool.filter(function(r){
      return Math.abs(r.yr - yr) <= 10;
    });
  }
  if (beds) {
    pool = pool.filter(function(r){
      if (beds === '4') return r.beds >= 4;
      return r.beds === parseInt(beds);
    });
  }
  if (baths) {
    pool = pool.filter(function(r){
      if (baths === '3+') return r.baths >= 3;
      return r.baths === parseFloat(baths);
    });
  }

  // If pool too small, progressively relax
  if (pool.length < 5) {
    pool = all.slice();
    if (sqft) pool = pool.filter(function(r){ return Math.abs(r.sqft - sqft) <= sqft * 0.30; });
    if (yr)   pool = pool.filter(function(r){ return Math.abs(r.yr - yr) <= 15; });
  }

  // Confidence score
  var n = pool.length;
  var conf = n >= 30 ? 'high' : (n >= 10 ? 'med' : 'low');

  if (n < 3) {
    resultEl.innerHTML = '<div style="background:#fdf9f1;border:1px dashed var(--border);border-radius:10px;padding:20px;text-align:center;color:var(--muted);font-size:13px;">' +
      '⚠️ Not enough comparable sales found. Try widening your criteria.</div>';
    leadEl.innerHTML = '';
    return;
  }

  // Recency-weighted price computation
  // Weight: 2026 = 1.0, 2025 = 0.9, ..., 2020 = 0.4
  var yearWeights = { '2020':0.4, '2021':0.5, '2022':0.6, '2023':0.7, '2024':0.85, '2025':0.95, '2026':1.0 };
  var weightedPsfs = [];
  pool.forEach(function(r){
    var w = yearWeights[r.year] || 0.5;
    weightedPsfs.push({ psf: r.psf, w: w, rec: r });
  });
  // Sort by weight desc, take top 30 most-recent-and-relevant
  weightedPsfs.sort(function(a,b){ return b.w - a.w; });
  var topComps = weightedPsfs.slice(0, Math.min(30, weightedPsfs.length));

  var totalW = topComps.reduce(function(a,b){return a+b.w;},0);
  var weightedAvgPsf = topComps.reduce(function(a,b){return a + b.psf*b.w;},0) / totalW;

  // Determine the subject's sqft for valuation
  var subjectSqft = sqft || (pool.reduce(function(a,r){return a+r.sqft;},0) / pool.length);

  var baseValue = weightedAvgPsf * subjectSqft;

  // Apply condition adjustment
  var condMult = { 'market':1.0, 'updated':1.08, 'premium':1.15, 'dated':0.92 }[cond] || 1.0;
  var midValue = baseValue * condMult;

  // Range: ±7% for high conf, ±10% med, ±15% low
  var bandPct = conf === 'high' ? 0.07 : (conf === 'med' ? 0.10 : 0.15);
  var lowVal = midValue * (1 - bandPct);
  var highVal = midValue * (1 + bandPct);

  // Find the 5 best comps to display (most recent + most similar sqft)
  var bestComps = pool.slice().sort(function(a,b){
    var aw = (yearWeights[a.year] || 0.5);
    var bw = (yearWeights[b.year] || 0.5);
    var aSim = sqft ? (1 - Math.abs(a.sqft - sqft) / sqft) : 0.5;
    var bSim = sqft ? (1 - Math.abs(b.sqft - sqft) / sqft) : 0.5;
    return (bw * 0.5 + bSim * 0.5) - (aw * 0.5 + aSim * 0.5);
  }).slice(0, 5);

  var confLabel = conf === 'high' ? 'High Confidence' : (conf === 'med' ? 'Medium Confidence' : 'Limited Data');
  var confClass = 'est-conf-' + conf;

  var html = '<div class="est-result-card">' +
    '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:700;">Estimated Value Range</div>' +
    '<div class="est-result-range">' + miFmtMoney(lowVal) + ' – ' + miFmtMoney(highVal) + '</div>' +
    '<div class="est-result-mid">Midpoint: ' + miFmtMoney(midValue) + '</div>' +
    '<div class="est-result-band">' +
      '<span style="color:var(--muted);">Based on <strong>' + n + '</strong> comparable sales · ' +
      '<strong>' + miFmtMoney(weightedAvgPsf) + '/sf</strong> weighted avg · ' +
      '<strong>' + Math.round(subjectSqft).toLocaleString() + ' sf</strong> subject</span>' +
    '</div>' +
    '<span class="est-confidence-pill ' + confClass + '">' + confLabel + '</span>' +
  '</div>';

  // Comp evidence table
  html += '<div style="margin-top:16px;background:#fff;border:1px solid var(--border);border-radius:10px;padding:16px;">' +
    '<div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:10px;">📋 Top 5 Most Comparable Sales</div>' +
    '<table style="width:100%;font-size:11px;border-collapse:collapse;">' +
      '<thead><tr style="border-bottom:2px solid var(--border);text-align:left;color:var(--muted);">' +
        '<th style="padding:6px 4px;">Address</th>' +
        '<th style="padding:6px 4px;text-align:right;">Sold</th>' +
        '<th style="padding:6px 4px;text-align:center;">Sq Ft</th>' +
        '<th style="padding:6px 4px;text-align:center;">$/sf</th>' +
        '<th style="padding:6px 4px;text-align:center;">Yr Built</th>' +
        '<th style="padding:6px 4px;text-align:center;">When</th>' +
      '</tr></thead><tbody>';
  bestComps.forEach(function(c){
    html += '<tr style="border-bottom:1px solid #f0ebe0;">' +
      '<td style="padding:6px 4px;">' + c.addr + '</td>' +
      '<td style="padding:6px 4px;text-align:right;font-weight:700;">' + miFmtMoneyExact(c.price) + '</td>' +
      '<td style="padding:6px 4px;text-align:center;">' + c.sqft.toLocaleString() + '</td>' +
      '<td style="padding:6px 4px;text-align:center;color:var(--orange);font-weight:700;">$' + Math.round(c.psf) + '</td>' +
      '<td style="padding:6px 4px;text-align:center;">' + c.yr + '</td>' +
      '<td style="padding:6px 4px;text-align:center;">' + (c.month.charAt(0).toUpperCase()+c.month.slice(1,3)) + " '" + c.year.slice(2) + '</td>' +
    '</tr>';
  });
  html += '</tbody></table></div>';

  // Disclaimer
  html += '<div style="font-size:10px;color:var(--muted);margin-top:8px;text-align:center;font-style:italic;">' +
    'Estimate based on actual ARMLS closed sales. Not an appraisal. Actual market value depends on condition, location specifics, upgrades, and current demand. ' +
    'For a precise valuation, contact Lona King at (623) 203-6271.' +
  '</div>';

  resultEl.innerHTML = html;

  // Lead capture
  leadEl.innerHTML = miLeadCaptureHtml('home valuation');
}

// ══════════════════════════════════════════════════════════════════════
//  ⏱️ TIME MACHINE
// ══════════════════════════════════════════════════════════════════════

function initTimeMachine() {
  var sel = document.getElementById('tmModel');
  if (!sel || sel.options.length > 1) return;
  var idx = miBuildModelIndex();
  // Filter to models with data spanning multiple years (more interesting time machine output)
  var multiYear = idx.filter(function(b){
    var years = new Set();
    b.records.forEach(function(r){ years.add(r.year); });
    return years.size >= 3 && b.count >= 8;
  });
  multiYear.slice(0, 60).forEach(function(b){
    var o = document.createElement('option');
    o.value = b.key;
    o.textContent = b.display + '  (' + b.count + ' sold across ' +
      new Set(b.records.map(function(r){return r.year;})).size + ' years)';
    sel.appendChild(o);
  });
}

function tmRandomModel() {
  var sel = document.getElementById('tmModel');
  // Pick a random non-empty option
  var options = Array.from(sel.options).slice(1);
  if (!options.length) return;
  var pick = options[Math.floor(Math.random() * options.length)];
  sel.value = pick.value;
  renderTimeMachine();
}

function renderTimeMachine() {
  var model = document.getElementById('tmModel').value;
  var resultEl = document.getElementById('tmResult');
  if (!model) {
    resultEl.innerHTML = '<div style="background:#fdf9f1;border:1px dashed var(--border);border-radius:10px;padding:24px;text-align:center;color:var(--muted);">' +
      '<div style="font-size:2rem;margin-bottom:8px;">⏱️</div>' +
      '<div style="font-size:13px;">Pick a model above to see how its value has evolved 2020 → 2026</div></div>';
    return;
  }
  var recs = miModelRecords(model);
  if (!recs.length) {
    resultEl.innerHTML = '<div style="padding:20px;color:var(--muted);font-size:13px;">No data found for this model.</div>';
    return;
  }
  // Group by year
  var byYear = {};
  recs.forEach(function(r){
    if (!byYear[r.year]) byYear[r.year] = [];
    byYear[r.year].push(r);
  });
  var years = Object.keys(byYear).sort();
  var yearStats = years.map(function(y){
    var agg = miAggRecords(byYear[y]);
    return { year: y, n: agg.n, median: agg.medianPrice, avg: agg.avgPrice, psf: agg.avgPsf, dom: agg.avgDom };
  });

  // First year vs last year
  var first = yearStats[0];
  var last = yearStats[yearStats.length - 1];
  var totalChange = last.median - first.median;
  var pctChange = (totalChange / first.median) * 100;
  var yrSpan = parseInt(last.year) - parseInt(first.year);
  var annualRate = yrSpan > 0 ? (Math.pow(last.median / first.median, 1/yrSpan) - 1) * 100 : 0;

  // Build SVG line chart
  var W = 700, H = 280, padL = 60, padR = 20, padT = 30, padB = 50;
  var minP = Math.min.apply(null, yearStats.map(function(y){return y.median;}));
  var maxP = Math.max.apply(null, yearStats.map(function(y){return y.median;}));
  var rng = (maxP - minP) || maxP * 0.1;
  var pad = rng * 0.15;
  var yMin = minP - pad, yMax = maxP + pad;

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#fafaf6;border-radius:8px;">';

  // Grid
  for (var i = 0; i <= 4; i++) {
    var gy = padT + (H - padT - padB) * (i/4);
    svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W-padR) + '" y2="' + gy + '" stroke="#e8e3d7" stroke-width="1"/>';
    var lblPrice = yMax - (yMax - yMin) * (i/4);
    svg += '<text x="' + (padL-8) + '" y="' + (gy+4) + '" text-anchor="end" font-size="10" fill="#666" font-weight="600">' + miFmtMoney(lblPrice) + '</text>';
  }

  // Build line points
  var xStep = (W - padL - padR) / Math.max(1, yearStats.length - 1);
  var pts = yearStats.map(function(y, i){
    var x = padL + i * xStep;
    var py = padT + (H - padT - padB) * (1 - (y.median - yMin) / (yMax - yMin));
    return { x: x, y: py, ys: y };
  });

  // Area fill under line
  var areaPath = 'M ' + pts[0].x + ' ' + (H - padB) + ' ';
  pts.forEach(function(p){ areaPath += 'L ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' '; });
  areaPath += 'L ' + pts[pts.length-1].x + ' ' + (H - padB) + ' Z';
  svg += '<defs><linearGradient id="tmGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#c8662a" stop-opacity="0.4"/><stop offset="100%" stop-color="#c8662a" stop-opacity="0.05"/></linearGradient></defs>';
  svg += '<path d="' + areaPath + '" fill="url(#tmGrad)"/>';

  // Line
  var linePath = pts.map(function(p, i){ return (i===0?'M':'L') + ' ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');
  svg += '<path d="' + linePath + '" fill="none" stroke="#c8662a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';

  // Dots and labels
  pts.forEach(function(p, i){
    svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="6" fill="#fff" stroke="#c8662a" stroke-width="3"/>';
    // Year label below
    svg += '<text x="' + p.x.toFixed(1) + '" y="' + (H - padB + 18) + '" text-anchor="middle" font-size="11" fill="#333" font-weight="700">' + p.ys.year + '</text>';
    svg += '<text x="' + p.x.toFixed(1) + '" y="' + (H - padB + 32) + '" text-anchor="middle" font-size="9" fill="#888">n=' + p.ys.n + '</text>';
    // Price label above (above the dot)
    svg += '<text x="' + p.x.toFixed(1) + '" y="' + (p.y - 12) + '" text-anchor="middle" font-size="11" fill="#1d3a2c" font-weight="800">' + miFmtMoney(p.ys.median) + '</text>';
  });

  // Annotations for major events
  var events = [
    { year: '2022', label: 'Spring Peak', y: 60 },
    { year: '2023', label: 'Rate Shock', y: 60 },
  ];
  events.forEach(function(ev){
    var idx = yearStats.findIndex(function(y){ return y.year === ev.year; });
    if (idx >= 0) {
      var ex = padL + idx * xStep;
      svg += '<line x1="' + ex + '" y1="' + (padT-5) + '" x2="' + ex + '" y2="' + ev.y + '" stroke="#888" stroke-width="1" stroke-dasharray="3,3"/>';
      svg += '<text x="' + ex + '" y="' + (ev.y - 2) + '" text-anchor="middle" font-size="9" fill="#888" font-style="italic">' + ev.label + '</text>';
    }
  });

  svg += '</svg>';

  // Big summary numbers
  var deltaColor = totalChange >= 0 ? 'var(--sage)' : '#c62828';
  var deltaSign = totalChange >= 0 ? '+' : '';

  var html = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;">' +
    '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">' +
      '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;">' + first.year + ' Median</div>' +
      '<div style="font-family:\'Merriweather\',serif;font-size:1.4rem;font-weight:700;color:var(--green);margin-top:4px;">' + miFmtMoney(first.median) + '</div>' +
    '</div>' +
    '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">' +
      '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;">' + last.year + ' Median</div>' +
      '<div style="font-family:\'Merriweather\',serif;font-size:1.4rem;font-weight:700;color:var(--green);margin-top:4px;">' + miFmtMoney(last.median) + '</div>' +
    '</div>' +
    '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">' +
      '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;">' + yrSpan + '-Year Change</div>' +
      '<div style="font-family:\'Merriweather\',serif;font-size:1.4rem;font-weight:700;color:' + deltaColor + ';margin-top:4px;">' + deltaSign + Math.round(pctChange) + '%</div>' +
      '<div style="font-size:10px;color:var(--muted);">' + (annualRate >= 0 ? '+' : '') + annualRate.toFixed(1) + '%/year compounded</div>' +
    '</div>' +
  '</div>';

  html += '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px;">' +
    '<div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:8px;">📈 Median Sale Price by Year — ' + model + '</div>' +
    svg +
  '</div>';

  // Story text
  html += '<div class="mi-feature-card" style="background:#fdf9f1;">' +
    '<div style="font-size:12px;color:var(--muted);line-height:1.7;">';
  if (pctChange > 50) {
    html += '<strong style="color:var(--orange);">📊 Massive appreciation.</strong> The ' + model + ' has appreciated <strong>' + Math.round(pctChange) + '%</strong> over ' + yrSpan + ' years — a compound annual rate of ' + annualRate.toFixed(1) + '%. ';
    html += 'Owners who purchased in ' + first.year + ' have seen substantial equity growth.';
  } else if (pctChange > 20) {
    html += '<strong style="color:var(--sage);">📈 Solid growth.</strong> The ' + model + ' has appreciated <strong>' + Math.round(pctChange) + '%</strong> across this ' + yrSpan + '-year window — a compound rate of ' + annualRate.toFixed(1) + '% annually. ';
    html += 'Steady, reliable appreciation typical of well-built Del Webb floor plans.';
  } else if (pctChange > 0) {
    html += '<strong style="color:var(--sage);">📊 Modest gains.</strong> The ' + model + ' is up <strong>' + Math.round(pctChange) + '%</strong> over ' + yrSpan + ' years. ';
    html += 'Prices held steady through the rate-shock period and are gradually trending upward.';
  } else {
    html += '<strong style="color:#c62828;">📉 Pricing pressure.</strong> Median pricing for the ' + model + ' is <strong>' + Math.abs(Math.round(pctChange)) + '%</strong> below the ' + first.year + ' baseline. ';
    html += 'This may signal a buying opportunity — talk to Lona about timing.';
  }
  html += '</div></div>';

  // Lead capture
  html += miLeadCaptureHtml('Time Machine for ' + model);

  resultEl.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════
//  🔥 HEAT MAP
// ══════════════════════════════════════════════════════════════════════

function renderHeatMap() {
  var period = document.getElementById('heatPeriod').value;
  var metric = document.getElementById('heatMetric').value;
  var scope = document.getElementById('heatScope').value;
  var resultEl = document.getElementById('heatResult');

  // Update header count
  var totalEl = document.getElementById('heatTotalCount');
  if (totalEl) totalEl.textContent = buildSearchAll().length.toLocaleString();

  var all = buildSearchAll();

  // Period filter
  if (period !== 'all') {
    var monthsBack = parseInt(period);
    // Find the most recent year+month in dataset and go back
    var latest = all.reduce(function(a,b){ return b.date > a.date ? b : a; }, all[0]);
    var cutoffYr = parseInt(latest.year), cutoffMo = latest.monthNum - monthsBack;
    while (cutoffMo < 1) { cutoffMo += 12; cutoffYr--; }
    var cutoffDate = cutoffYr * 100 + cutoffMo;
    all = all.filter(function(r){ return r.date >= cutoffDate; });
  }

  if (!all.length) {
    resultEl.innerHTML = '<div style="padding:20px;color:var(--muted);">No data for this period.</div>';
    return;
  }

  // Group by scope
  var groups = {};
  all.forEach(function(r){
    var key;
    if (scope === 'street') {
      // Extract street from address: drop the leading number, drop trailing unit/suffix.
      // e.g. "13606 W ANTELOPE DR" → "Antelope Dr"
      var m = r.addr.match(/^\s*\d+\s+[NSEW]\s+(.+?)$/i);
      var street = m ? m[1] : r.addr;
      // Strip trailing "--" markers
      street = street.replace(/\s*--+\s*$/, '').replace(/\s+(CT|LN|DR|BLVD|CIR|WAY|AVE)\.?\s*$/i, function(_, t){ return ' ' + t.toUpperCase(); });
      // Title-case
      key = street.toLowerCase().replace(/\b\w/g, function(c){ return c.toUpperCase(); });
    } else if (scope === 'model') {
      key = miNormalizeModel(r.model || r.name || '');
      if (!key) return;
    } else { // decade
      var yr = r.yr;
      if (yr < 1980) key = 'Built 1970s';
      else if (yr < 1990) key = 'Built 1980s';
      else if (yr < 2000) key = 'Built 1990s';
      else if (yr < 2010) key = 'Built 2000s';
      else key = 'Built 2010+';
    }
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  // Aggregate each group
  var rows = Object.keys(groups).map(function(k){
    var recs = groups[k];
    var agg = miAggRecords(recs);
    return {
      key: k,
      n: recs.length,
      median: agg.medianPrice,
      avg: agg.avgPrice,
      psf: agg.avgPsf,
      dom: agg.avgDom,
      vol: recs.reduce(function(a,r){return a+r.price;},0),
    };
  });

  // Filter out tiny groups (< 3 sales for streets/decades, < 5 for models)
  var minN = scope === 'model' ? 5 : 3;
  rows = rows.filter(function(r){ return r.n >= minN; });

  // Sort by metric
  if (metric === 'volume') rows.sort(function(a,b){ return b.n - a.n; });
  else if (metric === 'price') rows.sort(function(a,b){ return b.psf - a.psf; });
  else if (metric === 'speed') rows.sort(function(a,b){ return a.dom - b.dom; });
  else if (metric === 'median') rows.sort(function(a,b){ return b.median - a.median; });

  rows = rows.slice(0, 25);
  if (!rows.length) {
    resultEl.innerHTML = '<div style="padding:20px;color:var(--muted);">Not enough data to rank.</div>';
    return;
  }

  // Determine the metric value to render and its range for the meter
  var values = rows.map(function(r){
    if (metric === 'volume') return r.n;
    if (metric === 'price') return r.psf;
    if (metric === 'speed') return r.dom; // lower is hotter
    if (metric === 'median') return r.median;
  });
  var maxV = Math.max.apply(null, values);
  var minV = Math.min.apply(null, values);

  var metricLabel = {
    'volume': 'Sales',
    'price': '$/sf',
    'speed': 'Avg DOM',
    'median': 'Median $'
  }[metric];

  var html = '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;overflow:hidden;">' +
    '<div style="background:linear-gradient(135deg,#fff7ec,#ffe9cc);padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--orange);font-weight:800;display:grid;grid-template-columns:30px 1fr 90px 70px 70px 80px;gap:10px;">' +
      '<span>#</span>' +
      '<span>' + (scope === 'street' ? 'Street' : scope === 'model' ? 'Model' : 'Era') + '</span>' +
      '<span>Heat</span>' +
      '<span>Sales</span>' +
      '<span>$/sf</span>' +
      '<span>Median</span>' +
    '</div>';
  rows.forEach(function(r, i){
    var v = (metric === 'volume' ? r.n : metric === 'price' ? r.psf : metric === 'speed' ? r.dom : r.median);
    // For "speed" lower is better, so invert the meter fill
    var pct;
    if (metric === 'speed') {
      pct = ((maxV - v) / Math.max(1, maxV - minV)) * 100;
    } else {
      pct = ((v - minV) / Math.max(1, maxV - minV)) * 100;
    }
    pct = Math.max(8, Math.min(100, pct)); // floor so the bar is visible
    html += '<div class="heat-row">' +
      '<span class="heat-rank">' + (i+1) + '</span>' +
      '<span class="heat-name">' + r.key + '</span>' +
      '<span class="heat-meter"><span class="heat-meter-fill" style="width:' + pct.toFixed(0) + '%;"></span></span>' +
      '<span style="text-align:right;font-weight:700;">' + r.n + '</span>' +
      '<span style="text-align:right;font-weight:700;color:var(--orange);">$' + Math.round(r.psf) + '</span>' +
      '<span style="text-align:right;font-weight:700;">' + miFmtMoney(r.median) + '</span>' +
    '</div>';
  });
  html += '</div>';

  // Insights summary
  var hottest = rows[0];
  html += '<div style="background:#fff7ec;border:1px solid var(--orange);border-radius:10px;padding:14px;margin-top:12px;font-size:12px;color:var(--green);line-height:1.7;">' +
    '<strong style="color:var(--orange);">🔥 Top of the leaderboard:</strong> <strong>' + hottest.key + '</strong> with ' + hottest.n + ' sales, $' + Math.round(hottest.psf) + '/sf average, ' + hottest.dom + '-day average DOM, and ' + miFmtMoney(hottest.median) + ' median price.';
  html += '</div>';

  // Lead capture
  html += miLeadCaptureHtml('Heat Map ' + scope);

  resultEl.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════
//  ⚔️ SHOWDOWN
// ══════════════════════════════════════════════════════════════════════

function initShowdown() {
  var sel1 = document.getElementById('sdModel1');
  var sel2 = document.getElementById('sdModel2');
  if (!sel1 || sel1.options.length > 1) return;
  var idx = miBuildModelIndex();
  // Only models with at least 8 sales for fair comparison
  var qualified = idx.filter(function(b){ return b.count >= 8; });
  qualified.slice(0, 60).forEach(function(b){
    var o1 = document.createElement('option');
    o1.value = b.key;
    o1.textContent = b.display + '  (' + b.count + ' sold)';
    sel1.appendChild(o1);
    var o2 = document.createElement('option');
    o2.value = b.key;
    o2.textContent = b.display + '  (' + b.count + ' sold)';
    sel2.appendChild(o2);
  });
}

function renderShowdown() {
  var m1 = document.getElementById('sdModel1').value;
  var m2 = document.getElementById('sdModel2').value;
  var resultEl = document.getElementById('sdResult');

  if (!m1 || !m2) {
    resultEl.innerHTML = '<div style="background:#fdf9f1;border:1px dashed var(--border);border-radius:10px;padding:24px;text-align:center;color:var(--muted);">' +
      '<div style="font-size:2rem;margin-bottom:8px;">⚔️</div>' +
      '<div style="font-size:13px;">Pick two models above to see them battle it out</div></div>';
    return;
  }
  if (m1 === m2) {
    resultEl.innerHTML = '<div style="padding:20px;color:var(--muted);font-size:13px;text-align:center;">Pick two <em>different</em> models to compare!</div>';
    return;
  }

  var r1 = miModelRecords(m1);
  var r2 = miModelRecords(m2);
  var a1 = miAggRecords(r1);
  var a2 = miAggRecords(r2);

  // Determine winner per category
  var battles = [
    { label: 'Sales Volume',     v1: a1.n,         v2: a2.n,         higher: true,  fmt: function(v){return v + ' sold';} },
    { label: 'Median Price',     v1: a1.medianPrice, v2: a2.medianPrice, higher: true,  fmt: miFmtMoney },
    { label: 'Avg $/sq ft',      v1: a1.avgPsf,    v2: a2.avgPsf,    higher: true,  fmt: function(v){return '$'+v;} },
    { label: 'Avg Sq Ft',        v1: a1.avgSqft,   v2: a2.avgSqft,   higher: true,  fmt: miFmtSqft },
    { label: 'Avg Days on Market', v1: a1.avgDom,  v2: a2.avgDom,    higher: false, fmt: function(v){return v + ' days';} },
    { label: 'Year Built (avg)', v1: a1.avgYr,     v2: a2.avgYr,     higher: true,  fmt: function(v){return v;} },
    { label: 'Highest Sale',     v1: a1.maxPrice,  v2: a2.maxPrice,  higher: true,  fmt: miFmtMoney },
  ];

  // Tally winners
  var wins1 = 0, wins2 = 0;
  battles.forEach(function(b){
    if (b.v1 === b.v2) return;
    if (b.higher ? b.v1 > b.v2 : b.v1 < b.v2) wins1++;
    else wins2++;
  });

  var leftWinner = wins1 > wins2;
  var rightWinner = wins2 > wins1;

  var html = '<div class="showdown-grid">';

  // Left side
  html += '<div class="showdown-side ' + (leftWinner ? 'winner' : '') + '">' +
    '<div style="font-family:\'Merriweather\',serif;font-size:1.2rem;font-weight:800;color:var(--green);text-align:center;margin-bottom:4px;">' + m1 + '</div>' +
    '<div style="text-align:center;font-size:11px;color:var(--muted);margin-bottom:10px;">Based on ' + a1.n + ' sales</div>';
  if (leftWinner) html += '<div style="text-align:center;background:var(--orange);color:#fff;padding:4px 10px;border-radius:14px;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;display:inline-block;margin:0 auto 10px auto;width:auto;">🏆 Winner ' + wins1 + '–' + wins2 + '</div>';
  html += '</div>';

  // VS divider
  html += '<div class="showdown-vs">VS</div>';

  // Right side
  html += '<div class="showdown-side ' + (rightWinner ? 'winner' : '') + '">' +
    '<div style="font-family:\'Merriweather\',serif;font-size:1.2rem;font-weight:800;color:var(--green);text-align:center;margin-bottom:4px;">' + m2 + '</div>' +
    '<div style="text-align:center;font-size:11px;color:var(--muted);margin-bottom:10px;">Based on ' + a2.n + ' sales</div>';
  if (rightWinner) html += '<div style="text-align:center;background:var(--orange);color:#fff;padding:4px 10px;border-radius:14px;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;display:inline-block;margin:0 auto 10px auto;width:auto;">🏆 Winner ' + wins2 + '–' + wins1 + '</div>';
  html += '</div>';

  html += '</div>';

  // Stat-by-stat comparison
  html += '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:18px;margin-top:12px;">';
  battles.forEach(function(b){
    var win1 = b.v1 !== b.v2 && (b.higher ? b.v1 > b.v2 : b.v1 < b.v2);
    var win2 = b.v1 !== b.v2 && !win1;
    html += '<div class="showdown-stat-row">' +
      '<div class="showdown-stat-val ' + (win1 ? 'win' : '') + '">' + b.fmt(b.v1) + '</div>' +
      '<div class="showdown-stat-label">' + b.label + '</div>' +
      '<div class="showdown-stat-val ' + (win2 ? 'win' : '') + '">' + b.fmt(b.v2) + '</div>' +
    '</div>';
  });
  html += '</div>';

  // Verdict text
  var winnerName = leftWinner ? m1 : (rightWinner ? m2 : null);
  html += '<div style="background:linear-gradient(135deg,#fff7ec,#ffe9cc);border:1px solid var(--orange);border-radius:10px;padding:14px 18px;margin-top:12px;font-size:12px;color:var(--green);line-height:1.7;">';
  if (winnerName) {
    html += '<strong style="color:var(--orange);">🏆 Verdict:</strong> The <strong>' + winnerName + '</strong> takes ' + Math.max(wins1, wins2) + ' of ' + battles.length + ' categories. ';
  } else {
    html += '<strong style="color:var(--orange);">🤝 It\'s a tie!</strong> Both models are evenly matched. ';
  }
  html += 'Remember: data tells you trends, but the right model for <em>you</em> depends on your specific needs. Talk to Lona about which fits your lifestyle and budget.';
  html += '</div>';

  // Lead capture
  html += miLeadCaptureHtml('Showdown ' + m1 + ' vs ' + m2);

  resultEl.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════
//  🔮 CRYSTAL BALL
// ══════════════════════════════════════════════════════════════════════

function renderCrystalBall() {
  var resultEl = document.getElementById('cbResult');
  var all = buildSearchAll();

  // Build year-over-year stats
  var byYear = {};
  ['2020','2021','2022','2023','2024','2025','2026'].forEach(function(y){
    var recs = all.filter(function(r){ return r.year === y; });
    if (recs.length < 20) return;
    var agg = miAggRecords(recs);
    byYear[y] = {
      year: y,
      yearNum: parseInt(y),
      n: recs.length,
      median: agg.medianPrice,
      avgPsf: agg.avgPsf,
      avgDom: agg.avgDom,
    };
  });

  var years = Object.keys(byYear).sort();
  if (years.length < 3) {
    resultEl.innerHTML = '<div style="padding:20px;color:var(--muted);">Not enough data for a forecast.</div>';
    return;
  }

  // Linear regression on the most recent 3-4 years for projection
  // Use last 3 complete years (skip current year if partial)
  var fitYears = years.slice(-4); // last 4 years
  // We'll fit to median price
  function linReg(pts) {
    var n = pts.length;
    var sumX=0, sumY=0, sumXY=0, sumXX=0;
    pts.forEach(function(p){
      sumX += p.x; sumY += p.y;
      sumXY += p.x * p.y; sumXX += p.x * p.x;
    });
    var slope = (n*sumXY - sumX*sumY) / (n*sumXX - sumX*sumX);
    var intercept = (sumY - slope*sumX) / n;
    return { slope: slope, intercept: intercept };
  }

  var medianPts = fitYears.map(function(y, i){ return { x: byYear[y].yearNum, y: byYear[y].median }; });
  var psfPts    = fitYears.map(function(y, i){ return { x: byYear[y].yearNum, y: byYear[y].avgPsf }; });
  var domPts    = fitYears.map(function(y, i){ return { x: byYear[y].yearNum, y: byYear[y].avgDom }; });

  var fitMedian = linReg(medianPts);
  var fitPsf    = linReg(psfPts);
  var fitDom    = linReg(domPts);

  // Project forward to next year
  var lastY = byYear[years[years.length-1]];
  var nextY = lastY.yearNum + 1;
  var projMedian = fitMedian.slope * nextY + fitMedian.intercept;
  var projPsf    = fitPsf.slope * nextY + fitPsf.intercept;
  var projDom    = Math.max(5, fitDom.slope * nextY + fitDom.intercept);

  var medianGrowth = ((projMedian / lastY.median) - 1) * 100;
  var psfGrowth = ((projPsf / lastY.avgPsf) - 1) * 100;
  var domChange = projDom - lastY.avgDom;

  // Determine market posture
  var posture, postureColor, postureNarrative;
  if (medianGrowth > 4 && domChange < 5) {
    posture = '📈 Sellers\' Market Strengthening';
    postureColor = '#2e7d32';
    postureNarrative = 'Prices are projected to climb while homes sell faster. If you\'re thinking of selling, the next 12 months look favorable.';
  } else if (medianGrowth > 0 && medianGrowth <= 4) {
    posture = '⚖️ Balanced Market';
    postureColor = '#a86815';
    postureNarrative = 'Modest price growth with stable absorption. Buyers and sellers should both find reasonable conditions.';
  } else if (medianGrowth <= 0 && domChange > 0) {
    posture = '📉 Buyer\'s Window Opening';
    postureColor = '#c62828';
    postureNarrative = 'Prices flat to declining and DOM rising — buyers gain leverage. Sellers should price aggressively and stage well.';
  } else {
    posture = '🔄 Market in Transition';
    postureColor = '#1976d2';
    postureNarrative = 'Mixed signals — pricing and pace diverging. Watch closely; this is the kind of market where pricing strategy makes the biggest difference.';
  }

  // Confidence band based on fit residuals
  var residuals = medianPts.map(function(p){
    var fit = fitMedian.slope * p.x + fitMedian.intercept;
    return Math.abs(p.y - fit) / fit;
  });
  var avgResidual = residuals.reduce(function(a,b){return a+b;},0) / residuals.length;
  var bandPct = Math.max(0.04, Math.min(0.12, avgResidual * 1.5));

  var medianLow = projMedian * (1 - bandPct);
  var medianHigh = projMedian * (1 + bandPct);

  // ── Build the visualization ──
  var html = '';

  // Big posture banner
  html += '<div style="background:linear-gradient(135deg,' + postureColor + ',' + postureColor + 'bb);color:#fff;border-radius:12px;padding:18px 22px;margin-bottom:14px;">' +
    '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;opacity:.85;">Forecast Posture for ' + nextY + '</div>' +
    '<div style="font-family:\'Merriweather\',serif;font-size:1.5rem;font-weight:800;margin:6px 0;">' + posture + '</div>' +
    '<div style="font-size:13px;opacity:.95;line-height:1.5;">' + postureNarrative + '</div>' +
  '</div>';

  // Three big projection cards
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;">';

  // Median Price prediction
  html += '<div class="cb-prediction">' +
    '<div class="cb-pred-label">Projected ' + nextY + ' Median</div>' +
    '<div class="cb-pred-val">' + miFmtMoney(projMedian) + '</div>' +
    '<div class="cb-pred-range">' + miFmtMoney(medianLow) + ' – ' + miFmtMoney(medianHigh) + '</div>' +
    '<div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:8px;position:relative;">' +
      (medianGrowth >= 0 ? '+' : '') + medianGrowth.toFixed(1) + '% vs ' + lastY.year +
    '</div>' +
  '</div>';

  // PSF prediction
  html += '<div class="cb-prediction">' +
    '<div class="cb-pred-label">Projected ' + nextY + ' $/sf</div>' +
    '<div class="cb-pred-val">$' + Math.round(projPsf) + '</div>' +
    '<div class="cb-pred-range">vs $' + lastY.avgPsf + ' in ' + lastY.year + '</div>' +
    '<div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:8px;position:relative;">' +
      (psfGrowth >= 0 ? '+' : '') + psfGrowth.toFixed(1) + '% trajectory' +
    '</div>' +
  '</div>';

  // DOM prediction
  html += '<div class="cb-prediction">' +
    '<div class="cb-pred-label">Projected ' + nextY + ' DOM</div>' +
    '<div class="cb-pred-val">' + Math.round(projDom) + ' days</div>' +
    '<div class="cb-pred-range">vs ' + lastY.avgDom + ' days in ' + lastY.year + '</div>' +
    '<div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:8px;position:relative;">' +
      (domChange >= 0 ? '+' : '') + Math.round(domChange) + ' days vs ' + lastY.year +
    '</div>' +
  '</div>';

  html += '</div>';

  // ── Build a regression chart showing actual + projection ──
  var W = 700, H = 280, padL = 60, padR = 20, padT = 20, padB = 50;
  var allYs = years.concat([String(nextY)]);
  var allValues = years.map(function(y){ return byYear[y].median; }).concat([projMedian]);
  var minY = Math.min.apply(null, allValues);
  var maxY = Math.max.apply(null, allValues);
  var padY = (maxY - minY) * 0.15;
  var yMin = minY - padY, yMax = maxY + padY;

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#fafaf6;border-radius:8px;">';

  // Grid
  for (var i = 0; i <= 4; i++) {
    var gy = padT + (H - padT - padB) * (i/4);
    svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W-padR) + '" y2="' + gy + '" stroke="#e8e3d7" stroke-width="1"/>';
    var lblP = yMax - (yMax - yMin) * (i/4);
    svg += '<text x="' + (padL-8) + '" y="' + (gy+4) + '" text-anchor="end" font-size="10" fill="#666" font-weight="600">' + miFmtMoney(lblP) + '</text>';
  }

  // Plot historical points
  var xStep = (W - padL - padR) / Math.max(1, allYs.length - 1);
  var actualPts = years.map(function(y, i){
    var x = padL + i * xStep;
    var py = padT + (H - padT - padB) * (1 - (byYear[y].median - yMin) / (yMax - yMin));
    return { x: x, y: py, ys: byYear[y] };
  });

  // Actual line (green/sage)
  var actualPath = actualPts.map(function(p, i){ return (i===0?'M':'L') + ' ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');
  svg += '<path d="' + actualPath + '" fill="none" stroke="#4a7c59" stroke-width="3" stroke-linecap="round"/>';

  actualPts.forEach(function(p){
    svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="5" fill="#fff" stroke="#4a7c59" stroke-width="2.5"/>';
    svg += '<text x="' + p.x.toFixed(1) + '" y="' + (H-padB+18) + '" text-anchor="middle" font-size="10" fill="#666" font-weight="600">' + p.ys.year + '</text>';
  });

  // Projected point (orange) connected with dashed line from last actual
  var lastActual = actualPts[actualPts.length-1];
  var projX = padL + (allYs.length-1) * xStep;
  var projYpx = padT + (H - padT - padB) * (1 - (projMedian - yMin) / (yMax - yMin));
  var projLowYpx = padT + (H - padT - padB) * (1 - (medianLow - yMin) / (yMax - yMin));
  var projHighYpx = padT + (H - padT - padB) * (1 - (medianHigh - yMin) / (yMax - yMin));

  // Confidence band
  svg += '<path d="M ' + lastActual.x + ' ' + lastActual.y + ' L ' + projX + ' ' + projHighYpx + ' L ' + projX + ' ' + projLowYpx + ' Z" fill="#c8662a" fill-opacity="0.12"/>';
  // Projection line
  svg += '<line x1="' + lastActual.x + '" y1="' + lastActual.y + '" x2="' + projX + '" y2="' + projYpx + '" stroke="#c8662a" stroke-width="3" stroke-dasharray="6,4" stroke-linecap="round"/>';
  // Projection point
  svg += '<circle cx="' + projX + '" cy="' + projYpx + '" r="7" fill="#c8662a" stroke="#fff" stroke-width="3"/>';
  svg += '<text x="' + projX + '" y="' + (H-padB+18) + '" text-anchor="middle" font-size="10" fill="#c8662a" font-weight="800">' + nextY + '</text>';
  svg += '<text x="' + projX + '" y="' + (H-padB+32) + '" text-anchor="middle" font-size="9" fill="#c8662a" font-weight="700">PROJECTED</text>';
  // Projected price label
  svg += '<text x="' + projX + '" y="' + (projYpx-12) + '" text-anchor="end" font-size="11" fill="#c8662a" font-weight="800">' + miFmtMoney(projMedian) + '</text>';

  // Legend
  svg += '<g transform="translate(' + (padL+8) + ',' + (padT+8) + ')">' +
    '<line x1="0" y1="6" x2="20" y2="6" stroke="#4a7c59" stroke-width="3"/>' +
    '<text x="26" y="10" font-size="10" fill="#333">Actual</text>' +
    '<line x1="80" y1="6" x2="100" y2="6" stroke="#c8662a" stroke-width="3" stroke-dasharray="4,3"/>' +
    '<text x="106" y="10" font-size="10" fill="#333">Projected</text>' +
  '</g>';

  svg += '</svg>';

  html += '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px;">' +
    '<div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:8px;">📊 Median Sale Price Trajectory — Corte Bella (with ' + nextY + ' projection)</div>' +
    svg +
  '</div>';

  // Strategic recommendations
  html += '<div style="background:#1d3a2c;color:#fff;border-radius:12px;padding:18px;margin-bottom:14px;">' +
    '<div style="font-size:13px;font-weight:700;color:var(--orange);margin-bottom:10px;">💡 What This Means For You</div>';

  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">';
  html += '<div>' +
    '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.6);font-weight:700;margin-bottom:6px;">If You\'re a Seller</div>' +
    '<div style="font-size:12px;line-height:1.6;opacity:.92;">';
  if (medianGrowth > 3) {
    html += 'Prices are climbing — but don\'t over-price. Hot markets reward properly-priced homes with multiple offers in week 1. Pricing 2-3% above market just adds DOM.';
  } else if (medianGrowth >= 0) {
    html += 'Stable pricing means presentation matters more than ever. Updated kitchens, fresh paint, and professional staging drive top-of-range outcomes.';
  } else {
    html += 'Buyers have leverage. Price aggressively, stage thoughtfully, and consider seller concessions. Time on market is your enemy.';
  }
  html += '</div></div>';

  html += '<div>' +
    '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.6);font-weight:700;margin-bottom:6px;">If You\'re a Buyer</div>' +
    '<div style="font-size:12px;line-height:1.6;opacity:.92;">';
  if (medianGrowth > 3) {
    html += 'Don\'t wait. Every month you delay costs roughly $' + Math.round(projMedian * (medianGrowth/100) / 12).toLocaleString() + ' on the median home. Get pre-approved and be ready to act.';
  } else if (medianGrowth >= 0) {
    html += 'Take your time, but don\'t lowball. The market is balanced — well-priced homes still move. Focus on long-term fit over chasing the absolute bottom.';
  } else {
    html += 'You have leverage. Negotiate hard, ask for concessions, and don\'t overpay just because you found "the one." Multiple options exist.';
  }
  html += '</div></div>';

  html += '</div></div>';

  // Disclaimer
  html += '<div style="font-size:10px;color:var(--muted);margin-top:8px;text-align:center;font-style:italic;">' +
    'Projection uses linear regression on the most recent ' + fitYears.length + ' years of actual median price data (' + fitYears[0] + '–' + fitYears[fitYears.length-1] + '). ' +
    'Real market outcomes depend on macroeconomic conditions, interest rates, and local supply/demand shifts. Not financial advice.' +
  '</div>';

  // Lead capture
  html += miLeadCaptureHtml('Crystal Ball forecast');

  resultEl.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════
//  PRO TOOLS — 6 NEW REALTOR-FACING FEATURES
// ══════════════════════════════════════════════════════════════════════

// ─── Property index by canonical address ──────────────────────────────
var MI_PROP_INDEX = null;
function miBuildPropertyIndex() {
  if (MI_PROP_INDEX) return MI_PROP_INDEX;
  var all = buildSearchAll();
  var bins = {};
  all.forEach(function(r){
    var key = miCanonicalAddr(r.addr);
    if (!key) return;
    if (!bins[key]) bins[key] = { addr: r.addr, key: key, sales: [] };
    bins[key].sales.push(r);
  });
  // Sort each property's sales by date
  Object.values(bins).forEach(function(b){
    b.sales.sort(function(a, c){ return a.date - c.date; });
    b.salesCount = b.sales.length;
    b.lastSale = b.sales[b.sales.length-1];
  });
  MI_PROP_INDEX = bins;
  return bins;
}

// Canonicalize an address for matching: uppercase, strip trailing markers, normalize whitespace
function miCanonicalAddr(s) {
  if (!s) return '';
  var x = String(s).toUpperCase().trim();
  // Strip trailing -- markers
  x = x.replace(/\s*-+\s*$/, '');
  // Normalize multiple spaces
  x = x.replace(/\s+/g, ' ');
  // Strip trailing unit indicators
  x = x.replace(/\s+(UNIT|#|APT)\s*\S+\s*$/, '');
  return x;
}

// ══════════════════════════════════════════════════════════════════════
//  🏘️ PROPERTY HISTORY LOOKUP
// ══════════════════════════════════════════════════════════════════════

function renderPropHistory() {
  var q = document.getElementById('phSearch').value.trim().toUpperCase();
  var sugEl = document.getElementById('phSuggestions');
  var resEl = document.getElementById('phResult');

  if (!q || q.length < 3) {
    sugEl.style.display = 'none';
    sugEl.innerHTML = '';
    resEl.innerHTML = '<div style="background:#fdf9f1;border:1px dashed var(--border);border-radius:10px;padding:24px;text-align:center;color:var(--muted);">' +
      '<div style="font-size:2rem;margin-bottom:8px;">🏘️</div>' +
      '<div style="font-size:13px;">Type any Corte Bella address to see its complete sale history</div>' +
      '<div style="font-size:11px;margin-top:6px;color:var(--orange);">Try: <em>13606 W Antelope</em> or <em>21235 N 132nd</em> or <em>Bolero</em></div>' +
    '</div>';
    return;
  }

  var idx = miBuildPropertyIndex();
  var matches = Object.values(idx).filter(function(b){
    return b.key.indexOf(q) >= 0;
  }).slice(0, 12);
  // Sort: properties with most sales first, then alphabetical
  matches.sort(function(a, b){
    if (b.salesCount !== a.salesCount) return b.salesCount - a.salesCount;
    return a.key.localeCompare(b.key);
  });

  // If exactly one match OR user typed a complete address (no suggestions visible), show its detail
  // Otherwise show suggestions
  var exactMatch = matches.find(function(b){ return b.key === q; });
  if (matches.length === 1 || exactMatch) {
    var prop = exactMatch || matches[0];
    sugEl.style.display = 'none';
    showPropertyDetail(prop);
  } else if (matches.length > 1) {
    // Show suggestions
    sugEl.innerHTML = matches.map(function(b){
      var last = b.lastSale;
      return '<div class="ph-suggestion" onclick="selectProperty(\'' + b.key.replace(/'/g, "\\'") + '\')">' +
        '<strong>' + b.addr + '</strong>' +
        '<div class="ph-meta">' + b.salesCount + ' sale' + (b.salesCount===1?'':'s') + ' on file · last: ' + miFmtMoneyExact(last.price) + ' (' + last.month.charAt(0).toUpperCase()+last.month.slice(1,3) + " '" + last.year.slice(2) + ')</div>' +
      '</div>';
    }).join('');
    sugEl.style.display = 'block';
    resEl.innerHTML = '';
  } else {
    sugEl.style.display = 'none';
    resEl.innerHTML = '<div style="padding:20px;color:var(--muted);font-size:13px;text-align:center;background:#fdf9f1;border-radius:10px;">' +
      '⚠️ No matching properties found. Try a partial address or street name.</div>';
  }
}

// Jump from Property History → Estimator with this property's specs pre-filled
function phJumpToEstimator(model, sqft, yr, beds, baths) {
  showMIMode('estimator');
  setTimeout(function(){
    var modelEl = document.getElementById('estModel');
    var sqftEl = document.getElementById('estSqft');
    var yrEl = document.getElementById('estYear');
    var bedsEl = document.getElementById('estBeds');
    var bathsEl = document.getElementById('estBaths');
    if (modelEl && model) {
      for (var i = 0; i < modelEl.options.length; i++) {
        if (modelEl.options[i].value === model) { modelEl.value = model; break; }
      }
    }
    if (sqftEl && sqft)  sqftEl.value = sqft;
    if (yrEl && yr)      yrEl.value = yr;
    if (bedsEl && beds)  {
      var b = beds >= 4 ? '4' : String(beds);
      for (var j = 0; j < bedsEl.options.length; j++) if (bedsEl.options[j].value === b) { bedsEl.value = b; break; }
    }
    if (bathsEl && baths) {
      var ba = baths >= 3 ? '3+' : String(baths);
      for (var k = 0; k < bathsEl.options.length; k++) if (bathsEl.options[k].value === ba) { bathsEl.value = ba; break; }
    }
    renderEstimator();
    var modal = document.getElementById('ytdModal');
    if (modal) modal.scrollTop = 0;
  }, 80);
}

// Jump from Property History → Time Machine for this property's model
function phJumpToTimeMachine(model) {
  showMIMode('timemachine');
  setTimeout(function(){
    var sel = document.getElementById('tmModel');
    if (sel && model) {
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === model) { sel.value = model; renderTimeMachine(); break; }
      }
    }
    var modal = document.getElementById('ytdModal');
    if (modal) modal.scrollTop = 0;
  }, 80);
}

function selectProperty(key) {
  var idx = miBuildPropertyIndex();
  var prop = idx[key];
  if (!prop) return;
  document.getElementById('phSearch').value = prop.addr;
  document.getElementById('phSuggestions').style.display = 'none';
  showPropertyDetail(prop);
}

function showPropertyDetail(prop) {
  var sales = prop.sales;
  var resEl = document.getElementById('phResult');
  var html = '';

  // Header
  var first = sales[0];
  var last = sales[sales.length-1];
  var totalGain = sales.length > 1 ? (last.price - first.price) : 0;
  var totalGainPct = sales.length > 1 ? ((last.price / first.price - 1) * 100) : 0;
  var yrSpan = sales.length > 1 ? (parseInt(last.year) - parseInt(first.year)) : 0;
  var annualRate = (sales.length > 1 && yrSpan > 0) ? (Math.pow(last.price / first.price, 1/yrSpan) - 1) * 100 : 0;

  html += '<div style="background:linear-gradient(135deg,var(--green),#3a5040);color:#fff;border-radius:12px;padding:20px 24px;margin-top:14px;">' +
    '<div style="font-family:\'Merriweather\',serif;font-size:1.4rem;font-weight:700;margin-bottom:4px;">' + prop.addr + '</div>' +
    '<div style="font-size:12px;opacity:.8;">' + last.beds + ' bed · ' + last.baths + ' bath · ' + last.sqft.toLocaleString() + ' sf · built ' + last.yr + (last.model || last.name ? ' · ' + (last.model || last.name) : '') + '</div>' +
  '</div>';

  // Stat cards
  html += '<div style="display:grid;grid-template-columns:repeat(' + (sales.length > 1 ? 4 : 2) + ',1fr);gap:10px;margin:14px 0;">';
  html += '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">' +
    '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;">Sales on File</div>' +
    '<div style="font-family:\'Merriweather\',serif;font-size:1.6rem;font-weight:800;color:var(--green);margin-top:4px;">' + sales.length + '</div>' +
  '</div>';
  html += '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">' +
    '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;">Most Recent</div>' +
    '<div style="font-family:\'Merriweather\',serif;font-size:1.6rem;font-weight:800;color:var(--green);margin-top:4px;">' + miFmtMoney(last.price) + '</div>' +
    '<div style="font-size:10px;color:var(--muted);">' + last.month.charAt(0).toUpperCase()+last.month.slice(1,3) + " '" + last.year.slice(2) + '</div>' +
  '</div>';
  if (sales.length > 1) {
    var gainColor = totalGain >= 0 ? 'var(--sage)' : '#c62828';
    html += '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">' +
      '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;">Total Gain</div>' +
      '<div style="font-family:\'Merriweather\',serif;font-size:1.6rem;font-weight:800;color:' + gainColor + ';margin-top:4px;">' + (totalGain >= 0 ? '+' : '') + miFmtMoney(totalGain) + '</div>' +
      '<div style="font-size:10px;color:var(--muted);">' + (totalGainPct >= 0 ? '+' : '') + totalGainPct.toFixed(1) + '% over ' + yrSpan + ' yr' + (yrSpan===1?'':'s') + '</div>' +
    '</div>';
    html += '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">' +
      '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;">Annualized</div>' +
      '<div style="font-family:\'Merriweather\',serif;font-size:1.6rem;font-weight:800;color:var(--orange);margin-top:4px;">' + (annualRate >= 0 ? '+' : '') + annualRate.toFixed(1) + '%</div>' +
      '<div style="font-size:10px;color:var(--muted);">compounded annually</div>' +
    '</div>';
  }
  html += '</div>';

  // Timeline
  html += '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:18px 22px;">' +
    '<div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:12px;">📅 Sale History Timeline</div>' +
    '<div class="ph-timeline">';

  for (var i = sales.length - 1; i >= 0; i--) {
    var s = sales[i];
    var prev = i > 0 ? sales[i-1] : null;
    var sinceLast = '';
    if (prev) {
      var gain = s.price - prev.price;
      var gainPct = (gain / prev.price) * 100;
      var yrBetween = parseInt(s.year) - parseInt(prev.year);
      sinceLast = '<div style="margin-top:6px;font-size:11px;color:' + (gain >= 0 ? 'var(--sage)' : '#c62828') + ';font-weight:700;">' +
        (gain >= 0 ? '↑ +' : '↓ ') + miFmtMoney(Math.abs(gain)) + ' (' + (gainPct >= 0 ? '+' : '') + gainPct.toFixed(1) + '%) over ' + yrBetween + ' yr' + (yrBetween===1?'':'s') + ' since prior sale</div>';
    }
    var monthName = s.month.charAt(0).toUpperCase() + s.month.slice(1);
    html += '<div class="ph-event">' +
      '<div class="ph-event-date">' + monthName + ' ' + s.year + '</div>' +
      '<div class="ph-event-price">' + miFmtMoneyExact(s.price) + '</div>' +
      '<div class="ph-event-meta">' +
        '$' + Math.round(s.psf) + '/sf · ' + s.dom + ' days on market · ' + s.type +
        (s.model || s.name ? ' · ' + (s.model || s.name) : '') +
      '</div>' +
      sinceLast +
    '</div>';
  }
  html += '</div></div>';

  // ─── Current Value Estimate (uses the same valuation engine as the Estimator tab) ───
  var lastSale = sales[sales.length - 1];
  var modelKey = miNormalizeModel(lastSale.model || lastSale.name || '');
  var valuation = miComputeValuation({
    model: modelKey,
    sqft: lastSale.sqft,
    yr: lastSale.yr,
    beds: lastSale.beds,
    baths: lastSale.baths,
    condition: 'market'
  });
  if (valuation) {
    var lastSalePrice = lastSale.price;
    var midGrowthPct = ((valuation.mid - lastSalePrice) / lastSalePrice) * 100;
    var growthSign = midGrowthPct >= 0 ? '+' : '';
    var growthColor = midGrowthPct >= 0 ? 'var(--sage)' : '#c62828';
    var confLabel = valuation.conf === 'high' ? 'High Confidence' : (valuation.conf === 'med' ? 'Medium Confidence' : 'Limited Data');
    var confClass = 'est-conf-' + valuation.conf;

    // Build a permalink to the Estimator tab pre-filled with this property's specs
    var estParams = new URLSearchParams();
    estParams.set('intel', 'estimator');
    var estLink = window.location.pathname + '?' + estParams.toString();

    html += '<div style="margin-top:18px;background:linear-gradient(135deg,var(--green),#3a5040);color:#fff;border-radius:14px;padding:22px 26px;position:relative;overflow:hidden;">' +
      '<div style="position:absolute;top:-30px;right:-20px;width:140px;height:140px;border-radius:50%;background:rgba(232,160,64,.15);"></div>' +
      '<div style="position:relative;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
          '<span style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:var(--orange);">📍 Estimated Today</span>' +
          '<span class="est-confidence-pill ' + confClass + '" style="margin:0;">' + confLabel + '</span>' +
        '</div>' +
        '<div style="font-family:\'Merriweather\',serif;font-size:1.9rem;font-weight:800;line-height:1.1;margin-bottom:4px;">' +
          miFmtMoney(valuation.low) + ' – ' + miFmtMoney(valuation.high) +
        '</div>' +
        '<div style="font-size:13px;opacity:.9;margin-bottom:10px;">' +
          'Midpoint: <strong>' + miFmtMoney(valuation.mid) + '</strong>' +
          ' · vs last sale of ' + miFmtMoneyExact(lastSalePrice) + ' (' + lastSale.month.charAt(0).toUpperCase()+lastSale.month.slice(1,3) + " '" + lastSale.year.slice(2) + ')' +
          ' = <strong style="color:' + (midGrowthPct >= 0 ? '#a8e6a3' : '#ffb3a8') + ';">' + growthSign + midGrowthPct.toFixed(1) + '%</strong>' +
        '</div>' +
        '<div style="font-size:11px;opacity:.75;margin-bottom:14px;line-height:1.5;">' +
          'Range derived from <strong>' + valuation.n + ' comparable sales</strong> ' +
          '(weighted avg <strong>$' + Math.round(valuation.weightedPsf) + '/sf</strong> × ' + Math.round(valuation.subjectSqft).toLocaleString() + ' sf). ' +
          'Newer comps weighted heavier.' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button onclick="phJumpToEstimator(\'' + (modelKey || '').replace(/\'/g, "\\\'") + '\', ' + lastSale.sqft + ', ' + lastSale.yr + ', ' + lastSale.beds + ', ' + lastSale.baths + ')" style="padding:9px 16px;background:var(--orange);color:#fff;border:none;border-radius:6px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">🏠 Refine This Estimate →</button>' +
          (modelKey ? '<button onclick="phJumpToTimeMachine(\'' + modelKey.replace(/\'/g, "\\\'") + '\')" style="padding:9px 16px;background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:6px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">⏱️ See ' + modelKey + ' Time Machine</button>' : '') +
        '</div>' +
        '<div style="font-size:10px;opacity:.6;margin-top:10px;font-style:italic;line-height:1.5;">' +
          '⚠️ <strong>Estimate, not an appraisal.</strong> Actual market value depends on condition, upgrades, location specifics, and current demand — talk to Lona for a precise valuation.' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Lead capture
  html += miLeadCaptureHtml('property history for ' + prop.addr);

  resEl.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════
//  🛣️ STREET PROFILES
// ══════════════════════════════════════════════════════════════════════

var MI_STREET_INDEX = null;

// Extract a canonical street name from a full address.
// "13606 W ANTELOPE DR" → "Antelope Dr"
// "22008 N Via Montoya"  → "Via Montoya"
function miStreetFromAddr(addr) {
  if (!addr) return null;
  var m = addr.match(/^\s*\d+\s+[NSEW]\s+(.+?)$/i);
  if (!m) return null;
  var s = m[1].replace(/\s*-+\s*$/, '').trim();
  // Title-case
  return s.toLowerCase().replace(/\b\w/g, function(c){ return c.toUpperCase(); });
}

// Build/cache the street index: { 'Aleppo Dr': [records...], ... }
function miBuildStreetIndex() {
  if (MI_STREET_INDEX) return MI_STREET_INDEX;
  var all = buildSearchAll();
  var bins = {};
  all.forEach(function(r){
    var s = miStreetFromAddr(r.addr);
    if (!s) return;
    if (!bins[s]) bins[s] = [];
    bins[s].push(r);
  });
  // Compute aggregates
  var streets = Object.keys(bins).map(function(name){
    var recs = bins[name];
    var agg = miAggRecords(recs);
    return {
      name: name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      records: recs,
      n: recs.length,
      median: agg.medianPrice,
      avg: agg.avgPrice,
      psf: agg.avgPsf,
      dom: agg.avgDom,
      sqft: agg.avgSqft,
      yr: agg.avgYr,
      maxPrice: agg.maxPrice,
      minPrice: agg.minPrice,
    };
  });
  MI_STREET_INDEX = streets;
  return streets;
}

// MAIN ENTRY: renders either the street INDEX (list of streets) or a single STREET DETAIL view
// Decides based on URL param ?street=... OR the current state of the search input
function renderStreetIndex() {
  var streets = miBuildStreetIndex();
  var resultEl = document.getElementById('streetResult');
  if (!resultEl) return;

  // Check URL for street deep-link
  var params = new URLSearchParams(window.location.search);
  var streetParam = params.get('street');
  if (streetParam) {
    var match = streets.find(function(s){ return s.slug === streetParam || s.name.toLowerCase() === streetParam.toLowerCase(); });
    if (match) {
      renderStreetDetail(match);
      return;
    }
  }

  var q = (document.getElementById('streetSearch').value || '').toLowerCase().trim();
  var sort = document.getElementById('streetSort').value || 'volume';

  var filtered = streets.slice();
  if (q) {
    filtered = filtered.filter(function(s){ return s.name.toLowerCase().indexOf(q) >= 0; });
  }
  // Filter to streets with at least 3 sales for meaningful stats
  filtered = filtered.filter(function(s){ return s.n >= 3; });

  if (sort === 'alpha')    filtered.sort(function(a,b){ return a.name.localeCompare(b.name); });
  else if (sort === 'price-hi') filtered.sort(function(a,b){ return b.median - a.median; });
  else if (sort === 'price-lo') filtered.sort(function(a,b){ return a.median - b.median; });
  else if (sort === 'psf-hi')   filtered.sort(function(a,b){ return b.psf - a.psf; });
  else if (sort === 'speed')    filtered.sort(function(a,b){ return a.dom - b.dom; });
  else                          filtered.sort(function(a,b){ return b.n - a.n; });

  if (!filtered.length) {
    resultEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);background:#fdf9f1;border-radius:10px;font-size:13px;">No streets match your search. Try a partial name like "Aleppo" or "Desert".</div>';
    return;
  }

  // Quick stats on top
  var totalStreets = filtered.length;
  var totalSales = filtered.reduce(function(a, s){ return a + s.n; }, 0);

  var html = '<div style="font-size:11px;color:var(--muted);margin-bottom:10px;">Showing <strong>' + totalStreets + '</strong> streets with 3+ sales · <strong>' + totalSales.toLocaleString() + '</strong> total tracked sales · click any street for full profile</div>';

  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">';
  filtered.forEach(function(s){
    html += '<div class="street-card" onclick="streetJumpTo(\'' + s.slug + '\')">' +
      '<div class="street-card-name">' + s.name + '</div>' +
      '<div class="street-card-stats">' +
        '<div>📊 <strong>' + s.n + '</strong> tracked sale' + (s.n===1?'':'s') + '</div>' +
        '<div>💰 ' + miFmtMoney(s.median) + ' median · $' + Math.round(s.psf) + '/sf</div>' +
        '<div>📐 avg ' + Math.round(s.sqft).toLocaleString() + ' sf · built ' + s.yr + '</div>' +
        '<div>⏱ avg ' + s.dom + ' days on market</div>' +
      '</div>' +
      '<div class="street-card-cta">View Profile →</div>' +
    '</div>';
  });
  html += '</div>';

  resultEl.innerHTML = html;
}

// Jump to a specific street's detail view (and update URL for deep-linking)
function streetJumpTo(slug) {
  var params = new URLSearchParams(window.location.search);
  params.set('intel', 'streets');
  params.set('street', slug);
  if (window.history && window.history.replaceState) {
    window.history.replaceState({}, '', window.location.pathname + '?' + params.toString());
  }
  var streets = miBuildStreetIndex();
  var match = streets.find(function(s){ return s.slug === slug; });
  if (match) renderStreetDetail(match);
}

// Clear the street param and return to the index
function streetBackToIndex() {
  var params = new URLSearchParams(window.location.search);
  params.delete('street');
  if (window.history && window.history.replaceState) {
    var qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''));
  }
  document.getElementById('streetSearch').value = '';
  renderStreetIndex();
}

// Renders the deep-dive page for a single street
function renderStreetDetail(s) {
  var resEl = document.getElementById('streetResult');
  if (!resEl) return;

  // Update doc title for SEO/sharing/bookmarking
  if (typeof document !== 'undefined' && document.title) {
    document.title = s.name + ' — Corte Bella Real Estate Profile | Lona King & Billy Heinzman';
  }

  var recs = s.records.slice().sort(function(a, b){ return b.date - a.date; });
  var agg = miAggRecords(recs);

  // Year-by-year breakdown for trend chart
  var byYear = {};
  recs.forEach(function(r){
    if (!byYear[r.year]) byYear[r.year] = [];
    byYear[r.year].push(r);
  });
  var yearStats = Object.keys(byYear).sort().map(function(y){
    var ya = miAggRecords(byYear[y]);
    return { year: y, n: ya.n, median: ya.medianPrice, psf: ya.avgPsf, dom: ya.avgDom };
  });

  // Model mix
  var modelCount = {};
  recs.forEach(function(r){
    var k = miNormalizeModel(r.model || r.name || '');
    if (!k) return;
    modelCount[k] = (modelCount[k] || 0) + 1;
  });
  var topModels = Object.entries(modelCount)
    .sort(function(a, b){ return b[1] - a[1]; })
    .slice(0, 6);

  // Year-built distribution
  var byBuilt = {};
  recs.forEach(function(r){
    var decade;
    if (r.yr < 1980) decade = '1970s';
    else if (r.yr < 1990) decade = '1980s';
    else if (r.yr < 2000) decade = '1990s';
    else if (r.yr < 2010) decade = '2000s';
    else decade = '2010+';
    byBuilt[decade] = (byBuilt[decade] || 0) + 1;
  });

  // Top sales
  var topSales = recs.slice().sort(function(a, b){ return b.price - a.price; }).slice(0, 5);

  // --- Build the HTML ---
  var html = '';

  // Back button + breadcrumb
  html += '<div style="margin-bottom:14px;">' +
    '<button onclick="streetBackToIndex()" style="background:none;border:1px solid var(--border);color:var(--muted);padding:6px 12px;border-radius:6px;font-family:inherit;font-size:11px;cursor:pointer;font-weight:600;">← Back to all streets</button>' +
  '</div>';

  // Hero banner with street name + headline stats
  html += '<div style="background:linear-gradient(135deg,var(--green),#3a5040);color:#fff;border-radius:14px;padding:24px 28px;margin-bottom:14px;position:relative;overflow:hidden;">' +
    '<div style="position:absolute;top:-30px;right:-20px;width:160px;height:160px;border-radius:50%;background:rgba(232,160,64,.15);"></div>' +
    '<div style="position:relative;">' +
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--orange);font-weight:800;margin-bottom:4px;">📍 Corte Bella Street Profile</div>' +
      '<div style="font-family:\'Merriweather\',serif;font-size:1.9rem;font-weight:800;line-height:1.1;margin-bottom:6px;">' + s.name + '</div>' +
      '<div style="font-size:13px;opacity:.9;">' + s.n + ' tracked closings · median ' + miFmtMoney(s.median) + ' · $' + Math.round(s.psf) + '/sf · ' + s.dom + ' day avg DOM</div>' +
    '</div>' +
  '</div>';

  // Big stat cards
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">';
  var statCards = [
    {lbl: 'Total Sales', val: s.n.toLocaleString(), tip: 'Closings tracked across all years on this street'},
    {lbl: 'Median Price', val: miFmtMoney(s.median), tip: 'Median sale price across all closings'},
    {lbl: 'Highest Sale', val: miFmtMoney(s.maxPrice), tip: 'Top sale ever recorded on this street'},
    {lbl: 'Avg DOM', val: s.dom + ' days', tip: 'Average time from listing to close'}
  ];
  statCards.forEach(function(c){
    html += '<div data-tip="' + c.tip + '" style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;cursor:help;">' +
      '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;margin-bottom:4px;">' + c.lbl + '</div>' +
      '<div style="font-family:\'Merriweather\',serif;font-size:1.3rem;font-weight:800;color:var(--green);">' + c.val + '</div>' +
    '</div>';
  });
  html += '</div>';

  // Year trend chart (if 3+ years of data)
  if (yearStats.length >= 3) {
    var W = 700, H = 220, padL = 60, padR = 20, padT = 20, padB = 50;
    var minP = Math.min.apply(null, yearStats.map(function(y){ return y.median; }));
    var maxP = Math.max.apply(null, yearStats.map(function(y){ return y.median; }));
    var pad = (maxP - minP) * 0.15 || maxP * 0.1;
    var yMin = minP - pad, yMax = maxP + pad;
    var xStep = (W - padL - padR) / Math.max(1, yearStats.length - 1);

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#fafaf6;border-radius:8px;">';
    for (var i = 0; i <= 4; i++) {
      var gy = padT + (H - padT - padB) * (i/4);
      svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W-padR) + '" y2="' + gy + '" stroke="#e8e3d7" stroke-width="1"/>';
      svg += '<text x="' + (padL-8) + '" y="' + (gy+4) + '" text-anchor="end" font-size="10" fill="#666" font-weight="600">' + miFmtMoney(yMax - (yMax - yMin) * (i/4)) + '</text>';
    }
    var pts = yearStats.map(function(y, i){
      var x = padL + i * xStep;
      var py = padT + (H - padT - padB) * (1 - (y.median - yMin) / (yMax - yMin));
      return { x: x, y: py, ys: y };
    });
    var areaPath = 'M ' + pts[0].x + ' ' + (H - padB) + ' ';
    pts.forEach(function(p){ areaPath += 'L ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' '; });
    areaPath += 'L ' + pts[pts.length-1].x + ' ' + (H - padB) + ' Z';
    svg += '<defs><linearGradient id="strGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#c8662a" stop-opacity="0.4"/><stop offset="100%" stop-color="#c8662a" stop-opacity="0.05"/></linearGradient></defs>';
    svg += '<path d="' + areaPath + '" fill="url(#strGrad)"/>';
    var linePath = pts.map(function(p, i){ return (i===0?'M':'L') + ' ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');
    svg += '<path d="' + linePath + '" fill="none" stroke="#c8662a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    pts.forEach(function(p){
      svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="5" fill="#fff" stroke="#c8662a" stroke-width="2.5"/>';
      svg += '<text x="' + p.x.toFixed(1) + '" y="' + (H - padB + 18) + '" text-anchor="middle" font-size="10" fill="#666" font-weight="700">' + p.ys.year + '</text>';
      svg += '<text x="' + p.x.toFixed(1) + '" y="' + (H - padB + 32) + '" text-anchor="middle" font-size="9" fill="#888">n=' + p.ys.n + '</text>';
    });
    svg += '</svg>';

    html += '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px;">' +
      '<div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:8px;">📈 ' + s.name + ' — Median Sale Price by Year</div>' +
      svg +
    '</div>';
  }

  // Two-column: Model mix + Year built
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">';

  // Model mix
  html += '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;">' +
    '<div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:10px;">📐 Model Mix</div>';
  if (topModels.length) {
    var maxModelCount = topModels[0][1];
    topModels.forEach(function(m){
      var pct = (m[1] / maxModelCount) * 100;
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
        '<div style="flex:1;font-size:12px;font-weight:600;color:var(--green);">' + m[0] + '</div>' +
        '<div style="flex:2;height:8px;background:var(--sand);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#ffd28a,var(--orange));border-radius:4px;"></div></div>' +
        '<div style="width:26px;text-align:right;font-size:11px;font-weight:700;color:var(--muted);">' + m[1] + '</div>' +
      '</div>';
    });
  } else {
    html += '<div style="color:var(--muted);font-size:12px;">Model data not available for this street.</div>';
  }
  html += '</div>';

  // Year-built distribution
  html += '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;">' +
    '<div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:10px;">🏗️ Year Built Distribution</div>';
  var builtKeys = ['1970s','1980s','1990s','2000s','2010+'].filter(function(k){ return byBuilt[k]; });
  var maxBuiltCount = Math.max.apply(null, builtKeys.map(function(k){ return byBuilt[k]; }));
  builtKeys.forEach(function(k){
    var pct = (byBuilt[k] / maxBuiltCount) * 100;
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
      '<div style="flex:1;font-size:12px;font-weight:600;color:var(--green);">' + k + '</div>' +
      '<div style="flex:2;height:8px;background:var(--sand);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#a8c5b8,var(--sage));border-radius:4px;"></div></div>' +
      '<div style="width:26px;text-align:right;font-size:11px;font-weight:700;color:var(--muted);">' + byBuilt[k] + '</div>' +
    '</div>';
  });
  html += '</div>';
  html += '</div>';

  // Top 5 sales
  html += '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px;">' +
    '<div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:10px;">🏆 Top 5 Sales on ' + s.name + '</div>' +
    '<table style="width:100%;font-size:12px;border-collapse:collapse;">' +
      '<thead><tr style="text-align:left;color:var(--muted);background:#fdf9f1;">' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);">Address</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);text-align:right;">Sold</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);text-align:center;">Sq Ft</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);text-align:center;">$/sf</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);text-align:center;">When</th>' +
      '</tr></thead><tbody>';
  topSales.forEach(function(r){
    html += '<tr style="border-bottom:1px solid #f0ebe0;">' +
      '<td style="padding:8px;">' + r.addr + '</td>' +
      '<td style="padding:8px;text-align:right;font-weight:700;color:var(--orange);">' + miFmtMoneyExact(r.price) + '</td>' +
      '<td style="padding:8px;text-align:center;">' + r.sqft.toLocaleString() + '</td>' +
      '<td style="padding:8px;text-align:center;">$' + Math.round(r.psf) + '</td>' +
      '<td style="padding:8px;text-align:center;color:var(--muted);">' + (r.month.charAt(0).toUpperCase()+r.month.slice(1,3)) + " '" + r.year.slice(2) + '</td>' +
    '</tr>';
  });
  html += '</tbody></table></div>';

  // Recent activity (last 8 sales)
  var recent = recs.slice(0, 8);
  html += '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px;">' +
    '<div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:10px;">🕐 Most Recent Activity</div>' +
    '<table style="width:100%;font-size:12px;border-collapse:collapse;">' +
      '<thead><tr style="text-align:left;color:var(--muted);background:#fdf9f1;">' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);">Closed</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);">Address</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);text-align:right;">Sold</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);text-align:center;">Sq Ft / $/sf</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);text-align:center;">DOM</th>' +
      '</tr></thead><tbody>';
  recent.forEach(function(r){
    html += '<tr style="border-bottom:1px solid #f0ebe0;">' +
      '<td style="padding:8px;color:var(--muted);">' + (r.month.charAt(0).toUpperCase()+r.month.slice(1,3)) + " '" + r.year.slice(2) + '</td>' +
      '<td style="padding:8px;">' + r.addr + '</td>' +
      '<td style="padding:8px;text-align:right;font-weight:700;">' + miFmtMoneyExact(r.price) + '</td>' +
      '<td style="padding:8px;text-align:center;">' + r.sqft.toLocaleString() + ' sf · $' + Math.round(r.psf) + '</td>' +
      '<td style="padding:8px;text-align:center;">' + r.dom + 'd</td>' +
    '</tr>';
  });
  html += '</tbody></table></div>';

  // Lona CTA — context-specific
  html += '<div style="background:linear-gradient(135deg,var(--orange),#e8a040);color:#fff;border-radius:12px;padding:20px 24px;margin-bottom:14px;">' +
    '<div style="font-family:\'Merriweather\',serif;font-size:1.15rem;font-weight:700;margin-bottom:6px;">Looking at a home on ' + s.name + '?</div>' +
    '<div style="font-size:12px;opacity:.95;line-height:1.5;margin-bottom:12px;">' +
      'Lona King and Billy Heinzman have tracked every closing on ' + s.name + ' for the past 7 years. We know which sales are outliers, which homes have hidden upgrades, and which ones to avoid. Talk to us before you make a move.' +
    '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
      '<a href="tel:+16232036271" style="display:inline-block;padding:9px 18px;background:#fff;color:var(--orange);border-radius:6px;font-family:inherit;font-size:12px;font-weight:800;text-decoration:none;">📞 Call Lona — (623) 203-6271</a>' +
      '<a href="mailto:lona@hometownaz.com?subject=Question%20about%20' + encodeURIComponent(s.name) + '" style="display:inline-block;padding:9px 18px;background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:6px;font-family:inherit;font-size:12px;font-weight:700;text-decoration:none;">✉️ Email Us</a>' +
    '</div>' +
  '</div>';

  // Lead capture
  html += miLeadCaptureHtml('properties on ' + s.name);

  resEl.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════
//  💰 PRICING POWER CALCULATOR
// ══════════════════════════════════════════════════════════════════════

function initPricingPower() {
  var sel = document.getElementById('ppModel');
  if (!sel || sel.options.length > 1) return;
  var idx = miBuildModelIndex();
  idx.slice(0, 60).forEach(function(b){
    var o = document.createElement('option');
    o.value = b.key;
    o.textContent = b.display + '  (' + b.count + ')';
    sel.appendChild(o);
  });
}

function renderPricingPower() {
  var model = document.getElementById('ppModel').value;
  var sqft = parseInt(document.getElementById('ppSqft').value) || null;
  var yr = parseInt(document.getElementById('ppYear').value) || null;
  var months = parseInt(document.getElementById('ppPeriod').value) || 24;
  var resEl = document.getElementById('ppResult');

  if (!model && !sqft) {
    resEl.innerHTML = '<div style="background:#fdf9f1;border:1px dashed var(--border);border-radius:10px;padding:24px;text-align:center;color:var(--muted);">' +
      '<div style="font-size:2rem;margin-bottom:8px;">💰</div>' +
      '<div style="font-size:13px;">Pick a model or enter sq ft to calculate pricing scenarios</div></div>';
    return;
  }

  // Build candidate pool
  var all = buildSearchAll();
  // Filter by recency
  var latest = all.reduce(function(a, b){ return b.date > a.date ? b : a; }, all[0]);
  var cutoffYr = parseInt(latest.year);
  var cutoffMo = latest.monthNum - months;
  while (cutoffMo < 1) { cutoffMo += 12; cutoffYr--; }
  var cutoffDate = cutoffYr * 100 + cutoffMo;
  var pool = all.filter(function(r){ return r.date >= cutoffDate; });

  if (model) {
    var modelRecs = miModelRecords(model);
    pool = modelRecs.filter(function(r){ return r.date >= cutoffDate; });
    if (pool.length < 5) pool = modelRecs;
  }
  if (sqft) {
    pool = pool.filter(function(r){ return Math.abs(r.sqft - sqft) <= Math.max(250, sqft * 0.20); });
  }
  if (yr) {
    pool = pool.filter(function(r){ return Math.abs(r.yr - yr) <= 12; });
  }

  if (pool.length < 5) {
    resEl.innerHTML = '<div style="background:#fdf9f1;border:1px dashed var(--border);border-radius:10px;padding:24px;text-align:center;color:var(--muted);font-size:13px;">' +
      '⚠️ Not enough comparable sales (' + pool.length + ' found). Widen criteria or extend the recency window.</div>';
    return;
  }

  // Compute median sale price as "fair" price baseline
  var prices = pool.map(function(r){ return r.price; }).sort(function(a, b){ return a - b; });
  var medPrice = prices[Math.floor(prices.length/2)];
  var avgDom = pool.reduce(function(a, r){ return a + r.dom; }, 0) / pool.length;

  // Build a price-vs-DOM regression from the pool (use $/sf to normalize against size)
  // Insight: higher PSF tends to take longer to sell. Compute the relationship.
  var psfValues = pool.map(function(r){ return r.psf; });
  var domValues = pool.map(function(r){ return r.dom; });
  function reg(xs, ys) {
    var n = xs.length;
    var sx = xs.reduce(function(a,b){return a+b;},0);
    var sy = ys.reduce(function(a,b){return a+b;},0);
    var sxy = 0, sxx = 0;
    for (var i = 0; i < n; i++) { sxy += xs[i]*ys[i]; sxx += xs[i]*xs[i]; }
    var slope = (n*sxy - sx*sy) / (n*sxx - sx*sx);
    var intercept = (sy - slope*sx) / n;
    return { slope: slope, intercept: intercept };
  }
  var psfDomFit = reg(psfValues, domValues);

  // Compute a target sqft for projecting
  var avgSqft = pool.reduce(function(a, r){ return a + r.sqft; }, 0) / pool.length;
  var subjectSqft = sqft || Math.round(avgSqft);

  // 5 pricing scenarios: -7%, -3%, market (median), +3%, +7%
  var scenarios = [
    { label: 'Aggressive', deltaPct: -7,  desc: 'Below market — fast sale' },
    { label: 'Below Market', deltaPct: -3, desc: 'Soft pricing — multi-offer' },
    { label: 'Market', deltaPct: 0, desc: 'Median for comps' },
    { label: 'Above Market', deltaPct: 3, desc: 'Stretch pricing' },
    { label: 'Premium', deltaPct: 7, desc: 'Top of range — patient' },
  ];

  // Find the recommended scenario: balance between price and speed
  var html = '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:14px;">';

  // Top stats
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">';
  html += '<div style="background:#fdf9f1;border-radius:8px;padding:12px 14px;text-align:center;">' +
    '<div style="font-size:10px;text-transform:uppercase;color:var(--muted);font-weight:700;">Comps Used</div>' +
    '<div style="font-family:\'Merriweather\',serif;font-size:1.3rem;font-weight:800;color:var(--green);">' + pool.length + '</div>' +
  '</div>';
  html += '<div style="background:#fdf9f1;border-radius:8px;padding:12px 14px;text-align:center;">' +
    '<div style="font-size:10px;text-transform:uppercase;color:var(--muted);font-weight:700;">Market Median</div>' +
    '<div style="font-family:\'Merriweather\',serif;font-size:1.3rem;font-weight:800;color:var(--green);">' + miFmtMoney(medPrice) + '</div>' +
  '</div>';
  html += '<div style="background:#fdf9f1;border-radius:8px;padding:12px 14px;text-align:center;">' +
    '<div style="font-size:10px;text-transform:uppercase;color:var(--muted);font-weight:700;">Median DOM</div>' +
    '<div style="font-family:\'Merriweather\',serif;font-size:1.3rem;font-weight:800;color:var(--orange);">' + Math.round(avgDom) + ' days</div>' +
  '</div>';
  html += '<div style="background:#fdf9f1;border-radius:8px;padding:12px 14px;text-align:center;">' +
    '<div style="font-size:10px;text-transform:uppercase;color:var(--muted);font-weight:700;">Subject Sq Ft</div>' +
    '<div style="font-family:\'Merriweather\',serif;font-size:1.3rem;font-weight:800;color:var(--green);">' + subjectSqft.toLocaleString() + '</div>' +
  '</div>';
  html += '</div>';

  // Scenario grid
  html += '<div class="pp-result-grid">';
  scenarios.forEach(function(s, i){
    var price = medPrice * (1 + s.deltaPct/100);
    var psfAtPrice = price / subjectSqft;
    // Predict DOM from regression: DOM = slope * PSF + intercept
    var predDom = Math.max(3, Math.round(psfDomFit.slope * psfAtPrice + psfDomFit.intercept));
    // Probability of selling in <30 days: count comps in pool that sold in <30 days within 5% of this PSF
    var nearby = pool.filter(function(r){ return Math.abs(r.psf - psfAtPrice) < psfAtPrice * 0.07; });
    var fastN = nearby.filter(function(r){ return r.dom <= 30; }).length;
    var fastPct = nearby.length >= 3 ? Math.round(fastN / nearby.length * 100) : null;
    var isRec = (i === 1 || i === 2); // recommend "below market" or "market"
    // Better recommendation logic: pick the scenario where fastPct is highest and price is still above medPrice * 0.95
    html += '<div class="pp-scenario' + (isRec ? ' recommended' : '') + '">' +
      (isRec && i === 2 ? '<div class="pp-recommended-badge">⭐ Sweet Spot</div>' : '') +
      '<div class="pp-scenario-label">' + s.label + (s.deltaPct !== 0 ? ' (' + (s.deltaPct > 0 ? '+' : '') + s.deltaPct + '%)' : '') + '</div>' +
      '<div class="pp-scenario-price">' + miFmtMoney(price) + '</div>' +
      '<div class="pp-scenario-dom">~' + predDom + ' days</div>' +
      (fastPct !== null ? '<div class="pp-scenario-prob">' + fastPct + '% sold in 30d</div>' : '<div class="pp-scenario-prob">Limited data</div>') +
    '</div>';
  });
  html += '</div>';

  html += '<div style="margin-top:14px;font-size:11px;color:var(--muted);font-style:italic;text-align:center;">' +
    'Predictions based on linear regression of $/sf vs DOM in the comparable pool. The "% sold in 30 days" reflects historical homes priced within 7% of each scenario\'s $/sf.' +
  '</div>';

  html += '</div>';

  // Strategic guidance
  html += '<div style="background:linear-gradient(135deg,#1d3a2c,#2d5040);color:#fff;border-radius:12px;padding:18px 22px;">' +
    '<div style="font-size:13px;font-weight:700;color:var(--orange);margin-bottom:8px;">💡 Pricing Strategy Read</div>' +
    '<div style="font-size:12px;line-height:1.7;opacity:.95;">';
  if (psfDomFit.slope > 0.3) {
    html += 'Strong positive slope between $/sf and DOM — <strong>this segment is price-sensitive right now</strong>. Each $5/sf above market roughly adds ' + Math.round(psfDomFit.slope * 5) + ' days on market. Pricing below median is rewarded with multi-offers.';
  } else if (psfDomFit.slope > 0.1) {
    html += 'Moderate price-sensitivity — homes priced at or slightly below market sell faster, but premium pricing isn\'t catastrophic. <strong>Median pricing is the safe play.</strong>';
  } else if (psfDomFit.slope > -0.1) {
    html += 'Price elasticity is weak — homes at every price point in this segment have similar DOM. <strong>The market is absorbing inventory uniformly</strong>; pricing strategy matters less than presentation.';
  } else {
    html += 'Surprising negative slope — higher-priced homes in this segment actually sell <em>faster</em>. Likely indicates premium-condition or premium-location homes are clearing the market while average-condition homes linger. <strong>Condition and presentation matter more than price.</strong>';
  }
  html += '</div></div>';

  // Lead capture
  html += miLeadCaptureHtml('pricing strategy ' + (model || 'analysis'));

  resEl.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════
//  🏆 AGENT LEADERBOARD — placeholder (data not in current PDFs)
// ══════════════════════════════════════════════════════════════════════

function renderLeaderboard() {
  var resEl = document.getElementById('lbResult');
  resEl.innerHTML = '<div class="coming-soon-card">' +
    '<div class="coming-soon-icon">🏆</div>' +
    '<div class="coming-soon-title">Coming Soon — Agent Leaderboard</div>' +
    '<div class="coming-soon-sub">' +
      'Once we wire in <strong>Agent Productivity</strong> data from ARMLS, this tab will show the top-performing Corte Bella listing agents ranked by:' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;max-width:560px;margin:0 auto;">' +
      '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px;text-align:left;">' +
        '<div style="font-weight:800;color:var(--green);margin-bottom:6px;">📊 Volume Leaders</div>' +
        '<div style="font-size:11px;color:var(--muted);line-height:1.5;">Total closed sales, total dollar volume, market share.</div>' +
      '</div>' +
      '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px;text-align:left;">' +
        '<div style="font-weight:800;color:var(--green);margin-bottom:6px;">⚡ Speed Leaders</div>' +
        '<div style="font-size:11px;color:var(--muted);line-height:1.5;">Lowest average days-on-market across closed listings.</div>' +
      '</div>' +
      '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px;text-align:left;">' +
        '<div style="font-weight:800;color:var(--green);margin-bottom:6px;">💰 Pricing Leaders</div>' +
        '<div style="font-size:11px;color:var(--muted);line-height:1.5;">Highest list-to-sale ratio (closest to or above asking).</div>' +
      '</div>' +
      '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px;text-align:left;">' +
        '<div style="font-weight:800;color:var(--green);margin-bottom:6px;">🌟 Specialists</div>' +
        '<div style="font-size:11px;color:var(--muted);line-height:1.5;">Top agents per Del Webb model — Cromwell, Safford, etc.</div>' +
      '</div>' +
    '</div>' +
    '<div class="coming-soon-data-need">' +
      '<strong>📋 Data needed:</strong> ARMLS "Agent Productivity Report" (CSV/PDF).<br>' +
      '<span style="font-size:11px;color:var(--muted);">Pull from ARMLS by date range; format includes listing agent name, brokerage, list price, sale price, DOM.</span>' +
    '</div>' +
    '<div style="margin-top:18px;font-size:11px;color:var(--orange);font-weight:700;">' +
      '💡 Once enabled, this tool will be <em>the</em> reason every Corte Bella agent visits this site weekly.' +
    '</div>' +
  '</div>';
}

// ══════════════════════════════════════════════════════════════════════
//  🤝 CONCESSION TRACKER — placeholder (data not in current PDFs)
// ══════════════════════════════════════════════════════════════════════

function renderConcessions() {
  var resEl = document.getElementById('ccResult');

  // We DO have list price patterns we can synthesize from the data — let's at least show DOM-based stress signals as a proxy for "pricing pressure"
  var all = buildSearchAll();
  var recent24 = all.filter(function(r){
    // Find latest year, go back 24 months
    return true; // simplified — show all-time pressure
  });

  // Compute % of homes selling slow (60+ DOM) per year — proxy for buyer leverage / concession pressure
  var byYear = {};
  all.forEach(function(r){
    if (!byYear[r.year]) byYear[r.year] = { total: 0, slow: 0, fast: 0 };
    byYear[r.year].total++;
    if (r.dom > 60) byYear[r.year].slow++;
    if (r.dom <= 14) byYear[r.year].fast++;
  });
  var years = Object.keys(byYear).sort();

  var html = '<div class="coming-soon-card" style="margin-bottom:14px;">' +
    '<div class="coming-soon-icon">🤝</div>' +
    '<div class="coming-soon-title">Coming Soon — Full Concession Tracker</div>' +
    '<div class="coming-soon-sub">' +
      'Full concession data — including dollar amounts, frequency by price tier, trending direction, and which agents/brokerages negotiate the most concessions — requires a different ARMLS export with transaction details.' +
    '</div>' +
    '<div class="coming-soon-data-need">' +
      '<strong>📋 Data needed:</strong> ARMLS Closed Sales report with seller-concession field included.<br>' +
      '<span style="font-size:11px;color:var(--muted);">Available in the standard MLS detail export.</span>' +
    '</div>' +
  '</div>';

  // What we CAN show right now: a "pricing pressure" proxy chart
  html += '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:18px;">' +
    '<div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:4px;">📊 Buyer Leverage Index — Available Now (Proxy)</div>' +
    '<div style="font-size:11px;color:var(--muted);margin-bottom:14px;">' +
      'Until full concession data lands, here\'s a strong proxy: <strong>% of homes that took 60+ days to sell</strong>. When this number rises, sellers face pressure to offer concessions to close deals.' +
    '</div>';

  // Build SVG bar chart
  var W = 700, H = 220, padL = 50, padR = 20, padT = 20, padB = 50;
  var maxPct = Math.max.apply(null, years.map(function(y){ return byYear[y].slow / byYear[y].total * 100; }));
  var yMax = Math.ceil(maxPct / 10) * 10 + 5;
  var barW = (W - padL - padR) / years.length * 0.7;
  var step = (W - padL - padR) / years.length;

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#fafaf6;border-radius:8px;">';
  // Grid
  for (var i = 0; i <= 4; i++) {
    var gy = padT + (H - padT - padB) * (i/4);
    svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W-padR) + '" y2="' + gy + '" stroke="#e8e3d7" stroke-width="1"/>';
    var lblPct = yMax - (yMax * (i/4));
    svg += '<text x="' + (padL-8) + '" y="' + (gy+4) + '" text-anchor="end" font-size="10" fill="#666" font-weight="600">' + Math.round(lblPct) + '%</text>';
  }
  // Bars
  years.forEach(function(y, i){
    var pct = byYear[y].slow / byYear[y].total * 100;
    var x = padL + i * step + (step - barW) / 2;
    var barH = (H - padT - padB) * (pct / yMax);
    var by = padT + (H - padT - padB) - barH;
    var color = pct > 35 ? '#c62828' : (pct > 20 ? '#e8a040' : '#4a7c59');
    svg += '<rect x="' + x.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + barH.toFixed(1) + '" fill="' + color + '" rx="3"/>';
    svg += '<text x="' + (x + barW/2).toFixed(1) + '" y="' + (by - 6).toFixed(1) + '" text-anchor="middle" font-size="11" fill="#333" font-weight="700">' + pct.toFixed(0) + '%</text>';
    svg += '<text x="' + (x + barW/2).toFixed(1) + '" y="' + (H - padB + 18) + '" text-anchor="middle" font-size="11" fill="#333" font-weight="700">' + y + '</text>';
    svg += '<text x="' + (x + barW/2).toFixed(1) + '" y="' + (H - padB + 32) + '" text-anchor="middle" font-size="9" fill="#888">n=' + byYear[y].total + '</text>';
  });
  svg += '</svg>';
  html += svg;

  // Read of the trend
  var first = byYear[years[0]];
  var last = byYear[years[years.length-1]];
  var firstPct = first.slow / first.total * 100;
  var lastPct = last.slow / last.total * 100;
  html += '<div style="margin-top:12px;font-size:12px;color:var(--green);line-height:1.6;">' +
    '<strong style="color:var(--orange);">📊 Reading the trend:</strong> In ' + years[0] + ', only <strong>' + firstPct.toFixed(0) + '%</strong> of homes sat 60+ days. By ' + years[years.length-1] + ', that number is <strong>' + lastPct.toFixed(0) + '%</strong>. ';
  if (lastPct > firstPct + 10) {
    html += 'A meaningful rise — sellers should expect to offer more concessions to close deals.';
  } else if (lastPct > firstPct) {
    html += 'Slight increase in buyer leverage — concession asks more common but not aggressive.';
  } else {
    html += 'Inventory is moving — buyers have less leverage to demand concessions.';
  }
  html += '</div>';
  html += '</div>';

  resEl.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════
//  📐 FLOOR PLAN LIBRARY
// ══════════════════════════════════════════════════════════════════════

function renderFloorPlans() {
  var q = (document.getElementById('fpSearch').value || '').toLowerCase().trim();
  var sort = document.getElementById('fpSort').value;
  var resEl = document.getElementById('fpResult');

  var idx = miBuildModelIndex();
  // Compute aggregates per model
  var models = idx.map(function(b){
    var agg = miAggRecords(b.records);
    return {
      key: b.key,
      display: b.display,
      count: b.count,
      avgSqft: agg.avgSqft,
      medianPrice: agg.medianPrice,
      avgPsf: agg.avgPsf,
      avgDom: agg.avgDom,
      avgYr: agg.avgYr,
      yearsSpan: new Set(b.records.map(function(r){return r.year;})).size,
    };
  });

  // Filter by query
  if (q) {
    models = models.filter(function(m){ return m.key.toLowerCase().indexOf(q) >= 0; });
  }

  // Sort
  if (sort === 'popular') models.sort(function(a, b){ return b.count - a.count; });
  else if (sort === 'alpha') models.sort(function(a, b){ return a.key.localeCompare(b.key); });
  else if (sort === 'price-hi') models.sort(function(a, b){ return b.medianPrice - a.medianPrice; });
  else if (sort === 'price-lo') models.sort(function(a, b){ return a.medianPrice - b.medianPrice; });
  else if (sort === 'size-hi') models.sort(function(a, b){ return b.avgSqft - a.avgSqft; });
  else if (sort === 'size-lo') models.sort(function(a, b){ return a.avgSqft - b.avgSqft; });

  if (!models.length) {
    resEl.innerHTML = '<div style="padding:20px;color:var(--muted);text-align:center;">No models match your search.</div>';
    return;
  }

  var html = '<div style="font-size:11px;color:var(--muted);margin-bottom:10px;">Showing <strong>' + models.length + '</strong> Del Webb floor plans · click any card to see all sales of that model</div>';

  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">';
  models.forEach(function(m){
    html += '<div class="fp-card" onclick="fpJumpToModel(\'' + m.key.replace(/'/g, "\\'") + '\')">' +
      '<div class="fp-card-name">' + m.display + '</div>' +
      '<div class="fp-card-stats">' +
        '<div>📐 ~' + m.avgSqft.toLocaleString() + ' sf · built ' + m.avgYr + '</div>' +
        '<div>💰 ' + miFmtMoney(m.medianPrice) + ' median · $' + m.avgPsf + '/sf</div>' +
        '<div>📊 ' + m.count + ' sale' + (m.count===1?'':'s') + ' · ' + m.avgDom + 'd avg DOM</div>' +
      '</div>' +
      '<div class="fp-card-cta">View Sales →</div>' +
    '</div>';
  });
  html += '</div>';

  // Cross-promo to lonajking.com floor plan tool
  html += '<div style="background:linear-gradient(135deg,var(--green),#3a5040);color:#fff;border-radius:12px;padding:18px 22px;margin-top:18px;">' +
    '<div style="font-family:\'Merriweather\',serif;font-size:1.1rem;font-weight:700;margin-bottom:6px;">📐 Looking for the actual floor plan diagrams?</div>' +
    '<div style="font-size:12px;opacity:.9;line-height:1.5;margin-bottom:12px;">' +
      'Lona\'s comprehensive Corte Bella floor plan library has every Del Webb model with diagrams, sq ft breakdowns, and key features. Currently in development at lonajking.com.' +
    '</div>' +
    '<a href="https://lonajking.com" target="_blank" style="display:inline-block;padding:9px 18px;background:var(--orange);color:#fff;border-radius:6px;font-family:inherit;font-size:12px;font-weight:700;text-decoration:none;">Visit lonajking.com →</a>' +
  '</div>';

  resEl.innerHTML = html;
}

function fpJumpToModel(key) {
  // Switch to Time Machine tab and pre-select this model
  showMIMode('timemachine');
  setTimeout(function(){
    var sel = document.getElementById('tmModel');
    if (sel) {
      sel.value = key;
      renderTimeMachine();
    }
  }, 50);
}

// ══════════════════════════════════════════════════════════════════════
//  📄 QUARTERLY REPORT (PDF-ready)
// ══════════════════════════════════════════════════════════════════════

function renderQuarterlyReport() {
  var period = document.getElementById('qrPeriod').value;
  var all = buildSearchAll();

  // Determine date range
  var latest = all.reduce(function(a, b){ return b.date > a.date ? b : a; }, all[0]);
  var latestYr = parseInt(latest.year), latestMo = latest.monthNum;
  var monthsBack;
  var periodLabel;
  if (period === 'q4') { monthsBack = 3; periodLabel = 'Most Recent Quarter'; }
  else if (period === 'annual') { monthsBack = 12; periodLabel = 'Last 12 Months'; }
  else {
    // YTD
    monthsBack = latestMo;
    periodLabel = 'Year-to-Date ' + latest.year;
  }

  var cutoffYr = latestYr;
  var cutoffMo = latestMo - monthsBack + 1;
  while (cutoffMo < 1) { cutoffMo += 12; cutoffYr--; }
  var cutoffDate = cutoffYr * 100 + cutoffMo;

  var pool = all.filter(function(r){ return r.date >= cutoffDate; });
  if (!pool.length) {
    document.getElementById('qrResult').innerHTML = '<div style="padding:20px;color:var(--muted);">No data for this period.</div>';
    return;
  }

  var agg = miAggRecords(pool);

  // Same period prior year for YoY
  var pyCutoffYr = cutoffYr - 1, pyEndYr = latestYr - 1;
  var pyPool = all.filter(function(r){
    var d = r.date;
    var pyStart = pyCutoffYr * 100 + cutoffMo;
    var pyEnd = pyEndYr * 100 + latestMo;
    return d >= pyStart && d <= pyEnd;
  });
  var pyAgg = pyPool.length ? miAggRecords(pyPool) : null;

  // Top sales / hottest streets / hottest models
  var top5 = pool.slice().sort(function(a, b){ return b.price - a.price; }).slice(0, 5);

  // Streets
  var streets = {};
  pool.forEach(function(r){
    var m = r.addr.match(/^\s*\d+\s+[NSEW]\s+(.+?)$/i);
    var s = m ? m[1].replace(/\s*-+\s*$/, '').toLowerCase().replace(/\b\w/g, function(c){return c.toUpperCase();}) : 'Unknown';
    if (!streets[s]) streets[s] = [];
    streets[s].push(r);
  });
  var topStreets = Object.entries(streets)
    .filter(function(e){ return e[1].length >= 3; })
    .map(function(e){ return { name: e[0], n: e[1].length, agg: miAggRecords(e[1]) }; })
    .sort(function(a, b){ return b.n - a.n; })
    .slice(0, 8);

  // Models
  var models = {};
  pool.forEach(function(r){
    var k = miNormalizeModel(r.model || r.name || '');
    if (!k) return;
    if (!models[k]) models[k] = [];
    models[k].push(r);
  });
  var topModels = Object.entries(models)
    .filter(function(e){ return e[1].length >= 2; })
    .map(function(e){ return { name: e[0], n: e[1].length, agg: miAggRecords(e[1]) }; })
    .sort(function(a, b){ return b.n - a.n; })
    .slice(0, 8);

  // Build report HTML
  var html = '<div class="qr-preview">';

  // Header
  html += '<div style="border-bottom:3px solid var(--orange);padding-bottom:14px;margin-bottom:24px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
      '<div>' +
        '<div style="font-family:\'Merriweather\',serif;font-size:1.7rem;font-weight:800;color:var(--green);">Corte Bella Market Report</div>' +
        '<div style="font-size:13px;color:var(--muted);margin-top:4px;">' + periodLabel + ' · Generated ' + new Date().toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'}) + '</div>' +
      '</div>' +
      '<div style="text-align:right;font-size:11px;color:var(--muted);line-height:1.5;">' +
        '<strong style="color:var(--green);font-size:13px;">Lona King &amp; Billy Heinzman</strong><br>' +
        'HomeSmart · Corte Bella<br>' +
        '(623) 203-6271 · lona@hometownaz.com<br>' +
        'hometownaz.com' +
      '</div>' +
    '</div>' +
  '</div>';

  // Headline stats
  html += '<div class="qr-section">' +
    '<h3>📊 Market Snapshot</h3>' +
    '<div class="qr-grid">' +
      '<div class="qr-stat"><div class="qr-stat-lbl">Closed Sales</div><div class="qr-stat-val">' + pool.length.toLocaleString() + '</div></div>' +
      '<div class="qr-stat"><div class="qr-stat-lbl">Median Price</div><div class="qr-stat-val">' + miFmtMoney(agg.medianPrice) + '</div></div>' +
      '<div class="qr-stat"><div class="qr-stat-lbl">Average $/Sq Ft</div><div class="qr-stat-val">$' + agg.avgPsf + '</div></div>' +
      '<div class="qr-stat"><div class="qr-stat-lbl">Average DOM</div><div class="qr-stat-val">' + agg.avgDom + ' days</div></div>' +
    '</div>' +
  '</div>';

  // YoY
  if (pyAgg) {
    var countDelta = ((pool.length - pyPool.length) / pyPool.length * 100);
    var medDelta = ((agg.medianPrice - pyAgg.medianPrice) / pyAgg.medianPrice * 100);
    var psfDelta = ((agg.avgPsf - pyAgg.avgPsf) / pyAgg.avgPsf * 100);
    var domDelta = agg.avgDom - pyAgg.avgDom;
    function arrow(delta, inverse) {
      var pos = inverse ? delta < 0 : delta > 0;
      return pos ? '↑' : (delta === 0 ? '→' : '↓');
    }
    function color(delta, inverse) {
      var pos = inverse ? delta < 0 : delta > 0;
      return pos ? 'var(--sage)' : (delta === 0 ? 'var(--muted)' : '#c62828');
    }
    html += '<div class="qr-section">' +
      '<h3>📈 Year-Over-Year Performance</h3>' +
      '<div class="qr-grid">' +
        '<div class="qr-stat"><div class="qr-stat-lbl">Sales Volume</div>' +
          '<div class="qr-stat-val" style="color:' + color(countDelta) + ';">' + arrow(countDelta) + ' ' + (countDelta >= 0 ? '+' : '') + countDelta.toFixed(1) + '%</div>' +
          '<div style="font-size:10px;color:var(--muted);">vs ' + pyPool.length + ' last year</div>' +
        '</div>' +
        '<div class="qr-stat"><div class="qr-stat-lbl">Median Price</div>' +
          '<div class="qr-stat-val" style="color:' + color(medDelta) + ';">' + arrow(medDelta) + ' ' + (medDelta >= 0 ? '+' : '') + medDelta.toFixed(1) + '%</div>' +
          '<div style="font-size:10px;color:var(--muted);">vs ' + miFmtMoney(pyAgg.medianPrice) + '</div>' +
        '</div>' +
        '<div class="qr-stat"><div class="qr-stat-lbl">Avg $/Sq Ft</div>' +
          '<div class="qr-stat-val" style="color:' + color(psfDelta) + ';">' + arrow(psfDelta) + ' ' + (psfDelta >= 0 ? '+' : '') + psfDelta.toFixed(1) + '%</div>' +
          '<div style="font-size:10px;color:var(--muted);">vs $' + pyAgg.avgPsf + '</div>' +
        '</div>' +
        '<div class="qr-stat"><div class="qr-stat-lbl">Days on Market</div>' +
          '<div class="qr-stat-val" style="color:' + color(domDelta, true) + ';">' + (domDelta > 0 ? '↑ +' : (domDelta === 0 ? '→ ' : '↓ ')) + Math.round(domDelta) + ' d</div>' +
          '<div style="font-size:10px;color:var(--muted);">vs ' + pyAgg.avgDom + ' days</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Top 5 sales
  html += '<div class="qr-section">' +
    '<h3>🏆 Top 5 Sales This Period</h3>' +
    '<table style="width:100%;font-size:12px;border-collapse:collapse;">' +
      '<thead><tr style="background:#fdf9f1;text-align:left;">' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);">Address</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);text-align:right;">Sale Price</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);text-align:center;">Sq Ft</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);text-align:center;">$/sf</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);text-align:center;">DOM</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);">Model</th>' +
      '</tr></thead><tbody>';
  top5.forEach(function(r){
    html += '<tr><td style="padding:8px;border-bottom:1px solid #f0ebe0;">' + r.addr + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #f0ebe0;text-align:right;font-weight:700;">' + miFmtMoneyExact(r.price) + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #f0ebe0;text-align:center;">' + r.sqft.toLocaleString() + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #f0ebe0;text-align:center;">$' + Math.round(r.psf) + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #f0ebe0;text-align:center;">' + r.dom + 'd</td>' +
      '<td style="padding:8px;border-bottom:1px solid #f0ebe0;font-size:11px;color:var(--muted);">' + (r.model || r.name || '—') + '</td>' +
    '</tr>';
  });
  html += '</tbody></table></div>';

  // Hottest streets
  html += '<div class="qr-section">' +
    '<h3>🔥 Most Active Streets</h3>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">' +
      '<div>' +
        '<div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">By Sales Volume</div>';
  topStreets.forEach(function(s, i){
    html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0ebe0;font-size:12px;">' +
      '<span><strong>' + (i+1) + '.</strong> ' + s.name + '</span>' +
      '<span style="font-weight:700;color:var(--orange);">' + s.n + ' sale' + (s.n===1?'':'s') + '</span>' +
    '</div>';
  });
  html += '</div>';

  html += '<div>' +
    '<div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">By Median Price</div>';
  var topByPrice = topStreets.slice().sort(function(a, b){ return b.agg.medianPrice - a.agg.medianPrice; });
  topByPrice.forEach(function(s, i){
    html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0ebe0;font-size:12px;">' +
      '<span><strong>' + (i+1) + '.</strong> ' + s.name + '</span>' +
      '<span style="font-weight:700;color:var(--green);">' + miFmtMoney(s.agg.medianPrice) + '</span>' +
    '</div>';
  });
  html += '</div>';
  html += '</div></div>';

  // Top models
  html += '<div class="qr-section">' +
    '<h3>📐 Most Popular Floor Plans This Period</h3>' +
    '<table style="width:100%;font-size:12px;border-collapse:collapse;">' +
      '<thead><tr style="background:#fdf9f1;text-align:left;">' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);">Model</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);text-align:center;">Sales</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);text-align:right;">Median Price</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);text-align:center;">Avg $/sf</th>' +
        '<th style="padding:8px;border-bottom:1px solid var(--border);text-align:center;">Avg DOM</th>' +
      '</tr></thead><tbody>';
  topModels.forEach(function(m){
    html += '<tr><td style="padding:8px;border-bottom:1px solid #f0ebe0;font-weight:700;">' + m.name + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #f0ebe0;text-align:center;">' + m.n + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #f0ebe0;text-align:right;">' + miFmtMoney(m.agg.medianPrice) + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #f0ebe0;text-align:center;">$' + m.agg.avgPsf + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #f0ebe0;text-align:center;">' + m.agg.avgDom + 'd</td>' +
    '</tr>';
  });
  html += '</tbody></table></div>';

  // Footer / contact
  html += '<div style="background:#1d3a2c;color:#fff;border-radius:10px;padding:20px 24px;margin-top:24px;">' +
    '<div style="font-family:\'Merriweather\',serif;font-size:1.1rem;font-weight:700;margin-bottom:6px;color:var(--orange);">Ready to make your move in Corte Bella?</div>' +
    '<div style="font-size:12px;line-height:1.6;opacity:.9;margin-bottom:10px;">' +
      'This report is generated from real ARMLS closed sales data — not estimates. Lona King has 20+ years of West Valley Del Webb experience and was Senior Contract Director for Del Webb 1993-2004. ' +
      'Billy Heinzman handles the data, the tech, and the marketing strategy. Together, they\'re Corte Bella\'s most data-driven team.' +
    '</div>' +
    '<div style="font-size:12px;font-weight:700;">📞 (623) 203-6271 · ✉️ lona@hometownaz.com · 🌐 hometownaz.com</div>' +
  '</div>';

  // Methodology footnote
  html += '<div style="font-size:10px;color:var(--muted);margin-top:14px;font-style:italic;text-align:center;">' +
    'Source: ARMLS closed sales data, Corte Bella (within zip 85375). Period: ' + periodLabel + '. ' +
    'All figures derived from ' + pool.length + ' verified closed transactions. ' +
    'Generated by hometownaz.com Market Intelligence platform.' +
  '</div>';

  html += '</div>';

  document.getElementById('qrResult').innerHTML = html;
}



// ════════════════════════════════════════════════════════════════
// ✅ RECENT CLOSINGS — dedicated tab view
// Reads from ACTIVE_LISTINGS.recentClosings (442 YTD 2026 records)
// Plus MONTHLY_HISTORY for the 24-month trend chart
// ════════════════════════════════════════════════════════════════
window._closingsState = {
  window: 90,  // days
  sortKey: 'closeDate',
  sortDir: 'desc',
  searchTerm: '',
  modelFilter: 'all'
};

function renderClosings() {
  var container = document.getElementById('miClosingsContent');
  if (!container) return;
  
  var data = (typeof ACTIVE_LISTINGS !== 'undefined') ? ACTIVE_LISTINGS : null;
  var closings = (data && data.recentClosings) ? data.recentClosings.slice() : [];
  
  if (!closings.length) {
    container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);">No closings data available.</div>';
    return;
  }
  
  var state = window._closingsState;
  
  // ── Time window filter ──
  function daysBetween(dStr) {
    if (!dStr) return 9999;
    var d = new Date(dStr);
    return Math.floor((new Date() - d) / 86400000);
  }
  
  var windowed = closings;
  if (state.window !== 'all') {
    // Find latest close date as the anchor (since we're working with historic 2026 YTD)
    var allDates = closings.map(function(c){ return c.closeDate; }).filter(Boolean).sort();
    var anchor = allDates.length ? new Date(allDates[allDates.length-1]) : new Date();
    var cutoff = new Date(anchor); cutoff.setDate(cutoff.getDate() - state.window);
    windowed = closings.filter(function(c){
      return c.closeDate && new Date(c.closeDate) >= cutoff;
    });
  }
  
  // ── Apply search filter ──
  if (state.searchTerm) {
    var term = state.searchTerm.toLowerCase();
    windowed = windowed.filter(function(c){
      return (c.addr || '').toLowerCase().indexOf(term) >= 0 ||
             (c.model || '').toLowerCase().indexOf(term) >= 0 ||
             (c.mls || '').toString().indexOf(term) >= 0;
    });
  }
  
  // ── Stats for the windowed set ──
  function median(arr) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function(a,b){return a-b;});
    var m = Math.floor(s.length/2);
    return s.length % 2 === 0 ? (s[m-1]+s[m])/2 : s[m];
  }
  function avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce(function(a,b){return a+b;}, 0) / arr.length;
  }
  
  var sold = windowed.map(function(c){return c.soldPrice||0;}).filter(function(p){return p>0;});
  var psf = windowed.map(function(c){return c.psf||0;}).filter(function(p){return p>0;});
  var doms = windowed.map(function(c){return c.dom||0;});
  var ratios = windowed.map(function(c){return c.soldRatio||0;}).filter(function(r){return r>0;});
  var totalVol = sold.reduce(function(a,b){return a+b;}, 0);
  var pctOverAsk = ratios.filter(function(r){return r >= 1.0;}).length / Math.max(1, ratios.length) * 100;
  var pctCutPrice = windowed.filter(function(c){
    return c.origPrice && c.listPrice && c.origPrice !== c.listPrice;
  }).length / Math.max(1, windowed.length) * 100;
  
  // ── Sort ──
  function sortFn(a, b) {
    var dir = state.sortDir === 'desc' ? -1 : 1;
    var va = a[state.sortKey];
    var vb = b[state.sortKey];
    if (va == null) va = state.sortKey === 'soldPrice' ? 0 : '';
    if (vb == null) vb = state.sortKey === 'soldPrice' ? 0 : '';
    if (typeof va === 'string') return va.localeCompare(vb) * dir;
    return (va - vb) * dir;
  }
  windowed.sort(sortFn);
  
  // ── 24-month trend from MONTHLY_HISTORY ──
  var trendHtml = '';
  if (typeof MONTHLY_HISTORY !== 'undefined') {
    var allMonths = Object.keys(MONTHLY_HISTORY).sort();
    var recentMonths = allMonths.slice(-24);
    if (recentMonths.length >= 2) {
      var prices = recentMonths.map(function(ym){ return MONTHLY_HISTORY[ym].medianPrice; });
      var counts = recentMonths.map(function(ym){ return MONTHLY_HISTORY[ym].count; });
      var maxP = Math.max.apply(null, prices);
      var minP = Math.min.apply(null, prices);
      var rangeP = (maxP - minP) || 1;
      var maxC = Math.max.apply(null, counts);
      
      var W = 720, H = 220;
      var pad = { l: 55, r: 25, t: 20, b: 50 };
      var pW = W - pad.l - pad.r;
      var pH = H - pad.t - pad.b;
      
      // Volume bars
      var barW = pW / recentMonths.length * 0.65;
      var barsHtml = recentMonths.map(function(ym, i){
        var c = counts[i];
        var x = pad.l + (i + 0.5) / recentMonths.length * pW - barW/2;
        var h = (c / maxC) * pH * 0.5;
        var y = pad.t + pH - h;
        return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + 
               '" height="' + h.toFixed(1) + '" fill="#ddd6c8" opacity="0.55"/>';
      }).join('');
      
      // Median price line
      var pts = recentMonths.map(function(ym, i){
        var x = pad.l + (i + 0.5) / recentMonths.length * pW;
        var y = pad.t + (1 - (prices[i] - minP) / rangeP) * pH * 0.85;
        return { x: x, y: y, val: prices[i], ym: ym, ct: counts[i] };
      });
      var pathD = 'M ' + pts.map(function(p){ return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' L ');
      
      var dots = pts.map(function(p, i){
        var isLast = i === pts.length - 1;
        return '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + 
               (isLast ? '5' : '3') + '" fill="' + (isLast ? '#2e7d32' : 'var(--orange)') + '"/>';
      }).join('');
      
      // X-axis labels — every 3 months
      var xLabels = pts.map(function(p, i){
        if (i % 3 !== 0 && i !== pts.length - 1) return '';
        var label = p.ym.substring(2);
        return '<text x="' + p.x.toFixed(1) + '" y="' + (pad.t + pH + 14) + 
               '" text-anchor="middle" font-size="9" fill="var(--muted)">' + label + '</text>';
      }).join('');
      
      // Y-axis price labels (3 reference points)
      var yLabels = '';
      [minP, minP + rangeP/2, maxP].forEach(function(v){
        var y = pad.t + (1 - (v - minP) / rangeP) * pH * 0.85;
        yLabels += '<line x1="' + pad.l + '" y1="' + y.toFixed(1) + '" x2="' + (W - pad.r) + 
                   '" y2="' + y.toFixed(1) + '" stroke="#e8e2d3" stroke-width="0.5" stroke-dasharray="2,3"/>';
        yLabels += '<text x="' + (pad.l - 8) + '" y="' + (y + 3).toFixed(1) + 
                   '" text-anchor="end" font-size="9" fill="var(--muted)">$' + (v/1000).toFixed(0) + 'K</text>';
      });
      
      // Latest point annotation
      var lastP = pts[pts.length - 1];
      var firstP = pts[0];
      var moMoChange = ((lastP.val - firstP.val) / firstP.val * 100).toFixed(1);
      var changeColor = moMoChange >= 0 ? '#2e7d32' : '#c8662a';
      
      trendHtml = '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:14px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;flex-wrap:wrap;gap:8px;">' +
          '<div>' +
            '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--orange);font-weight:700;">📈 24-Month Closings Trend</div>' +
            '<div style="font-size:12px;color:var(--green);font-weight:700;margin-top:2px;">Median sold price + monthly volume</div>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div style="font-size:1.3rem;font-weight:800;color:' + changeColor + ';font-family:\'Merriweather\',serif;line-height:1;">' +
              (moMoChange >= 0 ? '+' : '') + moMoChange + '%' +
            '</div>' +
            '<div style="font-size:10px;color:var(--muted);">' + firstP.ym + ' → ' + lastP.ym + '</div>' +
          '</div>' +
        '</div>' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;">' +
          yLabels + barsHtml + 
          '<path d="' + pathD + '" stroke="var(--orange)" stroke-width="2.5" fill="none"/>' +
          dots + xLabels +
          // Legend
          '<text x="' + (W - pad.r - 200) + '" y="' + (H - 8) + '" font-size="9" fill="var(--muted)">' +
            '<tspan fill="var(--orange)">━</tspan> median sold price &nbsp;' +
            '<tspan fill="#ddd6c8">▮</tspan> monthly closings' +
          '</text>' +
        '</svg>' +
      '</div>';
    }
  }
  
  // ── Window filter pills ──
  function pill(label, val) {
    var active = (state.window === val || (state.window === 'all' && val === 'all'));
    return '<button type="button" onclick="window._closingsState.window=' + 
           (val === 'all' ? "'all'" : val) + ';renderClosings();" ' +
           'style="padding:6px 12px;border-radius:18px;border:1px solid ' + 
           (active ? 'var(--orange)' : 'var(--border)') + ';' + 
           'background:' + (active ? 'var(--orange)' : '#fff') + ';' +
           'color:' + (active ? '#fff' : 'var(--green)') + ';' +
           'font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;">' +
           label + '</button>';
  }
  var pillsHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center;">' +
    '<span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-right:6px;">Window:</span>' +
    pill('Last 7d', 7) +
    pill('Last 30d', 30) +
    pill('Last 60d', 60) +
    pill('Last 90d', 90) +
    pill('YTD', 'all') +
  '</div>';
  
  // ── Stat tiles ──
  var statsHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:14px;">' +
    statTile('Closings', windowed.length.toLocaleString(), 'in window') +
    statTile('Median Sold', '$' + Math.round(median(sold)/1000) + 'K', 'avg $' + Math.round(avg(sold)/1000) + 'K') +
    statTile('Median $/sf', '$' + Math.round(median(psf)), 'avg $' + Math.round(avg(psf))) +
    statTile('Avg DOM', Math.round(avg(doms)) + 'd', 'median ' + Math.round(median(doms)) + 'd') +
    statTile('% of Ask', median(ratios) ? (median(ratios)*100).toFixed(1) + '%' : '—', 'median ratio') +
    statTile('Total Volume', '$' + (totalVol/1_000_000).toFixed(1) + 'M', windowed.length + ' sales') +
  '</div>';
  
  // ── Search + count ──
  var searchHtml = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px;">' +
    '<div>' +
      '<div style="font-size:13px;font-weight:700;color:var(--green);">All ' + windowed.length + ' closings in this window</div>' +
      '<div style="font-size:11px;color:var(--muted);">Click column headers to sort</div>' +
    '</div>' +
    '<input type="text" id="closingsSearch" placeholder="Search address, model, or MLS#..." value="' + 
      (state.searchTerm || '').replace(/"/g, '&quot;') + '" ' +
      'onkeyup="window._closingsState.searchTerm=this.value;clearTimeout(window._closingsSearchTimer);window._closingsSearchTimer=setTimeout(renderClosings,300);" ' +
      'style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px;width:240px;max-width:100%;"/>' +
  '</div>';
  
  // ── Table ──
  function th(label, key) {
    var arrow = '';
    if (state.sortKey === key) {
      arrow = state.sortDir === 'desc' ? ' ▼' : ' ▲';
    }
    return '<th onclick="window._closingsState.sortKey=\''+key+'\';' +
           'window._closingsState.sortDir=(window._closingsState.sortKey===\''+key+'\'&&window._closingsState.sortDir===\'desc\')?\'asc\':\'desc\';' +
           'renderClosings();" ' +
           'style="padding:8px 10px;border-bottom:1px solid var(--border);background:#f1f8f4;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--green);cursor:pointer;user-select:none;white-space:nowrap;">' +
           label + arrow + '</th>';
  }
  
  var rows = windowed.slice(0, 250).map(function(c){
    var ratioPct = c.soldRatio ? (c.soldRatio * 100).toFixed(1) : '—';
    var ratioColor = '#666';
    if (c.soldRatio) {
      ratioColor = c.soldRatio < 0.95 ? '#c8662a' : (c.soldRatio >= 1.0 ? '#2e7d32' : '#666');
    }
    var dateShort = c.closeDate ? c.closeDate.substring(5) : '—';
    return '<tr style="border-bottom:1px solid #f0ebe0;">' +
      '<td style="padding:8px 10px;font-weight:600;font-size:12px;">' + (c.addr||'—') + '</td>' +
      '<td style="padding:8px 10px;text-align:center;font-size:11px;color:var(--muted);">' + dateShort + '</td>' +
      '<td style="padding:8px 10px;text-align:right;font-weight:800;color:#2e7d32;font-size:12.5px;">$' + Math.round((c.soldPrice||0)/1000) + 'K</td>' +
      '<td style="padding:8px 10px;text-align:right;font-size:11px;color:var(--muted);">$' + Math.round((c.origPrice||0)/1000) + 'K</td>' +
      '<td style="padding:8px 10px;text-align:right;font-size:11.5px;color:'+ratioColor+';font-weight:700;">' + ratioPct + '%</td>' +
      '<td style="padding:8px 10px;text-align:center;font-size:11px;">' + (c.beds||'—') + '/' + (c.baths||'—') + '</td>' +
      '<td style="padding:8px 10px;text-align:right;font-size:11px;">' + (c.sqft||0).toLocaleString() + '</td>' +
      '<td style="padding:8px 10px;text-align:right;font-size:11px;color:var(--muted);">$' + Math.round(c.psf||0) + '</td>' +
      '<td style="padding:8px 10px;text-align:center;font-size:11px;">' + (c.model||'—') + '</td>' +
      '<td style="padding:8px 10px;text-align:center;font-size:11px;color:var(--muted);">' + (c.yr||'—') + '</td>' +
      '<td style="padding:8px 10px;text-align:center;font-size:11px;">' + (c.dom||0) + 'd</td>' +
    '</tr>';
  }).join('');
  
  var truncNote = windowed.length > 250 ? 
    '<div style="font-size:10.5px;color:var(--muted);font-style:italic;margin-top:8px;text-align:center;">Showing first 250 of ' + windowed.length + ' — narrow your search or shorten the window to see more</div>' : '';
  
  var tableHtml = '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:16px 18px;">' +
    searchHtml +
    '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">' +
      '<table style="width:100%;border-collapse:collapse;min-width:900px;">' +
        '<thead><tr>' +
          th('Address', 'addr') +
          th('Closed', 'closeDate') +
          th('Sold', 'soldPrice') +
          th('Orig List', 'origPrice') +
          th('% Ask', 'soldRatio') +
          th('BD/BA', 'beds') +
          th('Sqft', 'sqft') +
          th('$/sf', 'psf') +
          th('Model', 'model') +
          th('Built', 'yr') +
          th('DOM', 'dom') +
        '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '</div>' +
    truncNote +
    '<div style="font-size:10.5px;color:var(--muted);margin-top:10px;font-style:italic;line-height:1.5;">' +
      '<strong>% Ask</strong> = sold price as % of original list price. ' +
      '<span style="color:#c8662a;font-weight:700;">Orange &lt;95%</span> means seller took a meaningful haircut. ' +
      '<span style="color:#2e7d32;font-weight:700;">Green ≥100%</span> means sold at or over original ask.' +
    '</div>' +
  '</div>';
  
  // ── Final assembly ──
  container.innerHTML = pillsHtml + statsHtml + trendHtml + tableHtml;
}

function statTile(label, value, sub) {
  return '<div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:10px 12px;">' +
    '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;">' + label + '</div>' +
    '<div style="font-family:\'Merriweather\',serif;font-size:1.3rem;font-weight:800;color:var(--green);margin-top:3px;line-height:1;">' + value + '</div>' +
    '<div style="font-size:10px;color:var(--muted);margin-top:3px;">' + sub + '</div>' +
  '</div>';
}
