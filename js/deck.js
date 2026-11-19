/* Deck engine: navigation, hash routing, overview, fullscreen, enter animations. */
(function () {
  'use strict';
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  var FINE = window.matchMedia('(pointer: fine)');
  var EX = window.GX.EX, autoTerm = window.GX.autoTerm;
  var deck = document.getElementById('deck');
  var slides = [].slice.call(deck.querySelectorAll('.slide'));
  var N = slides.length, cur = -1;
  var bar = document.querySelector('.progress i');
  var hudNum = document.getElementById('hudNum'), hudPart = document.getElementById('hudPart');
  var ov = document.getElementById('ov'), ovGrid = document.getElementById('ovGrid');
  var baseTitle = 'Git cho Team Dev';

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---- split text: words stay unbroken, characters animate ---- */
  function splitText(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (tn) {
      if (tn.parentNode.closest('.grad')) return;
      var parts = tn.nodeValue.normalize('NFC').split(/(\s+)/), frag = document.createDocumentFragment();
      parts.forEach(function (p) {
        if (!p) return;
        if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
        var w = document.createElement('span'); w.className = 'w';
        Array.from(p).forEach(function (ch) { var c = document.createElement('span'); c.className = 'ch'; c.textContent = ch; w.appendChild(c); });
        frag.appendChild(w);
      });
      tn.parentNode.replaceChild(frag, tn);
    });
    root.querySelectorAll('.grad').forEach(function (g) { g.classList.add('ch'); g.style.display = 'inline-block'; });
  }
  document.querySelectorAll('.st').forEach(splitText);

  /* ---- explainer playback ---- */
  function modesOf(s) { return s.querySelector('.modes'); }
  function activeMode(s) { var b = s.querySelector('.modes button.on'); return b ? b.dataset.mode : undefined; }
  function setMode(s, m) { s.querySelectorAll('.modes button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === m); }); }

  function stopSlide(s) {
    s._gen = (s._gen || 0) + 1;
    s._visit = (s._visit || 0) + 1;
    (s._anims || []).forEach(function (a) { a.pause(); });
    s._anims = [];
    if (s._tl) s._tl.pause();
    clearTimeout(s._cycleTimer);
  }
  // A single seek never fires child 'begin' callbacks (they need currentTime > 0 from a prior tick), so seek twice.
  function jumpEnd(tl, root) {
    tl.seek(tl.duration); tl.seek(tl.duration);
    if (root) root.querySelectorAll('.typing').forEach(function (p) { p.classList.remove('typing'); });
  }
  function run(tl, root) { if (RM.matches) jumpEnd(tl, root); else tl.play(); return tl; }

  function playEx(s, mode) {
    var name = s.dataset.ex;
    if (!name || !EX[name]) return;
    if (s._tl) s._tl.pause();
    clearTimeout(s._cycleTimer);
    var gen = s._gen = (s._gen || 0) + 1;
    var stage = s.querySelector('.ex-stage');
    var tl;
    try { tl = EX[name](stage, s, mode); } catch (err) { console.error('explainer ' + name, err); return; }
    var cap = s.querySelector('.ex-cap');
    if (cap) cap.innerHTML = '';
    s._tl = tl;
    run(tl, s);
    if (!s._cycle || RM.matches) return;
    tl.finished.then(function () {
      if (s._gen !== gen || slides[cur] !== s || !s._cycle) return;
      var btns = [].slice.call(s.querySelectorAll('.modes button'));
      var i = btns.findIndex(function (b) { return b.classList.contains('on'); });
      if (i < 0 || i >= btns.length - 1) { s._cycle = false; return; }
      s._cycleTimer = setTimeout(function () {
        if (s._gen !== gen || slides[cur] !== s || !s._cycle) return;
        var m = btns[i + 1].dataset.mode;
        setMode(s, m);
        playEx(s, m);
      }, 2200);
    });
  }

  function enter(s) {
    var visit = s._visit;
    var anims = s._anims = [];
    var chars = s.querySelectorAll('.st .ch');
    if (chars.length && !RM.matches) {
      anims.push(anime({ targets: chars, translateY: ['0.55em', 0], opacity: [0, 1], rotate: [6, 0], duration: 760, delay: anime.stagger(14, { start: 120 }), easing: 'easeOutExpo' }));
    }
    var rv = s.querySelectorAll('.rv');
    if (rv.length && !RM.matches) {
      anims.push(anime({ targets: rv, translateY: [18, 0], opacity: [0, 1], duration: 650, delay: anime.stagger(70, { start: 260 }), easing: 'easeOutCubic' }));
    }
    s.querySelectorAll('.term-body[data-auto]').forEach(function (b) {
      var tl = autoTerm(b);
      if (RM.matches) { jumpEnd(tl, b); return; }
      setTimeout(function () { if (s._visit === visit) { tl.play(); } }, 650);
      anims.push(tl);
    });
    if (s.dataset.ex) {
      var m = modesOf(s);
      s._cycle = !!(m && m.hasAttribute('data-cycle'));
      if (m) setMode(s, m.querySelector('button').dataset.mode);
      if (RM.matches) playEx(s, activeMode(s));
      else s._cycleTimer = setTimeout(function () { if (s._visit === visit) playEx(s, activeMode(s)); }, 380);
    }
  }

  /* ---- navigation ---- */
  function go(n, opts) {
    n = Math.max(0, Math.min(N - 1, n));
    if (n === cur) return;
    var prev = cur, back = n < prev;
    if (prev >= 0) { var o = slides[prev]; stopSlide(o); o.classList.remove('on'); o.setAttribute('aria-hidden', 'true'); }
    cur = n;
    var s = slides[n];
    s.classList.toggle('from-left', back);
    s.classList.remove('on');
    void s.offsetWidth;
    s.classList.add('on');
    s.removeAttribute('aria-hidden');
    s.scrollTop = 0;
    stopSlide(s);
    if (!opts || !opts.noHash) history.replaceState(null, '', '#/' + (n + 1));
    hudNum.innerHTML = pad(n + 1) + ' <span>/ ' + pad(N) + '</span>';
    hudPart.textContent = s.dataset.part || '';
    bar.style.width = ((n + 1) / N * 100) + '%';
    document.title = (s.dataset.title || '') + (n ? ' - ' + baseTitle : ' - Workshop');
    enter(s);
  }
  function next() { go(cur + 1); }
  function prev() { go(cur - 1); }
  function fromHash() {
    var m = /^#\/(\d+)/.exec(location.hash);
    return m ? parseInt(m[1], 10) - 1 : 0;
  }
  slides.forEach(function (s) { s.setAttribute('aria-hidden', 'true'); });

  /* ---- overview ---- */
  slides.forEach(function (s, i) {
    var b = document.createElement('button');
    b.className = 'ov-card';
    b.innerHTML = '<span class="n">' + pad(i + 1) + '</span><span class="t"></span><span class="pp"></span>';
    b.querySelector('.t').textContent = s.dataset.title || '';
    b.querySelector('.pp').textContent = s.dataset.part || '';
    b.addEventListener('click', function () { closeOv(); go(i); });
    ovGrid.appendChild(b);
  });
  function openOv() {
    ov.classList.add('open');
    var cards = ovGrid.children;
    [].forEach.call(cards, function (c, i) { c.classList.toggle('cur', i === cur); });
    if (cards[cur]) cards[cur].scrollIntoView({ block: 'center' });
    if (!RM.matches) anime({ targets: cards, opacity: [0, 1], translateY: [16, 0], scale: [0.96, 1], duration: 450, delay: anime.stagger(18), easing: 'easeOutCubic' });
    if (cards[cur]) cards[cur].focus({ preventScroll: true });
  }
  function closeOv() { ov.classList.remove('open'); }
  function toggleOv() { if (ov.classList.contains('open')) closeOv(); else openOv(); }
  document.getElementById('ovClose').addEventListener('click', closeOv);

  function toggleFs() {
    var d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) req.call(el);
  }
  function replay() {
    var s = slides[cur];
    if (s.dataset.ex) { s._cycle = false; playEx(s, activeMode(s)); return; }
    stopSlide(s); enter(s);
  }

  /* ---- input ---- */
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (ov.classList.contains('open')) {
      if (k === 'Escape' || k === 'o' || k === 'O') { closeOv(); e.preventDefault(); }
      return;
    }
    if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) { next(); e.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'PageUp' || (k === ' ' && e.shiftKey)) { prev(); e.preventDefault(); }
    else if (k === 'Home') { go(0); e.preventDefault(); }
    else if (k === 'End') { go(N - 1); e.preventDefault(); }
    else if (k === 'o' || k === 'O') { toggleOv(); e.preventDefault(); }
    else if (k === 'f' || k === 'F') { toggleFs(); e.preventDefault(); }
    else if (k === 'r' || k === 'R') { replay(); e.preventDefault(); }
  });
  document.getElementById('btnNext').addEventListener('click', next);
  document.getElementById('btnPrev').addEventListener('click', prev);
  document.getElementById('btnOv').addEventListener('click', toggleOv);
  document.getElementById('btnFs').addEventListener('click', toggleFs);
  window.addEventListener('hashchange', function () { go(fromHash(), { noHash: true }); });

  deck.addEventListener('click', function (e) {
    var t = e.target;
    var mb = t.closest('.modes button');
    if (mb) { var s = slides[cur]; s._cycle = false; setMode(s, mb.dataset.mode); playEx(s, mb.dataset.mode); return; }
    if (t.closest('.replay')) { replay(); return; }
    var g = t.closest('[data-go]');
    if (g) { var target = document.getElementById(g.dataset.go); if (target) go(slides.indexOf(target)); return; }
    if (!FINE.matches) return;
    if (t.closest('button, a, input, .term, .ex, table, code, kbd')) return;
    if (String(window.getSelection())) return;
    next();
  });

  var tx = null, ty = 0;
  deck.addEventListener('touchstart', function (e) { if (e.touches.length !== 1) { tx = null; return; } tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  deck.addEventListener('touchend', function (e) {
    if (tx == null) return;
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    tx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { if (dx < 0) next(); else prev(); }
  }, { passive: true });

  /* cursor spotlight on background and glow cards */
  var spot = document.querySelector('.bg .spot');
  document.addEventListener('pointermove', function (e) {
    spot.style.setProperty('--sx', e.clientX + 'px');
    spot.style.setProperty('--sy', e.clientY + 'px');
    var c = e.target.closest && e.target.closest('.card, .ov-card');
    if (!c) return;
    var r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /* explainers that depend on layout (4 areas) rebuild when the breakpoint flips */
  var rz;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      var s = slides[cur], st = s && s.querySelector('.ex-stage');
      if (st && st._layout !== undefined && st._layout !== (st.clientWidth < 520)) playEx(s, activeMode(s));
    }, 250);
  });

  go(fromHash(), { noHash: !location.hash });
})();
