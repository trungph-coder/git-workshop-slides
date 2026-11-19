/* Animated explainers.
   Each EX[name](stage, slide, mode) rebuilds its diagram and returns a paused anime.js timeline with
   tl.steps = [{t, cap}] (step start times) and tl.sync(time). Every discrete change (class, text,
   typing, scrambles) is derived from time inside sync(), so seeking to any step, forward or back,
   gives the exact state; nothing depends on one-shot callbacks. */
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
    var s = el('svg', { viewBox: '0 0 ' + w + ' ' + h, class: 'gsvg', role: 'img' }, stage);
    s.id2 = 'g' + (++uid);
    var defs = el('defs', {}, s);
    var m = el('marker', { id: s.id2 + 'ah', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0 0L10 5L0 10z', fill: '#77839b' }, m);
    s.B = el('g', {}, s); s.E = el('g', {}, s); s.N = el('g', {}, s); s.P = el('g', {}, s); s.T = el('g', {}, s);
    s.ah = 'url(#' + s.id2 + 'ah)';
    return s;
  }
  function hide(g, show) { if (!show) g.style.opacity = 0; return g; }
  function fb(g) { g.style.transformBox = 'fill-box'; g.style.transformOrigin = 'center'; return g; }
  function info(g, title, text) { g.dataset.info = text; g.dataset.title = title; return g; }

  var NODE_INFO = {
    '': 'Commit trên main. Mỗi commit là một ảnh chụp toàn bộ code, định danh bằng hash.',
    feat: 'Commit trên nhánh tính năng.',
    new: 'Commit vừa được tạo ra, nên có hash mới.',
    remote: 'Commit của đồng đội, đến từ remote.',
    bad: 'Commit chứa lỗi.',
    merge: 'Merge commit: có 2 commit cha, nối 2 nhánh lại.',
    warn: 'Commit tạo ra khi không có nhánh nào giữ.',
    junk: 'Merge commit tự sinh khi git pull: không mang nội dung, chỉ làm rối lịch sử.'
  };
  function node(s, x, y, label, cls, o) {
    o = o || {};
    var g = el('g', { class: 'c ' + (cls || '') }, s.N);
    el('circle', { cx: x, cy: y, r: o.r || 17 }, g);
    g.lab = el('text', { x: x, y: y, class: 'cl' }, g, label);
    if (o.sub) g.sub = el('text', { x: x, y: y + 37, class: 'cs' }, g, o.sub);
    g.X = x; g.Y = y;
    info(g, label ? 'Commit ' + label : 'Commit', o.info || NODE_INFO[cls || ''] || NODE_INFO['']);
    return hide(g, o.show);
  }
  function cd(a, b) {
    var mx = (a.X + b.X) / 2;
    return 'M' + a.X + ' ' + a.Y + ' C' + mx + ' ' + a.Y + ' ' + mx + ' ' + b.Y + ' ' + b.X + ' ' + b.Y;
  }
  function dash(p) {
    var L = p.getTotalLength() || 1; p.style.strokeDasharray = L + ' ' + L; p.style.strokeDashoffset = L;
    if (p.hasAttribute('marker-end')) p.style.opacity = 0; /* arrowheads would show before the line draws */
    return p;
  }
  function edge(s, a, b, cls, o) {
    o = o || {};
    var p = el('path', { class: 'e ' + (cls || ''), d: o.d || cd(a, b) }, s.E);
    if (!o.show) dash(p);
    return p;
  }
  function ptr(s, text, x, y, cls, o) {
    o = o || {};
    var g = fb(el('g', { class: 'p ' + (cls || '') }, s.P));
    var w = text.length * 8 + 20;
    g.rect = el('rect', { x: x - w / 2, y: y - 13, width: w, height: 26, rx: 8 }, g);
    g.txt = el('text', { x: x, y: y + 1 }, g, text);
    g.X = x; g.Y = y;
    var inf = o.info;
    if (!inf) {
      if (/^HEAD/.test(text)) inf = 'HEAD: con trỏ cho biết bạn đang đứng ở đâu. Bình thường nó trỏ vào tên một nhánh.';
      else if (cls === 'tag') inf = 'Tag: mốc cố định gắn vào một commit, không bao giờ tự di chuyển.';
      else if (/^origin\//.test(text)) inf = 'Remote-tracking branch: trạng thái nhánh trên remote ở lần fetch gần nhất.';
      else inf = 'Nhánh chỉ là một con trỏ (file 41 bytes) tới một commit. Commit mới thì nó tự tiến lên.';
    }
    info(g, text, inf);
    return hide(g, o.show);
  }
  function chip(s, x, y, w, label, cls, o) {
    o = o || {};
    var g = fb(el('g', { class: 'chip ' + (cls || '') }, o.parent || s.N));
    el('rect', { x: x - w / 2, y: y - 15, width: w, height: 30, rx: 7 }, g);
    g.txt = el('text', { x: x, y: y + 1 }, g, label);
    g.X = x; g.Y = y;
    if (o.info !== false) info(g, label, o.info || 'File ' + label + '.');
    return hide(g, o.show);
  }
  function txt(s, x, y, str, cls, o) {
    o = o || {};
    var t = fb(el('text', { x: x, y: y, class: cls || 'lbl' }, o.parent || s.T, str));
    return hide(t, o.show);
  }
  function place(g, x, y) { anime.set(g, { translateX: x - g.X, translateY: y - g.Y }); }
  function arrowLine(s, x1, y1, x2, y2, show) {
    var p = el('path', { d: 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2, class: 'arrow', 'marker-end': s.ah }, s.E);
    if (!show) dash(p);
    return p;
  }

  /* animation param factories */
  function pop(t, o) { return Object.assign({ targets: t, opacity: [0, 1], scale: [0.2, 1], duration: 520, easing: 'easeOutBack' }, o || {}); }
  function grow(t, o) { return Object.assign({ targets: t, opacity: [0, 1], scale: [0, 1], duration: 900, easing: 'easeOutElastic(1, .55)' }, o || {}); }
  function stamp(t, o) { return Object.assign({ targets: t, opacity: [0, 1], scale: [1.6, 1], duration: 360, easing: 'easeInQuad' }, o || {}); }
  function drop(t, o) { return Object.assign({ targets: t, opacity: [0, 1], translateY: [-46, 0], duration: 750, easing: 'easeOutBounce' }, o || {}); }
  function fade(t, v, o) { return Object.assign({ targets: t, opacity: v, duration: 400, easing: 'linear' }, o || {}); }
  function draw(p, o) { return Object.assign({ targets: p, strokeDashoffset: 0, opacity: { value: 1, duration: 1 }, duration: 420, easing: 'easeInOutSine' }, o || {}); }
  function mv(g, x, y, o) { return Object.assign({ targets: g, translateX: x - g.X, translateY: y - g.Y, duration: 700, easing: 'easeInOutCubic' }, o || {}); }
  /* move along an arc: x eases across, y rises by `lift` then lands */
  function arc(g, x, y, lift, o) {
    o = o || {};
    var d = o.duration || 900;
    var curY = o.fromY != null ? o.fromY : g.Y;
    var peak = Math.min(curY, y) - g.Y - (lift == null ? 50 : lift);
    return {
      targets: g, duration: d,
      translateX: { value: x - g.X, duration: d, easing: 'easeInOutSine' },
      translateY: [{ value: peak, duration: d * 0.5, easing: 'easeOutQuad' }, { value: y - g.Y, duration: d * 0.5, easing: 'easeInQuad' }]
    };
  }
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

  function arr(x) { return (x && x.length !== undefined && !x.tagName) ? Array.prototype.slice.call(x) : [x]; }

  /* sequencer: absolute-time cursor + reversible discrete events */
  function Q() {
    var q;
    var tl = anime.timeline({ autoplay: false, easing: 'easeOutCubic', update: function () { q.sync(tl.currentTime); if (tl._hook) tl._hook(); } });
    var t = 0, steps = [], events = [], ticks = [], base = new Map();
    function dur(p) {
      var d = typeof p.duration === 'number' ? p.duration : 500;
      var dl = typeof p.delay === 'number' ? p.delay : 0;
      return d + dl;
    }
    function remember(e) {
      if (!base.has(e)) base.set(e, { cls: e.getAttribute('class'), txt: null, st: {} });
      return base.get(e);
    }
    q = {
      tl: tl,
      step: function (cap) { steps.push({ t: t, cap: cap }); return q; },
      add: function (p, gap) { tl.add(p, t + (gap || 0)); return q; },
      go: function (p, gap) { gap = gap || 0; tl.add(p, t + gap); t += gap + dur(p); return q; },
      wait: function (ms) { t += ms; return q; },
      cls: function (els, add, rm, gap) {
        arr(els).forEach(function (e) { remember(e); events.push({ t: t + (gap || 0), e: e, k: 'c', add: add, rm: rm }); });
        return q;
      },
      text: function (e, s, gap) {
        var b = remember(e); if (b.txt == null) b.txt = e.textContent;
        events.push({ t: t + (gap || 0), e: e, k: 't', s: s });
        return q;
      },
      style: function (e, prop, val, gap) {
        var b = remember(e); if (!(prop in b.st)) b.st[prop] = e.style[prop];
        events.push({ t: t + (gap || 0), e: e, k: 's', prop: prop, val: val });
        return q;
      },
      tick: function (d, fn, gap) {
        var t0 = t + (gap || 0);
        ticks.push({ t0: t0, d: d, fn: fn });
        tl.add({ targets: { v: 0 }, v: 1, duration: d }, t0);
        return q;
      },
      type: function (p, gap, speed) {
        if (!p) return q;
        gap = gap || 0;
        var b = p.parentNode;
        if (!p.classList.contains('cmd')) {
          tl.add({ targets: p, opacity: [0, 1], translateX: [-6, 0], duration: 260, easing: 'easeOutQuad' }, t + gap);
          q.tick(1, function (pr, started) { if (started && !p._shown) { p._shown = true; b.scrollTop = b.scrollHeight; } if (!started) p._shown = false; }, gap);
          t += gap + 200;
          return q;
        }
        var s = p.dataset.text;
        var d = Math.min(1600, Math.max(260, s.length * (speed || 22)));
        q.tick(d, function (pr, started) {
          var v = started ? s.slice(0, Math.round(pr * s.length)) : '';
          if (p.textContent !== v) { p.textContent = v; b.scrollTop = b.scrollHeight; }
          p.classList.toggle('typing', started && pr < 1);
        }, gap);
        t += gap + d + 160;
        return q;
      },
      scramble: function (e, from, final, d, gap) {
        var hex = '0123456789abcdef';
        q.tick(d || 900, function (pr, started) {
          if (!started || pr <= 0) { e.textContent = from; return; }
          if (pr >= 1) { e.textContent = final; return; }
          var k = Math.floor(pr * final.length), s = final.slice(0, k);
          for (var i = k; i < final.length; i++) s += hex[Math.floor(Math.random() * 16)];
          e.textContent = s;
        }, gap);
        return q;
      },
      sync: function (time) {
        base.forEach(function (b, e) {
          if (b.cls == null) e.removeAttribute('class'); else e.setAttribute('class', b.cls);
          if (e._sel) e.classList.add('sel');
          if (b.txt != null) e.textContent = b.txt;
          for (var k in b.st) e.style[k] = b.st[k];
        });
        events.forEach(function (ev) {
          if (ev.t > time + 0.5) return;
          if (ev.k === 'c') {
            if (ev.rm) ev.rm.split(' ').forEach(function (c) { ev.e.classList.remove(c); });
            if (ev.add) ev.add.split(' ').forEach(function (c) { ev.e.classList.add(c); });
          } else if (ev.k === 't') ev.e.textContent = ev.s;
          else ev.e.style[ev.prop] = ev.val;
        });
        ticks.forEach(function (k) { k.fn(Math.max(0, Math.min(1, (time - k.t0) / k.d)), time >= k.t0); });
      },
      finish: function () {
        if (!steps.length || steps[0].t > 0) steps.unshift({ t: 0, cap: '' });
        t += 300;
        tl.add({ targets: { v: 0 }, v: 1, duration: 300 }, t - 300);
        tl.steps = steps;
        tl.sync = q.sync;
        tl.seek(tl.duration); tl.seek(0); q.sync(0);
        return tl;
      }
    };
    return q;
  }
  function ghost(q, g, v, gap) { q.cls(g, 'ghost', null, gap); q.add(fade(g, v == null ? 0.32 : v, { duration: 500 }), gap); }
  function panelTitle(s, y0, str) { txt(s, 16, y0 + 24, str, 'lbl b', { show: true }); }
  function seqPop(q, list, gap) { gap = gap || 100; list.forEach(function (x, i) { q.add(x.tagName === 'path' ? draw(x, { duration: 260 }) : pop(x, { duration: 380 }), i * gap); }); q.wait(list.length * gap + 300); }

  var EX = {};

  /* ---------- decorative title graph ---------- */
  EX.title = function (stage) {
    var s = svg(stage, 820, 520), q = Q();
    s.setAttribute('viewBox', '0 140 820 320'); /* crop to the graph so it can sit in its own band */
    var xs = [], main = [], i;
    for (i = 0; i < 9; i++) xs.push(40 + i * 92);
    xs.forEach(function (x, i) { main.push(node(s, x, 300, '', i === 6 || i === 8 ? 'merge' : '', { r: 13 })); });
    var up = [node(s, xs[2] + 70, 170, '', 'feat', { r: 13 }), node(s, xs[3] + 70, 170, '', 'feat', { r: 13 }), node(s, xs[4] + 70, 170, '', 'feat', { r: 13 })];
    var dn = [node(s, xs[4] + 50, 430, '', 'remote', { r: 13 }), node(s, xs[5] + 80, 430, '', 'remote', { r: 13 })];
    var em = [];
    for (i = 0; i < 8; i++) em.push(edge(s, main[i], main[i + 1], 'main'));
    var eu = [edge(s, main[2], up[0], 'feat'), edge(s, up[0], up[1], 'feat'), edge(s, up[1], up[2], 'feat'), edge(s, up[2], main[6], 'feat')];
    var ed = [edge(s, main[4], dn[0], 'remote'), edge(s, dn[0], dn[1], 'remote'), edge(s, dn[1], main[8], 'remote')];
    var hp = ptr(s, 'HEAD -> main', xs[8], 252, 'head');
    q.step('');
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
    return q.finish();
  };

  /* ---------- 2005 timeline (DOM) ---------- */
  EX.history = function (stage, slide) {
    var q = Q(), narrow = window.innerWidth <= 620;
    var bar = slide.querySelector('.timeline .bar');
    q.step('BitKeeper thu hồi giấy phép miễn phí, Linus tự viết Git trong vài tuần.');
    q.add(narrow ? { targets: bar, scaleY: [0, 1], duration: 1400, easing: 'easeInOutQuart' } : { targets: bar, scaleX: [0, 1], duration: 1400, easing: 'easeInOutQuart' });
    q.add({ targets: slide.querySelectorAll('.timeline .ms'), opacity: [0, 1], translateY: [24, 0], duration: 600, delay: anime.stagger(380) }, 150);
    q.wait(1700);
    q.step('4 tiêu chí thiết kế của Git.');
    q.go({ targets: slide.querySelectorAll('.crit'), opacity: [0, 1], translateY: [20, 0], scale: [0.94, 1], duration: 600, delay: anime.stagger(140), easing: 'easeOutBack' });
    return q.finish();
  };

  /* ---------- snapshot vs diff ---------- */
  EX.snapshot = function (stage, slide) {
    var s = svg(stage, 640, 318), q = Q();
    var cols = [95, 245, 395, 545], BW = 118;
    cols.forEach(function (x, i) { txt(s, x, 22, 'C' + (i + 1), 'lbl b mid', { show: true }); });
    txt(s, 36, 52, 'SVN, CVS: file gốc + bản vá', 'lbl b', { show: true });
    var v1 = chip(s, cols[0], 80, BW, 'v1 gốc', 'staged', { info: 'File gốc ban đầu, SVN lưu đầy đủ một lần.' });
    var ds = [1, 2, 3].map(function (i) { return chip(s, cols[i], 80, BW, '+Δ' + (i + 1), 'mod', { info: 'Bản vá (delta): chỉ những dòng thay đổi so với lần trước.' }); });
    var plus = [1, 2, 3].map(function (i) { return txt(s, cols[i] - 75, 85, '+', 'lbl a mid'); });
    var comp = ['v1+Δ2', 'v1+Δ2+Δ3', 'v1+Δ2+Δ3+Δ4'].map(function (str, i) { var t = txt(s, cols[i + 1], 116, str, 'lbl a mid mono'); return t; });
    el('line', { x1: 36, y1: 138, x2: 604, y2: 138, stroke: 'rgba(255,255,255,.08)' }, s.B);
    txt(s, 36, 164, 'Git: mỗi commit là một ảnh chụp', 'lbl b', { show: true });
    var rows = [196, 236, 276], files = ['A', 'B', 'C'];
    var plan = [[1, 1, 1], [1, 0, 0], [0, 1, 0], [1, 0, 1]];
    var ver = [0, 0, 0], colEls = [];
    var hl = el('rect', { x: cols[3] - 68, y: 176, width: 136, height: 120, rx: 12, fill: 'rgba(74,222,128,.06)', stroke: 'rgba(74,222,128,.55)', 'stroke-width': 1.5 }, s.B);
    hl.style.opacity = 0;
    cols.forEach(function (cx, ci) {
      var flash = el('rect', { x: cx - 66, y: 176, width: 132, height: 120, rx: 10, fill: '#fff' }, s.T);
      flash.style.opacity = 0; flash.style.pointerEvents = 'none';
      var items = [], links = [];
      rows.forEach(function (ry, fi) {
        if (plan[ci][fi]) { ver[fi]++; items.push(chip(s, cx, ry, BW, files[fi] + ver[fi], 'staged', { info: 'File ' + files[fi] + ' có thay đổi: Git lưu bản mới ' + files[fi] + ver[fi] + '.' })); }
        else {
          items.push(chip(s, cx, ry, BW, '→ ' + files[fi] + ver[fi], 'link', { info: 'File ' + files[fi] + ' không đổi: Git chỉ lưu liên kết tới ' + files[fi] + ver[fi] + ', không tốn thêm dung lượng.' }));
          links.push(arrowLine(s, cx - BW / 2 - 3, ry, cols[ci - 1] + BW / 2 + 5, ry));
        }
      });
      colEls.push({ items: items, links: links, flash: flash });
    });
    q.step('SVN lưu file gốc v1 một lần.');
    q.go(drop(v1)).wait(300);
    q.step('Mỗi lần sửa, SVN chỉ chồng thêm một bản vá Δ.');
    ds.forEach(function (d, i) { q.add(drop(d, { duration: 650 }), i * 380); q.add(fade(plus[i], 1), i * 380 + 200); });
    q.wait(1600);
    q.step('Muốn xem phiên bản 4, SVN phải cộng dồn mọi bản vá từ v1. Càng về sau càng chậm.');
    comp.forEach(function (c, i) {
      q.add({ targets: c, opacity: [0, 1], translateY: [-6, 0], duration: 400 }, i * 600);
      q.add(pulse([v1].concat(ds.slice(0, i + 1)), { duration: 450 }), i * 600);
    });
    q.wait(2100);
    function shoot(ci) {
      var c = colEls[ci];
      q.add({ targets: c.flash, opacity: [0, 0.35, 0], duration: 420, easing: 'linear' });
      c.items.forEach(function (it) { q.add(stamp(it), 120); });
      c.links.forEach(function (l) { q.add(draw(l, { duration: 300 }), 480); });
      q.wait(900);
    }
    q.step('Git chụp lại toàn bộ file ở mỗi commit, như bấm máy ảnh.');
    shoot(0); shoot(1);
    q.step('File không đổi chỉ là liên kết (nét đứt) tới bản đã lưu. Click vào một ô để xem.');
    shoot(2); shoot(3);
    q.step('Checkout C4: lấy thẳng ảnh chụp C4, không cộng dồn gì cả.');
    q.go(fade(hl, 1, { duration: 400 })).add(pulse(colEls[3].items, { duration: 600 }));
    return q.finish();
  };

  /* ---------- commit hash ---------- */
  EX.hash = function (stage, slide) {
    var s = svg(stage, 640, 320), q = Q();
    var labels = ['Cây thư mục (tree)', 'Tác giả + email', 'Thời gian', 'Message: feat: login', 'Hash cha: 7d1e9a0'];
    var ys = [40, 100, 160, 220, 280];
    var chips = labels.map(function (l, i) { return chip(s, 125, ys[i], 226, l, '', { info: 'Thành phần ' + (i + 1) + ' của hash. Đổi bất kỳ thứ gì ở đây là ra hash khác.' }); });
    var arrows = ys.map(function (y) { return dash(el('path', { class: 'arrow', d: 'M242 ' + y + ' C276 ' + y + ' 276 160 310 160', 'marker-end': s.ah }, s.E)); });
    var box = fb(el('g', {}, s.N));
    el('rect', { x: 316, y: 118, width: 110, height: 84, rx: 14, fill: '#1a1210', stroke: '#f05033', 'stroke-width': 2 }, box);
    el('text', { x: 371, y: 156, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: '#ffd2c7' }, box, 'SHA-1');
    el('text', { x: 371, y: 178, 'text-anchor': 'middle', 'font-size': 12, fill: '#8d99ae' }, box, 'hàm băm');
    info(box, 'SHA-1', 'Hàm băm: cùng đầu vào luôn ra cùng hash, đổi 1 ký tự là ra hash khác hẳn.');
    box.style.opacity = 0;
    var out = arrowLine(s, 430, 160, 472, 160);
    var h1 = chip(s, 552, 160, 128, '0000000', 'staged', { info: 'Hash của commit gốc.' });
    var h2 = chip(s, 552, 240, 128, '0000000', 'mod', { info: 'Hash của commit mới sau khi "sửa".' });
    var oldLbl = txt(s, 552, 128, 'commit cũ vẫn còn', 'lbl mid');
    var newLbl = txt(s, 552, 284, 'commit MỚI', 'lbl a mid');
    q.step('Hash của commit được tính từ 5 thành phần.');
    chips.forEach(function (c, i) { q.add({ targets: c, opacity: [0, 1], translateX: [-30, 0], duration: 450, easing: 'easeOutCubic' }, i * 110); });
    q.wait(900);
    q.step('Cả 5 đi qua hàm băm SHA-1 ra hash a1b2c3d.');
    arrows.forEach(function (a, i) { q.add(draw(a, { duration: 380 }), i * 60); });
    q.wait(500).go(grow(box, { duration: 700 })).go(draw(out, { duration: 250 }));
    q.add(pop(h1, { duration: 300 })).scramble(h1.txt, '0000000', 'a1b2c3d', 1000).wait(1300);
    q.step('"Sửa" message: chỉ thêm một chữ "page"...');
    q.add({ targets: chips[3], translateX: [0, 10, 0], duration: 500, easing: 'easeInOutSine' });
    q.text(chips[3].txt, 'Message: feat: login page', 200).cls(chips[3], 'mod', null, 200).wait(900);
    q.step('...ra hash khác hẳn 9f3e7c1: một commit MỚI. a1b2c3d vẫn nằm nguyên, không ai sửa được.');
    arrows.forEach(function (a) { q.add({ targets: a, strokeDashoffset: [a.getTotalLength(), 0], duration: 380 }); });
    q.wait(420).add(pulse(box, { duration: 500 }));
    q.go(fade(oldLbl, 1), 200).go(pop(h2, { duration: 300 }));
    q.scramble(h2.txt, '0000000', '9f3e7c1', 1000).wait(1000).go(fade(newLbl, 1));
    return q.finish();
  };

  /* ---------- the 4 areas ---------- */
  EX.areas = function (stage, slide) {
    var vert = stage.clientWidth < 520;
    stage._layout = vert;
    var W = vert ? 360 : 760, H = vert ? 610 : 312;
    var s = svg(stage, W, H), q = Q();
    var names = ['Working Dir', 'Staging', 'Local Repo', 'Remote'];
    var subs = ['thư mục code', '.git/index', '.git', 'GitHub / GitLab'];
    var infos = ['File bạn đang sửa trên IDE. Chưa được Git bảo vệ.', 'Khu dàn cảnh (.git/index): những gì sẽ vào ảnh chụp tiếp theo.', 'Thư mục .git trên máy bạn: chứa toàn bộ lịch sử commit.', 'Kho trên GitHub/GitLab để cả team đồng bộ.'];
    var B = [];
    for (var i = 0; i < 4; i++) {
      var b = vert ? { x: 10, y: 10 + i * 150, w: 340, h: 118 } : { x: 10 + i * 190, y: 40, w: 170, h: 230 };
      B.push(b);
      info(el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 14, class: 'box' }, s.B), names[i], infos[i]);
      if (vert) { txt(s, b.x + 14, b.y + 26, names[i], 'lbl b', { show: true }); txt(s, b.x + 326, b.y + 26, subs[i], 'lbl sm', { show: true }).setAttribute('text-anchor', 'end'); }
      else { txt(s, b.x + 85, b.y + 28, names[i], 'lbl b mid', { show: true }); txt(s, b.x + 85, b.y + 48, subs[i], 'lbl sm mid', { show: true }); }
    }
    function slot(bi, k) { var b = B[bi]; return vert ? { x: b.x + 60 + k * 110, y: b.y + 76 } : { x: b.x + 85, y: b.y + 92 + k * 44 }; }
    var cw = vert ? 100 : 140;
    function arrowG(d, lx, ly, label, anchor) {
      var g = el('g', { class: 'ag' }, s.E);
      el('path', { d: d, class: 'arrow', 'marker-end': s.ah }, g);
      var t = el('text', { x: lx, y: ly, class: 'alabel' }, g, label);
      if (anchor) t.style.textAnchor = anchor;
      return g;
    }
    var A = {};
    if (vert) {
      A.add = arrowG('M110 130 L110 157', 98, 149, 'git add', 'end');
      A.commit = arrowG('M110 280 L110 307', 98, 299, 'git commit', 'end');
      A.push = arrowG('M110 430 L110 457', 98, 449, 'git push', 'end');
      A.restore = arrowG('M250 158 L250 131', 262, 149, 'restore', 'start');
      A.pull = arrowG('M250 458 L250 431', 262, 449, 'fetch / pull', 'start');
    } else {
      A.add = arrowG('M152 26 L218 26', 186, 16, 'git add');
      A.commit = arrowG('M342 26 L408 26', 376, 16, 'git commit');
      A.push = arrowG('M532 26 L598 26', 566, 16, 'git push');
      A.restore = arrowG('M218 290 L152 290', 186, 307, 'restore');
      A.pull = arrowG('M598 290 L532 290', 566, 307, 'fetch / pull');
    }
    var allA = s.querySelectorAll('.ag');
    function on(g) { q.cls(allA, null, 'on'); q.cls(g, 'on'); }
    function cnode(bi, k, label, cls, show, inf) { var p = slot(bi, k); return node(s, p.x, p.y, label, cls, { r: 15, show: show, info: inf }); }
    cnode(2, 0, 'c1', '', true); cnode(3, 0, 'c1', '', true);
    var files = ['login.js', 'api.js', 'README.md'].map(function (f, k) {
      var c = chip(s, 0, 0, cw, f, 'mod', { info: 'File ' + f + ' đã sửa.' }); var p = slot(0, k); place(c, p.x, p.y); return c;
    });
    var cam = el('rect', { x: B[2].x + 4, y: B[2].y + 4, width: B[2].w - 8, height: B[2].h - 8, rx: 12, fill: '#fff' }, s.T); cam.style.opacity = 0; cam.style.pointerEvents = 'none';
    var c2 = cnode(2, 1, 'c2', 'new', false, 'Snapshot chứa login.js và api.js.');
    var r2 = cnode(3, 1, 'c2', 'new', false, 'c2 đã lên remote.'); var l1 = slot(2, 1); place(r2, l1.x, l1.y);
    var r3 = cnode(3, 2, 'c3', 'remote');
    var l3 = cnode(2, 2, 'c3', 'remote'); var rp = slot(3, 2); place(l3, rp.x, rp.y);
    var upd = chip(s, 0, 0, cw, 'code c3', 'staged', { info: 'Code của c3 đã về Working Directory.' }); var w0 = slot(0, 0); place(upd, w0.x, w0.y);
    var L = term(slide, ['git add login.js api.js', 'git commit -m "feat: login"', 'git push origin main', { out: '# đồng đội vừa push c3', cls: 'cm' }, 'git pull', { out: 'Fast-forward  api.js | 4 ++--', cls: 'ok' }]);

    q.step('Sửa 3 file trong Working Directory. Lúc này Git chưa bảo vệ chúng.');
    files.forEach(function (f, k) { q.add(pop(f), k * 150); });
    q.wait(1000);
    q.step('git add: chỉ 2 file liên quan nhảy vào Staging. README.md ở lại.');
    q.type(L[0]); on(A.add);
    [0, 1].forEach(function (k) { var p = slot(1, k), o = slot(0, k); q.cls(files[k], 'staged', 'mod', k * 160 + 400); q.add(arc(files[k], p.x, p.y, 46, { duration: 850, fromY: o.y }), k * 160); });
    q.wait(1400);
    q.step('git commit: chụp Staging thành snapshot c2, lưu vĩnh viễn trong Local Repo.');
    q.type(L[1]); on(A.commit);
    var cp = slot(2, 1);
    [0, 1].forEach(function (k) { q.add(mv(files[k], cp.x, cp.y, { duration: 650, easing: 'easeInCubic' }), k * 80); q.add({ targets: files[k], scale: 0.1, opacity: 0, duration: 260, easing: 'easeInQuad' }, 450 + k * 80); });
    q.wait(700).add({ targets: cam, opacity: [0, 0.4, 0], duration: 420, easing: 'linear' }).go(stamp(c2, { duration: 400 })).wait(500);
    q.step('git push: gửi c2 lên Remote để cả team cùng thấy.');
    q.type(L[2]); on(A.push);
    q.add(fade(r2, 1, { duration: 150 })).go(arc(r2, r2.X, r2.Y, 40, { duration: 900, fromY: l1.y })).wait(400);
    q.step('Đồng đội push c3 lên Remote.');
    q.type(L[3]).go(drop(r3)).wait(400);
    q.step('git pull = fetch + merge: c3 về Local Repo, rồi Working Directory được cập nhật.');
    q.type(L[4]); on(A.pull);
    q.add(fade(l3, 1, { duration: 150 })).go(arc(l3, l3.X, l3.Y, 40, { duration: 900, fromY: rp.y }));
    q.go(pop(upd)).type(L[5]);
    return q.finish();
  };

  /* ---------- HEAD ---------- */
  EX.head = function (stage, slide) {
    var s = svg(stage, 640, 240), q = Q();
    var c = [node(s, 80, 170, 'c1'), node(s, 200, 170, 'c2'), node(s, 320, 170, 'c3'), node(s, 440, 170, 'c4')];
    var e = [edge(s, c[0], c[1], 'main'), edge(s, c[1], c[2], 'main'), edge(s, c[2], c[3], 'main')];
    var ring = fb(el('g', {}, s.B)); el('circle', { cx: 320, cy: 170, r: 27, fill: 'none', stroke: '#f05033', 'stroke-width': 2, 'stroke-dasharray': '4 5' }, ring); ring.X = 320; ring.Y = 170; ring.style.opacity = 0;
    var main = ptr(s, 'main', 320, 124, ''), head = ptr(s, 'HEAD', 320, 92, 'head'), feat = ptr(s, 'feat', 200, 124, 'feat');
    var L = term(slide, ['git commit -m "feat: thêm nút đăng nhập"', { out: '[main 4c2d9e1] feat: thêm nút đăng nhập', cls: 'out' }, 'git switch feat', { out: "Switched to branch 'feat'", cls: 'ok' }]);
    q.step('HEAD -> main -> c3: bạn đang đứng trên nhánh main (vòng cam là code đang mở).');
    seqPop(q, [c[0], e[0], c[1], e[1], c[2]]);
    q.add(pop(main)).add(pop(feat), 100).go(drop(head, { duration: 600 }), 200).go(fade(ring, 1));
    q.step('Commit mới: main tiến lên c4 và kéo HEAD theo, vì HEAD đang gắn vào main.');
    q.type(L[0]);
    q.go(draw(e[2])).add(pop(c[3]));
    q.add(mv(main, 440, 124)).add(mv(head, 440, 92, { delay: 80 })).go(mv(ring, 440, 170)).type(L[1]);
    q.step('git switch feat: HEAD nhảy sang tên nhánh feat. Working Directory đổi thành code của c2.');
    q.type(L[2]);
    q.add(arc(head, 200, 92, 40, { duration: 900 })).go(mv(ring, 200, 170, { duration: 900 })).type(L[3]);
    return q.finish();
  };

  /* ---------- detached HEAD ---------- */
  EX.detached = function (stage, slide, mode) {
    var fix = mode === 'fix';
    var s = svg(stage, 640, 300), q = Q();
    var c = [node(s, 70, 200, 'c1'), node(s, 180, 200, 'c2', '', { sub: 'a1b2c3d' }), node(s, 290, 200, 'c3'), node(s, 400, 200, 'c4')];
    edge(s, c[0], c[1], 'main', { show: true }); edge(s, c[1], c[2], 'main', { show: true }); edge(s, c[2], c[3], 'main', { show: true });
    var x1 = node(s, 290, 100, 'x1', fix ? 'feat' : 'warn'), x2 = node(s, 400, 100, 'x2', fix ? 'feat' : 'warn');
    var ex1 = edge(s, c[1], x1, fix ? 'feat' : ''), ex2 = edge(s, x1, x2, fix ? 'feat' : '');
    var main = ptr(s, 'main', 400, 246, ''), head = ptr(s, 'HEAD', 400, 278, 'head');
    var hook = el('path', { d: 'M400 259 L400 265', stroke: '#f05033', 'stroke-width': 3, 'stroke-linecap': 'round' }, s.P); hook.style.opacity = 0;
    var feat = ptr(s, 'feat/thu-nghiem', 180, 154, 'feat');
    var orphan = txt(s, 440, 105, 'commit mồ côi', 'lbl r');
    var lines = ['git checkout a1b2c3d', { out: "You are in 'detached HEAD' state.", cls: 'warn' }];
    if (fix) lines.push('git switch -c feat/thu-nghiem', { out: "Switched to a new branch 'feat/thu-nghiem'", cls: 'ok' });
    lines.push('git commit -m "thử nghiệm 1"', 'git commit -m "thử nghiệm 2"', 'git switch main');
    lines.push(fix ? { out: "Switched to branch 'main'", cls: 'ok' } : { out: 'Warning: you are leaving 2 commits behind, not connected to any of your branches', cls: 'err' });
    var L = term(slide, lines), li = 0;
    q.step('Bình thường HEAD móc vào nhánh: HEAD -> main -> c4.');
    c.forEach(function (n, i) { q.add(pop(n, { duration: 380 }), i * 90); });
    q.add(pop(main), 400).go(pop(head), 500).go(fade(hook, 1, { duration: 200 }));
    q.step('git checkout a1b2c3d: HEAD tuột khỏi nhánh và trôi tự do tới commit c2.');
    q.type(L[li++]);
    q.go(fade(hook, 0, { duration: 150 })).cls(head, 'danger', 'head');
    q.go({ targets: head, translateY: -10, rotate: -10, duration: 300, easing: 'easeOutQuad' });
    q.go({ targets: head, translateX: 180 - 400, translateY: [{ value: -170, duration: 600, easing: 'easeOutSine' }, { value: 154 - 278, duration: 600, easing: 'easeInOutSine' }], rotate: [{ value: 8, duration: 600 }, { value: 0, duration: 600 }], duration: 1200, easing: 'easeInOutSine' });
    q.type(L[li++]);
    if (fix) {
      q.step('Tạo nhánh ngay: git switch -c. HEAD móc lại vào feat/thu-nghiem.');
      q.type(L[li++]);
      q.cls(head, 'head', 'danger').add(mv(head, 180, 124, { duration: 500, easing: 'easeOutBack' })).go(pop(feat)).type(L[li++]);
    }
    q.step(fix ? 'Commit mới nằm trên nhánh feat/thu-nghiem, nhánh tiến lên theo từng commit.' : 'Commit mới chỉ có HEAD giữ, không nhánh nào trỏ tới chúng.');
    q.type(L[li++]);
    q.go(draw(ex1)).add(pop(x1));
    if (fix) q.add(mv(feat, 290, 54)).go(mv(head, 290, 24)); else q.go(mv(head, 290, 54));
    q.type(L[li++]);
    q.go(draw(ex2)).add(pop(x2));
    if (fix) q.add(mv(feat, 400, 54)).go(mv(head, 400, 24)); else q.go(mv(head, 400, 54));
    q.step(fix ? 'Về main thoải mái: feat/thu-nghiem vẫn giữ x1, x2. Không mất gì.' : 'git switch main: HEAD móc lại vào main. x1, x2 thành commit mồ côi.');
    q.type(L[li++]);
    q.cls(head, 'head', 'danger').go(mv(head, 400, 278, { duration: 1000 })).go(fade(hook, 1, { duration: 200 })).type(L[li++]);
    if (fix) {
      q.cls([x1, x2], 'new', 'feat').add(pulse([x1, x2]));
    } else {
      q.cls([x1, x2], 'junk', 'warn');
      q.add(fade([ex1, ex2], 0.35)).go(fade(orphan, 1));
      q.step('Garbage Collector dọn rác: x1, x2 bị xóa vĩnh viễn.');
      q.go({ targets: [x1, x2, ex1, ex2, orphan], opacity: 0, translateY: 30, duration: 1300, easing: 'easeInQuad', delay: anime.stagger(120) });
    }
    return q.finish();
  };

  /* ---------- fast-forward ---------- */
  EX.ff = function (stage, slide) {
    var s = svg(stage, 640, 240), q = Q();
    var c1 = node(s, 80, 150, 'c1'), c2 = node(s, 200, 150, 'c2'), c3 = node(s, 320, 150, 'c3', 'feat'), c4 = node(s, 440, 150, 'c4', 'feat');
    var glow = el('path', { class: 'e glow', d: 'M200 150 L440 150' }, s.B); dash(glow);
    var e12 = edge(s, c1, c2, 'main'), e23 = edge(s, c2, c3, 'feat'), e34 = edge(s, c3, c4, 'feat');
    var main = ptr(s, 'main', 200, 104), head = ptr(s, 'HEAD', 200, 72, 'head'), feat = ptr(s, 'feat/login', 200, 196, 'feat');
    var L = term(slide, ['git switch -c feat/login', { out: '# ... commit c3, c4', cls: 'cm' }, 'git switch main', 'git merge feat/login', { out: 'Updating 3e1f2a0..9c8d7b6', cls: 'out' }, { out: 'Fast-forward', cls: 'ok' }]);
    q.step('main đang ở c2. Tạo nhánh feat/login tại đây.');
    seqPop(q, [c1, e12, c2]);
    q.add(pop(main)).add(pop(head), 100).type(L[0]).go(pop(feat));
    q.step('Commit c3, c4 trên feat/login: con trỏ feat/login tiến theo. main đứng yên.');
    q.type(L[1]);
    q.go(draw(e23)).add(pop(c3)).go(mv(feat, 320, 196, { duration: 500 }));
    q.go(draw(e34)).add(pop(c4)).go(mv(feat, 440, 196, { duration: 500 }));
    q.step('git merge feat/login: không cần commit mới. Nhãn main chỉ trượt dọc đường có sẵn tới c4.');
    q.type(L[2]).type(L[3]);
    q.add(draw(glow, { duration: 900, easing: 'easeInOutQuad' })).add(mv(main, 440, 104, { duration: 900, easing: 'easeInOutQuad' })).go(mv(head, 440, 72, { duration: 900, easing: 'easeInOutQuad' }));
    q.type(L[4]).type(L[5]);
    return q.finish();
  };

  /* ---------- merge vs --no-ff ---------- */
  EX.noff = function (stage, slide) {
    var s = svg(stage, 640, 420), q = Q();
    el('rect', { x: 2, y: 2, width: 636, height: 196, rx: 14, class: 'panel-bg' }, s.B);
    el('rect', { x: 2, y: 214, width: 636, height: 204, rx: 14, class: 'panel-bg' }, s.B);
    panelTitle(s, 0, 'git merge feat/login (mặc định)');
    panelTitle(s, 212, 'git merge --no-ff feat/login');
    var ay = 120;
    var a = [node(s, 70, ay, 'c1', '', { show: true }), node(s, 180, ay, 'c2', '', { show: true }), node(s, 290, ay, 'f1', 'feat', { show: true }), node(s, 400, ay, 'f2', 'feat', { show: true })];
    edge(s, a[0], a[1], 'main', { show: true }); edge(s, a[1], a[2], 'feat', { show: true }); edge(s, a[2], a[3], 'feat', { show: true });
    var aglow = el('path', { class: 'e glow', d: 'M180 ' + ay + ' L400 ' + ay }, s.B); dash(aglow);
    var amain = ptr(s, 'main', 180, ay + 42, '', { show: true }); ptr(s, 'feat/login', 400, ay - 42, 'feat', { show: true });
    var by = 368, bl = 296;
    var b1 = node(s, 70, by, 'c1', '', { show: true }), b2 = node(s, 180, by, 'c2', '', { show: true }), bf1 = node(s, 290, bl, 'f1', 'feat', { show: true }), bf2 = node(s, 400, bl, 'f2', 'feat', { show: true });
    edge(s, b1, b2, 'main', { show: true }); edge(s, b2, bf1, 'feat', { show: true }); edge(s, bf1, bf2, 'feat', { show: true });
    var bmain = ptr(s, 'main', 180, by + 34, '', { show: true });
    ptr(s, 'feat/login', 400, bl - 40, 'feat', { show: true });
    var M = node(s, 520, by, 'M', 'merge', { info: 'Merge commit M: 2 cha (c2 và f2). Revert cả tính năng chỉ cần git revert -m 1 M.' });
    var eM1 = edge(s, b2, M, 'main', { d: 'M180 ' + by + ' C350 ' + by + ' 350 ' + by + ' 520 ' + by });
    var eM2 = edge(s, bf2, M, 'feat');
    var ra = txt(s, 470, ay + 5, '1 đường thẳng', 'lbl g');
    var rb = txt(s, 350, by - 14, 'merge bubble', 'lbl o mid');
    q.step('Cùng tình huống: main không có commit mới từ lúc feat/login tách ra.');
    q.wait(600);
    q.step('Mặc định (fast-forward): nhãn main trượt dọc đường có sẵn tới f2. Mất dấu nhánh.');
    q.add(draw(aglow, { duration: 900 })).go(mv(amain, 400, ay + 42, { duration: 900, easing: 'easeInOutQuad' })).go(fade(ra, 1));
    q.step('--no-ff: hai đường cùng vẽ về một điểm mới...');
    q.add(draw(eM1, { duration: 800 })).go(draw(eM2, { duration: 800 }));
    q.step('...merge commit M mọc ra với 2 cha, main nhảy lên M. Cả tính năng gom trong một "bong bóng".');
    q.go(grow(M)).add(mv(bmain, 520, by + 34, { duration: 700 })).go(fade(rb, 1));
    return q.finish();
  };

  /* ---------- merge vs rebase ---------- */
  EX.mr = function (stage, slide) {
    var s = svg(stage, 640, 440), q = Q();
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
    var n1 = node(s, 380, B.my, "f1'", 'new', { sub: 'a1f', info: "f1' là bản phát lại của f1 trên đỉnh main: cùng nội dung, cha khác nên hash khác." });
    var n2 = node(s, 490, B.my, "f2'", 'new', { sub: 'b2e', info: "f2' là bản phát lại của f2: hash mới." });
    place(n1, 270, B.ly - 26); place(n2, 380, B.ly - 26);
    var eB1 = edge(s, B.m3, n1, 'new', { d: 'M270 ' + B.my + ' C325 ' + B.my + ' 325 ' + B.my + ' 380 ' + B.my }), eB2 = edge(s, n1, n2, 'new');
    q.step('main có m3, feat có f1, f2. Hai cách tích hợp.');
    q.wait(500);
    q.step('merge: hai đường vẽ về một merge commit M mới. Hash cũ giữ nguyên.');
    q.add(draw(eA1, { duration: 600 })).go(draw(eA2, { duration: 600 })).go(grow(M)).go(mv(A.main, 490, A.my + 40, { duration: 600 }));
    q.step('rebase: f1, f2 được nhấc khỏi gốc cũ.');
    q.add({ targets: [B.f1, B.f2], translateY: -26, duration: 600, easing: 'easeOutBack', delay: anime.stagger(120) });
    q.add({ targets: [B.ef1, B.ef2], opacity: 0.15, duration: 500 });
    q.add(fade([n1, n2], 0.9, { duration: 1 }), 700);
    ghost(q, [B.f1, B.f2], 0.28, 700);
    q.wait(900);
    q.step("Phát lại f1 lên đỉnh main: thành f1', hash đổi a1f -> c9e.");
    q.go(arc(n1, 380, B.my, 30, { duration: 900, fromY: B.ly - 26 })).go(draw(eB1, { duration: 300 }));
    q.scramble(n1.sub, 'a1f', 'c9e', 700).wait(800);
    q.step("Rồi f2 -> f2' (b2e -> d4a). Nhãn feat đi theo. Lịch sử thành một đường thẳng.");
    q.go(arc(n2, 490, B.my, 30, { duration: 900, fromY: B.ly - 26 })).go(draw(eB2, { duration: 300 }));
    q.scramble(n2.sub, 'b2e', 'd4a', 700).add(mv(B.feat, 490, B.my - 42, { duration: 700 })).wait(800);
    return q.finish();
  };

  /* ---------- pull vs pull --rebase ---------- */
  EX.pull = function (stage, slide) {
    var s = svg(stage, 640, 440), q = Q();
    function panel(y0, title) {
      el('rect', { x: 2, y: y0 + 2, width: 636, height: 212, rx: 14, class: 'panel-bg' }, s.B);
      panelTitle(s, y0, title);
      var my = y0 + 156, ly = y0 + 86;
      var c1 = node(s, 60, my, 'c1', '', { show: true }), c2 = node(s, 160, my, 'c2', '', { show: true }), L1 = node(s, 270, my, 'L1', 'feat', { show: true, info: 'Commit của bạn, chưa push.' });
      edge(s, c1, c2, 'main', { show: true }); var eL = edge(s, c2, L1, 'feat', { show: true });
      var R1 = node(s, 270, ly, 'R1', 'remote');
      var eR = edge(s, c2, R1, 'remote');
      var dev = ptr(s, 'develop', 270, my + 40, 'feat', { show: true });
      var org = ptr(s, 'origin/develop', 270, ly - 40, 'remote');
      return { my: my, ly: ly, c2: c2, L1: L1, eL: eL, R1: R1, eR: eR, dev: dev, org: org };
    }
    var A = panel(0, 'git pull  (fetch + merge)'), B = panel(224, 'git pull --rebase  (fetch + rebase)');
    var M = node(s, 390, A.my, 'M', 'junk');
    var eM1 = edge(s, A.L1, M, 'feat'), eM2 = edge(s, A.R1, M, 'remote');
    var junk = txt(s, 416, A.my + 5, "Merge branch 'develop' of...", 'lbl r sm');
    var Ln = node(s, 390, B.ly, "L1'", 'new', { info: "L1' là L1 được xếp lên trên R1 (hash mới)." }); place(Ln, 270, B.my - 24);
    var eLn = edge(s, B.R1, Ln, 'new');
    q.step('Bạn có L1 chưa push. Đồng đội đã push R1 lên remote.');
    q.wait(500);
    q.step('Bước fetch giống nhau: R1 rơi về máy.');
    [A, B].forEach(function (P) { q.add(drop(P.R1)).add(draw(P.eR), 500).add(pop(P.org), 700); });
    q.wait(1300);
    q.step('git pull (merge): một commit rác "Merge branch..." mọc ra để nối hai đầu.');
    q.add(draw(eM1)).go(draw(eM2)).go(grow(M, { easing: 'easeOutBack', duration: 600 })).add(mv(A.dev, 390, A.my + 40)).go(fade(junk, 1)).add(shake(junk));
    q.wait(400);
    q.step("git pull --rebase: L1 được nhấc lên rồi đặt lên trên R1 thành L1'. Thẳng tắp.");
    q.add({ targets: B.L1, translateY: -24, duration: 500, easing: 'easeOutBack' }).add(fade(B.eL, 0.15));
    q.add(fade(Ln, 0.9, { duration: 1 }), 500); ghost(q, B.L1, 0.25, 500);
    q.wait(600).go(arc(Ln, 390, B.ly, 30, { duration: 900, fromY: B.my - 24 })).go(draw(eLn, { duration: 300 })).add(mv(B.dev, 390, B.ly - 40, { duration: 700 })).wait(700);
    return q.finish();
  };

  /* ---------- reset soft / mixed / hard ---------- */
  EX.reset = function (stage, slide, mode) {
    mode = mode || 'soft';
    var s = svg(stage, 640, 350), q = Q();
    var c1 = node(s, 140, 72, 'c1', '', { show: true }), c2 = node(s, 260, 72, 'c2', '', { show: true }), c3 = node(s, 380, 72, 'c3', '', { show: true, info: 'Commit c3 chứa thay đổi a.js, b.js.' });
    edge(s, c1, c2, 'main', { show: true }); var e3 = edge(s, c2, c3, 'main', { show: true });
    var hp = ptr(s, 'HEAD -> main', 380, 28, 'head', { show: true });
    var BX = [20, 225, 430], titles = ['Lịch sử commit', 'Staging (index)', 'Working Dir'];
    var binfo = ['Local Repo: chuỗi commit.', 'Vùng git add.', 'File trên ổ cứng.'];
    var boxes = BX.map(function (x, i) {
      var r = info(el('rect', { x: x, y: 132, width: 190, height: 200, rx: 14, class: 'box' }, s.B), titles[i], binfo[i]);
      txt(s, x + 95, 160, titles[i], 'lbl b mid', { show: true });
      return r;
    });
    var hist = [['c3', 'thêm a.js, b.js'], ['c2', 'feat: form'], ['c1', 'init']].map(function (r, i) {
      var t = txt(s, 40, 205 + i * 30, '', 'lbl mono', { show: true });
      el('tspan', { fill: '#5aa9ff', 'font-weight': 700 }, t, r[0] + '  ');
      el('tspan', {}, t, r[1]);
      return t;
    });
    var strike = el('path', { d: 'M34 200 L196 200', stroke: '#f87171', 'stroke-width': 2.5 }, s.T); dash(strike);
    var clean = [txt(s, 320, 240, 'sạch', 'lbl mid', { show: true }), txt(s, 525, 240, 'sạch', 'lbl mid', { show: true })];
    var st = [txt(s, 115, 314, 'Hủy c3', 'lbl r mid'), txt(s, 320, 314, '', 'lbl mid'), txt(s, 525, 314, '', 'lbl mid')];
    function mk(k, cls) { var c = chip(s, 0, 0, 120, k ? 'b.js' : 'a.js', cls, { info: 'Thay đổi từng nằm trong c3.' }); place(c, 380, 72); anime.set(c, { scale: 0.3 }); return c; }
    var stg = [mk(0, 'staged'), mk(1, 'staged')], wd = [mk(0, 'mod'), mk(1, 'mod')];
    var L = term(slide, ['git reset --' + mode + ' HEAD~1', { out: mode === 'hard' ? 'HEAD is now at 7d1e9a0 feat: form' : 'Unstaged changes after reset:', cls: mode === 'hard' ? 'warn' : 'out' }]);
    q.step('Trước reset: HEAD ở c3, Staging và Working Dir đều sạch.');
    q.wait(500);
    q.step('git reset --' + mode + ' HEAD~1: con trỏ tua ngược về c2, c3 bị gỡ khỏi lịch sử.');
    q.type(L[0]);
    q.add(mv(hp, 260, 28, { duration: 900, easing: 'easeInOutBack' })).add(fade(e3, 0.25)); ghost(q, c3, 0.3);
    q.go(draw(strike, { duration: 500 }), 400).add(fade(hist[0], 0.4)).go(fade(st[0], 1));
    q.step('Thay đổi của c3 rơi xuống các vùng...');
    q.add(fade(clean, 0, { duration: 250 }));
    function fly(c, bi, k, d) { q.add({ targets: c, opacity: [0, 1], duration: 150 }, d); q.add({ targets: c, translateX: BX[bi] + 95 - c.X, translateY: 212 + k * 44 - c.Y, scale: 1, duration: 800, easing: 'easeOutBack' }, d); }
    if (mode === 'soft') { fly(stg[0], 1, 0, 0); fly(stg[1], 1, 1, 120); fly(wd[0], 2, 0, 240); fly(wd[1], 2, 1, 360); }
    else { fly(wd[0], 2, 0, 0); fly(wd[1], 2, 1, 140); }
    q.wait(1200);
    if (mode === 'soft') {
      q.step('--soft: Staging GIỮ, Working GIỮ. Chỉ hủy commit, sẵn sàng commit lại (sửa message, thêm file quên add).');
      q.text(st[1], 'Giữ nguyên').text(st[2], 'Giữ nguyên').cls([st[1], st[2]], 'g').cls([boxes[1], boxes[2]], 'keep');
      q.add(fade([st[1], st[2]], 1)).add(pulse(stg.concat(wd), { duration: 500 }));
    } else if (mode === 'mixed') {
      q.step('--mixed (mặc định): Staging BỊ XÓA (bỏ git add), Working GIỮ. Tách lại thành commit nhỏ.');
      q.text(st[1], 'Xóa (bỏ git add)').cls(st[1], 'r').cls(boxes[1], 'drop').text(st[2], 'Giữ nguyên').cls(st[2], 'g').cls(boxes[2], 'keep');
      q.add(fade([st[1], st[2]], 1)).add(fade(clean[0], 1)).type(L[1]);
    } else {
      q.step('--hard: Staging và Working đều BỊ XÓA, quay về đúng c2. File untracked vẫn còn.');
      q.cls(wd, 'key', 'mod').add(wobble(wd)).wait(450);
      q.go({ targets: wd, scale: 0, opacity: 0, rotate: 25, duration: 450, easing: 'easeInBack' });
      q.text(st[1], 'Xóa sạch').text(st[2], 'Xóa sạch').cls([st[1], st[2]], 'r').cls([boxes[1], boxes[2]], 'drop');
      q.add(fade([st[1], st[2]], 1)).add(fade(clean, 1)).type(L[1]);
    }
    q.wait(600);
    return q.finish();
  };

  /* ---------- cherry-pick ---------- */
  EX.cherry = function (stage, slide) {
    var s = svg(stage, 640, 300), q = Q();
    var c1 = node(s, 70, 96, 'c1'), c2 = node(s, 170, 96, 'c2'), c3 = node(s, 270, 96, 'c3');
    var v1 = node(s, 270, 210, 'v1', 'feat'), fx = node(s, 370, 210, '8f9', 'bad', { sub: 'vá bảo mật', info: 'Commit 8f9a1b2: bản vá bảo mật nằm giữa nhánh feat/v2 còn dở.' }), v3 = node(s, 470, 210, 'v3', 'feat');
    var es = [edge(s, c1, c2, 'main'), edge(s, c2, c3, 'main'), edge(s, c2, v1, 'feat'), edge(s, v1, fx, 'feat'), edge(s, fx, v3, 'feat')];
    var ring = fb(el('circle', { cx: 370, cy: 210, r: 27, fill: 'none', stroke: '#fbbf24', 'stroke-width': 2, 'stroke-dasharray': '4 5' }, s.B)); ring.style.opacity = 0;
    var cp = node(s, 370, 96, '8f9', 'new', { sub: '8f9a1b2', info: 'Bản sao của bản vá trên main: cùng nội dung, hash mới e4d5f6a.' }); place(cp, 370, 210);
    var ecp = edge(s, c3, cp, 'new');
    var main = ptr(s, 'main', 270, 52), head = ptr(s, 'HEAD', 270, 22, 'head'), feat = ptr(s, 'feat/v2', 470, 256, 'feat');
    var L = term(slide, ['git switch main', 'git cherry-pick 8f9a1b2', { out: '[main e4d5f6a] fix: vá lỗi bảo mật', cls: 'ok' }, { out: ' 1 file changed, 3 insertions(+), 1 deletion(-)', cls: 'out' }]);
    q.step('Đứng ở main. feat/v2 còn làm dở, chưa merge được.');
    seqPop(q, [c1, es[0], c2, es[1], c3, es[2], v1, es[3], fx, es[4], v3], 90);
    q.add(pop(main)).add(pop(head), 100).go(pop(feat), 200);
    q.step('Nhưng commit 8f9a1b2 là bản vá bảo mật cần deploy ngay.');
    q.type(L[0]).add(fade(ring, 1)).go(pulse(fx, { duration: 700 }));
    q.step('git cherry-pick 8f9a1b2: một bản sao tách ra khỏi commit đó...');
    q.type(L[1]);
    q.add(fade(cp, 0.85, { duration: 150 })).go({ targets: cp, translateX: 18, translateY: 96, duration: 500, easing: 'easeOutQuad' });
    q.step('...bay lên main và đáp xuống với hash mới e4d5f6a (vì cha giờ là c3).');
    q.go(arc(cp, 370, 96, 30, { duration: 900, fromY: 192 })).go(draw(ecp, { duration: 300 })).add(fade(cp, 1));
    q.scramble(cp.sub, '8f9a1b2', 'e4d5f6a', 800).add(mv(main, 370, 52)).go(mv(head, 370, 22));
    q.type(L[2]).type(L[3]);
    q.step('feat/v2 không bị đụng tới: vẫn đủ v1, 8f9, v3.');
    q.go(pulse([feat, v1, fx, v3], { duration: 600 }));
    return q.finish();
  };

  /* ---------- worktree ---------- */
  EX.worktree = function (stage, slide) {
    var s = svg(stage, 640, 320), q = Q();
    function folder(x, y, title, branch, bcol, line3, inf) {
      var g = fb(el('g', {}, s.N)), w = 230, h = 128, tw = 70;
      el('path', { d: 'M' + x + ' ' + y + ' h' + tw + ' l12 12 h' + (w - tw - 12) + ' v' + (h - 12) + ' h' + (-w) + ' z', fill: '#121722', stroke: 'rgba(255,255,255,.2)', 'stroke-width': 1.5 }, g);
      txt(s, x + 16, y + 42, title, 'lbl b', { show: true, parent: g });
      var b = txt(s, x + 16, y + 68, branch, 'lbl mono', { show: true, parent: g }); b.style.fill = bcol;
      g.l3 = txt(s, x + 34, y + 98, line3, 'lbl sm', { show: true, parent: g });
      g.X = x; g.Y = y; g.style.opacity = 0;
      return info(g, title, inf);
    }
    var f2 = folder(380, 30, 'project-hotfix/', 'hotfix/urgent-bug', '#f87171', 'IDE cửa sổ thứ 2', 'Worktree thứ 2: thư mục riêng, nhánh riêng, cùng một .git.');
    el('circle', { cx: 404, cy: 124, r: 6, fill: '#22d3ee' }, f2);
    var f1 = folder(30, 30, 'project/', 'feat/big-feature', '#a78bfa', 'server :3000 đang chạy', 'Thư mục chính: đang code dở, server đang chạy.');
    el('circle', { cx: 54, cy: 124, r: 6, fill: '#4ade80', class: 'pulse' }, f1);
    var db = fb(el('g', {}, s.N));
    el('path', { d: 'M250 230 v46 a70 14 0 0 0 140 0 v-46', fill: '#141a26', stroke: '#f05033', 'stroke-width': 2 }, db);
    el('ellipse', { cx: 320, cy: 230, rx: 70, ry: 14, fill: '#1e2636', stroke: '#f05033', 'stroke-width': 2 }, db);
    el('text', { x: 320, y: 266, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, fill: '#ffd2c7' }, db, '.git');
    info(db, '.git', 'Một cơ sở dữ liệu duy nhất: mọi worktree đọc và ghi commit vào đây.');
    db.style.opacity = 0;
    var k1 = el('path', { class: 'e dash', d: 'M145 158 C145 205 220 230 252 234' }, s.E); k1.style.opacity = 0;
    var k2 = el('path', { class: 'e dash', d: 'M495 158 C495 205 420 230 388 234' }, s.E); k2.style.opacity = 0;
    var fixc = node(s, 570, 126, 'fix', 'new', { r: 14 });
    place(f2, 30, 30);
    var L = term(slide, ['git worktree add ../project-hotfix hotfix/urgent-bug', { out: "Preparing worktree (checking out 'hotfix/urgent-bug')", cls: 'ok' }, { out: '# mở ../project-hotfix bằng IDE thứ 2', cls: 'cm' }, 'git commit -am "fix: urgent bug" && git push', 'git worktree remove ../project-hotfix']);
    q.step('Đang code dở feat/big-feature, server đang chạy. Có hotfix gấp!');
    q.add(pop(f1, { duration: 500 })).add(pop(db, { duration: 500 }), 200).go(fade(k1, 1), 500);
    q.step('git worktree add: thư mục tách đôi thành hai cửa sổ song song, chung một .git.');
    q.type(L[0]);
    q.add(fade(f2, 1, { duration: 200 })).add({ targets: f1, scale: [1, 0.96, 1], duration: 600 }).go(mv(f2, 380, 30, { duration: 1000, easing: 'easeOutExpo' }));
    q.go(fade(k2, 1, { duration: 300 })).type(L[1]);
    q.step('Fix và push ngay trong project-hotfix/. Commit ghi vào cùng .git.');
    q.type(L[2]).type(L[3]).go(pop(fixc)).add(pulse(db, { duration: 600 }));
    q.step('Xong thì xóa worktree. Server ở folder 1 chạy suốt: không stash, không build lại.');
    q.type(L[4]);
    q.add(fade(fixc, 0, { duration: 300 })).add(fade(k2, 0, { duration: 300 })).go({ targets: f2, opacity: 0, scale: 0.85, duration: 600, easing: 'easeInQuad' });
    q.add(pulse(f1, { duration: 700 }));
    return q.finish();
  };

  /* ---------- tag ---------- */
  EX.tag = function (stage, slide) {
    var s = svg(stage, 640, 250), q = Q();
    var xs = [70, 180, 290, 400, 510], c = xs.map(function (x, i) { return node(s, x, 140, 'c' + (i + 1)); });
    var e = [0, 1, 2, 3].map(function (i) { return edge(s, c[i], c[i + 1], 'main'); });
    var main = ptr(s, 'main', 180, 96);
    var pin = el('path', { d: 'M180 158 L180 175', stroke: '#fbbf24', 'stroke-width': 2 }, s.E); pin.style.opacity = 0;
    var tag = ptr(s, 'v1.0.0', 180, 190, 'tag');
    var org = fb(el('g', {}, s.N));
    el('rect', { x: 540, y: 196, width: 90, height: 36, rx: 10, fill: '#0f2a33', stroke: '#22d3ee', 'stroke-width': 1.5 }, org);
    el('text', { x: 585, y: 219, 'text-anchor': 'middle', 'font-size': 14, fill: '#a5f3fc' }, org, 'origin');
    info(org, 'origin', 'Remote. Tag chỉ lên đây khi push riêng.');
    org.style.opacity = 0;
    var fly = ptr(s, 'v1.0.0', 180, 190, 'tag');
    var L = term(slide, ['git tag -a v1.0.0 -m "Release version 1.0.0: Production stable"', { out: '# ... 3 commit mới sau đó', cls: 'cm' }, 'git push origin v1.0.0', { out: ' * [new tag]         v1.0.0 -> v1.0.0', cls: 'ok' }]);
    q.step('Bản ổn định nằm ở c2.');
    seqPop(q, [c[0], e[0], c[1]]); q.go(pop(main));
    q.step('Đóng đinh tag v1.0.0 vào c2. Annotated tag lưu người tạo, ngày giờ, thông điệp.');
    q.type(L[0]).go(drop(tag, { duration: 900 })).go(fade(pin, 1, { duration: 200 }));
    q.step('Commit mới: main chạy tiếp tới c5. v1.0.0 đứng yên tại c2.');
    q.type(L[1]);
    for (var i = 1; i < 4; i++) { q.go(draw(e[i], { duration: 300 })).add(pop(c[i + 1], { duration: 380 })).go(mv(main, xs[i + 1], 96, { duration: 500 })); }
    q.add(pulse(tag, { duration: 700 })).wait(500);
    q.step('git push thường KHÔNG đẩy tag. Phải push riêng (hoặc --tags).');
    q.type(L[2]).go(pop(org, { duration: 400 }));
    q.add(fade(fly, 1, { duration: 100 })).go(arc(fly, 585, 186, 60, { duration: 1000 }));
    q.go(fade(fly, 0, { duration: 300 })).add(pulse(org)).type(L[3]);
    return q.finish();
  };

  /* ---------- branching strategy ---------- */
  EX.flow = function (stage, slide) {
    var s = svg(stage, 640, 290), q = Q();
    var lanes = [[60, 'main', 'Production'], [150, 'develop', 'Staging'], [240, 'feat/PROJ-105', 'Feature']];
    lanes.forEach(function (l) {
      txt(s, 12, l[0] - 4, l[1], 'lbl b mono', { show: true });
      txt(s, 12, l[0] + 16, l[2], 'lbl sm', { show: true });
      el('path', { d: 'M130 ' + l[0] + ' L630 ' + l[0], stroke: 'rgba(255,255,255,.07)', 'stroke-width': 2, 'stroke-dasharray': '3 6' }, s.B);
    });
    var m1 = node(s, 150, 60, 'm1'), d1 = node(s, 210, 150, 'd1', 'remote', { info: 'Commit trên develop (Staging).' }), f1 = node(s, 300, 240, 'f1', 'feat'), f2 = node(s, 380, 240, 'f2', 'feat');
    var d2 = node(s, 470, 150, 'd2', 'merge', { info: 'Feature đã gộp vào develop sau khi PR được approve.' }), m2 = node(s, 570, 60, 'm2', 'merge', { info: 'Phát hành: develop gộp vào main.' });
    var e1 = edge(s, m1, d1, 'remote'), e2 = edge(s, d1, f1, 'feat'), e3 = edge(s, f1, f2, 'feat');
    var e4 = edge(s, f2, d2, 'feat'), e5 = edge(s, d1, d2, 'remote'), e6 = edge(s, m1, m2, 'main'), e7 = edge(s, d2, m2, 'remote');
    var pr = chip(s, 490, 240, 150, 'PR #42 approved', 'staged', { info: 'Pull Request: ít nhất 1 người review, CI xanh.' });
    var tag = ptr(s, 'v1.2.0', 570, 22, 'tag');
    var lock = ptr(s, 'protected', 360, 30, 'grey', { info: 'Protected branch: không ai push thẳng vào main.' });
    q.step('main = Production (khóa push thẳng), develop = Staging.');
    q.add(pop(m1)).add(pop(lock), 200).go(draw(e1), 300).go(pop(d1));
    q.step('Mọi việc bắt đầu bằng một nhánh tính năng tách từ develop.');
    q.go(draw(e2)).go(pop(f1)).go(draw(e3)).go(pop(f2));
    q.step('Mở Pull Request: review và CI chạy tự động.');
    q.go({ targets: pr, opacity: [0, 1], translateX: [-40, 0], duration: 600, easing: 'easeOutBack' });
    q.step('Approve xong mới gộp vào develop để test trên Staging.');
    q.add(draw(e5, { duration: 600 })).go(draw(e4, { duration: 600 })).go(grow(d2, { duration: 700 }));
    q.step('Ổn định thì phát hành lên main và gắn tag.');
    q.add(draw(e6, { duration: 700 })).go(draw(e7, { duration: 700 })).go(grow(m2, { duration: 700 })).go(drop(tag));
    return q.finish();
  };

  /* ---------- conventional commit anatomy (DOM) ---------- */
  EX.conv = function (stage, slide) {
    var q = Q(), segs = stage.querySelectorAll('.seg'), tags = stage.querySelectorAll('.tg'), rest = stage.querySelectorAll('.body, .foot');
    var caps = ['type: loại thay đổi (feat, fix, refactor, ...).', 'scope: phạm vi, module bị ảnh hưởng.', 'mô tả: ngắn gọn, thì hiện tại, không viết hoa đầu câu.'];
    anime.set(segs, { opacity: 0.15 }); anime.set(tags, { opacity: 0 }); anime.set(rest, { opacity: 0 });
    [0, 1, 2].forEach(function (i) {
      q.step(caps[i]);
      q.add({ targets: segs[i], opacity: [0.15, 1], translateY: [10, 0], duration: 500 }).go({ targets: tags[i], opacity: [0, 1], translateY: [-8, 0], duration: 500 }, 200);
    });
    q.step('Body giải thích TẠI SAO, footer liên kết ticket.');
    q.go({ targets: rest, opacity: [0, 1], translateX: [-12, 0], duration: 500, delay: anime.stagger(300) });
    return q.finish();
  };

  /* ---------- daily 6 steps ---------- */
  EX.daily = function (stage, slide) {
    var q = Q(), lis = [].slice.call(slide.querySelectorAll('.steps li'));
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
    plan.forEach(function (p, i) {
      q.step(lis[i].textContent);
      lis.forEach(function (li, j) { q.cls(li, j === i ? 'on' : (j < i ? 'done' : null), j === i ? 'done' : 'on'); });
      q.wait(200);
      p.forEach(function () { q.type(L[k++]); });
      q.wait(500);
    });
    return q.finish();
  };

  /* ---------- git hooks ---------- */
  EX.hooks = function (stage, slide, mode) {
    var fail = mode === 'fail';
    var s = svg(stage, 640, 290), q = Q();
    function station(x, y, label, note, kind, inf) {
      var g = fb(el('g', { class: kind === 'gate' ? 'gate' : 'stn' }, s.N));
      var w = kind === 'gate' ? 118 : 100;
      el('rect', { x: x - w / 2, y: y - 22, width: w, height: 44, rx: kind === 'gate' ? 10 : 22 }, g);
      el('text', { x: x, y: y + 1 }, g, label);
      if (note) el('text', { x: x, y: y + 40, class: 'note' }, g, note);
      g.X = x; g.Y = y;
      return info(g, label, inf || label);
    }
    el('path', { d: 'M60 80 L560 80', class: 'e' }, s.E);
    el('path', { d: 'M60 210 L590 210', class: 'e' }, s.E);
    txt(s, 16, 26, 'Máy dev', 'lbl b', { show: true }); txt(s, 16, 156, 'Push lên server', 'lbl b', { show: true });
    station(60, 80, 'git commit', null, 'stn', 'Lệnh bạn gõ.');
    var g1 = station(205, 80, 'pre-commit', 'lint, format, secret', 'gate', 'Chạy trước khi commit được tạo. Exit code khác 0 là chặn.');
    var g2 = station(355, 80, 'commit-msg', 'commitlint', 'gate', 'Kiểm tra message theo Conventional Commits.');
    var end1 = chip(s, 520, 80, 120, fail ? 'bị chặn' : 'commit xong', fail ? 'key' : 'staged');
    var s2 = station(60, 210, 'git push', null, 'stn', 'Lệnh bạn gõ.');
    var g3 = station(215, 210, 'pre-push', 'unit test', 'gate', 'Chạy test nhanh trước khi đẩy code.');
    var g4 = station(385, 210, 'pre-receive', 'server: chặn force push', 'gate', 'Hook phía server: từ chối push sai luật.');
    var end2 = chip(s, 550, 210, 110, 'lên remote', 'staged');
    var tok = el('circle', { cx: 60, cy: 80, r: 9, fill: '#f05033' }, s.P); tok.X = 60; tok.Y = 80; tok.style.opacity = 0;
    var ex = [g1, g2, g3, g4].map(function (g) { return txt(s, g.X, g.Y - 32, 'exit 0', 'lbl g mid sm mono'); });
    var L = fail
      ? term(slide, ['git commit -m "feat(auth): add refresh token"', { out: '✖ eslint --fix', cls: 'err' }, { out: "  src/auth.js 12:7  error  'token' is assigned a value but never used", cls: 'err' }, { out: 'husky - pre-commit script failed (code 1)', cls: 'err' }])
      : term(slide, ['git commit -m "feat(auth): add refresh token"', { out: '✔ lint-staged: eslint --fix, prettier --write', cls: 'ok' }, { out: '✔ commitlint: message hợp lệ', cls: 'ok' }, { out: '[feat/auth 4c2d9e1] feat(auth): add refresh token', cls: 'out' }, 'git push', { out: '✔ pre-push: 128 tests passed', cls: 'ok' }, { out: ' * [new branch]  feat/auth -> feat/auth', cls: 'out' }]);
    function pass(g, i, tline) { q.go(mv(tok, g.X, g.Y, { duration: 650 })); q.cls(g, 'pass').add(pulse(g, { duration: 400 })).go(fade(ex[i], 1, { duration: 250 })); if (tline) q.type(tline); q.wait(250); }
    q.step('Gõ git commit: Git chạy các hook trước khi commit được tạo.');
    q.type(L[0]).go(fade(tok, 1, { duration: 200 }));
    if (fail) {
      q.step('ESLint báo lỗi, pre-commit trả exit 1: cổng đóng sập.');
      q.go(mv(tok, g1.X - 70, g1.Y, { duration: 500 }));
      q.cls(g1, 'fail').text(ex[0], 'exit 1').cls(ex[0], 'r', 'g').go(fade(ex[0], 1, { duration: 200 }));
      q.add(shake(g1)).type(L[1]).type(L[2]);
      q.step('Commit bị chặn ngay. Sửa xong mới commit lại được, code bẩn không bao giờ lên remote.');
      q.go(mv(tok, 60, 80, { duration: 600, easing: 'easeOutQuad' })).go(fade(tok, 0.3));
      q.go(pop(end1)).type(L[3]).add(fade([s2, g3, g4, end2], 0.35));
    } else {
      q.step('pre-commit: lint-staged chỉ lint file đang add. Exit 0 thì đi tiếp.');
      pass(g1, 0, L[1]);
      q.step('commit-msg: commitlint kiểm tra chuẩn message. Commit được tạo.');
      pass(g2, 1, L[2]);
      q.go(mv(tok, 520, 80, { duration: 500 })).add(fade(tok, 0, { duration: 200 })).go(pop(end1)).type(L[3]);
      q.step('git push: pre-push chạy unit test nhanh.');
      q.type(L[4]).go(mv(tok, 60, 210, { duration: 1 })).go(fade(tok, 1, { duration: 250 }));
      pass(g3, 2, L[5]);
      q.step('Phía server, pre-receive chặn force push trái phép. Qua hết thì code lên remote.');
      pass(g4, 3, null);
      q.go(mv(tok, 550, 210, { duration: 500 })).add(fade(tok, 0, { duration: 200 })).go(pop(end2)).type(L[6]);
    }
    return q.finish();
  };

  /* ---------- TH1 revert ---------- */
  EX.revert = function (stage, slide, mode) {
    var right = mode === 'right';
    var s = svg(stage, 640, 320), q = Q();
    txt(s, 16, 30, 'origin/develop', 'lbl b', { show: true }); txt(s, 16, 186, 'Máy đồng đội', 'lbl b', { show: true });
    var c1 = node(s, 80, 100, 'c1'), c2 = node(s, 190, 100, 'c2'), bad = node(s, 300, 100, 'c3', 'bad', { sub: 'lỗi' });
    var e1 = edge(s, c1, c2, 'main'), e2 = edge(s, c2, bad, 'bad');
    var t1 = node(s, 80, 250, 'c1'), t2 = node(s, 190, 250, 'c2'), t3 = node(s, 300, 250, 'c3', 'bad'), t4 = node(s, 410, 250, 't4', 'remote', { info: 'Commit đồng đội làm trên nền c3.' });
    var te = [edge(s, t1, t2, 'main'), edge(s, t2, t3, 'bad'), edge(s, t3, t4, 'remote')];
    var dev = ptr(s, 'develop', 300, 56);
    var rv = node(s, 410, 100, 'rv', 'new', { sub: 'Revert c3', info: 'Commit revert: nội dung ngược hẳn c3, xóa tác dụng của c3 mà không xóa lịch sử.' }), erv = edge(s, bad, rv, 'new');
    var rv2 = node(s, 520, 250, 'rv', 'new'); place(rv2, 410, 100); var erv2 = edge(s, t4, rv2, 'new');
    var flash = el('rect', { x: 60, y: 60, width: 300, height: 80, rx: 12, fill: '#f87171' }, s.B); flash.style.opacity = 0;
    var msg = txt(s, 320, 306, right ? 'Đồng đội pull bình thường, lịch sử liền mạch' : 'Lịch sử lệch: đồng đội pull là conflict, dễ mất code', right ? 'lbl g mid' : 'lbl r mid');
    var L = right
      ? term(slide, ['git revert 3c4d5e6', { out: '[develop 7f8e9d0] Revert "feat: c3 lỗi"', cls: 'ok' }, 'git push origin develop', { out: '   3c4d5e6..7f8e9d0  develop -> develop', cls: 'out' }])
      : term(slide, ['git reset --hard HEAD~1', 'git push -f origin develop', { out: ' + 3c4d5e6...7a8b9c0 develop -> develop (forced update)', cls: 'warn' }]);
    q.step('c3 lỗi đã lên develop. Đồng đội đã pull về và commit t4 trên đó.');
    seqPop(q, [c1, e1, c2, e2, bad, t1, te[0], t2, te[1], t3, te[2], t4], 80);
    q.go(pop(dev));
    if (!right) {
      q.step('Sai: git reset --hard. Nhãn develop tua về c2 ở máy bạn.');
      q.type(L[0]).go(mv(dev, 190, 56, { easing: 'easeInOutBack' })); ghost(q, bad, 0.3); q.add(fade(e2, 0.25));
      q.step('git push -f: ép remote quay về c2, xóa c3 khỏi lịch sử chung.');
      q.type(L[1]).add({ targets: flash, opacity: [0, 0.25, 0], duration: 600 }).type(L[2]);
      q.step('Máy đồng đội vẫn có c3 và t4 xây trên nó. Lịch sử lệch, cả team phải gỡ rối.');
      q.cls([t3, t4], 'bad', 'remote').add(shake([t3, t4])).add(pulse([t3, t4]), 500).go(fade(msg, 1), 300);
    } else {
      q.step('Đúng: git revert tạo commit rv có nội dung đảo ngược c3. Không xóa gì cả.');
      q.type(L[0]).go(draw(erv)).go({ targets: rv, opacity: [0, 1], scale: [0, 1], rotate: [-180, 0], duration: 800, easing: 'easeOutBack' }).go(mv(dev, 410, 56)).type(L[1]);
      q.step('git push origin develop: push bình thường, không cần force.');
      q.type(L[2]).type(L[3]);
      q.step('Đồng đội pull về như mọi ngày. Lịch sử liền mạch.');
      q.add(fade(rv2, 1, { duration: 150 })).go(arc(rv2, 520, 250, 30, { duration: 900, fromY: 100 })).go(draw(erv2, { duration: 300 })).go(fade(msg, 1));
    }
    return q.finish();
  };

  /* ---------- TH2 push rejected ---------- */
  EX.rejected = function (stage, slide) {
    var s = svg(stage, 640, 320), q = Q();
    txt(s, 16, 30, 'origin/develop (remote)', 'lbl b', { show: true }); txt(s, 16, 186, 'Máy bạn (local)', 'lbl b', { show: true });
    var r1 = node(s, 80, 100, 'c1'), r2 = node(s, 190, 100, 'c2'), r3 = node(s, 300, 100, 'R', 'remote', { sub: 'đồng đội' });
    var l1 = node(s, 80, 250, 'c1'), l2 = node(s, 190, 250, 'c2'), l3 = node(s, 300, 250, 'L', 'feat', { info: 'Commit của bạn, chưa push.' });
    var es = [edge(s, r1, r2, 'main'), edge(s, r2, r3, 'remote'), edge(s, l1, l2, 'main'), edge(s, l2, l3, 'feat')];
    var wall = fb(el('g', {}, s.T));
    el('rect', { x: 340, y: 160, width: 150, height: 32, rx: 8, fill: '#2b1113', stroke: '#f87171', 'stroke-width': 1.5 }, wall);
    el('text', { x: 415, y: 181, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#fca5a5' }, wall, 'rejected');
    info(wall, 'rejected', 'Remote có commit bạn chưa có. Push sẽ đè mất nó nên Git từ chối.');
    wall.style.opacity = 0;
    var pk = el('circle', { cx: 300, cy: 250, r: 8, fill: '#a78bfa' }, s.P); pk.X = 300; pk.Y = 250; pk.style.opacity = 0;
    var rc = node(s, 300, 250, 'R', 'remote'); place(rc, 300, 100);
    var ln = node(s, 410, 250, "L'", 'new', { info: "L' là L được xếp lên trên R." }); place(ln, 300, 226);
    var eln = edge(s, rc, ln, 'new');
    var up = node(s, 410, 100, "L'", 'new'); place(up, 410, 250);
    var eup = edge(s, r3, up, 'new');
    var L = term(slide, ['git push origin develop', { out: ' ! [rejected]        develop -> develop (fetch first)', cls: 'err' }, { out: 'Updates were rejected because the remote contains work that you do not have locally.', cls: 'err' }, 'git pull --rebase origin develop', { out: 'Successfully rebased and updated refs/heads/develop.', cls: 'ok' }, 'git push origin develop', { out: '   9c1d2e3..4f5a6b7  develop -> develop', cls: 'ok' }]);
    q.step('Đồng đội vừa push R. Bạn có L ở local, chưa có R.');
    seqPop(q, [r1, es[0], r2, es[1], r3, l1, es[2], l2, es[3], l3], 80);
    q.step('git push: gói commit bay lên và dội ngược. Rejected.');
    q.type(L[0]);
    q.add(fade(pk, 1, { duration: 100 })).go(mv(pk, 415, 196, { duration: 600, easing: 'easeInQuad' }));
    q.add(stamp(wall, { duration: 300 })).go(mv(pk, 300, 250, { duration: 700, easing: 'easeOutBounce' })).go(fade(pk, 0, { duration: 200 }));
    q.type(L[1]).type(L[2]);
    q.step("git pull --rebase: R rơi xuống trước, L được nhấc lên và đặt lại trên cùng thành L'.");
    q.type(L[3]);
    q.add({ targets: l3, translateY: -24, duration: 400, easing: 'easeOutBack' }); ghost(q, l3, 0.25, 400);
    q.add(fade(ln, 0.9, { duration: 1 }), 400);
    q.add(fade(rc, 1, { duration: 150 }), 200).add(mv(rc, 300, 250, { duration: 800, easing: 'easeOutBounce' }), 300);
    q.cls(es[3], 'remote', 'feat', 900);
    q.wait(1100).go(arc(ln, 410, 250, 30, { duration: 800, fromY: 226 })).go(draw(eln, { duration: 300 })).add(fade(l3, 0, { duration: 300 })).type(L[4]);
    q.step('Push lại: thành công. Lịch sử thẳng, không commit merge rác.');
    q.type(L[5]).add(fade(wall, 0, { duration: 300 }));
    q.add(fade(up, 1, { duration: 150 })).go(arc(up, 410, 100, 20, { duration: 900, fromY: 250 })).go(draw(eup, { duration: 300 })).type(L[6]);
    return q.finish();
  };

  /* ---------- TH3 force-with-lease ---------- */
  EX.lease = function (stage, slide, mode) {
    var lease = mode === 'lease';
    var s = svg(stage, 640, 330), q = Q();
    txt(s, 16, 30, 'origin/feat/ten-nhanh', 'lbl b', { show: true }); txt(s, 16, 192, 'Máy bạn: vừa rebase, chưa fetch t', 'lbl b', { show: true });
    var r = [node(s, 70, 100, 'c1'), node(s, 170, 100, 'c2'), node(s, 270, 100, 'a', 'feat'), node(s, 370, 100, 'b', 'feat'), node(s, 470, 100, 't', 'remote', { sub: 'đồng đội', info: 'Commit t đồng đội vừa push, bạn chưa fetch.' })];
    var re = [edge(s, r[0], r[1], 'main'), edge(s, r[1], r[2], 'feat'), edge(s, r[2], r[3], 'feat'), edge(s, r[3], r[4], 'remote')];
    var l = [node(s, 70, 256, 'c1'), node(s, 170, 256, 'c2'), node(s, 270, 256, "a'", 'new'), node(s, 370, 256, "b'", 'new')];
    var le = [edge(s, l[0], l[1], 'main'), edge(s, l[1], l[2], 'new'), edge(s, l[2], l[3], 'new')];
    var na = node(s, 270, 100, "a'", 'new'), nb = node(s, 370, 100, "b'", 'new'); place(na, 270, 256); place(nb, 370, 256);
    var ena = edge(s, r[1], na, 'new'), enb = edge(s, na, nb, 'new');
    var pk = el('circle', { cx: 370, cy: 256, r: 8, fill: '#4ade80' }, s.P); pk.X = 370; pk.Y = 256; pk.style.opacity = 0;
    var shield = fb(el('g', {}, s.T));
    el('rect', { x: 250, y: 162, width: 260, height: 32, rx: 8, fill: '#10241a', stroke: '#4ade80', 'stroke-width': 1.5 }, shield);
    el('text', { x: 380, y: 183, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#86efac' }, shield, 'lease: remote đã đổi -> từ chối');
    info(shield, 'lease', '--force-with-lease so remote với lần fetch cuối. Khác là từ chối.');
    shield.style.opacity = 0;
    var lost = txt(s, 470, 60, 't bị xóa!', 'lbl r mid');
    var L = lease
      ? term(slide, ['git push --force-with-lease origin feat/ten-nhanh', { out: ' ! [rejected]        feat/ten-nhanh -> feat/ten-nhanh (stale info)', cls: 'err' }, { out: '# fetch, xem commit t, rebase tiếp rồi mới push', cls: 'cm' }])
      : term(slide, ['git push -f origin feat/ten-nhanh', { out: ' + 1a2b3c4...9d8e7f6 feat/ten-nhanh -> feat/ten-nhanh (forced update)', cls: 'warn' }]);
    q.step("Bạn rebase nhánh cá nhân thành a', b'. Trong lúc đó đồng đội đẩy thêm t lên remote.");
    seqPop(q, r.concat(re).concat(l).concat(le), 50);
    q.step(lease ? 'git push --force-with-lease: gói commit bay lên...' : 'git push -f: gói commit bay lên...');
    q.type(L[0]).add(fade(pk, 1, { duration: 100 }));
    if (!lease) {
      q.go(mv(pk, 370, 100, { duration: 700, easing: 'easeInQuad' })).add(fade(pk, 0, { duration: 150 }));
      q.step('...và ghi đè thẳng: commit t của đồng đội biến mất khỏi remote.');
      q.cls(r[4], 'bad', 'remote').add(shake(r[4])).go(fade(lost, 1), 300);
      q.add({ targets: [r[2], r[3], r[4]], opacity: 0, scale: 0.4, duration: 500, easing: 'easeInBack' }).add(fade([re[1], re[2], re[3]], 0));
      q.add(fade([na, nb], 1, { duration: 150 }), 300).add(mv(na, 270, 100, { duration: 800 }), 300).go(mv(nb, 370, 100, { duration: 800 }), 400);
      q.go(draw(ena, { duration: 250 })).go(draw(enb, { duration: 250 }));
      q.type(L[1]);
    } else {
      q.go(mv(pk, 370, 200, { duration: 600, easing: 'easeInQuad' }));
      q.step('...đập vào lá chắn lease: remote có t mà bạn chưa fetch, Git từ chối. t an toàn.');
      q.add(stamp(shield, { duration: 350 })).go(mv(pk, 370, 256, { duration: 600, easing: 'easeOutBounce' })).go(fade(pk, 0, { duration: 200 }));
      q.type(L[1]).add(pulse(r[4])).type(L[2]);
    }
    return q.finish();
  };

  /* ---------- TH4 committed on main ---------- */
  EX.wrongmain = function (stage, slide) {
    var s = svg(stage, 640, 300), q = Q();
    var c1 = node(s, 70, 200, 'c1'), c2 = node(s, 180, 200, 'c2'), a = node(s, 290, 200, 'a', 'warn', { info: 'Commit tính năng lỡ làm trên main.' }), b = node(s, 400, 200, 'b', 'warn', { info: 'Commit tính năng lỡ làm trên main.' });
    var e1 = edge(s, c1, c2, 'main'), e2 = edge(s, c2, a, 'main'), e3 = edge(s, a, b, 'main');
    var main = ptr(s, 'main', 400, 246), head = ptr(s, 'HEAD', 400, 276, 'head'), feat = ptr(s, 'feat/nhanh-moi-dung', 400, 154, 'feat');
    var L = term(slide, [{ out: '# 1. tạo nhánh giữ toàn bộ công sức', cls: 'cm' }, 'git branch feat/nhanh-moi-dung', { out: '# 2. lùi main về trạng thái sạch (2 commit)', cls: 'cm' }, 'git reset --hard HEAD~2', { out: '# 3. chuyển sang nhánh mới làm tiếp', cls: 'cm' }, 'git switch feat/nhanh-moi-dung']);
    q.step('Lỡ tay: 2 commit tính năng a, b nằm thẳng trên main (chưa push).');
    seqPop(q, [c1, e1, c2, e2, a, e3, b]);
    q.add(pop(main)).go(pop(head), 100);
    q.step('Bước 1: git branch. Cắm một nhãn nhánh mới ngay tại b để giữ công sức.');
    q.type(L[0]).type(L[1]).go(drop(feat));
    q.step('Bước 2: git reset --hard HEAD~2. main tua về c2; a, b giờ chỉ thuộc nhánh mới.');
    q.type(L[2]).type(L[3]);
    q.add(mv(main, 180, 246, { duration: 900, easing: 'easeInOutBack' })).add(mv(head, 180, 276, { duration: 900, easing: 'easeInOutBack' }));
    q.cls([a, b], 'feat', 'warn', 200).cls([e2, e3], 'feat', 'main', 200).style(e2, 'strokeDasharray', 'none', 200);
    q.add({ targets: [a, b], translateY: -100, duration: 900, easing: 'easeInOutCubic' }, 200);
    q.add({ targets: e2, d: 'M180 200 C235 200 235 100 290 100', duration: 900, easing: 'easeInOutCubic' }, 200);
    q.add({ targets: e3, translateY: -100, duration: 900, easing: 'easeInOutCubic' }, 200);
    q.go(mv(feat, 400, 54, { duration: 900 }), 200);
    q.step('Bước 3: git switch. HEAD sang nhánh mới, làm tiếp như chưa có gì.');
    q.type(L[4]).type(L[5]).go(arc(head, 400, 24, 20, { duration: 1000, fromY: 276 }));
    return q.finish();
  };

  /* ---------- TH5 squash ---------- */
  EX.squash = function (stage, slide) {
    var s = svg(stage, 640, 320), q = Q();
    var frame = fb(el('g', {}, s.B));
    el('rect', { x: 10, y: 10, width: 620, height: 258, rx: 12, fill: '#0b0e15', stroke: 'rgba(255,255,255,.14)' }, frame);
    el('text', { x: 30, y: 36, 'font-size': 12.5, fill: '#5b6578' }, frame, 'git-rebase-todo');
    el('text', { x: 36, y: 254, 'font-size': 12, fill: '#5b6578' }, frame, '# s, squash = gộp vào commit phía trên');
    frame.style.opacity = 0;
    var data = [['a1b2c3d', 'feat: export excel'], ['b2c3d4e', 'fix typo'], ['c3d4e5f', 'update'], ['d4e5f6a', 'fix lint'], ['e5f6a7b', 'update again']];
    var rows = data.map(function (d, i) {
      var y = 72 + i * 36, g = el('g', { class: 'mono' }, s.N);
      var pick = el('text', { x: 36, y: y, 'font-size': 14, fill: '#5aa9ff', 'font-weight': 700 }, g, 'pick');
      var sq = el('text', { x: 36, y: y, 'font-size': 14, fill: '#fbbf24', 'font-weight': 700 }, g, 'squash'); sq.style.opacity = 0;
      var h = el('text', { x: 116, y: y, 'font-size': 14, fill: '#8d99ae' }, g, d[0]);
      var m = el('text', { x: 200, y: y, 'font-size': 14, fill: '#eef1f7' }, g, d[1]);
      g.style.opacity = 0;
      info(g, d[0], i ? 'Commit lẻ "' + d[1] + '": nên gộp vào commit phía trên.' : 'Commit chính của tính năng: giữ pick.');
      return { g: g, pick: pick, sq: sq, h: h, m: m };
    });
    var nh = el('text', { x: 116, y: 72, 'font-size': 14, fill: '#4ade80', class: 'mono' }, s.N, 'f00d123'); nh.style.opacity = 0;
    var nm = el('text', { x: 200, y: 72, 'font-size': 14, fill: '#4ade80', 'font-weight': 700, class: 'mono' }, s.N, 'feat(export): xuất báo cáo Excel'); nm.style.opacity = 0;
    var res = txt(s, 320, 302, '5 commit lẻ -> 1 commit sạch, sẵn sàng tạo PR', 'lbl g mid');
    var L = term(slide, ['git rebase -i HEAD~5', { out: '# sửa pick -> squash cho 4 dòng dưới, lưu lại', cls: 'cm' }, { out: 'Successfully rebased and updated refs/heads/feat/PROJ-201-export-excel.', cls: 'ok' }, 'git log --oneline -1', { out: 'f00d123 feat(export): xuất báo cáo Excel', cls: 'out' }]);
    q.step('git rebase -i HEAD~5: editor mở ra 5 dòng pick, cũ nhất ở trên.');
    q.type(L[0]).go(fade(frame, 1, { duration: 300 }));
    rows.forEach(function (r, i) { q.add({ targets: r.g, opacity: [0, 1], translateX: [-20, 0], duration: 400 }, i * 100); });
    q.wait(900);
    q.step('Giữ pick dòng đầu, đổi 4 dòng dưới thành squash.');
    q.type(L[1]);
    rows.slice(1).forEach(function (r, i) {
      q.add({ targets: r.pick, opacity: 0, translateY: -8, duration: 250 }, i * 280);
      q.add({ targets: r.sq, opacity: [0, 1], translateY: [8, 0], duration: 300 }, i * 280 + 150);
    });
    q.wait(1400);
    q.step('Lưu và đóng: 4 dòng dưới gập vào dòng đầu.');
    rows.slice(1).forEach(function (r, i) { q.add({ targets: r.g, translateY: -(i + 1) * 36, opacity: 0, duration: 650, easing: 'easeInOutCubic' }, i * 120); });
    q.wait(1100);
    q.step('Viết message mới chuyên nghiệp. 5 commit thành 1, reviewer đọc một lần là hiểu.');
    q.add(fade([rows[0].h, rows[0].m], 0, { duration: 250 })).add(fade([nh, nm], 1, { duration: 400 }), 200);
    q.wait(700).type(L[2]).type(L[3]).type(L[4]).go(pop(res));
    return q.finish();
  };

  /* ---------- TH6 reflog ---------- */
  EX.reflog = function (stage, slide) {
    var s = svg(stage, 640, 230), q = Q();
    var c = [node(s, 70, 120, 'c1'), node(s, 180, 120, 'c2'), node(s, 290, 120, 'c3'), node(s, 400, 120, 'c4', '', { info: 'c4 có hash 9f8e7d6.' })];
    var e = [edge(s, c[0], c[1], 'main'), edge(s, c[1], c[2], 'main'), edge(s, c[2], c[3], 'main')];
    var main = ptr(s, 'main', 400, 76), head = ptr(s, 'HEAD', 400, 46, 'head'), rec = ptr(s, 'nhanh-khoi-phuc', 400, 166, 'new');
    var lost = txt(s, 345, 175, 'mất rồi?', 'lbl r mid');
    var L = term(slide, ['git reset --hard HEAD~2', { out: 'HEAD is now at 1b2c3d4 c2', cls: 'warn' }, 'git reflog', { out: '1b2c3d4 HEAD@{0}: reset: moving to HEAD~2', cls: 'out' }, { out: '9f8e7d6 HEAD@{1}: commit: feat: c4', cls: 'out' }, { out: '5c4b3a2 HEAD@{2}: commit: feat: c3', cls: 'out' }, 'git switch -c nhanh-khoi-phuc 9f8e7d6', { out: "Switched to a new branch 'nhanh-khoi-phuc'", cls: 'ok' }]);
    q.step('main đang ở c4 (9f8e7d6), có 2 commit công sức c3, c4.');
    seqPop(q, [c[0], e[0], c[1], e[1], c[2], e[2], c[3]]);
    q.add(pop(main)).go(pop(head), 100);
    q.step('Gõ nhầm git reset --hard HEAD~2: main tua về c2, c3 và c4 mờ đi.');
    q.type(L[0]);
    q.add(mv(main, 180, 76, { duration: 800, easing: 'easeInOutBack' })).add(mv(head, 180, 46, { duration: 800, easing: 'easeInOutBack' }));
    ghost(q, [c[2], c[3]], 0.25, 300); q.add(fade([e[1], e[2]], 0.15), 300);
    q.wait(800).go(fade(lost, 1)).type(L[1]);
    q.step('git reflog: nhật ký mọi bước HEAD đi qua. Trạng thái trước lúc gõ nhầm là 9f8e7d6.');
    q.type(L[2]).type(L[3]).type(L[4]).type(L[5]);
    q.cls(L[4], 'hit');
    q.step('git switch -c nhanh-khoi-phuc 9f8e7d6: c3, c4 sống lại đầy đủ.');
    q.type(L[6]).add(fade(lost, 0, { duration: 200 }));
    q.cls([c[2], c[3]], null, 'ghost').add(fade([c[2], c[3], e[1], e[2]], 1, { duration: 600 })).add(pulse([c[2], c[3]], { duration: 600 }));
    q.add(drop(rec), 300).go(mv(head, 400, 196, { duration: 900 }), 300).type(L[7]);
    return q.finish();
  };

  /* ---------- TH7 leaked .env ---------- */
  EX.leak = function (stage, slide) {
    var s = svg(stage, 640, 320), q = Q();
    info(el('rect', { x: 20, y: 100, width: 200, height: 130, rx: 14, class: 'box' }, s.B), 'Máy bạn', 'Máy local.');
    txt(s, 120, 126, 'Máy bạn', 'lbl b mid', { show: true });
    info(el('rect', { x: 400, y: 90, width: 220, height: 140, rx: 30, class: 'box' }, s.B), 'GitHub', 'Repo public: ai cũng đọc được, kể cả bot.');
    txt(s, 510, 78, 'GitHub (public)', 'lbl b mid', { show: true });
    var envL = chip(s, 120, 172, 110, '.env', 'key', { show: true, info: 'File .env chứa API key thật.' });
    var keyTxt = txt(s, 120, 210, 'API_KEY=sk-live-...', 'lbl mid sm mono', { show: true });
    var envR = chip(s, 510, 168, 130, '.env', 'key', { info: 'Bản .env đã lên repo public.' }); place(envR, 120, 172);
    var newKey = chip(s, 120, 172, 110, 'key mới', 'newkey', { info: 'Key mới sau khi rotate. Không bao giờ commit.' });
    var pos = [[380, 36], [500, 26], [625, 50], [628, 262], [500, 290], [372, 270]];
    var bots = pos.map(function (p) {
      var g = fb(el('g', {}, s.P));
      el('circle', { cx: p[0], cy: p[1], r: 13, fill: '#2b1113', stroke: '#f87171', 'stroke-width': 1.5 }, g);
      el('text', { x: p[0], y: p[1] + 4, 'text-anchor': 'middle', 'font-size': 10, fill: '#fca5a5', 'font-weight': 700 }, g, 'bot');
      g.X = p[0]; g.Y = p[1]; g.style.opacity = 0; return info(g, 'bot', 'Bot quét GitHub tìm key, chạy 24/7.');
    });
    var clock = txt(s, 510, 312, 't = 0.0s', 'lbl r mid mono');
    var step1 = txt(s, 20, 60, '1. Revoke + Rotate key ngay', 'lbl a lg');
    var L = term(slide, ['git add . && git commit -m "config" && git push', { out: '# việc 1: revoke + rotate key trên AWS / GCP / DB', cls: 'warn' }, { out: '# việc 2, nếu CHƯA push:', cls: 'cm' }, 'git rm --cached .env', "echo '.env' >> .gitignore", 'git commit --amend -m "chore: remove sensitive env file"', { out: '# việc 3, nếu ĐÃ push: git-filter-repo hoặc BFG, rồi báo team clone lại', cls: 'cm' }]);
    q.step('Lỡ git add . cả file .env chứa API key, rồi push.');
    q.type(L[0]).add(fade(envR, 1, { duration: 150 })).go(arc(envR, 510, 168, 50, { duration: 900, fromY: 172 }));
    q.step('Bot quét GitHub tìm ra key chỉ sau vài giây. Xóa commit lúc này đã quá muộn.');
    bots.forEach(function (b, i) { q.add(pop(b, { duration: 300 }), i * 70); });
    q.add(fade(clock, 1, { duration: 200 }));
    q.tick(1600, function (p, started) { clock.textContent = 't = ' + (started ? p * 4.2 : 0).toFixed(1) + 's'; }, 300);
    bots.forEach(function (b, i) {
      var ang = i / bots.length * Math.PI * 2, tx = 510 + Math.cos(ang) * 98, ty = 168 + Math.sin(ang) * 44;
      b.ang = ang;
      q.add(mv(b, tx, ty, { duration: 1300, easing: 'easeInOutQuad' }), 400 + i * 60);
    });
    q.wait(1900).add(shake(envR)).wait(500);
    q.step('Việc số 1: revoke key cũ, tạo key mới. Bot giữ key chết cũng vô dụng.');
    q.go(fade(step1, 1)).type(L[1]);
    q.text(envR.txt, 'key đã revoke').cls(envR, null, 'key').text(clock, 'key cũ vô dụng');
    bots.forEach(function (b, i) { q.add({ targets: b, translateX: 510 + Math.cos(b.ang) * 170 - b.X, translateY: 168 + Math.sin(b.ang) * 120 - b.Y, opacity: 0, duration: 700, easing: 'easeInQuad' }, i * 40); });
    q.add(fade([envL, keyTxt], 0, { duration: 300 })).go(pop(newKey), 200);
    q.step('Rồi mới dọn repo: chưa push thì amend, đã push thì git-filter-repo hoặc BFG.');
    q.type(L[2]).type(L[3]).type(L[4]).type(L[5]).type(L[6]);
    return q.finish();
  };

  /* ---------- closing: the workshop lands as the final commit ---------- */
  EX.kahoot = function (stage, slide) {
    var s = svg(stage, 640, 230), q = Q(), Y = 132, i;
    var parts = ['Sự ra đời', 'Bản chất', 'Lệnh cơ bản', 'Nhánh và merge', 'Quy trình team', 'Tình huống thực chiến'];
    var c = parts.map(function (t, k) { return node(s, 50 + k * 80, Y, String(k + 1), '', { info: 'Phần ' + (k + 1) + ': ' + t + '.' }); });
    var e = []; for (i = 0; i < 5; i++) e.push(edge(s, c[i], c[i + 1], 'main'));
    var W = node(s, 570, Y, 'W', 'new', { r: 22, info: 'Commit 7e1a0c9 "workshop: completed successfully". Commit cuối cùng của buổi học.' });
    var eW = edge(s, c[5], W, 'main');
    var main = ptr(s, 'main', 450, Y + 44), head = ptr(s, 'HEAD', 450, Y - 44, 'head');
    var tag = ptr(s, 'v1.0-kahoot', 570, Y + 82, 'tag', { info: 'Tag đánh dấu mốc: học xong, sang phần Kahoot.' });
    var lbl = txt(s, 50, 36, '6 phần workshop = 6 commit trên main', 'lbl b', { show: true });
    var ring = el('circle', { cx: 570, cy: Y, r: 22, fill: 'none', stroke: '#4ade80', 'stroke-width': 2, class: 'burst' }, s.B); fb(ring); ring.style.opacity = 0;
    var COL = ['#f05033', '#5aa9ff', '#a78bfa', '#4ade80', '#fbbf24', '#22d3ee'];
    var bits = [];
    for (i = 0; i < 18; i++) {
      var a = i / 18 * Math.PI * 2 + (i % 2 ? 0.17 : 0), d = 52 + (i % 3) * 16;
      var b = i % 3 === 0 ? el('rect', { x: 566, y: Y - 4, width: 8, height: 8, rx: 2, fill: COL[i % 6], class: 'burst' }, s.T) : el('circle', { cx: 570, cy: Y, r: i % 3 === 1 ? 4 : 3, fill: COL[i % 6], class: 'burst' }, s.T);
      fb(b); b.style.opacity = 0; b.dx = Math.cos(a) * d; b.dy = Math.sin(a) * d * 0.8; bits.push(b);
    }
    var L = term(slide, ['git commit -m "workshop: completed successfully"', { out: '[main 7e1a0c9] workshop: completed successfully', cls: 'ok' }, 'git tag v1.0-kahoot', { out: '# Mở kahoot.it, nhập mã game trên màn hình', cls: 'cm' }]);
    q.step('Mỗi phần đã học là một commit trên main.');
    var seq = []; c.forEach(function (n, k) { seq.push(n); if (e[k]) seq.push(e[k]); }); seqPop(q, seq, 90);
    q.add(pop(main)).go(pop(head), 100);
    q.step('git commit: commit cuối rơi xuống graph, main và HEAD tiến lên theo.');
    q.type(L[0]);
    q.go(draw(eW, { duration: 380 })).add(drop(W, { duration: 820 }));
    q.add(mv(main, 570, Y + 44, { duration: 700, easing: 'easeOutBack' }), 380).go(mv(head, 570, Y - 44, { duration: 700, easing: 'easeOutBack' }), 380);
    q.type(L[1]);
    q.step('Hoàn thành workshop. Gắn tag mốc, và đến giờ Kahoot!');
    q.type(L[2]);
    q.add({ targets: ring, opacity: [0.9, 0], scale: [1, 4.2], duration: 1000, easing: 'easeOutQuad' });
    bits.forEach(function (b, k) {
      q.add({ targets: b, translateX: [0, b.dx], translateY: [0, b.dy], rotate: [0, (k % 2 ? 1 : -1) * 160], opacity: [{ value: 1, duration: 60 }, { value: 1, duration: 520 }, { value: 0, duration: 420 }], duration: 1000, easing: 'easeOutCubic' }, k * 12);
    });
    q.add(pulse(W, { duration: 600 }));
    q.go(drop(tag, { duration: 700 }), 250).type(L[3]);
    return q.finish();
  };

  /* auto-typing terminal for static command slides */
  function autoTerm(body) {
    var q = Q(), ps = body.querySelectorAll('p');
    ps.forEach(function (p) { if (!p.classList.contains('cmd')) p.style.opacity = 0; else p.textContent = ''; });
    q.step('');
    ps.forEach(function (p) { q.type(p, 0, 18); });
    return q.finish();
  }

  window.GX = { EX: EX, autoTerm: autoTerm };
})();
