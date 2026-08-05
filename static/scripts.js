/* ============================================================
   Site behaviour
   ------------------------------------------------------------
   1. Header shrink + pin
   2. Folder-tab navigation (show/hide sections)
   3. Button glint
   4. Share panel
   5. Referral logging
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;

  function px(name, fallback) {
    var v = parseFloat(getComputedStyle(root).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }

  /* ---------------------------------------------------------
     1. Header shrink
     The header is sticky, so as it collapses its bottom edge
     rises. #headerSpacer grows by the same amount (capped at
     the end of the shrink) so the content below keeps a
     constant gap from that live edge instead of jumping up.
     Once collapsed the spacer freezes and the page scrolls
     under a normal fixed-height bar.
     --------------------------------------------------------- */
  var SHRINK_RANGE = px('--shrink-range', 160);

  function onScroll() {
    var t = window.scrollY || window.pageYOffset || 0;
    var p = Math.min(1, Math.max(0, t / SHRINK_RANGE));
    root.style.setProperty('--p', p.toFixed(4));
    root.style.setProperty('--shrink-px', Math.min(t, SHRINK_RANGE).toFixed(1) + 'px');
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { onScroll(); ticking = false; });
  }, { passive: true });

  window.addEventListener('resize', function () {
    SHRINK_RANGE = px('--shrink-range', 160);
    onScroll();
  });

  onScroll();

  /* ---------------------------------------------------------
     2. Tab navigation
     Tabs between the old and new selection flip forward in
     sequence, like fingers walking across a folder organiser,
     before the destination tab pulls forward for good.
     --------------------------------------------------------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.section'));
  var STEP = 65;      // ms between each in-between tab
  var HOLD = 130;     // ms each in-between tab stays forward
  var SETTLE = 140;   // ms before the destination tab locks in
  var animating = false;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function showSection(name) {
    sections.forEach(function (s) {
      var match = s.getAttribute('data-section') === name;
      s.hidden = !match;
      s.classList.toggle('is-active', match);
    });
    tabs.forEach(function (t) {
      var match = t.getAttribute('data-tab') === name;
      t.classList.toggle('is-active', match);
      if (match) { t.setAttribute('aria-current', 'page'); }
      else { t.removeAttribute('aria-current'); }
    });
  }

  function goTo(name) {
    var targetIdx = tabs.findIndex(function (t) { return t.getAttribute('data-tab') === name; });
    var oldIdx = tabs.findIndex(function (t) { return t.classList.contains('is-active'); });
    if (targetIdx < 0 || targetIdx === oldIdx || animating) return;

    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });

    if (reduceMotion) { showSection(name); return; }

    animating = true;
    tabs[oldIdx].classList.remove('is-active');

    var dir = targetIdx > oldIdx ? 1 : -1;
    var delay = 0;

    for (var i = oldIdx + dir; i !== targetIdx; i += dir) {
      (function (tab, d) {
        setTimeout(function () {
          tab.classList.add('is-flipping');
          setTimeout(function () { tab.classList.remove('is-flipping'); }, HOLD);
        }, d);
      })(tabs[i], delay);
      delay += STEP;
    }

    setTimeout(function () {
      showSection(name);
      animating = false;
    }, delay + SETTLE);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () { goTo(tab.getAttribute('data-tab')); });
  });

  document.querySelectorAll('[data-jump]').forEach(function (el) {
    el.addEventListener('click', function () { goTo(el.getAttribute('data-jump')); });
  });

  /* ---------------------------------------------------------
     3. Button glint
     --------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.btn') : null;
    if (!btn) return;
    btn.classList.remove('is-glinting');
    void btn.offsetWidth;               // restart the animation
    btn.classList.add('is-glinting');
  });

  document.addEventListener('animationend', function (e) {
    if (e.animationName === 'glint') {
      e.target.parentElement.classList.remove('is-glinting');
    }
  });

  /* ---------------------------------------------------------
     4. Share panel
     --------------------------------------------------------- */
  var shareButton = document.getElementById('shareButton');
  var shareOverlay = document.getElementById('shareOverlay');
  var shareClose = document.getElementById('shareClose');

  function setShare(open) {
    if (!shareOverlay || !shareButton) return;
    shareOverlay.hidden = !open;
    shareButton.setAttribute('aria-expanded', String(open));
    if (open && shareClose) { shareClose.focus(); }
    else { shareButton.focus(); }
  }

  if (shareButton) { shareButton.addEventListener('click', function () { setShare(true); }); }
  if (shareClose) { shareClose.addEventListener('click', function () { setShare(false); }); }
  if (shareOverlay) {
    shareOverlay.addEventListener('click', function (e) {
      if (e.target === shareOverlay) setShare(false);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && shareOverlay && !shareOverlay.hidden) setShare(false);
  });

  /* ---------------------------------------------------------
     5. Referral logging
     Every visit is logged, not just ?ref= ones, so organic
     traffic is captured too:
       ref present            → labelled source  (linkedin, acme-corp)
       ref absent + referrer  → organic source   (google.com)
       ref absent + no referrer → direct/typed
     Set COLLECT_ENDPOINT to the Cloudflare Worker URL to switch
     this on; until then it stays quiet.
     --------------------------------------------------------- */
  var COLLECT_ENDPOINT = '';   // e.g. 'https://ref-logger.your-name.workers.dev/collect'

  function logVisit() {
    if (!COLLECT_ENDPOINT) return;
    if (location.hostname === 'localhost' || location.protocol === 'file:') return;

    var ref = new URLSearchParams(location.search).get('ref');
    var referrer = document.referrer || '';
    var source, kind;

    if (ref) {
      source = ref.trim().toLowerCase();
      kind = 'labelled';
    } else if (referrer) {
      try { source = new URL(referrer).hostname; } catch (err) { source = referrer; }
      kind = 'organic';
    } else {
      source = 'direct/typed';
      kind = 'direct';
    }

    var payload = {
      source: source,
      kind: kind,
      referrer: referrer,
      path: location.pathname + location.search,
      screen: window.innerWidth + 'x' + window.innerHeight,
      ts: new Date().toISOString()
    };

    fetch(COLLECT_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },  // keeps the request simple, no preflight
      body: JSON.stringify(payload)
    }).catch(function () { /* logging must never break the page */ });
  }

  logVisit();
})();
