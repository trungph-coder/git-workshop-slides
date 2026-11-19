/* Animated explainers. Each EX[name](stage, slide, mode) rebuilds its SVG from scratch and
   returns a paused anime.js timeline, so replay is just "build again and play". */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  function el(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function svg(stage, w, h) {
    stage.innerHTML = '';
    var s = el('svg', { viewBox: '0 0 ' + w + ' ' + h, class: 'gsvg', 'aria-hidden': 'true' }, stage);
    s.id2 = 'g' + (++uid);
    var defs = el('defs', {}, s);
    var m = el('marker', { id: s.id2 + 'ah', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0 0L10 5L0 10z', fill: '#77839b' }, m);
    s.B = el('g', {}, s); s.E = el('g', {}, s); s.N = el('g', {}, s); s.P = el('g', {}, s); s.T = el('g', {}, s);
    return s;
  }
  function hide(g, show) { if (!show) g.style.opacity = 0; return g; }
  function fb(g) { g.style.transformBox = 'fill-box'; g.style.transformOrigin = 'center'; return g; }
  function node(s, x, y, label, cls, o) {
    o = o || {};
    var g = el('g', { class: 'c ' + (cls || '') }, s.N);
    el('circle', { cx: x, cy: y, r: o.r || 17 }, g);
    g.lab = el('text', { x: x, y: y, class: 'cl' }, g, label);
    if (o.sub) g.sub = el('text', { x: x, y: y + 38, class: 'cs' }, g, o.sub);
    g.X = x; g.Y = y;
    return hide(g, o.show);
  }
  function cd(a, b) {
    var mx = (a.X + b.X) / 2;
    return 'M' + a.X + ' ' + a.Y + ' C' + mx + ' ' + a.Y + ' ' + mx + ' ' + b.Y + ' ' + b.X + ' ' + b.Y;
  }
  function edge(s, a, b, cls, o) {
    o = o || {};
    var p = el('path', { class: 'e ' + (cls || ''), d: o.d || cd(a, b) }, s.E);
    if (!o.show) {
      var L = p.getTotalLength() || 1;
      p.style.strokeDasharray = L + ' ' + L;
      p.style.strokeDashoffset = L;
    }
    return p;
  }
  function ptr(s, text, x, y, cls, o) {
    o = o || {};
    var g = fb(el('g', { class: 'p ' + (cls || '') }, s.P));
    var w = text.length * 8 + 20;
    g.rect = el('rect', { x: x - w / 2, y: y - 13, width: w, height: 26, rx: 8 }, g);
    g.txt = el('text', { x: x, y: y + 1 }, g, text);
    g.X = x; g.Y = y;
    return hide(g, o.show);
  }
  function chip(s, x, y, w, label, cls, o) {
    o = o || {};
    var g = fb(el('g', { class: 'chip ' + (cls || '') }, o.parent || s.N));
    el('rect', { x: x - w / 2, y: y - 15, width: w, height: 30, rx: 7 }, g);
    g.txt = el('text', { x: x, y: y + 1 }, g, label);
    g.X = x; g.Y = y;
    return hide(g, o.show);
  }
  function txt(s, x, y, str, cls, o) {
    o = o || {};
    var t = fb(el('text', { x: x, y: y, class: cls || 'lbl' }, o.parent || s.T, str));
    return hide(t, o.show);
  }
  function place(g, x, y) { anime.set(g, { translateX: x - g.X, translateY: y - g.Y }); }

  /* animation param factories */
  function pop(t, o) { return Object.assign({ targets: t, opacity: [0, 1], scale: [0.2, 1], duration: 520, easing: 'easeOutBack' }, o || {}); }
  function fade(t, v, o) { return Object.assign({ targets: t, opacity: v, duration: 400, easing: 'linear' }, o || {}); }
  function draw(p, o) { return Object.assign({ targets: p, strokeDashoffset: 0, duration: 420, easing: 'easeInOutSine' }, o || {}); }
  function mv(g, x, y, o) { return Object.assign({ targets: g, translateX: x - g.X, translateY: y - g.Y, duration: 700, easing: 'easeInOutCubic' }, o || {}); }
  function pulse(t, o) { return Object.assign({ targets: t, scale: [1, 1.3, 1], duration: 700, easing: 'easeInOutSine' }, o || {}); }
  function shake(t, o) { return Object.assign({ targets: t, translateX: [0, -8, 8, -6, 6, 0], duration: 500, easing: 'linear' }, o || {}); }
  function wobble(t, o) { return Object.assign({ targets: t, rotate: [0, -10, 10, -7, 7, 0], duration: 500, easing: 'linear' }, o || {}); }

  /* terminal */
  function term(slide, lines) {
    var b = slide.querySelector('.term-body');
    if (!b) return [];
    b.innerHTML = '';
    return lines.map(function (l) {
      if (typeof l === 'string') l = { cmd: l };
      var p = document.createElement('p');
      if (l.cmd != null) { p.className = 'cmd'; p.dataset.text = l.cmd; }
      else { p.className = l.cls || 'out'; p.textContent = l.out; p.style.opacity = 0; }
      b.appendChild(p);
      return p;
    });
  }

  /* sequencer: absolute-time cursor over one anime timeline */
  function Q(slide) {
    var tl = anime.timeline({ autoplay: false, easing: 'easeOutCubic' });
    var cap = slide && slide.querySelector('.ex-cap');
    if (cap) cap.innerHTML = '';
    var t = 0;
    function dur(p) {
      var d = typeof p.duration === 'number' ? p.duration : 500;
      var dl = typeof p.delay === 'number' ? p.delay : 0;
      return d + dl;
    }
    var q = {
      tl: tl,
      get t() { return t; },
      set t(v) { t = v; },
      add: function (p, gap) { tl.add(p, t + (gap || 0)); return q; },
      go: function (p, gap) { gap = gap || 0; tl.add(p, t + gap); t += gap + dur(p); return q; },
      wait: function (ms) { t += ms; return q; },
      say: function (html, gap) {
        if (!cap) return q;
        tl.add({ targets: cap, opacity: [0, 1], translateY: [6, 0], duration: 380, easing: 'easeOutQuad', begin: function () { cap.innerHTML = html; } }, t + (gap || 0));
        return q;
      },
      call: function (fn, gap) {
        var o = { v: 0 };
        tl.add({ targets: o, v: 1, duration: 1, begin: fn }, t + (gap || 0));
        return q;
      },
      cls: function (els, add, rm, gap) {
        var arr = (els && els.length !== undefined && !els.tagName) ? Array.prototype.slice.call(els) : [els];
        return q.call(function () {
          arr.forEach(function (e) {
            if (rm) rm.split(' ').forEach(function (c) { e.classList.remove(c); });
            if (add) add.split(' ').forEach(function (c) { e.classList.add(c); });
          });
        }, gap);
      },
      text: function (e, str, gap) { return q.call(function () { e.textContent = str; }, gap); },
      type: function (p, gap, speed) {
        if (!p) return q;
        gap = gap || 0;
        var b = p.parentNode;
        if (!p.classList.contains('cmd')) {
          tl.add({ targets: p, opacity: [0, 1], translateX: [-6, 0], duration: 260, easing: 'easeOutQuad', begin: function () { b.scrollTop = b.scrollHeight; } }, t + gap);
          t += gap + 200;
          return q;
        }
        var s = p.dataset.text, o = { n: 0 };
        var d = Math.min(1700, Math.max(260, s.length * (speed || 24)));
        tl.add({
          targets: o, n: s.length, round: 1, duration: d, easing: 'linear',
          begin: function () { p.classList.add('typing'); },
          update: function () { p.textContent = s.slice(0, o.n); b.scrollTop = b.scrollHeight; },
          complete: function () { p.textContent = s; p.classList.remove('typing'); }
        }, t + gap);
        t += gap + d + 180;
        return q;
      }
    };
    return q;
  }
  function ghost(q, g, v, gap) { q.cls(g, 'ghost', null, gap); q.add(fade(g, v == null ? 0.32 : v, { duration: 500 }), gap); }
  function scramble(q, textEl, final, gap, d) {
    var o = { p: 0 }, hex = '0123456789abcdef';
    d = d || 900;
    q.go({
      targets: o, p: 1, duration: d, easing: 'easeOutQuad',
      update: function () {
        var k = Math.floor(o.p * final.length), s = final.slice(0, k);
        for (var i = k; i < final.length; i++) s += hex[Math.floor(Math.random() * 16)];
        textEl.textContent = s;
      },
      complete: function () { textEl.textContent = final; }
    }, gap);
  }
  function panelTitle(s, y0, str) { txt(s, 16, y0 + 24, str, 'lbl b', { show: true }); }

  var EX = {};

  /* ---------- decorative title graph ---------- */
  EX.title = function (stage, slide) {
    var s = svg(stage, 820, 520), q = Q(slide);
    var xs = [], main = [];
    for (var i = 0; i < 9; i++) xs.push(40 + i * 92);
    xs.forEach(function (x, i) { main.push(node(s, x, 300, '', i === 6 || i === 8 ? 'merge' : '', { r: 13 })); });
    var up = [node(s, xs[2] + 70, 170, '', 'feat', { r: 13 }), node(s, xs[3] + 70, 170, '', 'feat', { r: 13 }), node(s, xs[4] + 70, 170, '', 'feat', { r: 13 })];
    var dn = [node(s, xs[4] + 50, 430, '', 'remote', { r: 13 }), node(s, xs[5] + 80, 430, '', 'remote', { r: 13 })];
    var em = [];
    for (i = 0; i < 8; i++) em.push(edge(s, main[i], main[i + 1], 'main'));
    var eu = [edge(s, main[2], up[0], 'feat'), edge(s, up[0], up[1], 'feat'), edge(s, up[1], up[2], 'feat'), edge(s, up[2], main[6], 'feat')];
    var ed = [edge(s, main[4], dn[0], 'remote'), edge(s, dn[0], dn[1], 'remote'), edge(s, dn[1], main[8], 'remote')];
    var hp = ptr(s, 'HEAD -> main', xs[8], 252, 'head');
    q.add(pop(main[0], { duration: 400 }));
    for (i = 0; i < 8; i++) {
      q.go(draw(em[i], { duration: 260 }), i ? 0 : 200);
      q.add(pop(main[i + 1], { duration: 380 }));
      if (i === 2) { q.add(draw(eu[0], { duration: 300 })); q.add(pop(up[0]), 300); q.add(draw(eu[1], { duration: 260 }), 420); q.add(pop(up[1]), 680); q.add(draw(eu[2], { duration: 260 }), 760); q.add(pop(up[2]), 1020); }
      if (i === 4) { q.add(draw(ed[0], { duration: 300 })); q.add(pop(dn[0]), 300); q.add(draw(ed[1], { duration: 300 }), 420); q.add(pop(dn[1]), 720); }
      if (i === 5) q.add(draw(eu[3], { duration: 360 }));
      if (i === 7) q.add(draw(ed[2], { duration: 360 }));
    }
    q.go(pop(hp), 100);
    return q.tl;
  };

  /* ---------- 2005 timeline ---------- */
  EX.history = function (stage, slide) {
    var q = Q(slide), narrow = window.innerWidth <= 620;
    var bar = slide.querySelector('.timeline .bar');
    q.add(narrow ? { targets: bar, scaleY: [0, 1], duration: 1400, easing: 'easeInOutQuart' } : { targets: bar, scaleX: [0, 1], duration: 1400, easing: 'easeInOutQuart' });
    q.add({ targets: slide.querySelectorAll('.timeline .ms'), opacity: [0, 1], translateY: [24, 0], duration: 600, delay: anime.stagger(380) }, 150);
    q.add({ targets: slide.querySelectorAll('.crit'), opacity: [0, 1], translateY: [20, 0], scale: [0.94, 1], duration: 600, delay: anime.stagger(140), easing: 'easeOutBack' }, 1500);
    return q.tl;
  };

  /* ---------- snapshot vs diff ---------- */
  EX.snapshot = function (stage, slide) {
    var s = svg(stage, 640, 370), q = Q(slide);
    txt(s, 16, 26, 'SVN, CVS: lưu file gốc + bản vá', 'lbl b', { show: true });
    var v1 = chip(s, 60, 64, 88, 'v1 gốc', 'staged');
    var ds = [chip(s, 170, 64, 76, '+Δ2', 'mod'), chip(s, 262, 64, 76, '+Δ3', 'mod'), chip(s, 354, 64, 76, '+Δ4', 'mod')];
    var f1 = txt(s, 16, 122, 'Xem v4 = v1 + Δ2 + Δ3 + Δ4  (cộng dồn)', 'lbl a');
    el('line', { x1: 10, y1: 148, x2: 630, y2: 148, stroke: 'rgba(255,255,255,.08)' }, s.B);
    txt(s, 16, 176, 'Git: mỗi commit là một ảnh chụp', 'lbl b', { show: true });
    var cols = [40, 190, 340, 490], rows = [232, 272, 312], files = ['A', 'B', 'C'];
    var plan = [[1, 1, 1], [1, 0, 0], [0, 1, 0], [1, 0, 1]];
    var ver = [0, 0, 0], colEls = [], hl;
    hl = el('rect', { x: cols[3] - 8, y: 186, width: 136, height: 146, rx: 12, fill: 'rgba(74,222,128,.06)', stroke: 'rgba(74,222,128,.5)', 'stroke-width': 1.5 }, s.B);
    hl.style.opacity = 0;
    cols.forEach(function (cx, ci) {
      var items = [txt(s, cx + 60, 204, 'C' + (ci + 1), 'lbl b mid')];
      rows.forEach(function (ry, fi) {
        if (plan[ci][fi]) {
          ver[fi]++;
          items.push(chip(s, cx + 60, ry, 104, files[fi] + ver[fi], 'staged'));
        } else {
          var c = chip(s, cx + 60, ry, 104, '→ ' + files[fi] + ver[fi], 'link');
          items.push(c);
          var a = el('path', { d: 'M' + (cx + 8) + ' ' + ry + ' L' + (cx - 22) + ' ' + ry, class: 'arrow', 'marker-end': 'url(#' + s.id2 + 'ah)' }, s.E);
          var L = 30; a.style.strokeDasharray = L; a.style.strokeDashoffset = L;
          items.push(a);
        }
      });
      colEls.push(items);
    });
    q.say('SVN lưu file gốc rồi chồng từng bản vá lên.');
    q.go(pop(v1)).wait(100);
    ds.forEach(function (d) { q.go(pop(d, { duration: 380 })); });
    q.go(fade(f1, 1, { duration: 500 })).wait(500);
    q.add(pulse(ds, { duration: 600 }));
    q.say('Muốn xem v4, SVN phải cộng dồn mọi bản vá từ v1. Phiên bản càng xa càng chậm.').wait(1500);
    q.say('Git chụp lại toàn bộ file ở mỗi commit.');
    colEls.forEach(function (items, ci) {
      items.forEach(function (it, k) {
        if (it.tagName === 'path') q.add(draw(it, { duration: 300 }), k * 90);
        else q.add(it.classList.contains('chip') ? pop(it, { duration: 420 }) : fade(it, 1), k * 90);
      });
      q.wait(650);
      if (ci === 1) q.say('File <b>đổi</b> thì lưu bản mới (xanh). File <b>không đổi</b> chỉ là liên kết tới bản cũ (nét đứt).');
    });
    q.wait(500);
    q.go(fade(hl, 1, { duration: 400 }));
    q.say('Checkout C4: lấy thẳng ảnh chụp C4, không cộng dồn gì cả. Nhanh và tiết kiệm.');
    return q.tl;
  };

  /* ---------- commit hash ---------- */
  EX.hash = function (stage, slide) {
    var s = svg(stage, 640, 330), q = Q(slide);
    var labels = ['Cây thư mục (tree)', 'Tác giả + email', 'Thời gian', 'Message: feat: login', 'Hash cha: 7d1e9a0'];
    var ys = [50, 105, 160, 215, 270];
    var chips = labels.map(function (l, i) { return chip(s, 125, ys[i], 230, l, ''); });
    var arrows = ys.map(function (y) {
      var p = el('path', { class: 'arrow', d: 'M242 ' + y + ' C275 ' + y + ' 275 160 312 160', 'marker-end': 'url(#' + s.id2 + 'ah)' }, s.E);
      var L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; return p;
    });
    var box = fb(el('g', {}, s.N));
    el('rect', { x: 318, y: 118, width: 110, height: 84, rx: 14, fill: '#1a1210', stroke: '#f05033', 'stroke-width': 2 }, box);
    el('text', { x: 373, y: 156, class: 'cl', 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: '#ffd2c7' }, box, 'SHA-1');
    el('text', { x: 373, y: 178, 'text-anchor': 'middle', 'font-size': 11, fill: '#8d99ae' }, box, 'hàm băm');
    box.style.opacity = 0;
    var out = el('path', { class: 'arrow', d: 'M430 160 L470 160', 'marker-end': 'url(#' + s.id2 + 'ah)' }, s.E);
    out.style.strokeDasharray = 40; out.style.strokeDashoffset = 40;
    var h1 = chip(s, 550, 160, 130, '0000000', 'staged');
    var h2 = chip(s, 550, 240, 130, '0000000', 'mod');
    var oldLbl = txt(s, 550, 110, 'commit cũ vẫn còn', 'lbl mid');
    var newLbl = txt(s, 550, 284, 'commit MỚI', 'lbl a mid');
    q.say('Hash của commit được tính từ 5 thành phần.');
    chips.forEach(function (c, i) { q.add(pop(c, { duration: 420 }), i * 120); });
    q.wait(800);
    arrows.forEach(function (a, i) { q.add(draw(a, { duration: 380 }), i * 60); });
    q.wait(500).go(pop(box)).add(pulse(box, { duration: 500 })).go(draw(out, { duration: 250 }), 300);
    q.add(pop(h1, { duration: 300 }));
    scramble(q, h1.txt, 'a1b2c3d', 0, 1000);
    q.say('Hash = SHA(tree + tác giả + thời gian + message + hash cha) = <b>a1b2c3d</b>.').wait(1300);
    q.add({ targets: chips[3], translateX: [0, 10, 0], duration: 500, easing: 'easeInOutSine' });
    q.text(chips[3].txt, 'Message: feat: login page', 200);
    q.cls(chips[3], 'mod', null, 200);
    q.say('"Sửa" message: chỉ thêm một chữ "page"...').wait(700);
    arrows.forEach(function (a) { q.add({ targets: a, strokeDashoffset: [a.style.strokeDasharray.split(' ')[0], 0], duration: 380 }); });
    q.wait(420).add(pulse(box, { duration: 500 }));
    q.go(fade(oldLbl, 1), 200);
    q.go(pop(h2, { duration: 300 }));
    scramble(q, h2.txt, '9f3e7c1', 0, 1000);
    q.go(fade(newLbl, 1));
    q.say('Ra hash khác hẳn: <b>9f3e7c1</b>. Đó là một commit mới; a1b2c3d vẫn nằm nguyên, không ai sửa được nó.');
    return q.tl;
  };

  /* ---------- the 4 areas ---------- */
  EX.areas = function (stage, slide) {
    var vert = stage.clientWidth < 520;
    stage._layout = vert;
    var W = vert ? 360 : 760, H = vert ? 610 : 312;
    var s = svg(stage, W, H), q = Q(slide);
    var names = ['Working Dir', 'Staging', 'Local Repo', 'Remote'];
    var subs = ['thư mục code', '.git/index', '.git', 'GitHub / GitLab'];
    var B = [];
    for (var i = 0; i < 4; i++) {
      var b = vert ? { x: 10, y: 10 + i * 150, w: 340, h: 118 } : { x: 10 + i * 190, y: 40, w: 170, h: 230 };
      B.push(b);
      el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 14, class: 'box' }, s.B);
      if (vert) { txt(s, b.x + 14, b.y + 26, names[i], 'lbl b', { show: true }); txt(s, b.x + 326, b.y + 26, subs[i], 'lbl', { show: true }).setAttribute('text-anchor', 'end'); }
      else { txt(s, b.x + 85, b.y + 28, names[i], 'lbl b mid', { show: true }); txt(s, b.x + 85, b.y + 48, subs[i], 'lbl mid', { show: true }).style.fontSize = '12.5px'; }
    }
    function slot(bi, k) { var b = B[bi]; return vert ? { x: b.x + 60 + k * 110, y: b.y + 76 } : { x: b.x + 85, y: b.y + 92 + k * 44 }; }
    var cw = vert ? 100 : 140;
    function arrowG(d, lx, ly, label, anchor) {
      var g = el('g', { class: 'ag' }, s.E);
      el('path', { d: d, class: 'arrow', 'marker-end': 'url(#' + s.id2 + 'ah)' }, g);
      var t = el('text', { x: lx, y: ly, class: 'alabel' }, g, label);
      if (anchor) t.style.textAnchor = anchor;
      return g;
    }
    var A = {};
    if (vert) {
      A.add = arrowG('M110 130 L110 158', 122, 149, 'git add', 'start');
      A.commit = arrowG('M110 280 L110 308', 122, 299, 'git commit', 'start');
      A.push = arrowG('M110 430 L110 458', 122, 449, 'git push', 'start');
      A.restore = arrowG('M260 158 L260 130', 248, 149, 'restore', 'end');
      A.pull = arrowG('M260 458 L260 430', 248, 449, 'fetch / pull', 'end');
    } else {
      A.add = arrowG('M150 26 L222 26', 186, 16, 'git add');
      A.commit = arrowG('M340 26 L412 26', 376, 16, 'git commit');
      A.push = arrowG('M530 26 L602 26', 566, 16, 'git push');
      A.restore = arrowG('M222 288 L150 288', 186, 306, 'restore');
      A.pull = arrowG('M602 288 L530 288', 566, 306, 'fetch / pull');
    }
    function on(g) { q.cls(s.querySelectorAll('.ag'), null, 'on'); q.cls(g, 'on'); }
    function cnode(bi, k, label, cls, show) { var p = slot(bi, k); return node(s, p.x, p.y, label, cls, { r: 15, show: show }); }
    cnode(2, 0, 'c1', '', true); cnode(3, 0, 'c1', '', true);
    var files = ['login.js', 'api.js', 'README.md'].map(function (f, k) {
      var c = chip(s, 0, 0, cw, f, 'mod'); c.X = 0; c.Y = 0; var p = slot(0, k); place(c, p.x, p.y); return c;
    });
    var c2 = cnode(2, 1, 'c2', 'new');
    var r2 = cnode(3, 1, 'c2', 'new'); var l1 = slot(2, 1); place(r2, l1.x, l1.y);
    var r3 = cnode(3, 2, 'c3', 'remote');
    var l3 = cnode(2, 2, 'c3', 'remote'); var rp = slot(3, 2); place(l3, rp.x, rp.y);
    var upd = chip(s, 0, 0, cw, 'code c3', 'staged'); upd.X = 0; upd.Y = 0; var w0 = slot(0, 0); place(upd, w0.x, w0.y);
    var L = term(slide, ['git add login.js api.js', 'git commit -m "feat: login"', 'git push origin main', { out: '# đồng đội vừa push c3', cls: 'cm' }, 'git pull', { out: 'Fast-forward  api.js | 4 ++--', cls: 'ok' }]);

    q.say('Sửa 3 file trong Working Directory. Lúc này Git chưa bảo vệ chúng.');
    files.forEach(function (f, k) { q.add(pop(f), k * 150); });
    q.wait(1300);
    q.type(L[0]); on(A.add);
    q.say('<code>git add</code>: chỉ đưa 2 file liên quan vào Staging. README.md vẫn ở lại.');
    [0, 1].forEach(function (k) { var p = slot(1, k); q.cls(files[k], 'staged', 'mod', k * 140); q.add(mv(files[k], p.x, p.y, { duration: 800 }), k * 140); });
    q.wait(1500);
    q.type(L[1]); on(A.commit);
    q.say('<code>git commit</code>: đóng gói Staging thành snapshot <b>c2</b>, lưu vĩnh viễn trong Local Repo.');
    var cp = slot(2, 1);
    [0, 1].forEach(function (k) { q.add(mv(files[k], cp.x, cp.y, { duration: 700, easing: 'easeInCubic' }), k * 80); q.add({ targets: files[k], scale: 0.2, opacity: 0, duration: 300, easing: 'easeInQuad' }, 500 + k * 80); });
    q.wait(750).go(pop(c2)).wait(700);
    q.type(L[2]); on(A.push);
    q.say('<code>git push</code>: gửi c2 lên Remote để cả team cùng thấy.');
    q.add(fade(r2, 1, { duration: 150 })).go(mv(r2, r2.X, r2.Y, { duration: 900 })).wait(600);
    q.type(L[3]);
    q.say('Đồng đội push <b>c3</b> lên Remote.');
    q.go(pop(r3)).wait(800);
    q.type(L[4]); on(A.pull);
    q.say('<code>git pull</code> = fetch + merge: c3 về Local Repo, rồi Working Directory được cập nhật.');
    q.add(fade(l3, 1, { duration: 150 })).go(mv(l3, l3.X, l3.Y, { duration: 900 }));
    q.go(pop(upd)).type(L[5]);
    q.cls(s.querySelectorAll('.ag'), null, 'on', 600);
    return q.tl;
  };

  /* ---------- HEAD ---------- */
  EX.head = function (stage, slide) {
    var s = svg(stage, 640, 250), q = Q(slide);
    var c = [node(s, 80, 170, 'c1'), node(s, 200, 170, 'c2'), node(s, 320, 170, 'c3'), node(s, 440, 170, 'c4')];
    var e = [edge(s, c[0], c[1], 'main'), edge(s, c[1], c[2], 'main'), edge(s, c[2], c[3], 'main')];
    var ring = fb(el('g', {}, s.B)); el('circle', { cx: 320, cy: 170, r: 27, fill: 'none', stroke: '#f05033', 'stroke-width': 2, 'stroke-dasharray': '4 5' }, ring); ring.X = 320; ring.Y = 170; ring.style.opacity = 0;
    var main = ptr(s, 'main', 320, 124, ''), head = ptr(s, 'HEAD', 320, 92, 'head'), feat = ptr(s, 'feat', 200, 124, 'feat');
    var L = term(slide, ['git commit -m "feat: thêm nút đăng nhập"', { out: '[main 4c2d9e1] feat: thêm nút đăng nhập', cls: 'out' }, 'git switch feat', { out: "Switched to branch 'feat'", cls: 'ok' }]);
    q.add(pop(c[0], { duration: 380 })).add(draw(e[0]), 150).add(pop(c[1], { duration: 380 }), 400).add(draw(e[1]), 550).add(pop(c[2], { duration: 380 }), 800);
    q.wait(1100).add(pop(main)).add(pop(feat), 100).go(pop(head), 250).add(fade(ring, 1));
    q.say('<b>HEAD -> main -> c3</b>: bạn đang đứng trên nhánh main.').wait(1200);
    q.type(L[0]);
    q.go(draw(e[2])).add(pop(c[3]));
    q.add(mv(main, 440, 124)).add(mv(head, 440, 92)).go(mv(ring, 440, 170)).type(L[1]);
    q.say('Commit mới: main tiến lên c4, HEAD đi theo vì đang gắn vào main.').wait(1300);
    q.type(L[2]);
    q.add(mv(head, 200, 92, { duration: 900 })).go(mv(ring, 200, 170, { duration: 900 })).type(L[3]);
    q.say('<code>git switch feat</code>: HEAD chuyển sang tên nhánh feat. Working Directory đổi thành code của c2.');
    return q.tl;
  };

  /* ---------- detached HEAD ---------- */
  EX.detached = function (stage, slide, mode) {
    var fix = mode === 'fix';
    var s = svg(stage, 640, 300), q = Q(slide);
    var c = [node(s, 70, 200, 'c1'), node(s, 180, 200, 'c2', '', { sub: 'a1b2c3d' }), node(s, 290, 200, 'c3'), node(s, 400, 200, 'c4')];
    var e = [edge(s, c[0], c[1], 'main', { show: true }), edge(s, c[1], c[2], 'main', { show: true }), edge(s, c[2], c[3], 'main', { show: true })];
    var x1 = node(s, 290, 100, 'x1', fix ? 'feat' : 'warn'), x2 = node(s, 400, 100, 'x2', fix ? 'feat' : 'warn');
    var ex1 = edge(s, c[1], x1, fix ? 'feat' : ''), ex2 = edge(s, x1, x2, fix ? 'feat' : '');
    var main = ptr(s, 'main', 400, 246, ''), head = ptr(s, 'HEAD', 400, 276, 'head');
    var feat = ptr(s, 'feat/thu-nghiem', 180, 154, 'feat');
    var orphan = txt(s, 440, 105, 'commit mồ côi', 'lbl r');
    var lines = ['git checkout a1b2c3d', { out: "You are in 'detached HEAD' state.", cls: 'warn' }];
    if (fix) lines.push('git switch -c feat/thu-nghiem', { out: "Switched to a new branch 'feat/thu-nghiem'", cls: 'ok' });
    lines.push('git commit -m "thử nghiệm 1"', 'git commit -m "thử nghiệm 2"', 'git switch main');
    lines.push(fix ? { out: "Switched to branch 'main'", cls: 'ok' } : { out: 'Warning: you are leaving 2 commits behind, not connected to any of your branches', cls: 'err' });
    var L = term(slide, lines), li = 0;
    c.forEach(function (n, i) { q.add(pop(n, { duration: 380 }), i * 90); });
    q.add(pop(main), 400).go(pop(head), 500);
    q.say('Bình thường: HEAD -> main -> c4.').wait(800);
    q.type(L[li++]);
    q.cls(head, 'danger', 'head').go(mv(head, 180, 154, { duration: 900 })).type(L[li++]);
    q.say('<b>Detached HEAD</b>: HEAD trỏ thẳng vào commit a1b2c3d, không qua nhánh nào.').wait(1100);
    if (fix) {
      q.type(L[li++]);
      q.cls(head, 'head', 'danger').add(mv(head, 180, 124, { duration: 500 })).go(pop(feat)).type(L[li++]);
      q.say('Tạo nhánh ngay: HEAD gắn lại vào <b>feat/thu-nghiem</b>.').wait(900);
    }
    q.type(L[li++]);
    q.go(draw(ex1)).add(pop(x1));
    if (fix) q.add(mv(feat, 290, 54)).go(mv(head, 290, 24)); else q.go(mv(head, 290, 54));
    q.type(L[li++]);
    q.go(draw(ex2)).add(pop(x2));
    if (fix) q.add(mv(feat, 400, 54)).go(mv(head, 400, 24)); else q.go(mv(head, 400, 54));
    q.say(fix ? 'Commit mới nằm trên nhánh feat/thu-nghiem, an toàn.' : 'Commit mới chỉ có HEAD giữ. Không nhánh nào trỏ tới chúng.').wait(1000);
    q.type(L[li++]);
    q.cls(head, 'head', 'danger').go(mv(head, 400, 276, { duration: 1000 })).type(L[li++]);
    if (fix) {
      q.cls([x1, x2], 'new', 'feat').add(pulse([x1, x2]));
      q.say('Về main thoải mái: feat/thu-nghiem vẫn giữ x1, x2. Không mất gì.');
    } else {
      q.cls([x1, x2], 'junk', 'warn');
      q.add(fade([ex1, ex2], 0.35)).go(fade(orphan, 1));
      q.say('Quay về main: x1, x2 thành <b>commit mồ côi</b>. Garbage Collector sẽ xóa chúng vĩnh viễn.').wait(1400);
      q.go(fade([x1, x2, ex1, ex2, orphan], 0, { duration: 1400 }));
    }
    return q.tl;
  };

  /* ---------- fast-forward ---------- */
  EX.ff = function (stage, slide) {
    var s = svg(stage, 640, 260), q = Q(slide);
    var c1 = node(s, 70, 180, 'c1'), c2 = node(s, 180, 180, 'c2'), c3 = node(s, 300, 90, 'c3', 'feat'), c4 = node(s, 420, 90, 'c4', 'feat');
    var glow = el('path', { class: 'e glow', d: 'M180 180 L420 180' }, s.B); glow.style.strokeDasharray = 240; glow.style.strokeDashoffset = 240;
    var e12 = edge(s, c1, c2, 'main'), e23 = edge(s, c2, c3, 'feat'), e34 = edge(s, c3, c4, 'feat');
    var main = ptr(s, 'main', 180, 134), head = ptr(s, 'HEAD', 180, 104, 'head'), feat = ptr(s, 'feat/login', 420, 136, 'feat');
    var L = term(slide, ['git switch main', 'git merge feat/login', { out: 'Updating 3e1f2a0..9c8d7b6', cls: 'out' }, { out: 'Fast-forward', cls: 'ok' }]);
    q.add(pop(c1, { duration: 380 })).add(draw(e12), 150).add(pop(c2, { duration: 380 }), 380).add(pop(main), 600).go(pop(head), 700);
    q.say('Tạo nhánh <b>feat/login</b> từ main tại c2.').wait(300);
    q.go(draw(e23)).add(pop(c3)).go(draw(e34), 250).add(pop(c4)).go(pop(feat), 200);
    q.say('Làm việc trên feat/login. Trong lúc đó main <b>không có commit mới</b>.').wait(1200);
    q.type(L[0]).type(L[1]);
    var straight = 'M180 180 C240 180 240 180 300 180';
    q.add({ targets: [c3, c4], translateY: 90, duration: 800, easing: 'easeInOutCubic' });
    q.call(function () { e23.style.strokeDasharray = 'none'; });
    q.add({ targets: e23, d: straight, duration: 800, easing: 'easeInOutCubic' });
    q.add({ targets: e34, translateY: 90, duration: 800, easing: 'easeInOutCubic' });
    q.go(mv(feat, 420, 226, { duration: 800 }));
    q.add(draw(glow, { duration: 700 })).add(mv(main, 420, 134, { duration: 900, easing: 'easeOutExpo' })).go(mv(head, 420, 104, { duration: 900, easing: 'easeOutExpo' }));
    q.type(L[2]).type(L[3]);
    q.say('Fast-forward: main chỉ <b>trượt lên</b> c4. Không có commit mới, lịch sử là một đường thẳng.');
    return q.tl;
  };

  /* ---------- merge vs --no-ff ---------- */
  EX.noff = function (stage, slide) {
    var s = svg(stage, 640, 430), q = Q(slide);
    function panel(y0, noff) {
      el('rect', { x: 2, y: y0 + 2, width: 636, height: 206, rx: 14, class: 'panel-bg' }, s.B);
      panelTitle(s, y0, noff ? 'git merge --no-ff feat/login' : 'git merge feat/login (mặc định)');
      var my = y0 + 150, ly = y0 + 82;
      var c1 = node(s, 60, my, 'c1', '', { show: true }), c2 = node(s, 160, my, 'c2', '', { show: true });
      var f1 = node(s, 270, ly, 'f1', 'feat', { show: true }), f2 = node(s, 380, ly, 'f2', 'feat', { show: true });
      edge(s, c1, c2, 'main', { show: true });
      var e2 = edge(s, c2, f1, 'feat', { show: true }), e3 = edge(s, f1, f2, 'feat', { show: true });
      var main = ptr(s, 'main', 160, my + 40, '', { show: true });
      var feat = ptr(s, 'feat/login', 380, ly - 40, 'feat', { show: true });
      return { y0: y0, my: my, ly: ly, c2: c2, f1: f1, f2: f2, e2: e2, e3: e3, main: main, feat: feat };
    }
    var A = panel(0, false), B = panel(222, true);
    var M = node(s, 500, B.my, 'M', 'merge');
    var eM1 = edge(s, B.c2, M, 'main', { d: 'M160 ' + B.my + ' C330 ' + B.my + ' 330 ' + B.my + ' 500 ' + B.my });
    var eM2 = edge(s, B.f2, M, 'feat');
    var ra = txt(s, 450, A.my + 5, '1 đường thẳng', 'lbl g'), rb = txt(s, 530, B.my + 5, '2 cha', 'lbl o');
    var bubble = txt(s, 330, B.my - 24, 'merge bubble', 'lbl o mid');
    q.say('Cùng một tình huống: main không có commit mới từ lúc feat/login tách ra.').wait(1400);
    var t0 = q.t;
    q.add({ targets: [A.f1, A.f2], translateY: 68, duration: 800, easing: 'easeInOutCubic' });
    q.call(function () { A.e2.style.strokeDasharray = 'none'; });
    q.add({ targets: A.e2, d: 'M160 ' + A.my + ' C215 ' + A.my + ' 215 ' + A.my + ' 270 ' + A.my, duration: 800, easing: 'easeInOutCubic' });
    q.add({ targets: A.e3, translateY: 68, duration: 800, easing: 'easeInOutCubic' });
    q.add(mv(A.feat, 380, A.my - 40, { duration: 800 }));
    q.add(mv(A.main, 380, A.my + 40, { duration: 900, easing: 'easeOutExpo' }), 800);
    q.add(fade(ra, 1), 1600);
    q.t = t0;
    q.add(draw(eM1, { duration: 600 }), 300).add(draw(eM2, { duration: 600 }), 300).add(pop(M), 800);
    q.add(mv(B.main, 500, B.my + 40, { duration: 900, easing: 'easeOutExpo' }), 1100);
    q.add(fade([rb, bubble], 1), 1700);
    q.wait(2100);
    q.say('Trên: Fast-forward, mất dấu nhánh. Dưới: <code>--no-ff</code> ép tạo Merge Commit M có 2 cha, gom cả tính năng vào một "bong bóng".').wait(1400);
    q.add(pulse(M, { duration: 800 }));
    return q.tl;
  };

  /* ---------- merge vs rebase ---------- */
  EX.mr = function (stage, slide) {
    var s = svg(stage, 640, 440), q = Q(slide);
    function panel(y0, title, rebase) {
      el('rect', { x: 2, y: y0 + 2, width: 636, height: 212, rx: 14, class: 'panel-bg' }, s.B);
      panelTitle(s, y0, title);
      var my = y0 + 156, ly = y0 + 84;
      var c1 = node(s, 60, my, 'c1', '', { show: true }), c2 = node(s, 160, my, 'c2', '', { show: true }), m3 = node(s, 270, my, 'm3', '', { show: true });
      var f1 = node(s, 270, ly, 'f1', 'feat', { show: true, sub: rebase ? 'a1f' : null }), f2 = node(s, 380, ly, 'f2', 'feat', { show: true, sub: rebase ? 'b2e' : null });
      edge(s, c1, c2, 'main', { show: true }); edge(s, c2, m3, 'main', { show: true });
      var ef1 = edge(s, c2, f1, 'feat', { show: true }), ef2 = edge(s, f1, f2, 'feat', { show: true });
      var main = ptr(s, 'main', 270, my + 40, '', { show: true }), feat = ptr(s, 'feat', 380, ly - 40, 'feat', { show: true });
      return { my: my, ly: ly, m3: m3, f1: f1, f2: f2, ef1: ef1, ef2: ef2, main: main, feat: feat };
    }
    var A = panel(0, 'git merge feat  (đứng ở main)', false), B = panel(224, 'git rebase main  (đứng ở feat)', true);
    var M = node(s, 490, A.my, 'M', 'merge');
    var eA1 = edge(s, A.m3, M, 'main'), eA2 = edge(s, A.f2, M, 'feat');
    var n1 = node(s, 380, B.my, "f1'", 'new', { sub: 'c9e' }), n2 = node(s, 490, B.my, "f2'", 'new', { sub: 'd4a' });
    place(n1, 270, B.ly); place(n2, 380, B.ly);
    var eB1 = edge(s, B.m3, n1, 'new', { d: 'M270 ' + B.my + ' C325 ' + B.my + ' 325 ' + B.my + ' 380 ' + B.my }), eB2 = edge(s, n1, n2, 'new');
    q.say('Main có m3, feat có f1, f2. Hai cách tích hợp.').wait(1300);
    var t0 = q.t;
    q.add(draw(eA1, { duration: 500 }), 200).add(draw(eA2, { duration: 500 }), 200).add(pop(M), 650);
    q.add(mv(A.main, 490, A.my + 40, { duration: 800 }), 900);
    q.t = t0;
    ghost(q, [B.f1, B.f2], 0.3, 200);
    q.add(fade([B.ef1, B.ef2], 0.2), 200);
    q.add(fade([n1, n2], 1, { duration: 200 }), 200);
    q.add(mv(n1, 380, B.my, { duration: 900, easing: 'easeInOutBack' }), 400);
    q.add(mv(n2, 490, B.my, { duration: 900, easing: 'easeInOutBack' }), 650);
    q.add(draw(eB1, { duration: 300 }), 1300).add(draw(eB2, { duration: 300 }), 1500);
    q.add(mv(B.feat, 490, B.my - 42, { duration: 700 }), 1500);
    q.wait(2400);
    q.say('Trên: merge tạo M, giữ nguyên hash. Dưới: rebase "phát lại" f1, f2 lên đỉnh main thành f1\', f2\' với <b>hash mới</b> (a1f -> c9e).').wait(1200);
    q.add(pulse([n1, n2], { duration: 700 }));
    return q.tl;
  };

  /* ---------- pull vs pull --rebase ---------- */
  EX.pull = function (stage, slide) {
    var s = svg(stage, 640, 440), q = Q(slide);
    function panel(y0, title) {
      el('rect', { x: 2, y: y0 + 2, width: 636, height: 212, rx: 14, class: 'panel-bg' }, s.B);
      panelTitle(s, y0, title);
      var my = y0 + 156, ly = y0 + 86;
      var c1 = node(s, 60, my, 'c1', '', { show: true }), c2 = node(s, 160, my, 'c2', '', { show: true }), L1 = node(s, 270, my, 'L1', 'feat', { show: true });
      edge(s, c1, c2, 'main', { show: true }); var eL = edge(s, c2, L1, 'feat', { show: true });
      var R1 = node(s, 270, ly, 'R1', 'remote'); place(R1, 270, ly - 60);
      var eR = edge(s, c2, R1, 'remote');
      var dev = ptr(s, 'develop', 270, my + 40, 'feat', { show: true });
      var org = ptr(s, 'origin/develop', 270, ly - 40, 'remote');
      return { my: my, ly: ly, c2: c2, L1: L1, eL: eL, R1: R1, eR: eR, dev: dev, org: org };
    }
    var A = panel(0, 'git pull  (fetch + merge)'), B = panel(224, 'git pull --rebase  (fetch + rebase)');
    var M = node(s, 390, A.my, 'M', 'junk');
    var eM1 = edge(s, A.L1, M, 'feat'), eM2 = edge(s, A.R1, M, 'remote');
    var junk = txt(s, 416, A.my + 5, "Merge branch 'develop' of...", 'lbl r');
    junk.style.fontSize = '13px';
    var Ln = node(s, 390, B.ly, "L1'", 'new'); place(Ln, 270, B.my);
    var eLn = edge(s, B.R1, Ln, 'new');
    q.say('Bạn có L1 chưa push. Đồng đội đã push R1 lên remote.').wait(1300);
    q.say('Bước fetch (giống nhau): tải R1 về.');
    [A, B].forEach(function (P) {
      q.add({ targets: P.R1, opacity: [0, 1], translateY: 0, duration: 700, easing: 'easeOutBounce' });
      q.add(draw(P.eR), 500).add(pop(P.org), 700);
    });
    q.wait(1700);
    q.say('Rồi khác nhau: merge sinh thêm một commit rác, rebase đặt L1 lên trên R1.');
    var t0 = q.t;
    q.add(draw(eM1), 200).add(draw(eM2), 200).add(pop(M), 600).add(mv(A.dev, 390, A.my + 40), 800).add(fade(junk, 1), 1100);
    q.t = t0;
    ghost(q, B.L1, 0.25, 200); q.add(fade(B.eL, 0.2), 200);
    q.add(fade(Ln, 1, { duration: 200 }), 200).add(mv(Ln, 390, B.ly, { duration: 900, easing: 'easeInOutBack' }), 350);
    q.add(draw(eLn, { duration: 300 }), 1150).add(mv(B.dev, 390, B.ly - 40, { duration: 800 }), 1100);
    q.wait(2100);
    q.say('Trên: lịch sử thêm "Merge branch..." vô nghĩa. Dưới: thẳng tắp, L1\' nằm trên cùng.');
    q.add(pulse(M, { duration: 600 }));
    return q.tl;
  };

  /* ---------- reset soft / mixed / hard ---------- */
  EX.reset = function (stage, slide, mode) {
    mode = mode || 'soft';
    var s = svg(stage, 640, 350), q = Q(slide);
    var c1 = node(s, 140, 72, 'c1', '', { show: true }), c2 = node(s, 260, 72, 'c2', '', { show: true }), c3 = node(s, 380, 72, 'c3', '', { show: true });
    edge(s, c1, c2, 'main', { show: true }); var e3 = edge(s, c2, c3, 'main', { show: true });
    var hp = ptr(s, 'HEAD -> main', 380, 28, 'head', { show: true });
    var BX = [20, 225, 430], titles = ['Lịch sử commit', 'Staging (index)', 'Working Dir'];
    var boxes = BX.map(function (x, i) {
      var r = el('rect', { x: x, y: 132, width: 190, height: 200, rx: 14, class: 'box' }, s.B);
      txt(s, x + 95, 160, titles[i], 'lbl b mid', { show: true });
      return r;
    });
    var hist = [['c3', 'thêm a.js, b.js'], ['c2', 'feat: form'], ['c1', 'init']].map(function (r, i) {
      var t = txt(s, 40, 205 + i * 30, '', 'lbl', { show: true });
      t.style.fontFamily = 'var(--mono)'; t.style.fontSize = '13px';
      el('tspan', { fill: '#5aa9ff', 'font-weight': 700 }, t, r[0] + '  ');
      el('tspan', {}, t, r[1]);
      return t;
    });
    var strike = el('path', { d: 'M34 200 L196 200', stroke: '#f87171', 'stroke-width': 2.5 }, s.T); strike.style.strokeDasharray = 162; strike.style.strokeDashoffset = 162;
    var clean = [txt(s, 320, 240, 'sạch', 'lbl mid', { show: true }), txt(s, 525, 240, 'sạch', 'lbl mid', { show: true })];
    var st = [txt(s, 115, 314, 'Hủy c3', 'lbl r mid'), txt(s, 320, 314, '', 'lbl mid'), txt(s, 525, 314, '', 'lbl mid')];
    function mk(cx, k, cls) { var c = chip(s, 0, 0, 120, k ? 'b.js' : 'a.js', cls); c.X = 0; c.Y = 0; place(c, 380, 72); anime.set(c, { scale: 0.3 }); return c; }
    var stg = [mk(0, 0, 'staged'), mk(0, 1, 'staged')], wd = [mk(0, 0, 'mod'), mk(0, 1, 'mod')];
    var L = term(slide, ['git reset --' + mode + ' HEAD~1', { out: mode === 'hard' ? 'HEAD is now at 7d1e9a0 feat: form' : 'Unstaged changes after reset:', cls: mode === 'hard' ? 'warn' : 'out' }]);
    q.say('Trước khi reset: HEAD ở c3, Staging và Working Dir đều sạch.').wait(900);
    q.type(L[0]);
    q.add(mv(hp, 260, 28, { duration: 800 })).add(fade(e3, 0.25)); ghost(q, c3, 0.3);
    q.go(draw(strike, { duration: 500 }), 300).add(fade(hist[0], 0.4)).go(fade(st[0], 1));
    q.add(fade(clean, 0, { duration: 250 }));
    function fly(c, bi, k, d) { q.add({ targets: c, opacity: [0, 1], duration: 150 }, d); q.add({ targets: c, translateX: BX[bi] + 95, translateY: 212 + k * 44, scale: 1, duration: 800, easing: 'easeOutBack' }, d); }
    if (mode === 'soft') {
      fly(stg[0], 1, 0, 0); fly(stg[1], 1, 1, 120); fly(wd[0], 2, 0, 240); fly(wd[1], 2, 1, 360);
      q.wait(1100);
      q.text(st[1], 'Giữ nguyên').text(st[2], 'Giữ nguyên').cls([st[1], st[2]], 'g').cls([boxes[1], boxes[2]], 'keep');
      q.add(fade([st[1], st[2]], 1));
      q.say('<code>--soft</code>: chỉ hủy commit. Thay đổi vẫn nằm trong Staging, sẵn sàng commit lại. Dùng để sửa message hoặc thêm file quên add.');
    } else if (mode === 'mixed') {
      fly(wd[0], 2, 0, 0); fly(wd[1], 2, 1, 140);
      q.wait(1000);
      q.text(st[1], 'Xóa (bỏ git add)').cls(st[1], 'r').cls(boxes[1], 'drop').text(st[2], 'Giữ nguyên').cls(st[2], 'g').cls(boxes[2], 'keep');
      q.add(fade([st[1], st[2]], 1)).add(fade(clean[0], 1));
      q.type(L[1]);
      q.say('<code>--mixed</code> (mặc định): hủy commit và bỏ git add. Code còn ở Working Dir để tách thành nhiều commit nhỏ.');
    } else {
      fly(wd[0], 2, 0, 0); fly(wd[1], 2, 1, 140);
      q.wait(1000);
      q.cls(wd, 'key', 'mod').add(wobble(wd)).wait(450);
      q.go({ targets: wd, scale: 0, opacity: 0, rotate: 25, duration: 450, easing: 'easeInBack' });
      q.text(st[1], 'Xóa sạch').text(st[2], 'Xóa sạch').cls([st[1], st[2]], 'r').cls([boxes[1], boxes[2]], 'drop');
      q.add(fade([st[1], st[2]], 1)).add(fade(clean, 1));
      q.type(L[1]);
      q.say('<code>--hard</code>: xóa sạch cả 3 vùng, quay về đúng c2. File untracked vẫn còn. Cẩn thận, nhưng vẫn cứu được bằng reflog.');
    }
    return q.tl;
  };

  /* ---------- cherry-pick ---------- */
  EX.cherry = function (stage, slide) {
    var s = svg(stage, 640, 300), q = Q(slide);
    var c1 = node(s, 70, 96, 'c1'), c2 = node(s, 170, 96, 'c2'), c3 = node(s, 270, 96, 'c3');
    var v1 = node(s, 270, 210, 'v1', 'feat'), fx = node(s, 370, 210, '8f9', 'bad', { sub: 'vá bảo mật' }), v3 = node(s, 470, 210, 'v3', 'feat');
    var es = [edge(s, c1, c2, 'main'), edge(s, c2, c3, 'main'), edge(s, c2, v1, 'feat'), edge(s, v1, fx, 'feat'), edge(s, fx, v3, 'feat')];
    var cp = node(s, 370, 96, 'e4d', 'new', { sub: 'e4d5f6a' }); place(cp, 370, 210);
    var ecp = edge(s, c3, cp, 'new');
    var main = ptr(s, 'main', 270, 52), head = ptr(s, 'HEAD', 270, 22, 'head'), feat = ptr(s, 'feat/v2', 470, 256, 'feat');
    var L = term(slide, ['git switch main', 'git cherry-pick 8f9a1b2', { out: '[main e4d5f6a] fix: vá lỗi bảo mật', cls: 'ok' }, { out: ' 1 file changed, 3 insertions(+), 1 deletion(-)', cls: 'out' }]);
    [c1, es[0], c2, es[1], c3, es[2], v1, es[3], fx, es[4], v3].forEach(function (x, i) { q.add(x.tagName === 'path' ? draw(x, { duration: 300 }) : pop(x, { duration: 380 }), i * 110); });
    q.wait(1300).add(pop(main)).add(pop(head), 100).go(pop(feat), 200);
    q.say('feat/v2 còn làm dở, chưa merge được. Nhưng commit <b>8f9a1b2</b> là bản vá bảo mật cần deploy ngay.').wait(1200);
    q.type(L[0]).type(L[1]);
    q.go(pulse(fx, { duration: 600 }));
    q.add(fade(cp, 0.9, { duration: 150 })).go(mv(cp, 370, 96, { duration: 1000, easing: 'easeOutBack' }));
    q.go(draw(ecp, { duration: 300 })).add(fade(cp, 1)).add(mv(main, 370, 52)).go(mv(head, 370, 22));
    q.type(L[2]).type(L[3]);
    q.say('Bản sao cùng nội dung nhưng <b>hash mới e4d5f6a</b> (vì cha là c3). feat/v2 không bị đụng tới.');
    return q.tl;
  };

  /* ---------- worktree ---------- */
  EX.worktree = function (stage, slide) {
    var s = svg(stage, 640, 330), q = Q(slide);
    function folder(x, y, title, branch, bcol, line3) {
      var g = fb(el('g', {}, s.N)), w = 230, h = 128, tw = 70;
      el('path', { d: 'M' + x + ' ' + y + ' h' + tw + ' l12 12 h' + (w - tw - 12) + ' v' + (h - 12) + ' h' + (-w) + ' z', fill: 'rgba(255,255,255,.035)', stroke: 'rgba(255,255,255,.18)', 'stroke-width': 1.5 }, g);
      txt(s, x + 16, y + 42, title, 'lbl b', { show: true, parent: g });
      var b = txt(s, x + 16, y + 68, branch, 'lbl', { show: true, parent: g }); b.style.fontFamily = 'var(--mono)'; b.style.fontSize = '13px'; b.style.fill = bcol;
      g.l3 = txt(s, x + 34, y + 98, line3, 'lbl', { show: true, parent: g }); g.l3.style.fontSize = '13px';
      g.X = x; g.Y = y; g.style.opacity = 0;
      return g;
    }
    var f1 = folder(30, 34, 'project/', 'feat/big-feature', '#a78bfa', 'server :3000 đang chạy');
    var dot = el('circle', { cx: 54, cy: 128, r: 6, fill: '#4ade80', class: 'pulse' }, f1);
    var f2 = folder(380, 34, 'project-hotfix/', 'hotfix/urgent-bug', '#f87171', 'IDE cửa sổ thứ 2');
    el('circle', { cx: 404, cy: 128, r: 6, fill: '#22d3ee' }, f2);
    var db = fb(el('g', {}, s.N));
    el('path', { d: 'M250 236 v46 a70 14 0 0 0 140 0 v-46', fill: '#141a26', stroke: '#f05033', 'stroke-width': 2 }, db);
    el('ellipse', { cx: 320, cy: 236, rx: 70, ry: 14, fill: '#1e2636', stroke: '#f05033', 'stroke-width': 2 }, db);
    el('text', { x: 320, y: 272, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, fill: '#ffd2c7' }, db, '.git');
    db.style.opacity = 0;
    var k1 = el('path', { class: 'e dash', d: 'M145 162 C145 210 220 236 252 240' }, s.E); k1.style.opacity = 0;
    var k2 = el('path', { class: 'e dash', d: 'M495 162 C495 210 420 236 388 240' }, s.E); k2.style.opacity = 0;
    var fixc = node(s, 570, 132, 'fix', 'new', { r: 14 });
    var L = term(slide, ['git worktree add ../project-hotfix hotfix/urgent-bug', { out: "Preparing worktree (checking out 'hotfix/urgent-bug')", cls: 'ok' }, { out: '# mở ../project-hotfix bằng IDE thứ 2, fix bug', cls: 'cm' }, 'git commit -am "fix: urgent bug" && git push', 'git worktree remove ../project-hotfix']);
    q.add(pop(f1, { duration: 500 })).add(pop(db, { duration: 500 }), 200).go(fade(k1, 1), 500);
    q.say('Đang code dở feat/big-feature, server đang chạy. Có hotfix gấp!').wait(1200);
    q.type(L[0]);
    q.add({ targets: f2, opacity: [0, 1], translateX: [80, 0], duration: 800, easing: 'easeOutExpo' }).go(fade(k2, 1), 400).type(L[1]);
    q.say('Thư mục thứ 2 nằm song song, dùng chung một <b>.git</b>. Folder 1 không bị đụng tới.').wait(1000);
    q.type(L[2]).type(L[3]).go(pop(fixc)).add(pulse(db, { duration: 600 }));
    q.say('Fix và push ngay trong project-hotfix/. Commit lưu vào cùng .git nên folder 1 thấy liền.').wait(1300);
    q.type(L[4]);
    q.add({ targets: [f2, fixc], opacity: 0, translateX: 40, duration: 600, easing: 'easeInQuad' }).go(fade(k2, 0, { duration: 500 }));
    q.add(pulse(f1, { duration: 700 }));
    q.say('Xong hotfix thì xóa worktree. Server ở folder 1 chạy suốt: không stash, không build lại.');
    return q.tl;
  };

  /* ---------- tag ---------- */
  EX.tag = function (stage, slide) {
    var s = svg(stage, 640, 250), q = Q(slide);
    var xs = [70, 180, 290, 400, 510], c = xs.map(function (x, i) { return node(s, x, 140, 'c' + (i + 1)); });
    var e = [0, 1, 2, 3].map(function (i) { return edge(s, c[i], c[i + 1], 'main'); });
    var main = ptr(s, 'main', 180, 96);
    var tag = ptr(s, 'v1.0.0', 180, 188, 'tag');
    var org = fb(el('g', {}, s.N));
    el('rect', { x: 540, y: 196, width: 90, height: 36, rx: 10, fill: '#0f2a33', stroke: '#22d3ee', 'stroke-width': 1.5 }, org);
    el('text', { x: 585, y: 219, 'text-anchor': 'middle', 'font-size': 14, fill: '#a5f3fc' }, org, 'origin');
    org.style.opacity = 0;
    var fly = ptr(s, 'v1.0.0', 180, 188, 'tag');
    var L = term(slide, ['git tag -a v1.0.0 -m "Release version 1.0.0: Production stable"', { out: '# ... 3 commit mới sau đó', cls: 'cm' }, 'git push origin v1.0.0', { out: ' * [new tag]         v1.0.0 -> v1.0.0', cls: 'ok' }]);
    q.add(pop(c[0], { duration: 380 })).add(draw(e[0]), 150).add(pop(c[1], { duration: 380 }), 380).go(pop(main), 600);
    q.say('Phát hành bản ổn định tại c2.').wait(500);
    q.type(L[0]);
    q.go({ targets: tag, opacity: [0, 1], translateY: [-60, 0], duration: 900, easing: 'easeOutBounce' });
    q.say('Đóng dấu <b>v1.0.0</b> tại c2. Annotated tag lưu người tạo, ngày giờ, thông điệp.').wait(900);
    q.type(L[1]);
    for (var i = 1; i < 4; i++) { q.go(draw(e[i], { duration: 300 })).add(pop(c[i + 1], { duration: 380 })).go(mv(main, xs[i + 1], 96, { duration: 500 })); }
    q.add(pulse(tag, { duration: 700 }));
    q.say('main chạy tiếp tới c5. <b>v1.0.0 đứng yên</b> tại c2, vĩnh viễn.').wait(1300);
    q.type(L[2]);
    q.go(pop(org, { duration: 400 }));
    q.add(fade(fly, 1, { duration: 100 })).go(mv(fly, 585, 186, { duration: 900, easing: 'easeInOutCubic' }));
    q.go(fade(fly, 0, { duration: 300 })).add(pulse(org)).type(L[3]);
    q.say('<code>git push</code> thường <b>không</b> đẩy tag. Phải push riêng: <code>git push origin v1.0.0</code> hoặc <code>--tags</code>.');
    return q.tl;
  };

  /* ---------- branching strategy ---------- */
  EX.flow = function (stage, slide) {
    var s = svg(stage, 640, 300), q = Q(slide);
    var lanes = [[60, 'main', 'Production', 'main'], [150, 'develop', 'Staging', 'remote'], [240, 'feat/PROJ-105', 'Feature', 'feat']];
    var lines = lanes.map(function (l) {
      txt(s, 12, l[0] - 4, l[1], 'lbl b', { show: true }).style.fontFamily = 'var(--mono)';
      txt(s, 12, l[0] + 16, l[2], 'lbl', { show: true }).style.fontSize = '12.5px';
      var p = el('path', { d: 'M130 ' + l[0] + ' L630 ' + l[0], stroke: 'rgba(255,255,255,.07)', 'stroke-width': 2, 'stroke-dasharray': '3 6' }, s.B);
      return p;
    });
    var m1 = node(s, 150, 60, 'm1'), d1 = node(s, 210, 150, 'd1', 'remote'), f1 = node(s, 300, 240, 'f1', 'feat'), f2 = node(s, 380, 240, 'f2', 'feat');
    var d2 = node(s, 470, 150, 'd2', 'remote'), m2 = node(s, 570, 60, 'm2', 'merge');
    var e1 = edge(s, m1, d1, 'remote'), e2 = edge(s, d1, f1, 'feat'), e3 = edge(s, f1, f2, 'feat');
    var e4 = edge(s, f2, d2, 'feat'), e5 = edge(s, d1, d2, 'remote'), e6 = edge(s, m1, m2, 'main'), e7 = edge(s, d2, m2, 'remote');
    var pr = chip(s, 490, 240, 150, 'PR #42 approved', 'staged');
    var tag = ptr(s, 'v1.2.0', 570, 22, 'tag');
    var lock = ptr(s, 'protected', 360, 30, 'grey');
    q.say('main = Production, develop = Staging. Mọi việc bắt đầu bằng một nhánh tính năng.');
    q.add(pop(m1)).add(pop(lock), 200).go(draw(e1), 300).go(pop(d1)).wait(500);
    q.go(draw(e2)).go(pop(f1)).go(draw(e3)).go(pop(f2));
    q.say('Dev làm trên <b>feat/PROJ-105</b>, commit theo cụm logic nhỏ.').wait(1100);
    q.go(pop(pr, { duration: 600 }));
    q.say('Mở <b>Pull Request</b>: ít nhất 1 người review và approve, CI chạy tự động.').wait(1400);
    q.add(draw(e5, { duration: 600 })).go(draw(e4, { duration: 600 })).go(pop(d2));
    q.say('Approve xong mới gộp vào develop để test trên Staging.').wait(1300);
    q.add(draw(e6, { duration: 700 })).go(draw(e7, { duration: 700 })).go(pop(m2)).go(pop(tag));
    q.say('Ổn định thì phát hành lên main (Production) và gắn tag. main cấm push thẳng.');
    return q.tl;
  };

  /* ---------- conventional commit anatomy (DOM) ---------- */
  EX.conv = function (stage, slide) {
    var q = Q(slide);
    var segs = stage.querySelectorAll('.seg'), tags = stage.querySelectorAll('.tg');
    q.add({ targets: segs, opacity: [0.15, 1], translateY: [10, 0], duration: 600, delay: anime.stagger(450) });
    q.add({ targets: tags, opacity: [0, 1], translateY: [-8, 0], duration: 500, delay: anime.stagger(450, { start: 300 }) });
    q.wait(1700);
    q.add({ targets: stage.querySelectorAll('.body, .foot'), opacity: [0, 1], translateX: [-12, 0], duration: 500, delay: anime.stagger(350) });
    return q.tl;
  };

  /* ---------- daily 6 steps ---------- */
  EX.daily = function (stage, slide) {
    var q = Q(slide), lis = [].slice.call(slide.querySelectorAll('.steps li'));
    var plan = [
      ['git switch develop && git pull --rebase origin develop'],
      ['git switch -c feat/PROJ-201-export-excel'],
      ['git add -p', 'git commit -m "feat(export): xuất file Excel"'],
      ['git fetch origin', 'git rebase origin/develop', { out: '# conflict? sửa file -> git add . -> git rebase --continue', cls: 'cm' }],
      ['git push -u origin feat/PROJ-201-export-excel'],
      [{ out: '# 1 approve + CI xanh -> Squash and Merge -> xóa nhánh', cls: 'ok' }]
    ];
    var flat = []; plan.forEach(function (p) { flat = flat.concat(p); });
    var L = term(slide, flat), k = 0;
    lis.forEach(function (li) { li.classList.remove('on', 'done'); });
    plan.forEach(function (p, i) {
      q.call(function () { lis.forEach(function (li, j) { li.classList.toggle('on', j === i); li.classList.toggle('done', j < i); }); });
      q.wait(250);
      p.forEach(function () { q.type(L[k++]); });
      q.wait(800);
    });
    return q.tl;
  };

  /* ---------- git hooks ---------- */
  EX.hooks = function (stage, slide, mode) {
    var fail = mode === 'fail';
    var s = svg(stage, 640, 300), q = Q(slide);
    function station(x, y, label, note, kind) {
      var g = fb(el('g', { class: kind === 'gate' ? 'gate' : 'stn' }, s.N));
      var w = kind === 'gate' ? 118 : 100;
      el('rect', { x: x - w / 2, y: y - 22, width: w, height: 44, rx: kind === 'gate' ? 10 : 22 }, g);
      el('text', { x: x, y: y + 1 }, g, label);
      if (note) { var n = el('text', { x: x, y: y + 40, class: 'note' }, g, note); }
      g.X = x; g.Y = y;
      return g;
    }
    el('path', { d: 'M60 86 L560 86', class: 'e' }, s.E);
    el('path', { d: 'M60 216 L590 216', class: 'e' }, s.E);
    txt(s, 16, 30, 'Máy dev', 'lbl b', { show: true }); txt(s, 16, 160, 'Push lên server', 'lbl b', { show: true });
    var s1 = station(60, 86, 'git commit', null, 'stn');
    var g1 = station(205, 86, 'pre-commit', 'lint, format, secret', 'gate');
    var g2 = station(355, 86, 'commit-msg', 'commitlint', 'gate');
    var end1 = chip(s, 520, 86, 120, fail ? 'bị chặn' : 'commit xong', fail ? 'key' : 'staged');
    var s2 = station(60, 216, 'git push', null, 'stn');
    var g3 = station(215, 216, 'pre-push', 'unit test', 'gate');
    var g4 = station(385, 216, 'pre-receive', 'server: chặn force push', 'gate');
    var end2 = chip(s, 550, 216, 110, 'lên remote', 'staged');
    var tok = el('circle', { cx: 60, cy: 86, r: 9, fill: '#f05033' }, s.P); tok.X = 60; tok.Y = 86; tok.style.opacity = 0;
    var ex = [g1, g2, g3, g4].map(function (g) { var t = txt(s, g.X, g.Y - 32, 'exit 0', 'lbl g mid'); t.style.fontSize = '12px'; t.style.fontFamily = 'var(--mono)'; return t; });
    var L = fail
      ? term(slide, ['git commit -m "feat(auth): add refresh token"', { out: '✖ eslint --fix', cls: 'err' }, { out: "  src/auth.js 12:7  error  'token' is assigned a value but never used", cls: 'err' }, { out: 'husky - pre-commit script failed (code 1)', cls: 'err' }])
      : term(slide, ['git commit -m "feat(auth): add refresh token"', { out: '✔ lint-staged: eslint --fix, prettier --write', cls: 'ok' }, { out: '✔ commitlint: message hợp lệ', cls: 'ok' }, { out: '[feat/auth 4c2d9e1] feat(auth): add refresh token', cls: 'out' }, 'git push', { out: '✔ pre-push: 128 tests passed', cls: 'ok' }, { out: ' * [new branch]  feat/auth -> feat/auth', cls: 'out' }]);
    function pass(g, i, tline) { q.go(mv(tok, g.X, g.Y, { duration: 650 })); q.cls(g, 'pass').add(pulse(g, { duration: 400 })).go(fade(ex[i], 1, { duration: 250 })); if (tline) q.type(tline); q.wait(250); }
    q.type(L[0]);
    q.go(fade(tok, 1, { duration: 200 }));
    q.say('Gõ <code>git commit</code>: Git chạy hook trước khi commit được tạo.');
    if (fail) {
      q.go(mv(tok, g1.X, g1.Y, { duration: 650 }));
      q.cls(g1, 'fail').text(ex[0], 'exit 1').cls(ex[0], 'r', 'g').go(fade(ex[0], 1, { duration: 200 }));
      q.add(shake(g1)).type(L[1]).type(L[2]);
      q.go(mv(tok, 60, 86, { duration: 600, easing: 'easeOutQuad' })).go(fade(tok, 0.3));
      q.go(pop(end1)).type(L[3]);
      q.add(fade([s2, g3, g4, end2], 0.35));
      q.say('ESLint báo lỗi, <code>pre-commit</code> trả exit code 1: <b>commit bị chặn ngay</b>. Sửa xong mới commit lại được.');
    } else {
      pass(g1, 0, L[1]);
      q.say('<code>pre-commit</code>: lint-staged chỉ lint file đang add. Exit 0 thì đi tiếp.');
      pass(g2, 1, L[2]);
      q.say('<code>commit-msg</code>: commitlint kiểm tra chuẩn Conventional Commits.');
      q.go(mv(tok, 520, 86, { duration: 500 })).go(pop(end1)).type(L[3]).wait(500);
      q.type(L[4]);
      q.add(mv(tok, 60, 216, { duration: 700 }));
      q.wait(800);
      pass(g3, 2, L[5]);
      q.say('<code>pre-push</code>: chạy unit test nhanh. Phía server, <code>pre-receive</code> chặn force push trái phép.');
      pass(g4, 3, null);
      q.go(mv(tok, 550, 216, { duration: 500 })).go(pop(end2)).type(L[6]);
    }
    return q.tl;
  };

  /* ---------- TH1 revert ---------- */
  EX.revert = function (stage, slide, mode) {
    var right = mode === 'right';
    var s = svg(stage, 640, 320), q = Q(slide);
    txt(s, 16, 30, 'origin/develop', 'lbl b', { show: true }); txt(s, 16, 186, 'Máy đồng đội', 'lbl b', { show: true });
    var c1 = node(s, 80, 100, 'c1'), c2 = node(s, 190, 100, 'c2'), bad = node(s, 300, 100, 'c3', 'bad', { sub: 'lỗi' });
    var e1 = edge(s, c1, c2, 'main'), e2 = edge(s, c2, bad, 'bad');
    var t1 = node(s, 80, 250, 'c1'), t2 = node(s, 190, 250, 'c2'), t3 = node(s, 300, 250, 'c3', 'bad'), t4 = node(s, 410, 250, 't4', 'remote');
    var te = [edge(s, t1, t2, 'main'), edge(s, t2, t3, 'bad'), edge(s, t3, t4, 'remote')];
    var dev = ptr(s, 'develop', 300, 56);
    var rv = node(s, 410, 100, 'rv', 'new', { sub: 'Revert c3' }), erv = edge(s, bad, rv, 'new');
    var rv2 = node(s, 520, 250, 'rv', 'new'); place(rv2, 410, 100); var erv2 = edge(s, t4, rv2, 'new');
    var msg = txt(s, 320, 306, right ? 'Đồng đội pull bình thường, lịch sử liền mạch' : 'Lịch sử lệch: đồng đội pull là conflict, dễ mất code', right ? 'lbl g mid' : 'lbl r mid');
    var L = right
      ? term(slide, ['git revert 3c4d5e6', { out: '[develop 7f8e9d0] Revert "feat: c3 lỗi"', cls: 'ok' }, 'git push origin develop', { out: '   3c4d5e6..7f8e9d0  develop -> develop', cls: 'out' }])
      : term(slide, ['git reset --hard HEAD~1', 'git push -f origin develop', { out: ' + 3c4d5e6...7a8b9c0 develop -> develop (forced update)', cls: 'warn' }]);
    [c1, e1, c2, e2, bad].forEach(function (x, i) { q.add(x.tagName === 'path' ? draw(x, { duration: 250 }) : pop(x, { duration: 360 }), i * 100); });
    [t1, te[0], t2, te[1], t3, te[2], t4].forEach(function (x, i) { q.add(x.tagName === 'path' ? draw(x, { duration: 250 }) : pop(x, { duration: 360 }), 300 + i * 100); });
    q.wait(1100).go(pop(dev));
    q.say('c3 lỗi đã lên develop. Đồng đội đã pull về và commit t4 trên đó.').wait(1200);
    if (!right) {
      q.type(L[0]);
      q.go(mv(dev, 190, 56)); ghost(q, bad, 0.3); q.add(fade(e2, 0.25));
      q.type(L[1]).type(L[2]);
      q.say('Remote bị ép quay về c2...').wait(600);
      q.cls([t3, t4], 'bad', 'remote').add(shake([t3, t4])).add(pulse([t3, t4]), 500).go(fade(msg, 1), 300);
      q.say('...nhưng máy đồng đội vẫn có c3 và t4 xây trên nó. <b>Lịch sử lệch</b>, cả team phải gỡ rối.');
    } else {
      q.type(L[0]);
      q.go(draw(erv)).go(pop(rv)).go(mv(dev, 410, 56)).type(L[1]);
      q.say('<code>git revert</code> tạo commit <b>rv</b> có nội dung đảo ngược c3. Không xóa gì cả.').wait(1100);
      q.type(L[2]).type(L[3]);
      q.add(fade(rv2, 1, { duration: 150 })).go(mv(rv2, 520, 250, { duration: 900 })).go(draw(erv2, { duration: 300 })).go(fade(msg, 1));
      q.say('Đồng đội pull về như mọi ngày. Lịch sử liền mạch, ai cũng thấy c3 đã được gỡ.');
    }
    return q.tl;
  };

  /* ---------- TH2 push rejected ---------- */
  EX.rejected = function (stage, slide) {
    var s = svg(stage, 640, 320), q = Q(slide);
    txt(s, 16, 30, 'origin/develop (remote)', 'lbl b', { show: true }); txt(s, 16, 186, 'Máy bạn (local)', 'lbl b', { show: true });
    var r1 = node(s, 80, 100, 'c1'), r2 = node(s, 190, 100, 'c2'), r3 = node(s, 300, 100, 'R', 'remote', { sub: 'đồng đội' });
    var l1 = node(s, 80, 250, 'c1'), l2 = node(s, 190, 250, 'c2'), l3 = node(s, 300, 250, 'L', 'feat');
    var es = [edge(s, r1, r2, 'main'), edge(s, r2, r3, 'remote'), edge(s, l1, l2, 'main'), edge(s, l2, l3, 'feat')];
    var wall = fb(el('g', {}, s.T));
    el('rect', { x: 340, y: 160, width: 150, height: 32, rx: 8, fill: '#2b1113', stroke: '#f87171', 'stroke-width': 1.5 }, wall);
    el('text', { x: 415, y: 181, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#fca5a5' }, wall, 'rejected');
    wall.style.opacity = 0;
    var pk = el('circle', { cx: 300, cy: 250, r: 8, fill: '#a78bfa' }, s.P); pk.X = 300; pk.Y = 250; pk.style.opacity = 0;
    var rc = node(s, 300, 250, 'R', 'remote'); place(rc, 300, 100);
    var ln = node(s, 410, 250, "L'", 'new'); place(ln, 300, 250);
    var eln = edge(s, rc, ln, 'new');
    var up = node(s, 410, 100, "L'", 'new'); place(up, 410, 250);
    var eup = edge(s, r3, up, 'new');
    var L = term(slide, ['git push origin develop', { out: ' ! [rejected]        develop -> develop (fetch first)', cls: 'err' }, { out: 'Updates were rejected because the remote contains work that you do not have locally.', cls: 'err' }, 'git pull --rebase origin develop', { out: 'Successfully rebased and updated refs/heads/develop.', cls: 'ok' }, 'git push origin develop', { out: '   9c1d2e3..4f5a6b7  develop -> develop', cls: 'ok' }]);
    [r1, es[0], r2, es[1], r3, l1, es[2], l2, es[3], l3].forEach(function (x, i) { q.add(x.tagName === 'path' ? draw(x, { duration: 250 }) : pop(x, { duration: 360 }), i * 90); });
    q.wait(1200);
    q.say('Đồng đội vừa push <b>R</b>. Bạn có <b>L</b> ở local, chưa có R.').wait(1100);
    q.type(L[0]);
    q.add(fade(pk, 1, { duration: 100 })).go(mv(pk, 415, 196, { duration: 600, easing: 'easeInQuad' }));
    q.add(pop(wall, { duration: 300 })).go(mv(pk, 300, 250, { duration: 600, easing: 'easeOutBounce' })).go(fade(pk, 0, { duration: 200 }));
    q.type(L[1]).type(L[2]);
    q.say('Bị từ chối: remote có R mà máy bạn chưa có. Push thêm sẽ đè mất R.').wait(1300);
    q.type(L[3]);
    ghost(q, l3, 0.25);
    q.add(fade(ln, 1, { duration: 150 })).add(mv(ln, 410, 250, { duration: 900, easing: 'easeInOutBack' }));
    q.add(fade(rc, 1, { duration: 150 }), 200).go(mv(rc, 300, 250, { duration: 900 }), 200);
    q.go(draw(eln, { duration: 300 })).type(L[4]);
    q.say('<code>pull --rebase</code>: R về trước, L được xếp lên trên cùng thành <b>L\'</b>.').wait(1200);
    q.type(L[5]);
    q.add(fade(wall, 0, { duration: 300 }));
    q.add(fade(up, 1, { duration: 150 })).go(mv(up, 410, 100, { duration: 900 })).go(draw(eup, { duration: 300 })).type(L[6]);
    q.say('Push thành công. Lịch sử thẳng, không có commit merge rác.');
    return q.tl;
  };

  /* ---------- TH3 force-with-lease ---------- */
  EX.lease = function (stage, slide, mode) {
    var lease = mode === 'lease';
    var s = svg(stage, 640, 330), q = Q(slide);
    txt(s, 16, 30, 'origin/feat/ten-nhanh', 'lbl b', { show: true }); txt(s, 16, 192, 'Máy bạn: vừa rebase, chưa fetch t', 'lbl b', { show: true });
    var r = [node(s, 70, 100, 'c1'), node(s, 170, 100, 'c2'), node(s, 270, 100, 'a', 'feat'), node(s, 370, 100, 'b', 'feat'), node(s, 470, 100, 't', 'remote', { sub: 'đồng đội' })];
    var re = [edge(s, r[0], r[1], 'main'), edge(s, r[1], r[2], 'feat'), edge(s, r[2], r[3], 'feat'), edge(s, r[3], r[4], 'remote')];
    var l = [node(s, 70, 256, 'c1'), node(s, 170, 256, 'c2'), node(s, 270, 256, "a'", 'new'), node(s, 370, 256, "b'", 'new')];
    var le = [edge(s, l[0], l[1], 'main'), edge(s, l[1], l[2], 'new'), edge(s, l[2], l[3], 'new')];
    var na = node(s, 270, 100, "a'", 'new'), nb = node(s, 370, 100, "b'", 'new'); place(na, 270, 256); place(nb, 370, 256);
    var pk = el('circle', { cx: 370, cy: 256, r: 8, fill: '#4ade80' }, s.P); pk.X = 370; pk.Y = 256; pk.style.opacity = 0;
    var shield = fb(el('g', {}, s.T));
    el('rect', { x: 250, y: 162, width: 260, height: 32, rx: 8, fill: '#10241a', stroke: '#4ade80', 'stroke-width': 1.5 }, shield);
    el('text', { x: 380, y: 183, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#86efac' }, shield, 'lease: remote đã đổi -> từ chối');
    shield.style.opacity = 0;
    var lost = txt(s, 470, 60, 't bị xóa!', 'lbl r mid');
    var L = lease
      ? term(slide, ['git push --force-with-lease origin feat/ten-nhanh', { out: ' ! [rejected]        feat/ten-nhanh -> feat/ten-nhanh (stale info)', cls: 'err' }, { out: '# fetch, xem commit t, rebase tiếp rồi mới push', cls: 'cm' }])
      : term(slide, ['git push -f origin feat/ten-nhanh', { out: ' + 1a2b3c4...9d8e7f6 feat/ten-nhanh -> feat/ten-nhanh (forced update)', cls: 'warn' }]);
    r.forEach(function (n, i) { q.add(pop(n, { duration: 360 }), i * 90); }); re.forEach(function (e, i) { q.add(draw(e, { duration: 250 }), 60 + i * 90); });
    l.forEach(function (n, i) { q.add(pop(n, { duration: 360 }), 400 + i * 90); }); le.forEach(function (e, i) { q.add(draw(e, { duration: 250 }), 460 + i * 90); });
    q.wait(1100);
    q.say('Bạn rebase nhánh cá nhân thành a\', b\'. Trong lúc đó đồng đội đẩy thêm <b>t</b> lên remote.').wait(1300);
    q.type(L[0]);
    q.add(fade(pk, 1, { duration: 100 }));
    if (!lease) {
      q.go(mv(pk, 370, 100, { duration: 700, easing: 'easeInQuad' })).add(fade(pk, 0, { duration: 150 }));
      q.cls(r[4], 'bad', 'remote').add(shake(r[4])).go(fade(lost, 1), 300);
      q.add({ targets: [r[2], r[3], r[4]], opacity: 0, scale: 0.4, duration: 500, easing: 'easeInBack' }).add(fade([re[1], re[2], re[3]], 0));
      q.add(fade([na, nb], 1, { duration: 150 }), 300).add(mv(na, 270, 100, { duration: 800 }), 300).go(mv(nb, 370, 100, { duration: 800 }), 400);
      q.type(L[1]);
      q.say('<code>-f</code> ghi đè thẳng: commit <b>t của đồng đội biến mất</b> khỏi remote.');
    } else {
      q.go(mv(pk, 370, 200, { duration: 600, easing: 'easeInQuad' }));
      q.add(pop(shield, { duration: 350 })).go(mv(pk, 370, 256, { duration: 600, easing: 'easeOutBounce' })).go(fade(pk, 0, { duration: 200 }));
      q.type(L[1]).add(pulse(r[4]));
      q.type(L[2]);
      q.say('Remote có <b>t</b> mà bạn chưa fetch, nên Git từ chối. t an toàn. Fetch, xem lại, rồi mới push.');
    }
    return q.tl;
  };

  /* ---------- TH4 committed on main ---------- */
  EX.wrongmain = function (stage, slide) {
    var s = svg(stage, 640, 300), q = Q(slide);
    var c1 = node(s, 70, 200, 'c1'), c2 = node(s, 180, 200, 'c2'), a = node(s, 290, 200, 'a', 'warn'), b = node(s, 400, 200, 'b', 'warn');
    var e1 = edge(s, c1, c2, 'main'), e2 = edge(s, c2, a, 'main'), e3 = edge(s, a, b, 'main');
    var main = ptr(s, 'main', 400, 246), head = ptr(s, 'HEAD', 400, 276, 'head'), feat = ptr(s, 'feat/nhanh-moi-dung', 400, 154, 'feat');
    var L = term(slide, [{ out: '# 1. tạo nhánh giữ toàn bộ công sức', cls: 'cm' }, 'git branch feat/nhanh-moi-dung', { out: '# 2. lùi main về trạng thái sạch (2 commit)', cls: 'cm' }, 'git reset --hard HEAD~2', { out: '# 3. chuyển sang nhánh mới làm tiếp', cls: 'cm' }, 'git switch feat/nhanh-moi-dung']);
    [c1, e1, c2, e2, a, e3, b].forEach(function (x, i) { q.add(x.tagName === 'path' ? draw(x, { duration: 250 }) : pop(x, { duration: 360 }), i * 100); });
    q.wait(800).add(pop(main)).go(pop(head), 100);
    q.say('Lỡ tay: 2 commit tính năng <b>a, b</b> nằm thẳng trên main (chưa push).').wait(1200);
    q.type(L[0]).type(L[1]).go(pop(feat));
    q.say('Bước 1: tạo nhánh ngay tại b để giữ công sức.').wait(900);
    q.type(L[2]).type(L[3]);
    q.add(mv(main, 180, 246, { duration: 900 })).add(mv(head, 180, 276, { duration: 900 }));
    q.cls([a, b], 'feat', 'warn');
    q.call(function () { e2.style.strokeDasharray = 'none'; e2.setAttribute('class', 'e feat'); e3.setAttribute('class', 'e feat'); });
    q.add({ targets: [a, b], translateY: -100, duration: 900, easing: 'easeInOutCubic' }, 200);
    q.add({ targets: e2, d: 'M180 200 C235 200 235 100 290 100', duration: 900, easing: 'easeInOutCubic' }, 200);
    q.add({ targets: e3, translateY: -100, duration: 900, easing: 'easeInOutCubic' }, 200);
    q.go(mv(feat, 400, 54, { duration: 900 }), 200);
    q.say('Bước 2: main lùi về c2 sạch sẽ. a, b giờ chỉ thuộc nhánh mới.').wait(1000);
    q.type(L[4]).type(L[5]);
    q.go(mv(head, 400, 24, { duration: 900 }));
    q.say('Bước 3: HEAD sang nhánh mới, làm tiếp như chưa có gì xảy ra.');
    return q.tl;
  };

  /* ---------- TH5 squash ---------- */
  EX.squash = function (stage, slide) {
    var s = svg(stage, 640, 330), q = Q(slide);
    var frame = fb(el('g', {}, s.B));
    el('rect', { x: 10, y: 10, width: 620, height: 262, rx: 12, fill: '#0b0e15', stroke: 'rgba(255,255,255,.14)' }, frame);
    el('text', { x: 30, y: 38, 'font-size': 12.5, fill: '#5b6578' }, frame, 'git-rebase-todo');
    el('text', { x: 36, y: 258, 'font-size': 12, fill: '#5b6578' }, frame, '# s, squash = gộp vào commit phía trên');
    frame.style.opacity = 0;
    var data = [['a1b2c3d', 'feat: export excel'], ['b2c3d4e', 'fix typo'], ['c3d4e5f', 'update'], ['d4e5f6a', 'fix lint'], ['e5f6a7b', 'update again']];
    var rows = data.map(function (d, i) {
      var y = 76 + i * 36, g = el('g', {}, s.N);
      var pick = el('text', { x: 36, y: y, 'font-size': 14, fill: '#5aa9ff', 'font-weight': 700 }, g, 'pick');
      var sq = el('text', { x: 36, y: y, 'font-size': 14, fill: '#fbbf24', 'font-weight': 700 }, g, 'squash'); sq.style.opacity = 0;
      var h = el('text', { x: 116, y: y, 'font-size': 14, fill: '#8d99ae' }, g, d[0]);
      var m = el('text', { x: 200, y: y, 'font-size': 14, fill: '#eef1f7' }, g, d[1]);
      g.style.opacity = 0;
      return { g: g, pick: pick, sq: sq, h: h, m: m };
    });
    var nh = el('text', { x: 116, y: 76, 'font-size': 14, fill: '#4ade80' }, s.N, 'f00d123'); nh.style.opacity = 0;
    var nm = el('text', { x: 200, y: 76, 'font-size': 14, fill: '#4ade80', 'font-weight': 700 }, s.N, 'feat(export): xuất báo cáo Excel'); nm.style.opacity = 0;
    var res = txt(s, 320, 310, '5 commit lẻ -> 1 commit sạch, sẵn sàng tạo PR', 'lbl g mid');
    var L = term(slide, ['git rebase -i HEAD~5', { out: '# sửa pick -> squash cho 4 dòng dưới, lưu lại', cls: 'cm' }, { out: 'Successfully rebased and updated refs/heads/feat/PROJ-201-export-excel.', cls: 'ok' }, 'git log --oneline -1', { out: 'f00d123 feat(export): xuất báo cáo Excel', cls: 'out' }]);
    q.type(L[0]);
    q.go(fade(frame, 1, { duration: 300 }));
    rows.forEach(function (r, i) { q.add({ targets: r.g, opacity: [0, 1], translateX: [-20, 0], duration: 400 }, i * 100); });
    q.wait(900);
    q.say('Editor mở ra 5 dòng <code>pick</code>, commit cũ nhất ở trên cùng.').wait(1200);
    q.type(L[1]);
    rows.slice(1).forEach(function (r, i) {
      q.add({ targets: r.pick, opacity: 0, translateY: -8, duration: 250 }, i * 280);
      q.add({ targets: r.sq, opacity: [0, 1], translateY: [8, 0], duration: 300 }, i * 280 + 150);
    });
    q.wait(1500);
    q.say('Giữ <code>pick</code> dòng đầu, đổi 4 dòng dưới thành <code>squash</code>. Lưu và đóng editor.').wait(1300);
    rows.slice(1).forEach(function (r, i) { q.add({ targets: r.g, translateY: -(i + 1) * 36, opacity: 0, duration: 650, easing: 'easeInOutCubic' }, i * 120); });
    q.wait(900);
    q.add(fade([rows[0].h, rows[0].m], 0, { duration: 250 })).add(fade([nh, nm], 1, { duration: 400 }), 200);
    q.wait(700).type(L[2]).type(L[3]).type(L[4]);
    q.go(pop(res));
    q.say('5 commit gộp thành <b>1 commit</b> với message mới, chuyên nghiệp. Reviewer đọc một lần là hiểu.');
    return q.tl;
  };

  /* ---------- TH6 reflog ---------- */
  EX.reflog = function (stage, slide) {
    var s = svg(stage, 640, 230), q = Q(slide);
    var c = [node(s, 70, 120, 'c1'), node(s, 180, 120, 'c2'), node(s, 290, 120, 'c3'), node(s, 400, 120, 'c4')];
    var e = [edge(s, c[0], c[1], 'main'), edge(s, c[1], c[2], 'main'), edge(s, c[2], c[3], 'main')];
    var main = ptr(s, 'main', 400, 76), head = ptr(s, 'HEAD', 400, 46, 'head'), rec = ptr(s, 'nhanh-khoi-phuc', 400, 166, 'new');
    var lost = txt(s, 345, 175, 'mất rồi?', 'lbl r mid');
    var L = term(slide, ['git reset --hard HEAD~2', { out: 'HEAD is now at 1b2c3d4 c2', cls: 'warn' }, 'git reflog', { out: '1b2c3d4 HEAD@{0}: reset: moving to HEAD~2', cls: 'out' }, { out: '9f8e7d6 HEAD@{1}: commit: feat: c4', cls: 'out' }, { out: '5c4b3a2 HEAD@{2}: commit: feat: c3', cls: 'out' }, 'git switch -c nhanh-khoi-phuc 9f8e7d6', { out: "Switched to a new branch 'nhanh-khoi-phuc'", cls: 'ok' }]);
    [c[0], e[0], c[1], e[1], c[2], e[2], c[3]].forEach(function (x, i) { q.add(x.tagName === 'path' ? draw(x, { duration: 250 }) : pop(x, { duration: 360 }), i * 100); });
    q.wait(800).add(pop(main)).go(pop(head), 100);
    q.say('main đang ở c4 (9f8e7d6), có 2 commit công sức c3, c4.').wait(1000);
    q.type(L[0]);
    q.add(mv(main, 180, 76, { duration: 800 })).add(mv(head, 180, 46, { duration: 800 }));
    ghost(q, [c[2], c[3]], 0.25, 300); q.add(fade([e[1], e[2]], 0.15), 300);
    q.wait(800).go(fade(lost, 1)).type(L[1]);
    q.say('c3, c4 biến khỏi <code>git log</code>. Nhưng Git <b>chưa xóa</b> chúng.').wait(1200);
    q.type(L[2]).type(L[3]).type(L[4]).type(L[5]);
    q.go({ targets: L[4], backgroundColor: ['rgba(240,80,51,0)', 'rgba(240,80,51,.28)'], color: '#ffffff', duration: 500 });
    q.say('<code>reflog</code> nhớ mọi bước HEAD đi qua. Trạng thái trước lúc gõ nhầm là <b>9f8e7d6</b>.').wait(1300);
    q.type(L[6]);
    q.add(fade(lost, 0, { duration: 200 }));
    q.cls([c[2], c[3]], null, 'ghost').add(fade([c[2], c[3], e[1], e[2]], 1, { duration: 600 }));
    q.add(pop(rec), 300).go(mv(head, 400, 196, { duration: 900 }), 300).type(L[7]);
    q.say('Tạo nhánh trỏ vào hash đó: c3, c4 quay về đầy đủ. Bình tĩnh, Git hiếm khi mất thật.');
    return q.tl;
  };

  /* ---------- TH7 leaked .env ---------- */
  EX.leak = function (stage, slide) {
    var s = svg(stage, 640, 320), q = Q(slide);
    el('rect', { x: 20, y: 100, width: 200, height: 130, rx: 14, class: 'box' }, s.B);
    txt(s, 120, 126, 'Máy bạn', 'lbl b mid', { show: true });
    el('rect', { x: 400, y: 90, width: 220, height: 140, rx: 30, class: 'box' }, s.B);
    txt(s, 510, 120, 'GitHub (public)', 'lbl b mid', { show: true });
    var envL = chip(s, 120, 172, 110, '.env', 'key', { show: true });
    var keyTxt = txt(s, 120, 210, 'API_KEY=sk-live-...', 'lbl mid', { show: true }); keyTxt.style.fontSize = '12px'; keyTxt.style.fontFamily = 'var(--mono)';
    var envR = chip(s, 510, 168, 130, '.env', 'key'); place(envR, 120, 172);
    var newKey = chip(s, 120, 172, 110, 'key mới', 'newkey');
    var pos = [[380, 36], [500, 26], [625, 50], [628, 262], [500, 290], [372, 270]];
    var bots = pos.map(function (p) {
      var g = fb(el('g', {}, s.P));
      el('circle', { cx: p[0], cy: p[1], r: 13, fill: '#2b1113', stroke: '#f87171', 'stroke-width': 1.5 }, g);
      el('text', { x: p[0], y: p[1] + 4, 'text-anchor': 'middle', 'font-size': 10, fill: '#fca5a5', 'font-weight': 700 }, g, 'bot');
      g.X = p[0]; g.Y = p[1]; g.style.opacity = 0; return g;
    });
    var clock = txt(s, 510, 312, 't = 0.0s', 'lbl r mid'); clock.style.fontFamily = 'var(--mono)';
    var step1 = txt(s, 20, 60, '1. Revoke + Rotate key ngay', 'lbl a');
    step1.style.fontSize = '17px';
    var L = term(slide, ['git add . && git commit -m "config" && git push', { out: '# việc 1: revoke + rotate key trên AWS / GCP / DB', cls: 'warn' }, { out: '# việc 2, nếu CHƯA push:', cls: 'cm' }, 'git rm --cached .env', "echo '.env' >> .gitignore", 'git commit --amend -m "chore: remove sensitive env file"', { out: '# việc 3, nếu ĐÃ push: git-filter-repo hoặc BFG, rồi báo team clone lại', cls: 'cm' }]);
    q.say('Lỡ tay <code>git add .</code> cả file .env chứa API key.').wait(900);
    q.type(L[0]);
    q.add(fade(envR, 1, { duration: 150 })).go(mv(envR, 510, 168, { duration: 900 }));
    q.say('File .env đã nằm trên repo public.').wait(500);
    bots.forEach(function (b, i) { q.add(pop(b, { duration: 300 }), i * 70); });
    q.add(fade(clock, 1, { duration: 200 }));
    var o = { t: 0 };
    q.add({ targets: o, t: 4.2, duration: 1600, easing: 'linear', update: function () { clock.textContent = 't = ' + o.t.toFixed(1) + 's'; } }, 300);
    bots.forEach(function (b, i) {
      var ang = i / bots.length * Math.PI * 2, tx = 510 + Math.cos(ang) * 82, ty = 168 + Math.sin(ang) * 44;
      q.add(mv(b, tx, ty, { duration: 1300, easing: 'easeInOutQuad' }), 400 + i * 60);
    });
    q.wait(1900).add(shake(envR));
    q.say('Bot quét GitHub tìm ra key chỉ sau <b>vài giây</b>. Xóa commit lúc này đã quá muộn.').wait(1400);
    q.go(fade(step1, 1)).type(L[1]);
    q.text(envR.txt, 'key đã revoke').cls(envR, null, 'key').add(fade(bots, 0.15, { duration: 600 }));
    q.text(clock, 'key cũ vô dụng');
    q.add(fade([envL, keyTxt], 0, { duration: 300 })).go(pop(newKey), 200);
    q.say('Việc số 1: revoke key cũ, tạo key mới. Bot giữ một key chết cũng vô dụng.').wait(1300);
    q.type(L[2]).type(L[3]).type(L[4]).type(L[5]).type(L[6]);
    q.say('Rồi mới dọn repo: chưa push thì amend, đã push thì xóa khỏi toàn bộ lịch sử bằng git-filter-repo hoặc BFG.');
    return q.tl;
  };

  /* auto-typing terminal for static command slides */
  function autoTerm(body) {
    var q = Q(null), ps = body.querySelectorAll('p');
    ps.forEach(function (p) {
      if (p.classList.contains('cmd')) p.textContent = '';
      else p.style.opacity = 0;
    });
    ps.forEach(function (p) { q.type(p, 0, 20); });
    return q.tl;
  }

  window.GX = { EX: EX, autoTerm: autoTerm };
})();
