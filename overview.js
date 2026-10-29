/*
  overview.js - Executive Dashboard.
  Combines synthetic history (data.js) with live numbers from the control tower simulator (window.SP).
*/
(function () {
  var root = document.getElementById('ovBody');
  var stamp = document.getElementById('ovStamp');
  var data = null, status = 'loading', charts = {};

  var ICON = {
    box:   '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.01"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.5c2.2.7 3.5 2.8 3.5 5.5"/>',
    coin:  '<circle cx="12" cy="12" r="9"/><path d="M14.8 9c-.4-1-1.4-1.5-2.8-1.5-1.6 0-2.8.8-2.8 2s1 1.7 2.8 2 2.8.8 2.8 2-1.2 2-2.8 2c-1.5 0-2.5-.6-2.9-1.6M12 6v1.5M12 16.5V18"/>',
    up:    '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down:  '<path d="M12 5v14M5 12l7 7 7-7"/>',
    flat:  '<path d="M5 12h14"/>',
    retry: '<path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8"/><path d="M3 3v5h5"/>'
  };
  function icon(n, cls) {
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICON[n] + '</svg>';
  }
  function money(k) { return k >= 1000 ? '$' + (k / 1000).toFixed(2) + 'M' : '$' + k.toFixed(1) + 'K'; }
  function last(a) { return a[a.length - 1]; }
  function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  /* Live figures from the simulator */
  function live() {
    var st = window.SP.state(), ships = st.ships, n = ships.length;
    var late = ships.filter(function (s) { return s.delay > 2; });
    var transit = ships.reduce(function (a, s) { return a + s.value; }, 0);
    // Estimated disruption cost = holding/penalty cost (0.6% of cargo value per day of delay) + extra freight bought by approved plans.
    var holding = ships.reduce(function (a, s) { return a + (s.delay > 0 ? s.value * 0.006 * s.delay : 0); }, 0);
    var sup = data.suppliers.map(function (p) {
      var hit = ships.filter(function (s) { return s.route[0] === p.origin && s.delay > 2; }).length;
      return { name: p.name, origin: p.origin, score: Math.max(60, p.score - 2.5 * hit), prev: p.prev, delayed: hit };
    });
    return {
      n: n, ok: n - late.length, late: late.length,
      otd: (n - late.length) / n * 100,
      transit: transit, cost: holding + st.extra,
      inv: data.inventoryNowM, sup: sup, supAvg: mean(sup.map(function (x) { return x.score; }))
    };
  }

  /* Trend chip */
  function trend(cur, prev, better, kind) {
    var d = cur - prev;
    var tiny = kind === 'pct' ? Math.abs(d / prev) < 0.001 : Math.abs(d) < 0.05;
    var dir = tiny ? 'flat' : (d > 0 ? 'up' : 'down');
    var good = dir === 'flat' ? null : (better === 'up' ? d > 0 : d < 0);
    var txt;
    if (kind === 'pct') txt = (d >= 0 ? '+' : '') + (d / prev * 100).toFixed(1) + '%';
    else if (kind === 'pts') txt = (d >= 0 ? '+' : '') + d.toFixed(1) + ' pts';
    else if (kind === 'cnt') txt = (d >= 0 ? '+' : '') + d.toFixed(0);
    else txt = (d >= 0 ? '+' : '-') + money(Math.abs(d));
    if (dir === 'flat') txt = 'No change';
    var word = dir === 'flat' ? 'unchanged from' : (good ? 'better than' : 'worse than');
    return '<span class="trend ' + (good === null ? 'flat' : (good ? 'good' : 'bad')) + '" title="Compared with last week">' +
      icon(dir) + '<b>' + txt + '</b><span class="sr">, ' + word + ' last week</span></span>';
  }

  /* Sparkline */
  function spark(vals, tone) {
    var W = 120, H = 36, p = 3, min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max === min) { max += 1; min -= 1; }
    var pts = vals.map(function (v, i) {
      return [p + (W - 2 * p) * i / (vals.length - 1), p + (H - 2 * p) * (1 - (v - min) / (max - min))];
    });
    var line = pts.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' ');
    var area = line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + H + ' L' + pts[0][0].toFixed(1) + ' ' + H + ' Z';
    var e = pts[pts.length - 1];
    return '<svg class="spark ' + tone + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path class="sa" d="' + area + '"/><path class="sl" d="' + line + '"/><circle cx="' + e[0].toFixed(1) + '" cy="' + e[1].toFixed(1) + '" r="2.6"/></svg>';
  }

  /* Interactive chart (line or bar) */
  function chart(id, type, labels, vals, o) {
    var W = 560, H = 210, pl = 42, pr = 14, pt = 14, pb = 26, n = vals.length, iw = W - pl - pr, ih = H - pt - pb;
    var min = o.min, max = o.max;
    if (max == null) { max = Math.max(5, Math.ceil(Math.max.apply(null, vals) * 1.2 / 5) * 5); }
    function X(i) { return type === 'bar' ? pl + iw * (i + .5) / n : pl + iw * i / (n - 1); }
    function Y(v) { return pt + ih * (1 - (v - min) / (max - min)); }
    var g = '', i;
    for (i = 0; i <= 4; i++) {
      var gv = min + (max - min) * i / 4, gy = Y(gv).toFixed(1);
      g += '<line class="gl" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '"/><text class="ax" x="' + (pl - 8) + '" y="' + (+gy + 4) + '" text-anchor="end">' + o.axis(gv) + '</text>';
    }
    var body = '';
    if (type === 'line') {
      var d = vals.map(function (v, k) { return (k ? 'L' : 'M') + X(k).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
      body += '<path class="area" d="' + d + ' L' + X(n - 1).toFixed(1) + ' ' + (pt + ih) + ' L' + X(0).toFixed(1) + ' ' + (pt + ih) + ' Z"/><path class="ln" d="' + d + '"/>';
      body += vals.map(function (v, k) { return '<circle class="pt' + (k === n - 1 ? ' live' : '') + '" cx="' + X(k).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="' + (k === n - 1 ? 5 : 3) + '"/>'; }).join('');
    } else {
      var bw = Math.min(34, iw / n * .6);
      body += vals.map(function (v, k) { var y = Y(v); return '<rect class="bar' + (k === n - 1 ? ' live' : '') + '" x="' + (X(k) - bw / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, pt + ih - y).toFixed(1) + '" rx="3"/>'; }).join('');
    }
    var step = n > 9 ? 2 : 1;
    var xl = labels.map(function (l, k) { return ((n - 1 - k) % step === 0) ? '<text class="ax" x="' + X(k).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + l + '</text>' : ''; }).join('');
    charts[id] = { type: type, labels: labels, vals: vals, n: n, W: W, pl: pl, iw: iw, pt: pt, ih: ih, X: X, Y: Y, fmt: o.fmt, idx: n - 1 };
    return '<div class="chart" data-id="' + id + '" tabindex="0" role="group" aria-label="' + esc(o.aria) + '. Use left and right arrow keys to read each value.">' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + g + body + xl + '<line class="cur" x1="0" x2="0" y1="' + pt + '" y2="' + (pt + ih) + '" style="display:none"/></svg>' +
      '<div class="tip" hidden></div></div>';
  }
  function showTip(box, c, idx) {
    idx = Math.max(0, Math.min(c.n - 1, idx)); c.idx = idx;
    var tip = box.querySelector('.tip'), cur = box.querySelector('.cur');
    var x = c.X(idx);
    cur.setAttribute('x1', x); cur.setAttribute('x2', x); cur.style.display = '';
    tip.innerHTML = '<b>' + c.labels[idx] + (idx === c.n - 1 ? ' (live)' : '') + '</b>' + c.fmt(c.vals[idx]);
    tip.hidden = false;
    var pct = x / c.W * 100;
    tip.style.left = Math.max(12, Math.min(88, pct)) + '%';
  }
  function hideTip(box) { box.querySelector('.tip').hidden = true; box.querySelector('.cur').style.display = 'none'; }

  /* Sections */
  function kpiCards(L) {
    var d = data, kp = [
      { l: 'Inventory value', ic: 'box', v: '$' + L.inv.toFixed(2) + 'M', cur: L.inv, prev: last(d.inventoryM), better: 'up', kind: 'pct',
        hist: d.inventoryM.concat(L.inv), tone: 'teal', s: 'On hand. ' + money(L.transit) + ' more in transit.' },
      { l: 'On-time delivery', ic: 'clock', v: L.otd.toFixed(0) + '%', cur: L.otd, prev: last(d.otd), better: 'up', kind: 'pts',
        hist: d.otd.concat(L.otd), tone: L.otd >= 90 ? 'teal' : 'crit', s: L.ok + ' of ' + L.n + ' live shipments' },
      { l: 'At-risk shipments', ic: 'alert', v: String(L.late), cur: L.late, prev: last(d.atRisk), better: 'down', kind: 'cnt',
        hist: d.atRisk.concat(L.late), tone: L.late ? 'crit' : 'teal', s: 'More than 2 days late' },
      { l: 'Supplier performance', ic: 'users', v: L.supAvg.toFixed(1), cur: L.supAvg, prev: last(d.supplierAvg), better: 'up', kind: 'pts',
        hist: d.supplierAvg.concat(L.supAvg), tone: 'teal', s: 'Average score out of 100' },
      { l: 'Est. disruption cost', ic: 'coin', v: money(L.cost), cur: L.cost, prev: last(d.costK), better: 'down', kind: 'usd',
        hist: d.costK.concat(L.cost), tone: L.cost > 15 ? 'crit' : 'teal', s: 'Delay holding cost plus mitigation spend' }
    ];
    return '<div class="kpi-grid">' + kp.map(function (k) {
      return '<article class="kc"><div class="kc-h">' + icon(k.ic) + '<span>' + k.l + '</span></div>' +
        '<div class="kc-v">' + k.v + '</div>' + trend(k.cur, k.prev, k.better, k.kind) +
        spark(k.hist, k.tone) + '<p class="kc-s">' + k.s + '</p></article>';
    }).join('') + '</div>';
  }
  function chartCards(L) {
    var d = data;
    var otdVals = d.otd.concat(L.otd);
    var costLabels = d.weeks.slice(4), costVals = d.costK.concat(L.cost);
    return '<div class="two">' +
      '<section class="card pad"><div class="ch"><h2>On-time delivery</h2><span>Last 12 weeks. Latest point is live.</span></div>' +
        chart('otd', 'line', d.weeks, otdVals, { min: Math.min(80, Math.floor(Math.min.apply(null, otdVals) / 10) * 10), max: 100, axis: function (v) { return v.toFixed(0) + '%'; }, fmt: function (v) { return v.toFixed(1) + '% on time'; }, aria: 'On-time delivery by week, latest ' + L.otd.toFixed(0) + ' percent' }) + '</section>' +
      '<section class="card pad"><div class="ch"><h2>Estimated disruption cost</h2><span>Last 8 weeks. Latest bar is live.</span></div>' +
        chart('cost', 'bar', costLabels, costVals, { min: 0, axis: function (v) { return '$' + v.toFixed(0) + 'K'; }, fmt: function (v) { return money(v) + ' estimated'; }, aria: 'Estimated disruption cost by week, latest ' + money(L.cost) }) + '</section>' +
      '</div>';
  }
  function supplierCard(L) {
    var rows = L.sup.slice().sort(function (a, b) { return b.score - a.score; }).map(function (p) {
      var tone = p.score >= 90 ? 'ok' : (p.score >= 80 ? 'warn' : 'crit');
      return '<li class="sp-row"><div class="sp-n"><b>' + esc(p.name) + '</b><span class="mono">' + p.origin + (p.delayed ? ' · ' + p.delayed + ' delayed shipment' + (p.delayed > 1 ? 's' : '') : ' · no delays') + '</span></div>' +
        '<div class="sp-bar" role="img" aria-label="Score ' + p.score.toFixed(1) + ' out of 100"><i class="' + tone + '" style="width:' + p.score.toFixed(1) + '%"></i></div>' +
        '<div class="sp-s mono">' + p.score.toFixed(1) + '</div>' + trend(p.score, p.prev, 'up', 'pts') + '</li>';
    }).join('');
    return '<section class="card pad"><div class="ch"><h2>Supplier performance</h2><span>Score drops when a supplier\'s shipments run late.</span></div><ul class="sp-list">' + rows + '</ul></section>';
  }

  function skeleton() {
    var k = '<div class="kpi-grid">' + new Array(6).join('<div class="kc sk-card"><div class="sk s1"></div><div class="sk s2"></div><div class="sk s3"></div></div>') + '</div>';
    return '<div aria-busy="true" aria-label="Loading overview">' + k + '<div class="two"><div class="card pad"><div class="sk s4"></div></div><div class="card pad"><div class="sk s4"></div></div></div></div>';
  }
  function errorView(msg) {
    return '<div class="card pad err" role="alert"><h2>Could not load the overview</h2><p>' + esc(msg) + '</p><button class="btn-quiet" id="ovRetry" type="button">' + icon('retry') + 'Try again</button></div>';
  }

  function render() {
    if (status === 'loading') { root.innerHTML = skeleton(); return; }
    if (status === 'error') return;
    var L = live();
    charts = {};
    root.innerHTML = kpiCards(L) + chartCards(L) + supplierCard(L);
    stamp.textContent = 'Synthetic data · ' + new Date().toLocaleTimeString('en-GB');
  }
  function load() {
    status = 'loading'; render(); stamp.textContent = 'Loading…';
    window.SPApi.getOverview().then(function (d) { data = d; status = 'ready'; render(); })
      .catch(function (e) { status = 'error'; stamp.textContent = 'Error'; root.innerHTML = errorView(e && e.message ? e.message : 'Unknown error'); });
  }

  root.addEventListener('pointermove', function (e) {
    var box = e.target.closest('.chart'); if (!box) return;
    var c = charts[box.getAttribute('data-id')], r = box.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width * c.W;
    var idx = c.type === 'bar' ? Math.floor((x - c.pl) / c.iw * c.n) : Math.round((x - c.pl) / c.iw * (c.n - 1));
    showTip(box, c, idx);
  });
  root.addEventListener('pointerleave', function (e) { var b = root.querySelectorAll('.chart'); Array.prototype.forEach.call(b, hideTip); }, true);
  root.addEventListener('keydown', function (e) {
    var box = e.target.closest && e.target.closest('.chart'); if (!box) return;
    var c = charts[box.getAttribute('data-id')];
    if (e.key === 'ArrowLeft') { e.preventDefault(); showTip(box, c, c.idx - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); showTip(box, c, c.idx + 1); }
  });
  root.addEventListener('blur', function (e) { if (e.target.classList && e.target.classList.contains('chart')) hideTip(e.target); }, true);
  root.addEventListener('click', function (e) { if (e.target.closest('#ovRetry')) load(); });
  document.getElementById('ovRefresh').addEventListener('click', load);

  document.addEventListener('sp:update', function () { if (status === 'ready') render(); });
  load();
})();
