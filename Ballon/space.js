// Weltraum-Grafiken für Ballon-Alarm. Alles mit Canvas gezeichnet, keine Bilddateien.
// SPACE.ground(g, W, H, pts, thema)  SPACE.tower(g, typ, stufe, winkel, zeit)  SPACE.ship(g, art, radius, winkel, zeit)  SPACE.hero(g, id, lvl, winkel, zeit)
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  let SB = 1;      // 0 = sparsame Effekte (kein Leuchten)
  const lg = (g, x0, y0, x1, y1, st) => { const r = g.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, c]) => r.addColorStop(o, c)); return r; };
  const rg = (g, x0, y0, r0, x1, y1, r1, st) => { const r = g.createRadialGradient(x0, y0, r0, x1, y1, r1); st.forEach(([o, c]) => r.addColorStop(o, c)); return r; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  const COL = { dart: '#38bdf8', boom: '#f59e0b', bomb: '#ef4444', ice: '#7dd3fc', sniper: '#a78bfa', bank: '#fbbf24', tesla: '#22d3ee', glue: '#84cc16', flame: '#f97316', magnet: '#3b82f6', farm: '#facc15', heli: '#34d399', pilot: '#38bdf8', magier: '#c084fc' };
  const SHIELD = { rot: '#ef4444', blau: '#3b82f6', gruen: '#22c55e', gelb: '#facc15', rosa: '#ec4899' };
  const TIERS = ['rot', 'blau', 'gruen', 'gelb', 'rosa'];

  // ---------- Hintergründe je Karte ----------
  const THEME = {
    orbit: { neb: [[620, 120, 330, '56,189,248', .16], [180, 80, 240, '168,85,247', .16], [420, 360, 260, '236,72,153', .07]], planet: ['#3b82f6', '#1e3a8a', '#020617', '125,211,252'], lights: true },
    guertel: { neb: [[200, 300, 340, '251,146,60', .1], [650, 140, 260, '56,189,248', .12]], planet: ['#a8a29e', '#57534e', '#0c0a09', '214,211,209'], rocks: 26 },
    nebel: { neb: [[400, 300, 380, '192,132,252', .22], [150, 500, 260, '236,72,153', .14], [700, 80, 220, '56,189,248', .12]], planet: null },
    eis: { neb: [[600, 200, 340, '125,211,252', .16], [160, 420, 240, '199,210,254', .12]], planet: ['#f0f9ff', '#7dd3fc', '#0c4a6e', '186,230,253'], ice: true },
    mars: { neb: [[300, 160, 340, '251,113,133', .12], [640, 460, 280, '251,146,60', .12]], planet: ['#fdba74', '#c2410c', '#1c0a03', '253,186,116'], dust: true }
  };
  function ground(g, W, H, pts, theme) {
    const T = THEME[theme] || THEME.orbit;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const segs = []; for (let i = 0; i < pts.length - 1; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]; segs.push({ x1, y1, x2, y2, l: Math.hypot(x2 - x1, y2 - y1) || .01 }); }
    const dist = (x, y) => { let m = 1e9; for (const s of segs) { const dx = s.x2 - s.x1, dy = s.y2 - s.y1, t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / (s.l * s.l))); m = Math.min(m, Math.hypot(x - s.x1 - dx * t, y - s.y1 - dy * t)); } return m; };
    const path = w => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(q => g.lineTo(q[0], q[1])); g.lineWidth = w; g.stroke(); };
    g.fillStyle = '#02030a'; g.fillRect(0, 0, W, H);
    T.neb.forEach(([x, y, r, c, a]) => { g.fillStyle = rg(g, x, y, 0, x, y, r, [[0, `rgba(${c},${a})`], [1, `rgba(${c},0)`]]); g.fillRect(0, 0, W, H); });
    for (let i = 0; i < 560; i++) { const x = rnd() * W, y = rnd() * H, s = rnd(); g.fillStyle = s > .97 ? 'rgba(186,230,253,.95)' : `rgba(255,255,255,${.18 + s * .5})`; g.fillRect(x, y, s > .97 ? 2 : 1, s > .97 ? 2 : 1); }
    // Planet am Rand: die Ecke, die am weitesten vom Weg weg ist
    if (T.planet) {
      const cs = [[-60, H + 160], [W + 60, H + 160], [-60, -160], [W + 60, -160]]; let best = cs[0], bd = -1;
      cs.forEach(([x, y]) => { const px = Math.max(0, Math.min(W, x)), py = Math.max(0, Math.min(H, y)), d = dist(px * .8 + W * .1, py * .8 + H * .1); if (d > bd) { bd = d; best = [x, y]; } });
      const [cx, cy] = best, R = 330, [c0, c1, c2, at] = T.planet, lx = cx + (W / 2 - cx) * .4, ly = cy + (H / 2 - cy) * .4;
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip(); g.fillStyle = rg(g, lx, ly, 10, cx, cy, R, [[0, c0], [.45, c1], [1, c2]]); g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,.14)'; for (let i = 0; i < 24; i++) { g.beginPath(); g.ellipse(cx + (rnd() - .5) * 560, cy + (rnd() - .5) * 560, 40 + rnd() * 60, 5 + rnd() * 6, -.4, 0, TAU); g.fill(); }
      if (T.lights) { g.fillStyle = 'rgba(253,224,71,.7)'; for (let i = 0; i < 60; i++) { const a = rnd() * TAU, r = 140 + rnd() * 180; g.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.5, 1.5); } }
      g.restore();
      g.save(); g.strokeStyle = `rgba(${at},.55)`; g.lineWidth = 6; g.shadowColor = `rgb(${at})`; g.shadowBlur = SB * 24; g.beginPath(); g.arc(cx, cy, R + 2, 0, TAU); g.stroke(); g.restore();
    }
    if (T.rocks) for (let i = 0; i < T.rocks; i++) { const x = rnd() * W, y = rnd() * H, r = 5 + rnd() * 14; if (dist(x, y) < 40 + r) continue; g.save(); g.translate(x, y); g.rotate(rnd() * 3); g.fillStyle = lg(g, -r, -r, r, r, [[0, '#a8a29e'], [1, '#292524']]); g.beginPath(); for (let k = 0; k < 9; k++) { const a = k / 9 * TAU, q = r * (.72 + rnd() * .32); g.lineTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(r * .2, r * .15, r * .25, 0, TAU); g.fill(); g.restore(); }
    if (T.ice) for (let i = 0; i < 18; i++) { const x = rnd() * W, y = rnd() * H, r = 4 + rnd() * 8; if (dist(x, y) < 40 + r) continue; g.save(); g.translate(x, y); g.rotate(rnd() * 3); g.fillStyle = 'rgba(186,230,253,.55)'; g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = .8; g.beginPath(); g.moveTo(0, -r * 1.6); g.lineTo(r * .6, 0); g.lineTo(0, r * 1.6); g.lineTo(-r * .6, 0); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    if (T.dust) { for (let i = 0; i < 90; i++) { const x = rnd() * W, y = rnd() * H; g.fillStyle = `rgba(251,146,60,${.08 + rnd() * .15})`; g.beginPath(); g.arc(x, y, 1 + rnd() * 3, 0, TAU); g.fill(); } }
    // Korridor mit Leitbojen
    g.lineCap = g.lineJoin = 'round'; g.strokeStyle = 'rgba(56,189,248,.075)'; path(52); g.strokeStyle = 'rgba(56,189,248,.05)'; path(30);
    g.save(); g.setLineDash([3, 22]); g.strokeStyle = 'rgba(186,230,253,.25)'; path(1.5); g.restore();
    segs.forEach(s => { const n = Math.floor(s.l / 34), nx = -(s.y2 - s.y1) / s.l, ny = (s.x2 - s.x1) / s.l; for (let i = 0; i <= n; i++) { const t = i / Math.max(1, n), x = s.x1 + (s.x2 - s.x1) * t, y = s.y1 + (s.y2 - s.y1) * t; [-1, 1].forEach(k => { const bx = x + nx * k * 26, by = y + ny * k * 26; if (dist(bx, by) < 22 || bx < 0 || by < 0 || bx > W || by > H) return; g.save(); g.shadowColor = k > 0 ? '#f59e0b' : '#38bdf8'; g.shadowBlur = SB * 8; g.fillStyle = k > 0 ? '#fbbf24' : '#7dd3fc'; g.beginPath(); g.arc(bx, by, 1.8, 0, TAU); g.fill(); g.restore(); }); } });
    // Wurmloch (Start) und Sternenbasis (Ziel), an den Rand geholt
    const cl = ([x, y]) => [Math.max(18, Math.min(W - 18, x)), Math.max(18, Math.min(H - 18, y))];
    const [sx, sy] = cl(pts[0]); g.save(); g.translate(sx, sy); for (let i = 6; i >= 1; i--) { g.strokeStyle = `rgba(${i % 2 ? '168,85,247' : '56,189,248'},${.15 + i * .08})`; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, i * 7, i * 9, .3, 0, TAU); g.stroke(); } g.fillStyle = rg(g, 0, 0, 0, 0, 0, 20, [[0, '#fff'], [.3, 'rgba(168,85,247,.8)'], [1, 'rgba(0,0,0,0)']]); g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.fill(); g.restore();
    const e = pts[pts.length - 1], [ex, ey] = cl(e).map((v, i) => i ? v : Math.min(W - 30, v)); base(g, ex, ey);
  }
  function base(g, x, y) {
    g.save(); g.translate(x, y); g.fillStyle = 'rgba(56,189,248,.12)'; g.beginPath(); g.arc(0, 0, 54, 0, TAU); g.fill();
    g.strokeStyle = lg(g, -46, -46, 46, 46, [[0, '#e2e8f0'], [1, '#475569']]); g.lineWidth = 9; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.stroke(); g.strokeStyle = '#94a3b8'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); g.lineTo(Math.cos(a) * 36, Math.sin(a) * 36); g.stroke(); }
    g.fillStyle = rg(g, -4, -4, 1, 0, 0, 14, [[0, '#f8fafc'], [1, '#64748b']]); g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fill(); g.fillStyle = '#38bdf8'; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();
    g.fillStyle = '#fde68a'; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; g.fillRect(Math.cos(a) * 40 - .8, Math.sin(a) * 40 - .8, 1.6, 1.6); } g.restore();
  }

  // ---------- Plattformen ----------
  const hullG = g => lg(g, 0, -12, 0, 12, [[0, '#f1f5f9'], [.5, '#94a3b8'], [1, '#334155']]);
  function glowDot(g, x, y, r, c) { g.save(); g.shadowColor = c; g.shadowBlur = SB * 10; g.fillStyle = rg(g, x, y, 0, x, y, r, [[0, '#fff'], [.4, c], [1, 'rgba(0,0,0,0)']]); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore(); }
  function hull(g, c) {
    const h = hullG(g);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(4, 6, 24, 15, 0, 0, TAU); g.fill();
    [-1, 1].forEach(k => { g.fillStyle = h; g.beginPath(); g.moveTo(-2, k * 5); g.lineTo(-16, k * 17); g.lineTo(-22, k * 17); g.lineTo(-12, k * 4); g.closePath(); g.fill(); g.strokeStyle = 'rgba(15,23,42,.5)'; g.lineWidth = .8; g.stroke();
      g.save(); g.shadowColor = c; g.shadowBlur = SB * 10; g.fillStyle = c; g.beginPath(); g.ellipse(-20, k * 17, 4, 2.2, 0, 0, TAU); g.fill(); g.restore(); });
    g.fillStyle = h; g.beginPath(); g.moveTo(16, 0); g.quadraticCurveTo(10, -9, -12, -7); g.lineTo(-16, 0); g.lineTo(-12, 7); g.quadraticCurveTo(10, 9, 16, 0); g.fill(); g.strokeStyle = 'rgba(15,23,42,.55)'; g.lineWidth = 1; g.stroke();
    g.strokeStyle = 'rgba(15,23,42,.25)'; g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.stroke();
    g.save(); g.beginPath(); g.moveTo(16, 0); g.quadraticCurveTo(10, -9, -12, -7); g.lineTo(-16, 0); g.lineTo(-12, 7); g.quadraticCurveTo(10, 9, 16, 0); g.clip(); g.fillStyle = c; g.globalAlpha = .85; g.fillRect(-6, -9, 4, 18); g.fillRect(-12, -9, 2, 18); g.restore();
    g.fillStyle = 'rgba(253,224,71,.8)'; for (let i = 0; i < 3; i++) g.fillRect(1 + i * 4, -4, 1.4, 1.4);
  }
  function dome(g, c) { g.fillStyle = rg(g, 1, -2, .5, 2, 0, 5, [[0, '#e0f2fe'], [1, c]]); g.beginPath(); g.ellipse(2, 0, 4.5, 3.5, 0, 0, TAU); g.fill(); }
  const WEAPON = {
    dart(g, c, tier) { g.fillStyle = '#334155'; const ys = tier >= 2 ? [-3.5, 0, 3.5] : [-3, 3]; ys.forEach(y => { rr(g, 12, y - 1.1, 12, 2.2, 1); g.fill(); }); g.save(); g.shadowColor = c; g.shadowBlur = SB * 8; g.fillStyle = c; ys.forEach(y => g.fillRect(22, y - 1, 2.5, 2)); g.restore(); },
    boom(g, c, tier, t) { g.save(); g.translate(18, 0); g.rotate(t * 8); g.strokeStyle = c; g.lineWidth = 2; g.shadowColor = c; g.shadowBlur = SB * 8; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.stroke(); g.fillStyle = '#334155'; for (let i = 0; i < 3; i++) { g.rotate(TAU / 3); g.fillRect(2, -1, 5, 2); } g.restore(); },
    bomb(g, c, tier) { g.fillStyle = '#1e293b'; rr(g, 10, -4.5, 15, 9, 3); g.fill(); if (tier >= 2) { rr(g, 10, -8, 12, 3, 1); g.fill(); rr(g, 10, 5, 12, 3, 1); g.fill(); } glowDot(g, 24, 0, 5, c); },
    ice(g, c) { g.save(); g.strokeStyle = c; g.lineWidth = 1.5; g.shadowColor = c; g.shadowBlur = SB * 8; [7, 11].forEach(r => { g.beginPath(); g.ellipse(18, 0, r * .5, r, 0, 0, TAU); g.stroke(); }); g.restore(); g.fillStyle = '#fff'; g.beginPath(); g.arc(18, 0, 2, 0, TAU); g.fill(); },
    sniper(g, c) { g.fillStyle = '#334155'; rr(g, 8, -3.5, 26, 2, 1); g.fill(); rr(g, 8, 1.5, 26, 2, 1); g.fill(); g.save(); g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = SB * 8; g.lineWidth = 1; g.beginPath(); g.moveTo(12, 0); g.lineTo(34, 0); g.stroke(); g.restore(); },
    tesla(g, c) { g.fillStyle = '#475569'; g.beginPath(); g.arc(14, 0, 8, -1.3, 1.3); g.closePath(); g.fill(); g.save(); g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = SB * 10; g.lineWidth = 1.3; g.beginPath(); g.moveTo(15, 0); g.lineTo(20, -3); g.lineTo(18, 0); g.lineTo(24, 2); g.stroke(); g.restore(); glowDot(g, 15, 0, 3, c); },
    glue(g, c) { g.fillStyle = '#334155'; g.beginPath(); g.moveTo(10, -2); g.lineTo(20, -7); g.lineTo(20, 7); g.lineTo(10, 2); g.fill(); g.save(); g.globalAlpha = .35; g.fillStyle = lg(g, 20, 0, 34, 0, [[0, c], [1, 'rgba(0,0,0,0)']]); g.beginPath(); g.moveTo(20, -6); g.lineTo(34, -11); g.lineTo(34, 11); g.lineTo(20, 6); g.fill(); g.restore(); glowDot(g, 20, 0, 3, c); },
    flame(g, c) { g.fillStyle = '#334155'; rr(g, 10, -3.5, 12, 7, 3); g.fill(); g.save(); g.shadowColor = c; g.shadowBlur = SB * 10; g.fillStyle = c; g.beginPath(); g.moveTo(22, -3); g.quadraticCurveTo(30, 0, 22, 3); g.fill(); g.restore(); },
    magnet(g, c, tier, t) { g.save(); g.translate(18, 0); g.strokeStyle = c; g.lineWidth = 1.4; g.shadowColor = c; g.shadowBlur = SB * 10; for (let i = 0; i < 3; i++) { const r = 3 + ((t * 6 + i * 2.5) % 7.5); g.globalAlpha = 1 - r / 11; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); } g.restore(); g.fillStyle = '#020617'; g.beginPath(); g.arc(18, 0, 3.2, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = .7; g.stroke(); }
  };
  function chevrons(g, tier, c) { for (let i = 0; i < tier; i++) { g.fillStyle = c; g.beginPath(); g.moveTo(-9 + i * 7, 24); g.lineTo(-6 + i * 7, 21); g.lineTo(-3 + i * 7, 24); g.fill(); } }
  function shield(g, c, r) { g.save(); g.strokeStyle = c; g.globalAlpha = .45; g.lineWidth = 1; g.shadowColor = c; g.shadowBlur = SB * 10; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); g.globalAlpha = .1; g.fillStyle = c; g.fill(); g.restore(); }
  // Handelsposten: Ringstation mit Frachtcontainern
  function bank(g, c, tier, t) {
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(4, 5, 20, 0, TAU); g.fill();
    g.save(); g.rotate(t * .4); g.strokeStyle = hullG(g); g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.stroke();
    const n = 4 + Math.min(tier, 3) * 2; for (let i = 0; i < n; i++) { g.save(); g.rotate(i / n * TAU); g.fillStyle = ['#f59e0b', '#38bdf8', '#e2e8f0', '#f43f5e'][i % 4]; g.fillRect(13, -2.5, 6, 5); g.restore(); } g.restore();
    g.fillStyle = hullG(g); g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill(); g.strokeStyle = 'rgba(15,23,42,.5)'; g.stroke();
    glowDot(g, 0, 0, 5, c); g.fillStyle = '#422006'; g.font = '800 7px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('C', 0, .5);
  }
  // Kristallmine: Asteroid mit Bohrturm und leuchtenden Kristallen
  function farm(g, c, tier, t) {
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(4, 5, 20, 0, TAU); g.fill();
    g.fillStyle = lg(g, -18, -18, 18, 18, [[0, '#a8a29e'], [1, '#292524']]); g.beginPath(); [[18, 0], [12, 12], [0, 17], [-13, 13], [-18, 1], [-12, -13], [1, -17], [13, -12]].forEach(([x, y]) => g.lineTo(x, y)); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.25)'; [[-7, 6, 4], [8, 7, 3]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); });
    const k = 2 + Math.min(tier, 3); for (let i = 0; i < k; i++) { const a = -2.4 + i * .9, x = Math.cos(a) * 9, y = Math.sin(a) * 9; g.save(); g.translate(x, y); g.rotate(a + 1.57); g.shadowColor = c; g.shadowBlur = SB * 10; g.fillStyle = i % 2 ? '#fde047' : c; g.beginPath(); g.moveTo(0, -6); g.lineTo(2.5, 0); g.lineTo(0, 3); g.lineTo(-2.5, 0); g.closePath(); g.fill(); g.restore(); }
    g.strokeStyle = '#cbd5e1'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(4, 4); g.lineTo(10, -6); g.lineTo(14, 2); g.closePath(); g.stroke(); glowDot(g, 10, -6, 2.5 + Math.sin(t * 6), '#f97316');
  }
  // Jägerhangar: runde Startplattform mit Markierung; der Jäger fliegt separat
  function heli(g, c, tier, t) {
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(4, 5, 21, 0, TAU); g.fill();
    g.fillStyle = hullG(g); g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + TAU / 16; g.lineTo(Math.cos(a) * 19, Math.sin(a) * 19); } g.closePath(); g.fill(); g.strokeStyle = 'rgba(15,23,42,.5)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#1e293b'; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fill();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.fillStyle = (Math.floor(t * 4) % 8) === i ? c : 'rgba(148,163,184,.5)'; g.beginPath(); g.arc(Math.cos(a) * 16, Math.sin(a) * 16, 1.4, 0, TAU); g.fill(); }
    g.strokeStyle = c; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-5, 4); g.lineTo(0, -5); g.lineTo(5, 4); g.moveTo(-5, 8); g.lineTo(0, -1); g.lineTo(5, 8); g.stroke();
  }
  function fighter(g, c, s = 1) { g.save(); g.scale(s, s); g.fillStyle = rg(g, -9, 0, 0, -9, 0, 6, [[0, '#fff'], [.4, c], [1, 'rgba(0,0,0,0)']]); g.beginPath(); g.arc(-9, 0, 6, 0, TAU); g.fill(); g.fillStyle = hullG(g); g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, -8); g.lineTo(-4, 0); g.lineTo(-6, 8); g.closePath(); g.fill(); g.strokeStyle = 'rgba(15,23,42,.6)'; g.lineWidth = .8; g.stroke(); g.fillStyle = c; g.beginPath(); g.ellipse(2, 0, 3, 1.6, 0, 0, TAU); g.fill(); g.restore(); }
  function disc(g, c) { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(4, 5, 20, 0, TAU); g.fill(); g.fillStyle = hullG(g); g.beginPath(); g.arc(0, 0, 18, 0, TAU); g.fill(); g.strokeStyle = 'rgba(15,23,42,.5)'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#1e293b'; g.beginPath(); g.arc(0, 0, 12.5, 0, TAU); g.fill(); for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + TAU / 8; g.save(); g.shadowColor = c; g.shadowBlur = SB * 8; g.fillStyle = c; g.beginPath(); g.arc(Math.cos(a) * 15.5, Math.sin(a) * 15.5, 1.8, 0, TAU); g.fill(); g.restore(); } }
  function ice(g, c, tier, t) { disc(g, c); g.save(); g.rotate(t * .8); for (let i = 0; i < 3; i++) { g.rotate(TAU / 3); g.fillStyle = '#cbd5e1'; rr(g, -1.6, -12, 3.2, 8, 1.5); g.fill(); g.fillStyle = c; g.fillRect(-1.2, -12, 2.4, 2.4); } g.restore(); g.save(); g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = SB * 10; g.lineWidth = 1.2; g.globalAlpha = .7; g.beginPath(); g.arc(0, 0, 6 + Math.sin(t * 4), 0, TAU); g.stroke(); g.restore(); glowDot(g, 0, 0, 4, c); }
  function tesla(g, c, tier, t) { disc(g, c); g.strokeStyle = '#94a3b8'; g.lineWidth = 2; [4, 7.5, 11].forEach((r, i) => { g.globalAlpha = 1 - i * .2; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); }); g.globalAlpha = 1; glowDot(g, 0, 0, 6 + Math.sin(t * 9) * 1.2, c);
    g.save(); g.strokeStyle = '#e0f2fe'; g.shadowColor = c; g.shadowBlur = SB * 8; g.lineWidth = 1; const a = t * 5; g.beginPath(); g.moveTo(0, 0); for (let k = 1; k <= 3; k++) g.lineTo(Math.cos(a + k) * k * 4, Math.sin(a + k * .7) * k * 4); g.stroke(); g.restore(); }
  function magnet(g, c, tier, t) { disc(g, c); g.save(); g.strokeStyle = c; g.lineWidth = 1.4; g.shadowColor = c; g.shadowBlur = SB * 10; for (let i = 0; i < 3; i++) { const r = 12 - ((t * 6 + i * 4) % 12); g.globalAlpha = r / 12; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); } g.restore(); g.fillStyle = '#020617'; g.beginPath(); g.arc(0, 0, 4.5, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = .8; g.stroke(); }
  const SPECIAL = { bank, farm, heli, ice, tesla, magnet };
  const CACHE = { dart: 1, bomb: 1, sniper: 1, glue: 1, flame: 1 };
  function body(g, id, tier, t) { const c = COL[id]; if (SPECIAL[id]) return SPECIAL[id](g, c, tier, t || 0); hull(g, c); g.save(); g.translate(-3, 0); g.scale(1.25, 1.25); WEAPON[id](g, c, tier, t || 0); g.restore(); dome(g, c); }
  function deco(g, id, tier) { const c = COL[id]; chevrons(g, tier, c); if (tier >= 3) shield(g, c, 27); }
  function tower(g, id, tier, ang, t) {
    t = t || 0; const c = COL[id] || '#94a3b8';
    if (SPECIAL[id]) { SPECIAL[id](g, c, tier, t); chevrons(g, tier, c); if (tier >= 3) shield(g, c, 27); return; }
    g.save(); g.rotate(ang || 0); hull(g, c); g.save(); g.translate(-3, 0); g.scale(1.25, 1.25); WEAPON[id](g, c, tier, t); g.restore(); dome(g, c); g.restore();
    chevrons(g, tier, c); if (tier >= 3) shield(g, c, 27);
  }
  // Helden: größeres Schiff mit Ring; ab Lv 5 Goldring, ab Lv 10 Strahlen
  function hero(g, id, lvl, ang, t) {
    const c = COL[id]; t = t || 0;
    if (lvl >= 10) { g.save(); g.globalAlpha = .25; g.strokeStyle = c; g.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + t * .5; g.beginPath(); g.moveTo(Math.cos(a) * 24, Math.sin(a) * 24); g.lineTo(Math.cos(a) * 32, Math.sin(a) * 32); g.stroke(); } g.restore(); }
    g.save(); g.strokeStyle = lvl >= 5 ? '#fbbf24' : 'rgba(148,163,184,.7)'; g.lineWidth = 2; g.setLineDash([5, 4]); g.lineDashOffset = -t * 10; g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.stroke(); g.restore();
    g.save(); g.rotate(ang || 0); g.scale(1.1, 1.1);
    if (id === 'pilot') { fighter(g, c, 1.5); }
    else { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(3, 5, 16, 12, 0, 0, TAU); g.fill(); g.fillStyle = lg(g, 0, -12, 0, 12, [[0, '#ede9fe'], [.5, '#8b5cf6'], [1, '#2e1065']]); g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); } g.closePath(); g.fill(); g.strokeStyle = '#1e1b4b'; g.lineWidth = 1; g.stroke(); g.save(); g.rotate(t); g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = SB * 10; g.lineWidth = 1.2; g.beginPath(); for (let i = 0; i < 5; i++) { const a = i * 2 / 5 * TAU; g.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); } g.closePath(); g.stroke(); g.restore(); glowDot(g, 0, 0, 4, c); }
    g.restore();
    g.fillStyle = '#0b1020'; rr(g, -11, 15, 22, 10, 4); g.fill(); g.strokeStyle = c; g.lineWidth = 1; g.stroke(); g.fillStyle = '#fff'; g.font = '800 7px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Lv ' + lvl, 0, 20.5);
  }

  // ---------- Gegner ----------
  // art: 'rot'..'rosa' (Schildfarbe), 'metall' (Panzerung), 'keramik', 'tarn', 'wachs' (regeneriert)
  function ship(g, kind, r, ang, t) {
    t = t || 0; let i = TIERS.indexOf(kind), c = SHIELD[kind];
    if (kind === 'metall') { i = 3; c = '#cbd5e1'; } else if (kind === 'keramik') { i = 4; c = '#fb923c'; } else if (kind === 'tarn') { i = 2; c = '#86efac'; } else if (kind === 'wachs') { i = 3; c = '#f472b6'; }
    g.save(); g.rotate(ang || 0); const s = r / 15; g.scale(s, s); if (kind === 'tarn') g.globalAlpha = .55;
    g.save(); g.shadowColor = c; g.shadowBlur = SB * 12; g.strokeStyle = c; g.globalAlpha *= .55 + .2 * Math.sin(t * 6 + i); g.lineWidth = 1.6; if (kind === 'tarn') g.setLineDash([3, 3]); g.beginPath(); g.ellipse(0, 0, 20, 15, 0, 0, TAU); g.stroke(); g.globalAlpha *= .18; g.fillStyle = c; g.fill(); g.restore();
    g.fillStyle = rg(g, -16, 0, 0, -16, 0, 9, [[0, '#fff'], [.4, '#f59e0b'], [1, 'rgba(0,0,0,0)']]); g.beginPath(); g.arc(-15, 0, 8, 0, TAU); g.fill();
    if (i >= 2) { g.fillStyle = '#111827'; g.strokeStyle = c; g.lineWidth = 1; [-1, 1].forEach(k => { g.beginPath(); g.moveTo(-2, k * 8); g.lineTo(-10, k * (i >= 3 ? 19 : 16)); g.lineTo(-14, k * (i >= 3 ? 18 : 15)); g.lineTo(-8, k * 6); g.closePath(); g.fill(); g.stroke(); }); }
    if (i >= 4) { g.fillStyle = '#1f2937'; g.beginPath(); g.ellipse(-2, 0, 6, 13, 0, 0, TAU); g.fill(); g.strokeStyle = c; g.stroke(); }
    const body = kind === 'metall' ? lg(g, 0, -10, 0, 10, [[0, '#f8fafc'], [.4, '#94a3b8'], [1, '#334155']]) : kind === 'keramik' ? lg(g, 0, -10, 0, 10, [[0, '#fdba74'], [.5, '#9a3412'], [1, '#431407']]) : lg(g, 0, -10, 0, 10, [[0, '#4b5563'], [.5, '#1f2937'], [1, '#030712']]);
    g.fillStyle = body; g.beginPath(); g.moveTo(15, 0); g.lineTo(-6, -11); g.lineTo(-12, -9); g.lineTo(-8, 0); g.lineTo(-12, 9); g.lineTo(-6, 11); g.closePath(); g.fill(); g.strokeStyle = c; g.lineWidth = 1.2; g.stroke();
    if (kind === 'metall') { g.fillStyle = '#475569'; [[-2, -5], [-2, 5], [4, 0]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 1.1, 0, TAU); g.fill(); }); }
    g.fillStyle = kind === 'metall' ? '#38bdf8' : c; g.beginPath(); g.moveTo(9, 0); g.lineTo(0, -3); g.lineTo(0, 3); g.fill();
    if (kind === 'wachs') { g.fillStyle = '#fff'; g.font = '800 9px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+', -3, .5); }
    g.restore();
  }
  // Boss: Mutterschiff
  function mother(g, t) {
    g.save(); g.fillStyle = 'rgba(244,63,94,.12)'; g.beginPath(); g.ellipse(0, 0, 56, 34, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(244,63,94,.6)'; g.lineWidth = 1.6; g.shadowColor = '#f43f5e'; g.shadowBlur = SB * 14; g.beginPath(); g.ellipse(0, 0, 56, 34, 0, 0, TAU); g.stroke(); g.shadowBlur = SB * 0;
    [-1, 1].forEach(k => glowDot(g, -40, k * 10, 9, '#f97316'));
    g.fillStyle = lg(g, 0, -26, 0, 26, [[0, '#6b7280'], [.5, '#1f2937'], [1, '#030712']]); g.beginPath(); g.moveTo(44, 0); g.lineTo(10, -14); g.lineTo(-10, -28); g.lineTo(-38, -22); g.lineTo(-30, 0); g.lineTo(-38, 22); g.lineTo(-10, 28); g.lineTo(10, 14); g.closePath(); g.fill(); g.strokeStyle = '#f43f5e'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#f43f5e'; for (let i = 0; i < 5; i++) g.fillRect(-20 + i * 8, -1, 4, 2); glowDot(g, 22, 0, 5, '#f43f5e'); g.restore();
  }
  // Bosse: Mutterschiff, Panzerkreuzer, Drohnenträger, Tarnkreuzer (Radius etwa 36)
  function boss(g, bk, t) {
    t = t || 0;
    if (bk === 'schwarm') {
      g.save(); g.fillStyle = 'rgba(250,204,21,.1)'; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill();
      for (let i = 0; i < 10; i++) { const a = t * 1.4 + i / 10 * TAU, r = 34 + Math.sin(t * 3 + i) * 3; g.save(); g.translate(Math.cos(a) * r, Math.sin(a) * r); g.rotate(a + Math.PI / 2); ship(g, 'gelb', 5, 0, t); g.restore(); }
      g.fillStyle = lg(g, 0, -22, 0, 22, [[0, '#6b7280'], [.5, '#1f2937'], [1, '#030712']]); g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + TAU / 12; g.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); } g.closePath(); g.fill(); g.strokeStyle = '#facc15'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#111827'; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.save(); g.translate(Math.cos(a) * 13, Math.sin(a) * 13); g.beginPath(); for (let k = 0; k < 6; k++) { const b = k / 6 * TAU; g.lineTo(Math.cos(b) * 5, Math.sin(b) * 5); } g.closePath(); g.fill(); g.strokeStyle = 'rgba(250,204,21,.6)'; g.lineWidth = .8; g.stroke(); g.restore(); }
      glowDot(g, 0, 0, 6, '#facc15'); g.restore(); return;
    }
    g.save(); g.scale(.78, .78); if (bk === 'tarn') g.globalAlpha = .55;
    mother(g, t, bk === 'panzer' ? '#fbbf24' : bk === 'tarn' ? '#86efac' : '#f43f5e', bk === 'panzer', bk === 'tarn');
    g.restore();
  }
  // Gegenstände: Minenfeld, Stasisbombe, Hüllenreparatur
  function item(g, id, t) {
    t = t || 0;
    if (id === 'spikes') { [[-11, 2], [0, -4], [11, 2]].forEach(([x, y], i) => { g.save(); g.translate(x, y); g.fillStyle = lg(g, -5, -5, 5, 5, [[0, '#94a3b8'], [1, '#1e293b']]); g.beginPath(); g.arc(0, 0, 5.5, 0, TAU); g.fill(); g.strokeStyle = '#0f172a'; g.lineWidth = 1; g.stroke(); g.strokeStyle = '#64748b'; g.lineWidth = 1.4; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 5.5, Math.sin(a) * 5.5); g.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); g.stroke(); } glowDot(g, 0, 0, 2.6, (Math.floor(t * 3 + i) % 2) ? '#ef4444' : '#7f1d1d'); g.restore(); }); return; }
    if (id === 'icebomb') { g.save(); g.strokeStyle = '#7dd3fc'; g.shadowColor = '#7dd3fc'; g.shadowBlur = SB * 10; g.lineWidth = 1.4; [9, 12].forEach(r => { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); }); g.restore(); g.fillStyle = lg(g, -7, -7, 7, 7, [[0, '#e0f2fe'], [1, '#0369a1']]); g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.lineTo(Math.cos(a) * 7, Math.sin(a) * 7); } g.closePath(); g.fill(); glowDot(g, 0, 0, 3, '#fff'); return; }
    if (id === 'heart') { g.fillStyle = lg(g, 0, -11, 0, 11, [[0, '#93c5fd'], [1, '#1d4ed8']]); g.beginPath(); g.moveTo(0, -11); g.lineTo(10, -7); g.lineTo(9, 3); g.quadraticCurveTo(6, 9, 0, 12); g.quadraticCurveTo(-6, 9, -9, 3); g.lineTo(-10, -7); g.closePath(); g.fill(); g.strokeStyle = '#e0f2fe'; g.lineWidth = 1.2; g.stroke(); g.fillStyle = '#fff'; g.fillRect(-1.5, -5, 3, 10); g.fillRect(-5, -1.5, 10, 3); }
  }
  // Energiekristall (statt Banane)
  function crystal(g, x, y, b, t) {
    g.save(); g.translate(x, y + b); g.fillStyle = 'rgba(250,204,21,.18)'; g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill();
    g.shadowColor = '#facc15'; g.shadowBlur = SB * 10; g.fillStyle = lg(g, -5, -9, 5, 9, [[0, '#fef9c3'], [.5, '#facc15'], [1, '#a16207']]); g.beginPath(); g.moveTo(0, -9); g.lineTo(5, -2); g.lineTo(3, 8); g.lineTo(-3, 8); g.lineTo(-5, -2); g.closePath(); g.fill(); g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = .8; g.beginPath(); g.moveTo(0, -9); g.lineTo(0, 8); g.stroke(); g.restore();
  }
  // Weltraumwetter: Nebelfeld (regen), Sonnenwind (wind), Ionensturm (sturm)
  function weather(g, W, H, wx, t) {
    g.save();
    if (wx === 'regen') { for (let i = 0; i < 7; i++) { const x = ((i * 173 + t * 14) % (W + 300)) - 150, y = (i * 97) % H; g.fillStyle = rg(g, x, y, 0, x, y, 160, [[0, 'rgba(168,85,247,.17)'], [1, 'rgba(168,85,247,0)']]); g.fillRect(x - 160, y - 160, 320, 320); } }
    else if (wx === 'wind') { g.strokeStyle = 'rgba(253,224,71,.22)'; g.lineWidth = 1.2; for (let i = 0; i < 46; i++) { const sp = 260 + (i % 5) * 60, x = ((i * 137 + t * sp) % (W + 200)) - 100, y = (i * 71) % H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 26, y - 6); g.stroke(); } g.fillStyle = 'rgba(253,224,71,.03)'; g.fillRect(0, 0, W, H); }
    else if (wx === 'sturm') { g.fillStyle = 'rgba(56,189,248,.04)'; g.fillRect(0, 0, W, H); for (let i = 0; i < 60; i++) { const x = (i * 211 + Math.floor(t * 8) * 37) % W, y = (i * 113 + Math.floor(t * 8) * 59) % H; g.fillStyle = 'rgba(186,230,253,.35)'; g.fillRect(x, y, 2, 1); }
      if ((t * 1.3) % 3 < .12) { g.strokeStyle = 'rgba(186,230,253,.55)'; g.lineWidth = 1.5; g.beginPath(); let x = (Math.floor(t * 1.3 / 3) * 263) % W, y = 0; g.moveTo(x, y); while (y < H) { x += (Math.sin(y * 13 + t) * 22); y += 30; g.lineTo(x, y); } g.stroke(); g.fillStyle = 'rgba(186,230,253,.06)'; g.fillRect(0, 0, W, H); } }
    g.restore();
  }
  function setLite(v) { SB = v ? 0 : 1; }
  // Farbe je Gegner-Art (für Vorschau und Effekte)
  window.SPACE = { ground, tower, body, deco, CACHE, hero, ship, mother, boss, fighter, base, item, crystal, weather, setLite, COL, SHIELD };
})();
