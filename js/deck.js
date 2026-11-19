/* Deck engine: navigation, hash routing, overview, fullscreen, enter animations and the step player.
   No-flash rule: animated content is hidden by CSS (html.js-anim) until its slide has been entered once,
   every explainer is built and seeked to its start BEFORE its slide becomes visible, and nothing that has
   been shown is ever reset by navigation. Leaving a slide completes its unfinished enter animations. */
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
  var ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

  /* ---- section transitions: one style per part ---- */
  var TR = ['rise', 'slide', 'zoom', 'flip', 'wipe', 'blur', 'drop', 'rise'];
  slides.forEach(function (s) {
    var p = s.dataset.part || '', m = /Phần (\d)/.exec(p);
    s.dataset.tr = TR[m ? +m[1] : (/Phụ lục|Kết/.test(p) ? 7 : 0)];
  });

  /* ---- split text: words stay unbroken, characters animate; <code> scrambles as one unit ---- */
  function splitText(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (tn) {
      if (tn.parentNode.closest('.grad, code')) return;
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
    root.querySelectorAll('.grad, code').forEach(function (g) { g.classList.add('ch'); g.dataset.final = g.textContent; });
    /* punctuation right after a <code> / highlighted span stays on that line (no ": ..." at a line start) */
    root.querySelectorAll('.w').forEach(function (w) {
      var prev = w.previousSibling;
      if (!prev || prev.nodeType !== 1 || prev.classList.contains('w') || !/^[:;,.!?)]/.test(w.textContent)) return;
      /* the last word unit of the previous element: itself if it is one, else its last .w / .nw / code / .grad */
      var unit = prev.matches('code, .grad, .nw') ? prev : [].slice.call(prev.querySelectorAll('.w, .nw, code, .grad')).pop();
      if (!unit) return;
      var top = unit.parentNode.closest('.nw, code, .grad'); if (top && prev.contains(top)) unit = top;
      if (unit.classList.contains('w')) { while (w.firstChild) unit.appendChild(w.firstChild); w.remove(); return; }
      var glue = document.createElement('span'); glue.className = 'w';
      unit.parentNode.insertBefore(glue, unit); glue.appendChild(unit);
      while (w.firstChild) glue.appendChild(w.firstChild); w.remove();
    });
  }
  document.querySelectorAll('.st').forEach(splitText);

  function scrambleCode(el, delay) {
    var final = el.dataset.final, pool = 'abcdefghijklmnopqrstuvwxyz-0123456789';
    var o = { p: 0 };
    var a = anime({
      targets: o, p: 1, duration: 650, delay: delay, easing: 'linear',
      update: function () {
        var k = Math.floor(o.p * final.length), s = final.slice(0, k);
        for (var i = k; i < final.length; i++) s += final[i] === ' ' ? ' ' : pool[Math.floor(Math.random() * pool.length)];
        el.textContent = s;
      }
    });
    a.sync = function () { el.textContent = final; };
    return a;
  }

  /* ---- step player ---- */
  function modeBtns(s) { return [].slice.call(s.querySelectorAll('.modes button')); }
  function activeMode(s) { var b = s.querySelector('.modes button.on'); return b ? b.dataset.mode : undefined; }
  function setMode(s, m) { modeBtns(s).forEach(function (b) { b.classList.toggle('on', b.dataset.mode === m); }); }
  function stepEnd(P, i) { return i < P.steps.length - 1 ? P.steps[i + 1].t : P.tl.duration; }
  function stepAt(P, t) { var k = 0; P.steps.forEach(function (st, i) { if (st.t <= t + 0.5) k = i; }); return k; }
  function playing(P) { return !P.tl.paused; }

  function makeCtl(s) {
    var slot = s.querySelector('[data-ctl]'), ex = s.querySelector('.ex');
    if (!slot && !ex) return null;
    var host = slot || ex;
    var ctl = document.createElement('div');
    ctl.className = 'ex-ctl';
    ctl.innerHTML = '<button class="sc-prev" aria-label="Bước trước"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<div class="sc-chips" role="tablist" aria-label="Các bước"></div>' +
      '<button class="sc-next" aria-label="Bước tiếp"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>' +
      '<button class="sc-play" aria-label="Phát / tạm dừng">' + ICON_PAUSE + '</button>';
    var cap = host.querySelector('.ex-cap');
    if (!cap && !(slot && slot.hasAttribute('data-nocap'))) { cap = document.createElement('p'); cap.className = 'ex-cap'; host.appendChild(cap); }
    if (cap) host.insertBefore(ctl, cap); else host.appendChild(ctl);
    /* replay lives in the step row; the title bar stays only where it carries mode tabs */
    var rp = host.querySelector('.replay');
    if (rp) ctl.appendChild(rp);
    var top = host.querySelector('.ex-top');
    if (top && !top.querySelector('.modes')) top.remove();
    var inf = document.createElement('p'); inf.className = 'ex-info'; inf.setAttribute('aria-live', 'polite');
    (cap || ctl).after(inf);
    return { el: ctl, chips: ctl.querySelector('.sc-chips'), play: ctl.querySelector('.sc-play'), cap: cap, info: inf };
  }

  function build(s, mode) {
    var name = s.dataset.ex;
    if (!name || !EX[name]) return null;
    if (s.P && s.P.tl) s.P.tl.pause();
    var stage = s.querySelector('.ex-stage') || s;
    var tl;
    try { tl = EX[name](stage, s, mode); } catch (err) { console.error('explainer ' + name, err); return null; }
    var svgEl = stage.querySelector(':scope > svg');
    if (svgEl && name !== 'title') { var vb = svgEl.viewBox.baseVal; svgEl.style.maxWidth = Math.round(vb.width * 1.12) + 'px'; }
    if (s._ctl === undefined) s._ctl = makeCtl(s);
    var P = s.P = { tl: tl, steps: tl.steps, idx: 0, stopAt: null, all: false, ctl: s._ctl };
    tl._hook = function () { onTick(s); };
    tl.complete = function () { P.all = false; P.stopAt = null; ui(s); };
    if (P.ctl) {
      P.ctl._key = null;
      P.ctl.chips.innerHTML = '';
      P.steps.forEach(function (st, i) {
        var b = document.createElement('button');
        b.className = 'sc-chip'; b.dataset.i = i; b.setAttribute('role', 'tab');
        b.innerHTML = '<span class="l">Bước</span>' + (i + 1);
        b.title = st.cap;
        P.ctl.chips.appendChild(b);
      });
      clearInfo(s);
    }
    ui(s);
    return P;
  }

  function onTick(s) {
    var P = s.P; if (!P) return;
    var tl = P.tl, t = tl.currentTime;
    if (P.stopAt != null && t >= P.stopAt - 0.5) {
      var st = P.stopAt; P.stopAt = null;
      tl.pause(); tl.seek(st); tl.sync(st);
    }
    if (P.all) P.idx = stepAt(P, t);
    ui(s);
  }

  function ui(s) {
    var P = s.P; if (!P || !P.ctl) return;
    var c = P.ctl, key = P.idx + '|' + playing(P) + '|' + P.steps.length;
    if (c._key === key) return;
    c._key = key;
    [].forEach.call(c.chips.children, function (b, i) {
      b.classList.toggle('on', i === P.idx);
      b.classList.toggle('done', i < P.idx);
      b.setAttribute('aria-selected', i === P.idx ? 'true' : 'false');
    });
    c.play.innerHTML = playing(P) ? ICON_PAUSE : ICON_PLAY;
    c.play.classList.toggle('on', playing(P));
    if (c.cap) c.cap.innerHTML = '<span class="sc-n">Bước ' + (P.idx + 1) + '/' + P.steps.length + '</span>' + esc(P.steps[P.idx].cap);
    var lis = s.querySelectorAll('.steps li');
    if (lis.length) [].forEach.call(lis, function (li, i) { li.classList.toggle('on', i === P.idx); li.classList.toggle('done', i < P.idx); });
  }

  function seekTo(s, t, idx) {
    var P = s.P; P.stopAt = null; P.all = false;
    P.tl.pause(); P.tl.seek(t); P.tl.sync(t);
    P.idx = idx;
    ui(s);
  }
  function startTl(P) { P.tl.completed = false; P.tl.play(); }
  function playStep(s, i) {
    var P = s.P; if (!P) return;
    i = Math.max(0, Math.min(P.steps.length - 1, i));
    if (RM.matches) { seekTo(s, stepEnd(P, i), i); return; }
    P.tl.pause(); P.tl.seek(P.steps[i].t); P.tl.sync(P.steps[i].t);
    P.idx = i; P.all = false; P.stopAt = stepEnd(P, i);
    startTl(P); ui(s);
  }
  function playAll(s, fromStart) {
    var P = s.P; if (!P) return;
    if (RM.matches) { seekTo(s, P.tl.duration, P.steps.length - 1); return; }
    if (fromStart || P.tl.currentTime >= P.tl.duration - 1) { P.tl.pause(); P.tl.seek(0); P.tl.sync(0); }
    P.stopAt = null; P.all = true; P.idx = stepAt(P, P.tl.currentTime);
    startTl(P); ui(s);
  }
  function togglePlay(s) {
    var P = s.P; if (!P) return;
    if (playing(P)) { P.tl.pause(); P.stopAt = null; P.all = false; ui(s); return; }
    playAll(s);
  }
  function switchMode(s, m, how) {
    setMode(s, m);
    var P = build(s, m);
    if (!P) return;
    if (how === 'end') seekTo(s, P.tl.duration, P.steps.length - 1);
    else if (how === 'step') playStep(s, 0);
    else playAll(s, true);
  }
  function neighbourMode(s, d) {
    var b = modeBtns(s), i = b.findIndex(function (x) { return x.classList.contains('on'); });
    return b[i + d] ? b[i + d].dataset.mode : null;
  }
  /* fragment-style stepping: returns false when the explainer has nothing left in that direction */
  function stepNext(s) {
    var P = s.P; if (!P || !P.ctl) return false;
    var t = P.tl.currentTime, end = stepEnd(P, P.idx);
    if (!playing(P) && t <= P.steps[P.idx].t + 1 && t < end - 1) { playStep(s, P.idx); return true; }
    if (t < end - 1) { seekTo(s, end, P.idx); return true; }
    if (P.idx < P.steps.length - 1) { playStep(s, P.idx + 1); return true; }
    var nm = neighbourMode(s, 1);
    if (nm) { switchMode(s, nm, 'step'); return true; }
    return false;
  }
  function stepPrev(s) {
    var P = s.P; if (!P || !P.ctl) return false;
    if (P.idx > 0) { seekTo(s, stepEnd(P, P.idx - 1), P.idx - 1); return true; }
    if (P.tl.currentTime > 1) { seekTo(s, 0, 0); return true; }
    var pm = neighbourMode(s, -1);
    if (pm) { switchMode(s, pm, 'end'); return true; }
    return false;
  }

  /* ---- click a diagram part to explain it ---- */
  function clearInfo(s) {
    var c = s._ctl; if (!c) return;
    s.querySelectorAll('.ex-stage .sel').forEach(function (e) { e.classList.remove('sel'); e._sel = false; });
    c.info.innerHTML = ''; c.info.classList.remove('on');
  }
  function showInfo(s, target) {
    var c = s._ctl; if (!c) return;
    clearInfo(s);
    target.classList.add('sel'); target._sel = true;
    c.info.innerHTML = '<b>' + esc(target.dataset.title || '') + '</b> ' + esc(target.dataset.info);
    c.info.classList.add('on');
    if (!RM.matches) anime({ targets: c.info, opacity: [0, 1], translateY: [-4, 0], duration: 260, easing: 'easeOutQuad' });
  }

  /* ---- slide enter / leave ---- */
  function finishAnims(s) {
    (s._anims || []).forEach(function (a) {
      if (!a.completed) { a.seek(a.duration); a.pause(); }
      if (a.sync) a.sync(a.duration);
    });
    s._anims = [];
    s.querySelectorAll('.term-body .typing').forEach(function (p) { p.classList.remove('typing'); });
  }
  function leave(s) {
    s._visit = (s._visit || 0) + 1;
    finishAnims(s);
    if (s.P) { s.P.tl.pause(); s.P.stopAt = null; s.P.all = false; ui(s); }
  }
  /* build everything the slide animates, at its start state, before it becomes visible */
  function prepare(s) {
    if (s._built) return;
    s._built = true;
    s._terms = [].slice.call(s.querySelectorAll('.term-body[data-auto]')).map(function (b) { return autoTerm(b); });
    if (s.dataset.ex) {
      var b = modeBtns(s);
      if (b.length) setMode(s, b[0].dataset.mode);
      build(s, activeMode(s));
    }
  }
  function enter(s, quick) {
    var visit = s._visit;
    if (s.classList.contains('seen')) return;
    var anims = s._anims = [];
    if (quick || RM.matches) {
      s._terms.forEach(function (tl) { tl.seek(tl.duration); tl.sync(tl.duration); });
      if (s.P) {
        if (s.P.ctl) seekTo(s, s.P.tl.duration, s.P.steps.length - 1);
        else { s.P.tl.seek(s.P.tl.duration); s.P.tl.sync(s.P.tl.duration); }
      }
      s.classList.add('seen');
      return;
    }
    var chars = s.querySelectorAll('.st .ch');
    if (chars.length) anims.push(anime({ targets: chars, translateY: ['0.55em', 0], opacity: [0, 1], rotate: [6, 0], duration: 760, delay: anime.stagger(14, { start: 120 }), easing: 'easeOutExpo' }));
    s.querySelectorAll('.st code').forEach(function (c, i) { anims.push(scrambleCode(c, 250 + i * 120)); });
    var rv = s.querySelectorAll('.rv');
    if (rv.length) anims.push(anime({ targets: rv, translateY: [18, 0], opacity: [0, 1], duration: 650, delay: anime.stagger(70, { start: 260 }), easing: 'easeOutCubic' }));
    s.classList.add('seen');
    s._terms.forEach(function (tl) {
      anims.push(tl);
      setTimeout(function () { if (s._visit === visit) { tl.completed = false; tl.play(); } }, 650);
    });
    if (s.P) setTimeout(function () { if (s._visit === visit && s.P.tl.currentTime === 0 && !playing(s.P)) playAll(s); }, 420);
  }

  /* ---- navigation ---- */
  function go(n, opts) {
    opts = opts || {};
    n = Math.max(0, Math.min(N - 1, n));
    if (n === cur) return;
    var prev = cur, back = prev >= 0 && n < prev;
    if (prev >= 0) { var o = slides[prev]; leave(o); o.classList.remove('on'); o.setAttribute('aria-hidden', 'true'); }
    cur = n;
    var s = slides[n];
    prepare(s);
    s.classList.toggle('from-left', back);
    s.classList.remove('on');
    void s.offsetWidth;
    s.classList.add('on');
    s.removeAttribute('aria-hidden');
    s.scrollTop = 0;
    if (!opts.noHash) history.replaceState(null, '', '#/' + (n + 1));
    hudNum.innerHTML = pad(n + 1) + ' <span>/ ' + pad(N) + '</span>';
    hudPart.textContent = s.dataset.part || '';
    bar.style.width = ((n + 1) / N * 100) + '%';
    document.title = (s.dataset.title || '') + (n ? ' - ' + baseTitle : ' - Workshop');
    enter(s, back || opts.jump);
  }
  function next() { if (!stepNext(slides[cur])) go(cur + 1); }
  function prev() { if (!stepPrev(slides[cur])) go(cur - 1); }
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
    b.addEventListener('click', function () { closeOv(); go(i, { jump: true }); });
    ovGrid.appendChild(b);
  });
  function openOv() {
    ov.classList.add('open');
    var cards = ovGrid.children;
    [].forEach.call(cards, function (c, i) { c.classList.toggle('cur', i === cur); });
    if (cards[cur]) cards[cur].scrollIntoView({ block: 'center' });
    if (!RM.matches) anime({ targets: cards, opacity: [0, 1], scale: [0.9, 1], duration: 450, delay: anime.stagger(22, { grid: [6, Math.ceil(N / 6)], from: Math.max(0, cur) }), easing: 'easeOutCubic' });
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
    if (s.P) { playAll(s, true); return; }
    (s._terms || []).forEach(function (tl) { tl.pause(); tl.seek(0); tl.sync(0); tl.completed = false; tl.play(); });
  }

  /* ---- input ---- */
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (ov.classList.contains('open')) {
      if (k === 'Escape' || k === 'o' || k === 'O') { closeOv(); e.preventDefault(); }
      return;
    }
    if (e.target.closest && e.target.closest('button') && (k === ' ' || k === 'Enter')) return;
    if (k === 'ArrowRight' || k === 'ArrowDown' || (k === ' ' && !e.shiftKey)) { next(); e.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || (k === ' ' && e.shiftKey)) { prev(); e.preventDefault(); }
    else if (k === 'PageDown') { go(cur + 1); e.preventDefault(); }
    else if (k === 'PageUp') { go(cur - 1); e.preventDefault(); }
    else if (k === 'Home') { go(0, { jump: true }); e.preventDefault(); }
    else if (k === 'End') { go(N - 1, { jump: true }); e.preventDefault(); }
    else if (k === 'o' || k === 'O') { toggleOv(); e.preventDefault(); }
    else if (k === 'f' || k === 'F') { toggleFs(); e.preventDefault(); }
    else if (k === 'r' || k === 'R') { replay(); e.preventDefault(); }
    else if (k === 'p' || k === 'P') { togglePlay(slides[cur]); e.preventDefault(); }
    else if (k === 'Escape') { clearInfo(slides[cur]); }
  });
  document.getElementById('btnNext').addEventListener('click', function () { go(cur + 1); });
  document.getElementById('btnPrev').addEventListener('click', function () { go(cur - 1); });
  document.getElementById('btnOv').addEventListener('click', toggleOv);
  document.getElementById('btnFs').addEventListener('click', toggleFs);
  window.addEventListener('hashchange', function () { go(fromHash(), { noHash: true, jump: true }); });

  /* clicks on diagrams never select text */
  deck.addEventListener('mousedown', function (e) { if (e.detail > 1 && e.target.closest('.ex, .term, .anat, .steps')) e.preventDefault(); });
  deck.addEventListener('click', function (e) {
    var t = e.target, s = slides[cur];
    var mb = t.closest('.modes button');
    if (mb) { switchMode(s, mb.dataset.mode, 'all'); return; }
    if (t.closest('.replay')) { replay(); return; }
    var chip = t.closest('.sc-chip');
    if (chip) { playStep(s, +chip.dataset.i); return; }
    if (t.closest('.sc-prev')) { stepPrev(s); return; }
    if (t.closest('.sc-next')) { stepNext(s); return; }
    if (t.closest('.sc-play')) { togglePlay(s); return; }
    var li = t.closest('.steps li');
    if (li && s.P && s.P.ctl) { playStep(s, [].indexOf.call(li.parentNode.children, li)); return; }
    var part = t.closest('.ex-stage [data-info]');
    if (part) { showInfo(s, part); return; }
    if (t.closest('.ex-stage')) { clearInfo(s); return; }
    var g = t.closest('[data-go]');
    if (g) { var target = document.getElementById(g.dataset.go); if (target) go(slides.indexOf(target), { jump: true }); return; }
    if (!FINE.matches) return;
    if (t.closest('button, a, input, .term, .ex, .anat, table, code, kbd, .steps, .ex-ctl')) return;
    if (String(window.getSelection())) return;
    next();
  });

  var tx = null, ty = 0;
  deck.addEventListener('touchstart', function (e) { if (e.touches.length !== 1) { tx = null; return; } tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  deck.addEventListener('touchend', function (e) {
    if (tx == null) return;
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    tx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { if (dx < 0) go(cur + 1); else go(cur - 1); }
  }, { passive: true });

  /* ---- fixed 1600x900 stage: scale to fit the window, letterboxed (CSS turns it on from 981px wide) ---- */
  var STAGE = window.matchMedia('(min-width: 981px)'), K = 1;
  function fit() {
    K = STAGE.matches ? Math.min(window.innerWidth / 1600, window.innerHeight / 900) : 1;
    document.documentElement.style.setProperty('--k', K);
  }
  fit();
  window.addEventListener('resize', fit);
  function kOf(el) { return el.closest('.deck') ? K : 1; } /* screen px -> canvas px inside the scaled stage */

  /* cursor spotlight on background and glow cards; magnetic pull on navigation targets */
  var spot = document.querySelector('.bg .spot');
  var magnet = null;
  document.addEventListener('pointermove', function (e) {
    spot.style.setProperty('--sx', e.clientX + 'px');
    spot.style.setProperty('--sy', e.clientY + 'px');
    var tgt = e.target && e.target.closest ? e.target : null;
    var c = tgt && tgt.closest('.card, .ov-card');
    if (c) {
      var r = c.getBoundingClientRect(), kc = kOf(c);
      c.style.setProperty('--mx', (e.clientX - r.left) / kc + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) / kc + 'px');
    }
    if (RM.matches || !FINE.matches) return;
    var m = tgt && tgt.closest('.magnet');
    if (magnet && magnet !== m) { magnet.style.transform = ''; magnet = null; }
    if (m) {
      var rr = m.getBoundingClientRect(), k = (m.classList.contains('card') ? 0.05 : 0.22) / kOf(m);
      m.style.transform = 'translate(' + ((e.clientX - rr.left - rr.width / 2) * k).toFixed(1) + 'px,' + ((e.clientY - rr.top - rr.height / 2) * k).toFixed(1) + 'px)';
      magnet = m;
    }
  }, { passive: true });
  document.querySelectorAll('.toc .card, .hud-btns button').forEach(function (b) { b.classList.add('magnet'); });

  /* explainers that depend on layout (4 areas) rebuild when the breakpoint flips, keeping the step */
  var rz;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      var s = slides[cur], st = s && s.querySelector('.ex-stage');
      if (!st || st._layout === undefined || st._layout === (st.clientWidth < 520) || !s.P) return;
      var idx = s.P.idx;
      var P = build(s, activeMode(s));
      if (P) seekTo(s, stepEnd(P, idx), idx);
    }, 250);
  });

  /* debug/test hook: lets the verification script drive the step player */
  window.DECK = { go: go, cur: function () { return cur; }, slide: function () { return slides[cur]; }, next: next, prev: prev };

  go(fromHash(), { noHash: !location.hash });
})();
