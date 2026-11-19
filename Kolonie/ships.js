// Kolonie/ships.js - detaillierte Raumschiffe für die Sternenkolonie (Canvas 2D, ohne Bilddateien).
// Alle Schiffe zeigen mit der Nase nach +x, Licht kommt von oben links.
(function () {
  const TAU = Math.PI * 2;
  const L = (g, x0, y0, x1, y1, st) => { const l = g.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, c]) => l.addColorStop(o, c)); return l; };
  const RG = (g, x, y, r0, r1, st) => { const l = g.createRadialGradient(x, y, r0, x, y, r1); st.forEach(([o, c]) => l.addColorStop(o, c)); return l; };
  const path = (g, pts) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); };
  const mirror = pts => pts.concat(pts.slice().reverse().map(([x, y]) => [x, -y]));
  function bloom(g, x, y, r, rgb, a) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = RG(g, x, y, 0, r, [[0, `rgba(${rgb},${a})`], [.35, `rgba(${rgb},${a * .4})`], [1, `rgba(${rgb},0)`]]); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }

  // Metall-Füllung über die Breite (oben hell, unten dunkel) + Rimlight
  function metal(g, pts, w, base, opt = {}) {
    const [hi, mid, lo] = base;
    path(g, pts); g.fillStyle = L(g, 0, -w, 0, w, [[0, hi], [.42, mid], [.58, mid], [1, lo]]); g.fill();
    // weiche Glanzlinie
    g.save(); path(g, pts); g.clip();
    g.fillStyle = L(g, 0, -w, 0, w * .2, [[0, 'rgba(255,255,255,.35)'], [.5, 'rgba(255,255,255,.06)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(-999, -w, 1998, w * 1.2);
    if (opt.panels) { g.strokeStyle = 'rgba(8,12,24,.35)'; g.lineWidth = .8; opt.panels.forEach(([x0, y0, x1, y1]) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); });
      g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = .6; opt.panels.forEach(([x0, y0, x1, y1]) => { g.beginPath(); g.moveTo(x0, y0 - .8); g.lineTo(x1, y1 - .8); g.stroke(); }); }
    g.restore();
    path(g, pts); g.strokeStyle = 'rgba(4,8,18,.75)'; g.lineWidth = 1; g.stroke();
  }
  function cockpit(g, x, y, rx, ry, tint = '14,116,144') {
    g.fillStyle = RG(g, x - rx * .3, y - ry * .4, 1, rx * 1.3, [[0, `rgba(${tint},1)`], [.6, '#04121f'], [1, '#020611']]);
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(148,163,184,.8)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = 'rgba(224,242,254,.75)'; g.beginPath(); g.ellipse(x + rx * .15, y - ry * .45, rx * .55, ry * .22, -.15, 0, TAU); g.fill();
  }
  // Triebwerk: Düse + Strahl (Länge t), Farbe
  function engine(g, x, y, r, t, rgb = '125,211,252', core = '#f0f9ff') {
    g.fillStyle = '#0b1220'; g.beginPath(); g.ellipse(x, y, r * .55, r, 0, 0, TAU); g.fill();
    g.strokeStyle = '#64748b'; g.lineWidth = 1.2; g.stroke();
    if (t > 0) {
      g.save(); g.globalCompositeOperation = 'lighter';
      g.fillStyle = L(g, x, 0, x - r * 9 * t, 0, [[0, `rgba(${rgb},.95)`], [.25, `rgba(${rgb},.55)`], [1, `rgba(${rgb},0)`]]);
      g.beginPath(); g.moveTo(x, y - r * .9); g.quadraticCurveTo(x - r * 4 * t, y - r * .6, x - r * 9 * t, y); g.quadraticCurveTo(x - r * 4 * t, y + r * .6, x, y + r * .9); g.fill();
      g.fillStyle = L(g, x, 0, x - r * 4 * t, 0, [[0, core], [1, 'rgba(255,255,255,0)']]);
      g.beginPath(); g.moveTo(x, y - r * .35); g.lineTo(x - r * 4 * t, y); g.lineTo(x, y + r * .35); g.fill();
      g.restore(); bloom(g, x, y, r * 3.2, rgb, .8);
    }
    g.fillStyle = core; g.beginPath(); g.ellipse(x - .5, y, r * .3, r * .6, 0, 0, TAU); g.fill();
  }
  function nav(g, x, y, c, rgb) { bloom(g, x, y, 7, rgb, .9); g.fillStyle = c; g.beginPath(); g.arc(x, y, 1.4, 0, TAU); g.fill(); }
  function stripe(g, pts, c) { path(g, pts); g.fillStyle = c; g.fill(); }

  const COLORS = {
    white: ['#f8fafc', '#a8b3c7', '#334155'], steel: ['#cbd5e1', '#64748b', '#1e293b'], dark: ['#94a3b8', '#3f4a5e', '#0f172a'],
    pirate: ['#a8a29e', '#57534e', '#1c1917'], gold: ['#fde68a', '#b45309', '#451a03']
  };

  // ---------- Abfangjäger ----------
  function fighter(g, o = {}) {
    const acc = o.accent || '#22d3ee', t = o.thrust ?? 1, C = COLORS[o.hull || 'white'];
    // Flügel (hinten, unten)
    const wing = [[10, 4], [-2, 6], [-16, 23], [-27, 24.5], [-24, 9], [-20, 4.5]];
    g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
    metal(g, wing, 24, C, { panels: [[-2, 8, -20, 18], [-12, 7, -24, 14]] }); metal(g, wing.map(([x, y]) => [x, -y]), 24, C, { panels: [[-2, -8, -20, -18], [-12, -7, -24, -14]] }); g.restore();
    stripe(g, [[-9, 13], [-16, 21], [-22, 21.5], [-15, 13]], acc); stripe(g, [[-9, -13], [-16, -21], [-22, -21.5], [-15, -13]], acc);
    // Waffen an den Flügelspitzen
    for (const sg of [1, -1]) { g.fillStyle = L(g, 0, sg * 23, 0, sg * 26.5, [[0, '#64748b'], [1, '#0f172a']]); g.fillRect(-28, sg > 0 ? 23 : -26.5, 26, 3.5); g.fillStyle = '#94a3b8'; g.fillRect(-2, sg > 0 ? 23.8 : -25.6, 9, 1.8); bloom(g, 7, sg * 24.7, 4, '34,211,238', .6); }
    // Rumpf
    const hull = mirror([[34, 0], [24, -2.6], [10, -5], [-6, -6.4], [-18, -6], [-22, -4.4]]);
    metal(g, hull, 6.5, C, { panels: [[16, -3.8, 16, 3.8], [2, -5.6, 2, 5.6], [-10, -6.2, -10, 6.2], [-10, 0, 24, 0]] });
    stripe(g, [[8, -5.2], [-6, -6.4], [-6, -4.2], [8, -3.4]], acc);
    // Lufteinlässe
    g.fillStyle = '#0b1220'; g.fillRect(-4, -8.2, 10, 2.4); g.fillRect(-4, 5.8, 10, 2.4);
    cockpit(g, 13, 0, 8, 3.2);
    engine(g, -22, -2.6, 2.6, t, o.flame || '125,211,252'); engine(g, -22, 2.6, 2.6, t, o.flame || '125,211,252');
    nav(g, -28, -25, '#fb7185', '244,63,94'); nav(g, -28, 25, '#4ade80', '74,222,128'); nav(g, 33, 0, '#fff', '255,255,255');
  }

  // ---------- Frachter ----------
  function freighter(g, o = {}) {
    const acc = o.accent || '#f59e0b', t = o.thrust ?? 1, C = COLORS[o.hull || 'steel'];
    // Container-Rücken
    g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8; g.shadowOffsetY = 4;
    metal(g, [[18, -11], [-34, -11], [-38, -8], [-38, 8], [-34, 11], [18, 11]], 11, COLORS.dark, {}); g.restore();
    const cc = ['#b45309', '#0369a1', '#9f1239', '#a16207', '#166534', '#334155'];
    for (let k = 0; k < 6; k++) { const x = -32 + k * 8.4; for (const s of [-1, 1]) {
      g.fillStyle = L(g, 0, s * 1, 0, s * 9.5, [[0, cc[(k + (s > 0)) % 6]], [1, '#1c1917']]); g.fillRect(x, s > 0 ? 1 : -9.5, 7.4, 8.5);
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = .6; for (let q = 1; q < 4; q++) { g.beginPath(); g.moveTo(x + q * 1.85, s > 0 ? 1.5 : -9); g.lineTo(x + q * 1.85, s > 0 ? 9 : -1.5); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x, s > 0 ? 1 : -9.5, 7.4, 1); } }
    g.fillStyle = '#334155'; g.fillRect(-34, -1, 52, 2);
    // Brücke / Bug
    const bow = mirror([[40, 0], [34, -4], [24, -8], [16, -9], [16, -9]]);
    metal(g, mirror([[40, 0], [34, -4.5], [24, -8.5], [14, -9.5]]), 9.5, C, { panels: [[28, -6, 28, 6], [20, -8.5, 20, 8.5]] });
    stripe(g, [[30, -6.2], [22, -8.6], [22, -7], [30, -4.8]], acc); stripe(g, [[30, 6.2], [22, 8.6], [22, 7], [30, 4.8]], acc);
    cockpit(g, 31, 0, 5.5, 3, '30,64,175');
    // Antriebsblock
    metal(g, [[-36, -12], [-44, -13], [-46, -9], [-46, 9], [-44, 13], [-36, 12]], 13, C, {});
    for (const y of [-8, 0, 8]) engine(g, -46, y, 3, t, o.flame || '251,191,36', '#fffbeb');
    nav(g, -40, -13, '#fb7185', '244,63,94'); nav(g, -40, 13, '#4ade80', '74,222,128'); nav(g, 0, -11, '#fde047', '253,224,71');
  }

  // ---------- Forscher ----------
  function scout(g, o = {}) {
    const acc = o.accent || '#a78bfa', t = o.thrust ?? 1, C = COLORS[o.hull || 'white'];
    // Sensorring
    g.save(); g.strokeStyle = 'rgba(167,139,250,.35)'; g.lineWidth = 5; g.beginPath(); g.ellipse(-6, 0, 7, 18, 0, 0, TAU); g.stroke();
    g.strokeStyle = L(g, 0, -18, 0, 18, [[0, '#e2e8f0'], [1, '#475569']]); g.lineWidth = 2.4; g.stroke(); g.restore();
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; bloom(g, -6 + Math.cos(a) * 7, Math.sin(a) * 18, 5, '196,181,253', .8); }
    const hull = mirror([[32, 0], [22, -3.5], [8, -5.5], [-10, -5], [-20, -3.5]]);
    metal(g, hull, 6, C, { panels: [[14, -4.6, 14, 4.6], [0, -5.4, 0, 5.4], [-12, 0, 20, 0]] });
    // Antennen
    g.strokeStyle = '#cbd5e1'; g.lineWidth = 1; g.beginPath(); g.moveTo(26, -2); g.lineTo(40, -7); g.moveTo(26, 2); g.lineTo(40, 7); g.stroke(); nav(g, 40, -7, '#c4b5fd', '196,181,253'); nav(g, 40, 7, '#c4b5fd', '196,181,253');
    stripe(g, [[10, -5.2], [-8, -5], [-8, -3.4], [10, -3.6]], acc); stripe(g, [[10, 5.2], [-8, 5], [-8, 3.4], [10, 3.6]], acc);
    cockpit(g, 17, 0, 6.5, 2.8, '91,33,182');
    engine(g, -20, 0, 3.2, t, o.flame || '196,181,253');
  }

  // ---------- Bergbau-Drohne ----------
  function drone(g, o = {}) {
    const t = o.thrust ?? 1, C = COLORS[o.hull || 'steel'];
    metal(g, mirror([[14, 0], [10, -6], [-4, -8], [-12, -6]]), 8, C, { panels: [[2, -7, 2, 7]] });
    g.fillStyle = '#fbbf24'; for (let k = 0; k < 4; k++) g.fillRect(-10 + k * 6, -8.2, 3, 1.6);
    // Greifarme
    g.strokeStyle = '#94a3b8'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, -4); g.lineTo(20, -8); g.lineTo(24, -4); g.moveTo(10, 4); g.lineTo(20, 8); g.lineTo(24, 4); g.stroke();
    bloom(g, 6, 0, 8, '251,191,36', .9); g.fillStyle = '#fde68a'; g.beginPath(); g.arc(6, 0, 2, 0, TAU); g.fill();
    engine(g, -12, -3, 2, t, '251,191,36', '#fffbeb'); engine(g, -12, 3, 2, t, '251,191,36', '#fffbeb');
  }

  // ---------- Kreuzer ----------
  function cruiser(g, o = {}) {
    const acc = o.accent || '#38bdf8', t = o.thrust ?? 1, C = COLORS[o.hull || 'steel'];
    // Seitenausleger
    const pod = [[16, 14], [-18, 17], [-44, 36], [-64, 37], [-62, 18], [-52, 11]];
    g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 10; g.shadowOffsetY = 5;
    metal(g, pod, 37, C, { panels: [[-14, 18, -50, 33], [0, 15.5, -40, 20], [-30, 22, -60, 22]] }); metal(g, pod.map(([x, y]) => [x, -y]), 37, C, { panels: [[-14, -18, -50, -33], [0, -15.5, -40, -20], [-30, -22, -60, -22]] }); g.restore();
    stripe(g, [[-26, 22], [-46, 35], [-54, 35.5], [-34, 22]], acc); stripe(g, [[-26, -22], [-46, -35], [-54, -35.5], [-34, -22]], acc);
    // Hauptrumpf
    const hull = mirror([[78, 0], [60, -6], [36, -12], [6, -16], [-30, -17], [-58, -14], [-66, -10]]);
    g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 12; g.shadowOffsetY = 5;
    metal(g, hull, 17, C, { panels: [[50, -8, 50, 8], [30, -12.6, 30, 12.6], [10, -15.4, 10, 15.4], [-12, -16.6, -12, 16.6], [-36, -16.6, -36, 16.6], [-60, 0, 66, 0], [-40, -9, 40, -9], [-40, 9, 40, 9]] }); g.restore();
    // Aufbau / Brücke
    metal(g, mirror([[22, 0], [16, -5], [-2, -7], [-14, -6]]), 7, COLORS.white, { panels: [[6, -6, 6, 6]] });
    cockpit(g, 14, 0, 5, 3.2);
    // Geschütztürme
    for (const [x, y] of [[44, -6], [44, 6], [-24, -10], [-24, 10]]) { g.fillStyle = RG(g, x - 1, y - 1, 0, 5, [[0, '#cbd5e1'], [1, '#334155']]); g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); g.strokeStyle = '#0f172a'; g.lineWidth = .8; g.stroke(); g.fillStyle = '#1e293b'; g.fillRect(x, y - 1.6, 9, 1.2); g.fillRect(x, y + .4, 9, 1.2); }
    // Fensterreihen
    g.fillStyle = 'rgba(186,230,253,.9)'; for (let k = 0; k < 12; k++) { if (k % 5 === 3) continue; g.fillRect(-44 + k * 6.5, -13.4, 2.6, 1.2); g.fillRect(-44 + k * 6.5, 12.2, 2.6, 1.2); }
    stripe(g, [[60, -6], [40, -11], [40, -9], [58, -4.6]], acc); stripe(g, [[60, 6], [40, 11], [40, 9], [58, 4.6]], acc);
    // Antrieb
    metal(g, [[-62, -16], [-72, -16], [-74, -12], [-74, 12], [-72, 16], [-62, 16]], 16, COLORS.dark, {});
    for (const y of [-10, 0, 10]) engine(g, -74, y, 4.4, t, o.flame || '129,140,248', '#eef2ff');
    for (const y of [-30, 30]) engine(g, -63, y, 3, t * .8, o.flame || '129,140,248', '#eef2ff');
    nav(g, -62, -37, '#fb7185', '244,63,94'); nav(g, -62, 37, '#4ade80', '74,222,128'); nav(g, 77, 0, '#fff', '255,255,255'); nav(g, -8, 0, '#fde047', '253,224,71');
  }

  // ---------- Kolonieschiff ----------
  function colony(g, o = {}) {
    const t = o.thrust ?? 1, C = COLORS[o.hull || 'white'];
    metal(g, mirror([[70, 0], [56, -6], [-50, -6], [-60, -4]]), 6, COLORS.steel, { panels: [[-40, 0, 60, 0]] });
    // Habitat-Ringe
    for (const x of [-26, 10]) { g.save(); g.strokeStyle = 'rgba(74,222,128,.25)'; g.lineWidth = 8; g.beginPath(); g.ellipse(x, 0, 9, 26, 0, 0, TAU); g.stroke();
      g.strokeStyle = L(g, 0, -26, 0, 26, [[0, '#f8fafc'], [.5, '#94a3b8'], [1, '#334155']]); g.lineWidth = 4.5; g.stroke(); g.restore();
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; g.fillStyle = 'rgba(134,239,172,.95)'; g.fillRect(x + Math.cos(a) * 9 - 1, Math.sin(a) * 26 - 1, 2, 2); } }
    // Gewächskuppel vorne
    g.fillStyle = RG(g, 38, -4, 1, 16, [[0, 'rgba(220,252,231,.95)'], [.5, 'rgba(74,222,128,.55)'], [1, 'rgba(21,128,61,.35)']]); g.beginPath(); g.ellipse(40, 0, 15, 11, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(187,247,208,.8)'; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.25)'; for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(40, 0, 15 * k / 4, 11, 0, 0, TAU); g.stroke(); }
    metal(g, mirror([[-56, -12], [-66, -12], [-68, -8]]).concat([]), 12, COLORS.dark, {});
    for (const y of [-7, 7]) engine(g, -68, y, 4, t, '74,222,128', '#f0fdf4');
    nav(g, 70, 0, '#fff', '255,255,255');
  }

  // ---------- Pirat ----------
  function pirate(g, o = {}) {
    const t = o.thrust ?? 1, C = COLORS.pirate;
    const wing = [[10, 4], [-2, 9], [-6, 26], [-20, 24], [-18, 6]];
    metal(g, wing, 24, C, { panels: [[-2, 9, -12, 20]] }); metal(g, wing.map(([x, y]) => [x, -y]), 24, C, {});
    stripe(g, [[-6, 12], [-11, 22], [-15, 21], [-11, 12]], '#dc2626'); stripe(g, [[-6, -12], [-11, -22], [-15, -21], [-11, -12]], '#dc2626');
    metal(g, mirror([[30, 0], [16, -4], [0, -6], [-14, -5], [-18, -3]]), 6, C, { panels: [[6, -5.6, 6, 5.6], [-8, -5.8, -8, 5.8]] });
    // Zacken
    g.fillStyle = '#292524'; path(g, [[18, -3.6], [24, -9], [14, -4.4]]); g.fill(); path(g, [[18, 3.6], [24, 9], [14, 4.4]]); g.fill();
    cockpit(g, 12, 0, 6, 2.6, '153,27,27');
    engine(g, -18, 0, 3.2, t, '248,113,113', '#fff1f2');
    nav(g, -14, -22, '#ef4444', '239,68,68'); nav(g, -14, 22, '#ef4444', '239,68,68');
  }

  // Zeichnet ein Schiff an x,y mit Winkel und Skalierung; tilt staucht für Iso-Ansicht.
  function draw(g, type, x, y, s = 1, ang = 0, o = {}) {
    g.save(); g.translate(x, y);
    if (o.shadow) { g.save(); g.translate(o.shadow[0], o.shadow[1]); g.scale(1, .5); g.rotate(ang); g.scale(s, s); g.fillStyle = 'rgba(0,0,0,' + (o.shadowA || .35) + ')'; g.beginPath(); g.ellipse(0, 0, (SIZE[type] || 30), (SIZE[type] || 30) * .45, 0, 0, TAU); g.fill(); g.restore(); }
    if (o.alpha != null) g.globalAlpha = o.alpha;
    if (o.iso) g.scale(1, o.iso); g.rotate(ang); g.scale(s, s * (o.tilt || 1));
    ({ fighter, freighter, scout, drone, cruiser, colony, pirate })[type](g, o); g.restore();
  }
  const SIZE = { fighter: 28, freighter: 42, scout: 26, drone: 14, cruiser: 72, colony: 66, pirate: 24 };
  window.SHIPS = { draw, bloom, SIZE };
})();
