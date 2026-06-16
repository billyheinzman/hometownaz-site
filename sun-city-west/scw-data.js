// scw-data.js — COMPATIBILITY WRAPPER
// The data has been split into data-listings.js and data-market.js for performance.
// This wrapper loads both from the SITE ROOT (one level up from /sun-city-west/),
// so pages in the /sun-city-west/ folder that include <script src="scw-data.js"></script>
// continue to work unchanged.
(function(){
  function loadScript(src, cb){
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    if (cb) s.onload = cb;
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading'){
    document.write('<script src="../data-listings.js"></scr' + 'ipt>');
    document.write('<script src="../data-market.js"></scr' + 'ipt>');
  } else {
    loadScript('../data-listings.js', function(){ loadScript('../data-market.js'); });
  }
})();
