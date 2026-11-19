// Kolonie/art.js - gezeichnete Gebäude für die Sternenkolonie (Canvas 2D, ohne Bilddateien).
// draw(g, P, b) zeichnet den festen Teil eines Gebäudes, anim(g, P, b, t) die bewegten Teile (Lichter, Rauch, Funken).
// P(i, j, z) rechnet Rasterfelder in Pixel um. Licht kommt von oben links.
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  let g = null;
  const lin = (x0, y0, x1, y1, st) => { const l = g.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, c]) => l.addColorStop(o, c)); return l; };
  const rad = (x, y, r0, r1, st) => { const l = g.createRadialGradient(x, y, r0, x, y, r1); st.forEach(([o, c]) => l.addColorStop(o, c)); return l; };
  function poly(pts, fill, stroke, lw = 1) { g.beginPath(); pts.forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } }
  function glow(x, y, r, rgb, a) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rad(x, y, 0, r, [[0, `rgba(${rgb},${a})`], [.4, `rgba(${rgb},${a * .35})`], [1, `rgba(${rgb},0)`]]); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = n >> 8 & 255, b = n & 255; const t = f < 0 ? 0 : 255, p = Math.abs(f); return `rgb(${Math.round((t - r) * p + r)},${Math.round((t - gg) * p + gg)},${Math.round((t - b) * p + b)})`; }
  let P;
  // Quader mit Verlauf, Kantenlicht und Bodenschatten
  function box(i, j, wi, wj, h, top, left, right, z = 0) {
    const a = P(i, j, z + h), b = P(i + wi, j, z + h), c = P(i + wi, j + wj, z + h), d = P(i, j + wj, z + h), b0 = P(i + wi, j, z), c0 = P(i + wi, j + wj, z), d0 = P(i, j + wj, z);
    poly([d, c, c0, d0], lin(d[0], d[1], d0[0], d0[1] + 6, [[0, left], [1, shade(left, -.35)]]));
    poly([c, b, b0, c0], lin(c[0], c[1], c0[0], c0[1] + 6, [[0, right], [1, shade(right, -.35)]]));
    poly([a, b, c, d], lin(a[0], a[1], c[0], c[1], [[0, shade(top, .12)], [1, top]]));
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(...d); g.lineTo(...c); g.lineTo(...b); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.moveTo(...c); g.lineTo(...c0); g.stroke();
    return { a, b, c, d };
  }
  // Fenster (beleuchtet) auf der linken (+j) oder rechten (+i) Seite eines Quaders
  function windows(i, j, wi, wj, h, side, rows, col, z = 0, seed = 1) {
    let s = seed * 97;
    for (let r = 0; r < rows; r++) {
      const zz = z + h * (r + .55) / rows, n = Math.max(2, Math.round((side === 'L' ? wi : wj) * 3));
      for (let k = 0; k < n; k++) { s = (s * 16807) % 2147483647; if (s % 7 === 0) continue; const t = (k + .5) / n; const p = side === 'L' ? P(i + wi * t, j + wj, zz) : P(i + wi, j + wj * t, zz);
        g.fillStyle = col; g.globalAlpha = .55 + (s % 45) / 100; g.beginPath(); const sk = side === 'L' ? -.5 : .5; g.moveTo(p[0] - 2.6, p[1] - 1.6 - sk * 2.6); g.lineTo(p[0] + 2.6, p[1] - 1.6 + sk * 2.6); g.lineTo(p[0] + 2.6, p[1] + 1.8 + sk * 2.6); g.lineTo(p[0] - 2.6, p[1] + 1.8 - sk * 2.6); g.fill(); g.globalAlpha = 1; }
    }
  }
  function cyl(x, y, r, h, top, side) {
    const ry = r * .5;
    g.fillStyle = lin(x - r, 0, x + r, 0, [[0, shade(side, -.45)], [.35, shade(side, .15)], [.6, side], [1, shade(side, -.55)]]);
    g.beginPath(); g.moveTo(x - r, y - h); g.lineTo(x - r, y); g.ellipse(x, y, r, ry, 0, Math.PI, 0, true); g.lineTo(x + r, y - h); g.closePath(); g.fill();
    g.fillStyle = lin(x - r, y - h - ry, x + r, y - h + ry, [[0, shade(top, .2)], [1, shade(top, -.2)]]); g.beginPath(); g.ellipse(x, y - h, r, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1; g.stroke();
  }
  function shadowFoot(i, j, w, d, a = .35) { const pts = [P(i - .05, j + .15), P(i + w + .15, j + .15), P(i + w + .25, j + d + .25), P(i + .05, j + d + .25)]; poly(pts, `rgba(0,0,0,${a})`); }
  function pad(i, j, w, d, col = '#2a3354') { const pts = [P(i + .06, j + .06, 2), P(i + w - .06, j + .06, 2), P(i + w - .06, j + d - .06, 2), P(i + .06, j + d - .06, 2)]; const pts0 = [P(i + w - .06, j + .06), P(i + w - .06, j + d - .06), P(i + .06, j + d - .06)];
    poly([pts[1], pts[2], pts0[1], pts0[0]], '#151a30'); poly([pts[2], pts[3], pts0[2], pts0[1]], '#1b2140'); poly(pts, col, 'rgba(125,211,252,.25)'); }
  function dome(x, y, r, rgb, lvl) {
    g.fillStyle = '#1b2140'; g.beginPath(); g.ellipse(x, y + 1, r * 1.12, r * .58, 0, 0, TAU); g.fill();
    g.fillStyle = '#2b3358'; g.beginPath(); g.ellipse(x, y - 1, r * 1.05, r * .52, 0, 0, TAU); g.fill();
    const dg = rad(x - r * .35, y - r * .95, 2, r * 1.25, [[0, 'rgba(240,249,255,.98)'], [.3, `rgba(${rgb},.75)`], [.75, `rgba(${rgb},.35)`], [1, `rgba(${rgb},.22)`]]);
    g.fillStyle = dg; g.beginPath(); g.ellipse(x, y - 2, r, r * .5, 0, 0, Math.PI); g.arc(x, y - 2, r, Math.PI, 0); g.fill();
    g.save(); g.beginPath(); g.ellipse(x, y - 2, r, r * .5, 0, 0, Math.PI); g.arc(x, y - 2, r, Math.PI, 0); g.clip();
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = .8; for (let k = 1; k < 5; k++) { g.beginPath(); g.ellipse(x, y - 2, r * k / 5, r * 1.05, 0, Math.PI, 0); g.stroke(); }
    for (let k = 1; k < 3; k++) { g.beginPath(); g.ellipse(x, y - 2 - r * k * .33, r * Math.sqrt(1 - (k * .33) ** 2), r * .5 * Math.sqrt(1 - (k * .33) ** 2), 0, 0, Math.PI); g.stroke(); }
    // Innenleben (Lichter)
    for (let k = 0; k < 4 + lvl * 2; k++) { g.fillStyle = 'rgba(254,240,138,.9)'; g.fillRect(x - r * .62 + (k % 5) * r * .3, y - r * .2 - (k > 4 ? r * .38 : 0) - (k % 2) * 4, 2.6, 2.6); }
    g.restore();
    g.strokeStyle = `rgba(${rgb},.9)`; g.lineWidth = 1.1; g.beginPath(); g.arc(x, y - 2, r, Math.PI, 0); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(x - r * .38, y - r * .62, r * .22, r * .1, -.6, 0, TAU); g.fill();
  }
  function antenna(x, y, h, col = '#f472b6', rgb = '244,114,182') { g.strokeStyle = '#cbd5e1'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.stroke(); return [x, y - h]; }
  function pipe(a, b, h, col = '#f59e0b') { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 5; g.beginPath(); g.moveTo(a[0], a[1] + 2); g.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - h + 2, b[0], b[1] + 2); g.stroke(); g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(...a); g.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - h, ...b); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.stroke(); }

  // ================= Gebäude =================
  const D = {
    hq(b) { const { i, j, lvl } = b, h1 = 36 + lvl * 6;
      shadowFoot(i, j, 2, 2, .45); pad(i, j, 2, 2, '#232a4a');
      box(i + .15, j + .15, 1.7, 1.7, h1, '#c7d2fe', '#3730a3', '#4f46e5'); windows(i + .15, j + .15, 1.7, 1.7, h1, 'L', 3, '#fde68a', 0, 3); windows(i + .15, j + .15, 1.7, 1.7, h1, 'R', 3, '#fde68a', 0, 5);
      const h2 = 26 + lvl * 9; box(i + .5, j + .5, 1, 1, h2, '#e0e7ff', '#4338ca', '#6366f1', h1); windows(i + .5, j + .5, 1, 1, h2, 'L', 2 + (lvl > 2), '#a5f3fc', h1, 7); windows(i + .5, j + .5, 1, 1, h2, 'R', 2 + (lvl > 2), '#a5f3fc', h1, 9);
      if (lvl >= 3) { box(i + .2, j + 1.25, .5, .5, 12, '#a5b4fc', '#3730a3', '#4f46e5', h1); box(i + 1.25, j + .2, .5, .5, 12, '#a5b4fc', '#3730a3', '#4f46e5', h1); }
      const [tx, ty] = P(i + 1, j + 1, h1 + h2); g.fillStyle = '#c7d2fe'; g.beginPath(); g.ellipse(tx, ty, 12, 6, 0, 0, TAU); g.fill(); antenna(tx, ty, 22 + lvl * 3); },
    hab(b) { const { i, j, lvl } = b, [x, y] = P(i + .5, j + .5); shadowFoot(i, j, 1, 1); pad(i, j, 1, 1);
      if (lvl >= 2) { const [x2, y2] = P(i + .78, j + .22); dome(x2, y2, 9, '56,189,248', 1); }
      dome(x, y + 2, 17 + lvl * 2, '56,189,248', lvl); if (lvl >= 3) { const [x3, y3] = P(i + .22, j + .78); dome(x3, y3 + 2, 9, '56,189,248', 1); } },
    green(b) { const { i, j, lvl } = b, [x, y] = P(i + .5, j + .5); shadowFoot(i, j, 1, 1); pad(i, j, 1, 1, '#1f3a2e');
      // Pflanzbeete
      for (let k = 0; k < 3; k++) { const p = P(i + .2 + k * .3, j + .82, 2); g.fillStyle = '#166534'; g.beginPath(); g.ellipse(p[0], p[1], 5, 2.5, 0, 0, TAU); g.fill(); }
      dome(x, y, 17 + lvl * 2, '74,222,128', lvl);
      g.save(); g.globalAlpha = .7; for (let k = 0; k < 5 + lvl * 2; k++) { g.fillStyle = k % 2 ? '#22c55e' : '#4ade80'; g.beginPath(); g.arc(x - 9 + (k % 5) * 4.5, y - 4 - (k % 3) * 3.5, 2.6, 0, TAU); g.fill(); } g.restore(); },
    solar(b) { const { i, j, lvl } = b; shadowFoot(i, j, 1, 1, .25); pad(i, j, 1, 1, '#1e2747'); const n = lvl >= 2 ? 4 : 3, rows = lvl >= 3 ? 2 : 1;
      for (let r = 0; r < rows; r++) for (let k = 0; k < (rows > 1 ? 2 : n > 3 ? 2 : 1); k++) {
        const ci = i + (rows > 1 ? .28 + k * .44 : n > 3 ? .28 + k * .44 : .5), cj = j + (rows > 1 ? .28 + r * .44 : .5), [x, y] = P(ci, cj, 4), w = rows > 1 || n > 3 ? 13 : 20;
        g.fillStyle = '#475569'; g.fillRect(x - 1, y, 2, 5);
        const c1 = P(ci - .18 * (w / 13), cj - .18 * (w / 13), 10), c2 = P(ci + .18 * (w / 13), cj - .18 * (w / 13), 14), c3 = P(ci + .18 * (w / 13), cj + .18 * (w / 13), 8), c4 = P(ci - .18 * (w / 13), cj + .18 * (w / 13), 4);
        poly([c1, c2, c3, c4], lin(c1[0], c1[1], c3[0], c3[1], [[0, '#93c5fd'], [.35, '#2563eb'], [1, '#1e3a8a']]), '#bfdbfe', .8);
        g.strokeStyle = 'rgba(191,219,254,.45)'; g.lineWidth = .6; for (let q = 1; q < 4; q++) { const t = q / 4; g.beginPath(); g.moveTo(c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t); g.lineTo(c4[0] + (c3[0] - c4[0]) * t, c4[1] + (c3[1] - c4[1]) * t); g.stroke(); }
        g.beginPath(); g.moveTo((c1[0] + c4[0]) / 2, (c1[1] + c4[1]) / 2); g.lineTo((c2[0] + c3[0]) / 2, (c2[1] + c3[1]) / 2); g.stroke();
      } },
    mine(b) { const { i, j, lvl } = b, [x, y] = P(i + .5, j + .5); shadowFoot(i, j, 1, 1); pad(i, j, 1, 1, '#2e2a3e');
      g.fillStyle = rad(x, y, 2, 16, [[0, '#0b0a14'], [1, '#3b3352']]); g.beginPath(); g.ellipse(x, y, 15, 7.5, 0, 0, TAU); g.fill();
      const h = 44 + lvl * 8; g.strokeStyle = '#f59e0b'; g.lineWidth = 2.6; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(x - 15, y + 2); g.lineTo(x, y - h); g.lineTo(x + 15, y + 2); g.moveTo(x - 4, y + 6); g.lineTo(x, y - h); g.stroke();
      g.lineWidth = 1.4; for (let k = 1; k < 4; k++) { const t = k / 4, w = 15 * (1 - t); g.beginPath(); g.moveTo(x - w, y + 2 - (h + 2) * t); g.lineTo(x + w, y + 2 - (h + 2) * t); g.stroke(); }
      box(i + .62, j + .1, .32, .32, 14, '#94a3b8', '#475569', '#64748b'); if (lvl >= 2) box(i + .08, j + .6, .3, .3, 10, '#fbbf24', '#92400e', '#b45309');
      // Erzhaufen
      const [ox, oy] = P(i + .8, j + .78); for (let k = 0; k < 4 + lvl; k++) { g.fillStyle = k % 2 ? '#94a3b8' : '#64748b'; g.beginPath(); g.arc(ox - 6 + k * 3, oy - (k % 2) * 3, 3.4, 0, TAU); g.fill(); } },
    crys(b) { const { i, j, lvl } = b, [x, y] = P(i + .5, j + .5); shadowFoot(i, j, 1, 1, .25);
      for (let k = 0; k < 6 + lvl; k++) { const a = k / (6 + lvl) * TAU, r = 6 + (k % 3) * 4, ox = Math.cos(a) * r, oy = Math.sin(a) * r * .5, hh = 12 + ((k * 7) % 4) * 6;
        g.fillStyle = lin(x + ox - 5, y + oy - hh, x + ox + 5, y + oy, [[0, '#fdf4ff'], [.3, '#f0abfc'], [1, '#7e22ce']]); g.beginPath(); g.moveTo(x + ox, y + oy - hh); g.lineTo(x + ox + 5, y + oy - hh * .3); g.lineTo(x + ox + 3, y + oy + 2); g.lineTo(x + ox - 3, y + oy + 2); g.lineTo(x + ox - 5, y + oy - hh * .3); g.closePath(); g.fill(); g.strokeStyle = 'rgba(253,244,255,.6)'; g.lineWidth = .7; g.stroke(); }
      cyl(x, y + 6, 7, 22 + lvl * 4, '#e2e8f0', '#64748b'); g.fillStyle = '#a855f7'; g.fillRect(x - 7, y - 4 - lvl * 2, 14, 3); },
    factory(b) { const { i, j, lvl } = b; shadowFoot(i, j, 2, 2, .45); pad(i, j, 2, 2, '#262c45');
      const h = 22 + lvl * 3; box(i + .1, j + .55, 1.75, 1.3, h, '#cbd5e1', '#475569', '#64748b'); windows(i + .1, j + .55, 1.75, 1.3, h, 'L', 2, '#fdba74', 0, 11);
      // Sheddach
      for (let k = 0; k < 4; k++) { const a = P(i + .1 + k * .44, j + .55, h), b2 = P(i + .1 + k * .44, j + 1.85, h), c = P(i + .1 + (k + .5) * .44, j + 1.85, h + 9), d = P(i + .1 + (k + .5) * .44, j + .55, h + 9), e = P(i + .1 + (k + 1) * .44, j + .55, h), f = P(i + .1 + (k + 1) * .44, j + 1.85, h);
        poly([a, d, c, b2], '#e2e8f0'); poly([d, e, f, c], lin(d[0], d[1], f[0], f[1], [[0, '#7dd3fc'], [1, '#0369a1']])); }
      box(i + .15, j + .1, .8, .45, 14, '#94a3b8', '#334155', '#475569'); box(i + 1.05, j + .12, .5, .4, 10, '#fbbf24', '#92400e', '#b45309');
      for (let k = 0; k < 1 + Math.min(2, lvl); k++) { const [x, y] = P(i + 1.55 + k * .14, j + .3 + k * .1, 10); cyl(x, y, 4.5, 30 + k * 4, '#334155', '#94a3b8'); g.fillStyle = '#ef4444'; g.fillRect(x - 4.5, y - 26 - k * 4, 9, 2.5); }
      // Förderband nach vorne
      const p0 = P(i + 1.85, j + 1.3, 5), p1 = P(i + 2, j + 1.3, 3); g.strokeStyle = '#1e293b'; g.lineWidth = 6; g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke(); },
    refinery(b) { const { i, j, lvl } = b; shadowFoot(i, j, 2, 2, .4); pad(i, j, 2, 2, '#1f2640');
      const tanks = [[.55, .55, 15, 32], [1.4, .55, 12, 26], [.6, 1.4, 11, 22]]; if (lvl >= 2) tanks.push([1.45, 1.4, 10, 20]);
      tanks.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1])).forEach(([di, dj, r, hh]) => { const [x, y] = P(i + di, j + dj, 2); cyl(x, y, r, hh + lvl * 3, '#f1f5f9', '#94a3b8'); g.fillStyle = 'rgba(56,189,248,.95)'; g.fillRect(x - r, y - (hh + lvl * 3) * .45, r * 2, 3); g.strokeStyle = 'rgba(15,23,42,.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - r * .3, y - hh - lvl * 3); g.lineTo(x - r * .3, y); g.stroke(); });
      pipe(P(i + .55, j + .55, 36 + lvl * 3), P(i + 1.4, j + .55, 28 + lvl * 3), 12); pipe(P(i + .6, j + 1.4, 24 + lvl * 3), P(i + .55, j + .55, 20), 8, '#fb923c');
      const [fx, fy] = P(i + 1.75, j + 1.75, 2); g.fillStyle = lin(fx - 2, 0, fx + 2, 0, [[0, '#334155'], [1, '#94a3b8']]); g.fillRect(fx - 2, fy - 44, 4, 44); },
    store(b) { const { i, j, lvl } = b; shadowFoot(i, j, 1, 1); pad(i, j, 1, 1);
      const cols = [['#f59e0b', '#92400e', '#b45309'], ['#38bdf8', '#075985', '#0369a1'], ['#a855f7', '#581c87', '#6b21a8']];
      const spots = [[.12, .12], [.52, .12], [.12, .52], [.52, .52]].slice(0, 2 + lvl);
      spots.forEach(([di, dj], k) => { const c = cols[k % 3]; box(i + di, j + dj, .36, .36, 12, c[0], c[1], c[2]); if (k < 2 && lvl >= 2) box(i + di, j + dj, .36, .36, 10, c[0], c[1], c[2], 12); });
      const [x, y] = P(i + .9, j + .9, 2); g.strokeStyle = '#fbbf24'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 34); g.lineTo(x - 18, y - 30); g.stroke(); },
    pad(b) { const { i, j, lvl } = b, [x, y] = P(i + 1, j + 1); shadowFoot(i, j, 2, 2, .3);
      pad(i, j, 2, 2, '#1c2238');
      g.fillStyle = '#1e293b'; g.beginPath(); g.ellipse(x, y + 3, 54, 27, 0, 0, TAU); g.fill();
      g.fillStyle = lin(x - 52, y - 26, x + 52, y + 26, [[0, '#4b5563'], [1, '#273042']]); g.beginPath(); g.ellipse(x, y, 52, 26, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.08)'; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 52, y + Math.sin(a) * 26); g.stroke(); }
      g.strokeStyle = '#fde047'; g.lineWidth = 2; g.setLineDash([7, 6]); g.beginPath(); g.ellipse(x, y, 42, 21, 0, 0, TAU); g.stroke(); g.setLineDash([]);
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x - 13, y - 6); g.lineTo(x - 13, y + 6); g.moveTo(x + 13, y - 6); g.lineTo(x + 13, y + 6); g.moveTo(x - 13, y); g.lineTo(x + 13, y); g.stroke();
      if (lvl >= 2) { box(i + 1.7, j + .05, .26, .26, 22, '#e2e8f0', '#475569', '#64748b'); }
      if (lvl >= 3) { box(i + .05, j + 1.7, .26, .26, 14, '#fbbf24', '#92400e', '#b45309'); } },
    yard(b) { const { i, j, lvl } = b; shadowFoot(i, j, 2, 2, .4);
      pad(i, j, 2, 2, '#141a2e'); g.strokeStyle = 'rgba(253,224,71,.35)'; g.setLineDash([5, 5]); g.lineWidth = 1.2; const q = [P(i + .25, j + .25, 3), P(i + 1.75, j + .25, 3), P(i + 1.75, j + 1.75, 3), P(i + .25, j + 1.75, 3)]; g.beginPath(); q.forEach((p, k) => k ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.stroke(); g.setLineDash([]);
      box(i + .05, j + .05, .35, .35, 26, '#94a3b8', '#334155', '#475569'); },
    yardFront(b) { const { i, j, lvl } = b, H = 62 + lvl * 6; g.strokeStyle = '#f59e0b'; g.lineWidth = 3; g.lineCap = 'round';
      const cor = [[.15, .15], [1.85, .15], [1.85, 1.85], [.15, 1.85]];
      cor.forEach(([a, c]) => { const p0 = P(i + a, j + c, 2), p1 = P(i + a, j + c, H); g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke(); });
      const top = cor.map(([a, c]) => P(i + a, j + c, H)); g.beginPath(); top.forEach((p, k) => k ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.stroke();
      g.lineWidth = 1.4; g.strokeStyle = 'rgba(245,158,11,.7)'; cor.forEach(([a, c], k) => { const [a2, c2] = cor[(k + 1) % 4]; for (let z = 14; z < H; z += 16) { const p0 = P(i + a, j + c, z), p1 = P(i + a2, j + c2, z + 14); g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke(); } });
      const m0 = P(i + .15, j + 1, H), m1 = P(i + 1.85, j + 1, H); g.lineWidth = 4; g.strokeStyle = '#fbbf24'; g.beginPath(); g.moveTo(...m0); g.lineTo(...m1); g.stroke(); g.lineCap = 'butt'; },
    tower(b) { const { i, j, lvl } = b, [x, y] = P(i + .5, j + .5); shadowFoot(i, j, 1, 1, .3); pad(i, j, 1, 1, '#262a40');
      cyl(x, y + 4, 15, 10, '#475569', '#334155'); cyl(x, y - 6, 8, 34 + lvl * 8, '#cbd5e1', '#64748b');
      const ty = y - 40 - lvl * 8; g.fillStyle = lin(x - 16, 0, x + 16, 0, [[0, '#155e75'], [.5, '#67e8f9'], [1, '#155e75']]); g.beginPath(); g.moveTo(x - 17, ty); g.lineTo(x + 17, ty); g.lineTo(x + 12, ty - 12); g.lineTo(x - 12, ty - 12); g.closePath(); g.fill();
      g.fillStyle = '#e2e8f0'; g.beginPath(); g.ellipse(x, ty - 12, 12, 5, 0, 0, TAU); g.fill();
      g.strokeStyle = '#94a3b8'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x + 2, ty - 15); g.lineTo(x + 22, ty - 25); if (lvl >= 2) { g.moveTo(x - 2, ty - 13); g.lineTo(x + 18, ty - 23); } g.stroke(); },
    shield(b) { const { i, j, lvl } = b, [x, y] = P(i + .5, j + .5); shadowFoot(i, j, 1, 1, .3); pad(i, j, 1, 1, '#2a2148');
      for (const [di, dj] of [[.2, .2], [.8, .2], [.2, .8], [.8, .8]]) { const [px, py] = P(i + di, j + dj, 2); g.fillStyle = '#6d28d9'; g.fillRect(px - 1.5, py - 10, 3, 10); }
      cyl(x, y, 9, 30 + lvl * 6, '#ddd6fe', '#6d28d9'); g.fillStyle = 'rgba(196,181,253,.9)'; for (let k = 0; k < 3; k++) g.fillRect(x - 9, y - 8 - k * 8, 18, 1.6); },
    lab(b) { const { i, j, lvl } = b; shadowFoot(i, j, 1, 1); pad(i, j, 1, 1, '#1d2745');
      const h = 20 + lvl * 6; box(i + .15, j + .15, .7, .7, h, '#a5f3fc', '#0e7490', '#0891b2'); windows(i + .15, j + .15, .7, .7, h, 'L', 2, '#cffafe', 0, 13); windows(i + .15, j + .15, .7, .7, h, 'R', 2, '#cffafe', 0, 17);
      const [x, y] = P(i + .5, j + .5, h); g.fillStyle = '#e0f2fe'; g.beginPath(); g.ellipse(x, y, 13, 6.5, 0, 0, TAU); g.fill();
      g.strokeStyle = '#94a3b8'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 16); g.stroke();
      g.fillStyle = lin(x - 14, y - 30, x + 14, y - 16, [[0, '#f8fafc'], [1, '#64748b']]); g.beginPath(); g.ellipse(x, y - 20, 14, 6, -.4, 0, TAU); g.fill(); g.strokeStyle = 'rgba(15,23,42,.5)'; g.lineWidth = 1; g.stroke(); },
    ruin(b) { const { i, j, w } = b; shadowFoot(i, j, w, w, .2); for (let k = 0; k < 5 * w; k++) { const p = P(i + .2 + (k * .37 % (w - .3)), j + .2 + (k * .53 % (w - .3)), 2); g.fillStyle = k % 2 ? '#475569' : '#334155'; g.fillRect(p[0] - 4, p[1] - 3, 8, 5); } }
  };

  // ================= bewegte Teile =================
  const A = {
    hq(b, t) { const { i, j, lvl } = b, h = 36 + lvl * 6 + 26 + lvl * 9, [x, y] = P(i + 1, j + 1, h); const top = [x, y - 22 - lvl * 3];
      const p = .6 + .4 * Math.sin(t * 2.4); glow(top[0], top[1], 16 * p + 6, '244,114,182', .9); g.fillStyle = '#fbcfe8'; g.beginPath(); g.arc(top[0], top[1], 2.6, 0, TAU); g.fill();
      g.strokeStyle = `rgba(103,232,249,${.35 + .3 * Math.sin(t * 1.3)})`; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y + 2, 30 + 3 * Math.sin(t), 9, 0, 0, TAU); g.stroke(); },
    mine(b, t) { const { i, j, lvl } = b, [x, y] = P(i + .5, j + .5); const h = 44 + lvl * 8; glow(x, y - h, 10 + 4 * Math.sin(t * 5), '251,191,36', .9);
      const k = (t * 1.4) % 1; g.fillStyle = `rgba(148,163,184,${.5 * (1 - k)})`; g.beginPath(); g.arc(x + 6, y - 8 - k * 26, 5 + k * 9, 0, TAU); g.fill(); glow(x, y, 16, '251,146,60', .25 + .15 * Math.sin(t * 9)); },
    crys(b, t) { const { i, j } = b, [x, y] = P(i + .5, j + .5); glow(x, y - 10, 30, '232,121,249', .28 + .12 * Math.sin(t * 1.7)); const k = (t * .7) % 1; g.fillStyle = `rgba(245,208,254,${1 - k})`; g.beginPath(); g.arc(x - 10 + 20 * ((t * .37) % 1), y - 10 - k * 24, 1.6, 0, TAU); g.fill(); },
    factory(b, t) { const { i, j, lvl } = b; for (let k = 0; k < 1 + Math.min(2, lvl); k++) { const [x, y] = P(i + 1.55 + k * .14, j + .3 + k * .1, 10); const top = y - 30 - k * 4; glow(x, top, 9, '251,146,60', .6);
        for (let s = 0; s < 3; s++) { const q = ((t * .5 + s / 3 + k * .2) % 1); g.fillStyle = `rgba(148,163,184,${.38 * (1 - q)})`; g.beginPath(); g.arc(x + 4 + q * 14, top - 4 - q * 30, 4 + q * 11, 0, TAU); g.fill(); } }
      const p0 = P(i + 1.85, j + 1.3, 9), p1 = P(i + 2, j + 1.3, 7); for (let s = 0; s < 2; s++) { const q = (t * .6 + s / 2) % 1; g.fillStyle = '#f59e0b'; g.fillRect(p0[0] + (p1[0] - p0[0]) * q - 3, p0[1] + (p1[1] - p0[1]) * q - 4, 6, 4); } },
    refinery(b, t) { const { i, j } = b, [fx, fy] = P(i + 1.75, j + 1.75, 2); const f = 1 + .25 * Math.sin(t * 11) + .15 * Math.sin(t * 17);
      glow(fx, fy - 46, 18 * f, '251,146,60', .9); g.fillStyle = `rgba(254,215,170,.95)`; g.beginPath(); g.moveTo(fx - 3, fy - 44); g.quadraticCurveTo(fx, fy - 56 * f, fx + 1, fy - 62 * f); g.quadraticCurveTo(fx + 2, fy - 52, fx + 3, fy - 44); g.fill(); },
    tower(b, t) { const { i, j, lvl } = b, [x, y] = P(i + .5, j + .5), ty = y - 40 - lvl * 8; glow(x + 23, ty - 26, 7, '244,63,94', .5 + .5 * (Math.sin(t * 3) > .6)); glow(x, ty - 6, 14, '103,232,249', .35); },
    shield(b, t) { const { i, j, lvl } = b, [x, y] = P(i + .5, j + .5); const hh = 30 + lvl * 6; glow(x, y - hh - 4, 22 + 6 * Math.sin(t * 2), '167,139,250', .8); g.fillStyle = '#ede9fe'; g.beginPath(); g.arc(x, y - hh - 4, 4, 0, TAU); g.fill(); },
    lab(b, t) { const { i, j, lvl } = b, [x, y] = P(i + .5, j + .5, 20 + lvl * 6); glow(x, y - 20, 10, '34,211,238', .5 + .3 * Math.sin(t * 4)); },
    pad(b, t) { const { i, j } = b, [x, y] = P(i + 1, j + 1); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU, on = ((t * 4) | 0) % 10 === k; glow(x + Math.cos(a) * 49, y + Math.sin(a) * 24.5, on ? 9 : 5, '253,224,71', on ? 1 : .55); } },
    hab(b, t) { }, green(b, t) { }, solar(b, t) { const { i, j } = b, [x, y] = P(i + .5, j + .5, 12); const q = (t * .25 + (i * 7 + j) * .13) % 1; if (q < .12) glow(x - 8 + q * 120, y - 4, 10, '219,234,254', .5 * (1 - q / .12)); },
    store() { }, yard() { }, ruin(b, t) { const { i, j, w } = b, [x, y] = P(i + w / 2, j + w / 2); const q = (t * .4) % 1; g.fillStyle = `rgba(100,116,139,${.4 * (1 - q)})`; g.beginPath(); g.arc(x, y - 8 - q * 30, 5 + q * 10, 0, TAU); g.fill(); }
  };

  // Baustelle: Gerüst, halbe Höhe, Funken
  function construction(b, t, p) { const { i, j, w } = b, H = 20 + 30 * p; g.strokeStyle = 'rgba(251,191,36,.95)'; g.lineWidth = 1.6;
    const c = [[.1, .1], [w - .1, .1], [w - .1, w - .1], [.1, w - .1]];
    c.forEach(([a, d]) => { const p0 = P(i + a, j + d, 0), p1 = P(i + a, j + d, H); g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke(); });
    for (let z = 10; z <= H; z += 10) { g.beginPath(); c.forEach(([a, d], k) => { const pp = P(i + a, j + d, z); k ? g.lineTo(...pp) : g.moveTo(...pp); }); g.closePath(); g.stroke(); }
    const [x, y] = P(i + w / 2, j + w / 2, H * .6); const k = Math.floor(t * 8) % 3; if (k) { g.save(); g.globalCompositeOperation = 'lighter'; for (let s = 0; s < 6; s++) { const a = s * 1.1 + t * 9, l = 4 + (s * 5 % 9); g.strokeStyle = 'rgba(254,240,138,.9)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } g.restore(); glow(x, y, 14, '254,240,138', .9); } }
  function damaged(b, t) { const { i, j, w } = b, [x, y] = P(i + w / 2, j + w / 2, 10);
    for (let s = 0; s < 3; s++) { const q = (t * .45 + s / 3) % 1; g.fillStyle = `rgba(30,27,46,${.55 * (1 - q)})`; g.beginPath(); g.arc(x + 4 + q * 10, y - 6 - q * 40, 5 + q * 12, 0, TAU); g.fill(); }
    glow(x, y + 4, 16 + 4 * Math.sin(t * 12), '249,115,22', .7); }

  window.ART = {
    use(ctx, proj) { g = ctx; P = proj; },
    draw(b) { (D[b.type] || D.ruin)(b); },
    front(b) { if (b.type === 'yard') D.yardFront(b); },
    anim(b, t) { (A[b.type] || (() => { }))(b, t); },
    construction, damaged, glow, box, cyl, poly, lin, rad, shade, dome
  };
})();
