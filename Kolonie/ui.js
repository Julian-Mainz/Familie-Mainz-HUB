// Kolonie/ui.js - Darstellung und Bedienung der Sternenkolonie: Kamera, Zeichnen, Bauen, Fenster.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2, N = G.N, TW = 64, TH = 32, OX = N * TW / 2 + 90, OY = 210, WW = N * TW + 180, WH = N * TH + 210 + 190;
  const P = (i, j, z = 0) => [OX + (i - j) * TW / 2, OY + (i + j) * TH / 2 - z];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => { n = Math.floor(n || 0); const a = Math.abs(n); if (a >= 1e6) return (n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio'; return n.toLocaleString('de-DE'); };
  const fmtR = r => (r >= 0 ? '+' : '−') + (Math.abs(r) >= 10 ? Math.round(Math.abs(r)) : Math.abs(r).toLocaleString('de-DE', { maximumFractionDigits: 1 }));
  const dur = s => { s = Math.max(0, Math.ceil(s)); if (s >= 3600) return Math.floor(s / 3600) + ' Std ' + Math.floor(s % 3600 / 60) + ' Min'; if (s >= 60) return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' Min'; return s + ' s'; };
  const IC = {
    ore: '<svg viewBox="0 0 24 24"><path d="m4 15 4-9 7 1 5 7-6 6H8z" fill="#94a3b8"/><path d="m8 6 7 1-3 5z" fill="#e2e8f0"/></svg>',
    crys: '<svg viewBox="0 0 24 24"><path d="M12 2 18 9l-6 13L6 9z" fill="#c084fc"/><path d="M12 2 18 9H6z" fill="#f5d0fe"/></svg>',
    parts: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="none" stroke="#38bdf8" stroke-width="3.4" stroke-dasharray="3.2 2.4"/><circle cx="12" cy="12" r="3.2" fill="#7dd3fc"/></svg>',
    fuel: '<svg viewBox="0 0 24 24"><path d="M12 2s6 7 6 12a6 6 0 0 1-12 0c0-5 6-12 6-12z" fill="#fb923c"/><path d="M12 10s3 3.4 3 5.6a3 3 0 0 1-6 0C9 13.4 12 10 12 10z" fill="#fde68a"/></svg>',
    cred: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#fbbf24"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#b45309" stroke-width="1.5"/><path d="M14.5 9.2a3 3 0 1 0 0 5.6" stroke="#78350f" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    energy: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="#fde047"/></svg>',
    pop: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" fill="#86efac"/><circle cx="16.5" cy="9" r="2.8" fill="#4ade80"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6zM13 20c.3-3 2-5 4-5 2.5 0 4 2 4 5z" fill="#4ade80"/></svg>',
    def: '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" fill="#67e8f9"/><path d="M12 5v14c3-1.4 5-4.6 5-8V7z" fill="#0e7490"/></svg>'
  };
  const costHtml = (c, mult) => Object.entries(c || {}).map(([k, v]) => `<span class="cost ${G.S.res[k] < v ? 'no' : ''}">${IC[k]}${fmt(v)}</span>`).join('');

  // ================= Zustand der Oberfläche =================
  const cv = $('cv'), ctx = cv.getContext('2d');
  let vw = 0, vh = 0, dpr = 1, cam = { x: OX, y: OY + N * TH / 2, z: 1 }, world = document.createElement('canvas'), wctx = world.getContext('2d'), wz = 0, dirty = true, bg = document.createElement('canvas');
  let mode = null, ghost = null, sel = null, hover = null, cat = 'basis', anims = [], beams = [], battle = null, mapSel = null, mapMis = null, mapPick = {};
  const fx = () => G.S.opt.fx !== 'low';

  // ================= Hintergrund =================
  function paintBg() {
    bg.width = vw * dpr; bg.height = vh * dpr; const g = bg.getContext('2d'); g.scale(dpr, dpr); let s = 7; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    g.fillStyle = g.createLinearGradient(0, 0, 0, vh); const l = g.createLinearGradient(0, 0, 0, vh); l.addColorStop(0, '#04051a'); l.addColorStop(1, '#090620'); g.fillStyle = l; g.fillRect(0, 0, vw, vh);
    const neb = (x, y, rr, c, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(.5, `rgba(${c},${a * .35})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); };
    g.globalCompositeOperation = 'lighter'; neb(vw * .85, vh * .12, Math.max(vw, vh) * .5, '124,58,237', .22); neb(vw * .95, vh * .45, vw * .3, '236,72,153', .08); neb(vw * .1, vh * .9, Math.max(vw, vh) * .45, '14,165,233', .1); g.globalCompositeOperation = 'source-over';
    for (let k = 0; k < vw * vh / 2200; k++) { g.fillStyle = `rgba(255,255,255,${.2 + r() * .7})`; g.beginPath(); g.arc(r() * vw, r() * vh, r() > .975 ? 1.5 : .7, 0, TAU); g.fill(); }
    // Ringplanet
    const px = vw * .86, py = Math.min(170, vh * .22), pr = Math.min(170, vw * .14);
    const pg = g.createRadialGradient(px - pr * .35, py - pr * .4, pr * .05, px, py, pr); pg.addColorStop(0, '#c4b5fd'); pg.addColorStop(.45, '#6d28d9'); pg.addColorStop(1, '#1e1b4b'); g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(px, py, pr, 0, TAU); g.clip(); for (let k = 0; k < 6; k++) { g.strokeStyle = `rgba(237,233,254,${.05 + k % 2 * .05})`; g.lineWidth = pr * (.06 + k * .02); g.beginPath(); g.ellipse(px, py - pr * .5 + k * pr * .2, pr * 1.2, pr * .13, -.2, 0, TAU); g.stroke(); } g.restore();
    g.strokeStyle = 'rgba(224,231,255,.5)'; g.lineWidth = pr * .03; g.beginPath(); g.ellipse(px, py + pr * .06, pr * 1.7, pr * .3, -.22, Math.PI * .98, Math.PI * 2.02); g.stroke();
    // Mond
    const mg = g.createRadialGradient(vw * .12 - 8, vh * .17 - 8, 2, vw * .12, vh * .17, 34); mg.addColorStop(0, '#e2e8f0'); mg.addColorStop(1, '#334155'); g.fillStyle = mg; g.beginPath(); g.arc(vw * .12, vh * .17, 30, 0, TAU); g.fill();
  }

  // ================= Welt (feste Teile, zwischengespeichert) =================
  function paintWorld() {
    const z = Math.min(cam.z * dpr, (vw < 700 ? 2 : 2.6)); wz = z; world.width = Math.ceil(WW * z); world.height = Math.ceil(WH * z);
    const g = wctx; g.setTransform(z, 0, 0, z, 0, 0); g.clearRect(0, 0, WW, WH); ART.use(g, P);
    // Unterseite des Asteroiden
    const c = [P(0, 0), P(N, 0), P(N, N), P(0, N)], dep = 110;
    const ug = g.createLinearGradient(0, c[2][1] - 60, 0, c[2][1] + dep * 1.3); ug.addColorStop(0, '#3b3558'); ug.addColorStop(1, '#0d0b1c'); g.fillStyle = ug;
    g.beginPath(); g.moveTo(...c[1]); g.lineTo(...c[2]); g.lineTo(...c[3]); g.lineTo(c[3][0] + 30, c[3][1] + dep * .7); g.lineTo(c[3][0] + 120, c[3][1] + dep * 1.1); g.lineTo(c[2][0] - 40, c[2][1] + dep * 1.4); g.lineTo(c[2][0] + 60, c[2][1] + dep * 1.2); g.lineTo(c[1][0] - 70, c[1][1] + dep * 1.1); g.lineTo(c[1][0] - 10, c[1][1] + dep * .5); g.closePath(); g.fill();
    let s = G.S.seed % 9999 + 3; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    for (let k = 0; k < 40; k++) { const side = r() < .5, a = side ? c[3] : c[1], b = c[2], t = r(); const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + 8 + r() * dep * .9; g.fillStyle = `rgba(${70 + r() * 50 | 0},${60 + r() * 40 | 0},${100 + r() * 50 | 0},.6)`; g.beginPath(); g.ellipse(x, y, 6 + r() * 18, 3 + r() * 8, 0, 0, TAU); g.fill(); }
    // Felder
    const a = G.area(G.S);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const t = G.tileAt(i, j), q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], inA = i >= a.lo && i <= a.hi && j >= a.lo && j <= a.hi, v = ((i * 7 + j * 13) % 5);
      let col = inA ? ((i + j) % 2 ? '#2b3252' : '#272d4b') : `rgb(${52 + v * 3},${45 + v * 2},${70 + v * 3})`;
      if (t === 'crater') col = inA ? '#1d2038' : '#2a2440';
      ART.poly(q, col, inA ? 'rgba(125,211,252,.09)' : 'rgba(0,0,0,.1)', 1);
      if (t === 'ore') { const [x, y] = P(i + .5, j + .5); for (let k = 0; k < 5; k++) { g.fillStyle = k % 2 ? 'rgba(251,191,36,.85)' : 'rgba(180,120,30,.85)'; g.beginPath(); g.ellipse(x - 12 + ((k * 11) % 24), y - 5 + ((k * 7) % 10), 4, 2, 0, 0, TAU); g.fill(); } }
      if (t === 'crys') { const [x, y] = P(i + .5, j + .5); for (let k = 0; k < 4; k++) { const ox = -10 + k * 7, hh = 6 + (k % 2) * 5; g.fillStyle = k % 2 ? '#f0abfc' : '#a855f7'; g.beginPath(); g.moveTo(x + ox, y - hh + (k % 2) * 3); g.lineTo(x + ox + 3, y + 2); g.lineTo(x + ox - 3, y + 2); g.fill(); } }
      if (t === 'crater') { const [x, y] = P(i + .5, j + .5); g.fillStyle = 'rgba(8,6,20,.55)'; g.beginPath(); g.ellipse(x, y, 20, 10, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(148,163,184,.25)'; g.beginPath(); g.ellipse(x, y + 1, 20, 10, 0, 0, Math.PI); g.stroke(); }
    }
    // Rand des Baulands
    const e = [P(a.lo, a.lo), P(a.hi + 1, a.lo), P(a.hi + 1, a.hi + 1), P(a.lo, a.hi + 1)]; g.strokeStyle = 'rgba(103,232,249,.35)'; g.setLineDash([6, 6]); g.lineWidth = 1.5; g.beginPath(); e.forEach((p, k) => k ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.stroke(); g.setLineDash([]);
    // Leitungen zwischen Gebäuden und Zentrale (Lichtbahnen)
    const hq = G.S.bld.find(b => b.type === 'hq'); if (hq) { g.lineCap = 'round'; for (const b of G.S.bld) { if (b === hq || b.build && !b.up) continue; const s1 = G.B[b.type].s, p0 = P(hq.i + 1, hq.j + 1), p1 = P(b.i + s1 / 2, b.j + s1 / 2), mid = P(b.i + s1 / 2, hq.j + 1);
      g.strokeStyle = 'rgba(34,211,238,.12)'; g.lineWidth = 7; g.beginPath(); g.moveTo(...p0); g.lineTo(...mid); g.lineTo(...p1); g.stroke(); g.strokeStyle = 'rgba(103,232,249,.55)'; g.lineWidth = 1.2; g.stroke(); } g.lineCap = 'butt'; }
    // Gebäude in Tiefenreihenfolge
    for (const b of sorted()) { const s1 = G.B[b.type].s, o = Object.assign({ w: s1 }, b); if (b.build && !b.up) { foundation(g, b); continue; } ART.draw(o); if (b.dmg) { ART.poly([P(b.i, b.j, 1), P(b.i + s1, b.j, 1), P(b.i + s1, b.j + s1, 1), P(b.i, b.j + s1, 1)], 'rgba(20,10,10,.35)'); } }
    dirty = false;
  }
  function foundation(g, b) { const s1 = G.B[b.type].s; ART.poly([P(b.i + .08, b.j + .08, 1), P(b.i + s1 - .08, b.j + .08, 1), P(b.i + s1 - .08, b.j + s1 - .08, 1), P(b.i + .08, b.j + s1 - .08, 1)], '#1a1f36', 'rgba(251,191,36,.6)', 1.2); }
  const sorted = () => G.S.bld.slice().sort((a, b) => (a.i + a.j + G.B[a.type].s * 2) - (b.i + b.j + G.B[b.type].s * 2));

  // ================= Schiffe in der Kolonie =================
  const SHSC = { drone: .55, fighter: .62, scout: .62, freighter: .5, cruiser: .32, colony: .3 };
  function slots() {
    const out = []; for (const b of G.S.bld) { if (b.type !== 'pad' || (b.build && !b.up)) continue; const [x, y] = P(b.i + 1, b.j + 1), n = 2 + (b.lvl - 1); const offs = [[-20, -1], [20, 3], [0, -13], [0, 13]].slice(0, n); offs.forEach(o => out.push([x + o[0], y + o[1]])); } return out;
  }
  const parked = () => { const s = slots(), list = G.S.fleet.filter(f => f.state === 'home' && !anims.some(a => a.id === f.id)); return list.map((f, k) => ({ f, p: s[k] })); };
  function slotOf(id) { const s = slots(); const list = G.S.fleet.filter(f => f.state === 'home' || anims.some(a => a.id === f.id && a.mode === 'in')); const k = list.findIndex(f => f.id === id); return s[k] || P(8, 8); }
  function flyOut(f, dirAng) { const p = slotOf(f.id); anims.push({ id: f.id, type: f.type, mode: 'out', from: p, ang: dirAng, t0: performance.now() + Math.random() * 500, d: 3600 }); }
  function flyIn(f, dirAng) { anims.push({ id: f.id, type: f.type, mode: 'in', ang: dirAng, t0: performance.now() + Math.random() * 600, d: 3600 }); }
  const sysAng = id => { const s = G.SBY[id], h = G.SBY.home; return Math.atan2(s.y - h.y, s.x - h.x) * .6 - .5; };

  function drawShips(t) {
    // geparkt
    for (const { f, p } of parked()) { if (!p) continue; const bob = f.type === 'drone' ? Math.sin(t / 500 + f.id) * 1.5 : 0; SHIPS.draw(ctx, f.type, p[0], p[1] - 5 + bob, SHSC[f.type], -.42, { thrust: 0, iso: .62, shadow: [3, 6 - bob] }); }
    // im Bau (in der Werft)
    for (const q of G.S.queue) { const y = G.S.bld.find(b => b.id === q.yard); const f = G.S.fleet.find(x => x.id === q.ship); if (!y || !f) continue; const [x, yy] = P(y.i + 1, y.j + 1, 22), p = Math.min(1, (Date.now() - q.t0) / (q.end - q.t0));
      SHIPS.draw(ctx, f.type, x, yy, SHSC[f.type] * 1.5, -.42, { thrust: 0, iso: .62, alpha: .35 + .65 * p }); ctx.globalAlpha = 1;
      if (fx() && Math.floor(t / 120) % 3) { ART.use(ctx, P); for (let k = 0; k < 2; k++) { const sx = x - 18 + ((t / 37 + k * 23) % 36), sy = yy - 6 + k * 8; ART.glow(sx, sy, 10, '254,240,138', .9); } } }
    // Gerüst der Werft vorne
    ART.use(ctx, P); for (const b of G.S.bld) if (b.type === 'yard' && !(b.build && !b.up)) ART.front(b);
    // Starts und Landungen
    anims = anims.filter(a => t < a.t0 + a.d + 50);
    for (const a of anims) { let k = (t - a.t0) / a.d; if (k < 0) { if (a.mode === 'out') SHIPS.draw(ctx, a.type, a.from[0], a.from[1] - 5, SHSC[a.type], -.42, { thrust: 0, iso: .62, shadow: [3, 6] }); continue; } k = Math.min(1, k);
      const from = a.mode === 'out' ? a.from : slotOf(a.id), far = [from[0] + Math.cos(a.ang) * 1400, from[1] + Math.sin(a.ang) * 700 - 500];
      const e = a.mode === 'out' ? k : 1 - k, lift = Math.min(1, e * 4), ee = Math.max(0, (e - .2) / .8), pos = [from[0] + (far[0] - from[0]) * ee * ee, from[1] - lift * 40 + (far[1] - from[1]) * ee * ee];
      const ang = ee > 0 ? Math.atan2(far[1] - from[1], far[0] - from[0]) * (a.mode === 'out' ? 1 : 1) + (a.mode === 'in' ? Math.PI : 0) : -.42 - (1 - lift) * 0;
      const sc = SHSC[a.type] * (1 + ee * .8), alpha = e > .85 ? (1 - e) / .15 : 1;
      if (lift < 1 && fx()) { ART.glow(from[0], from[1], 40 * lift + 10, '165,243,252', .45 * lift); }
      SHIPS.draw(ctx, a.type, pos[0], pos[1] - 5, sc, a.mode === 'in' && ee <= 0 ? -.42 : (ee > 0 ? ang : -1.2), { thrust: .4 + ee * .8, iso: .62 + ee * .38, alpha: Math.max(0, alpha), shadow: lift < 1 ? [3 + lift * 20, 6 + lift * 30] : null, shadowA: .35 * (1 - lift) }); ctx.globalAlpha = 1; }
  }
  // Ambiente: Pendel-Shuttles und Verkehr am Himmel
  let shuttles = [], lastShuttle = 0, sky = [];
  function ambient(t) {
    if (!fx()) return;
    const B = G.S.bld.filter(b => !b.build && b.type !== 'hq'), hq = G.S.bld.find(b => b.type === 'hq');
    if (hq && B.length && t - lastShuttle > 3500) { lastShuttle = t; const b = B[Math.floor(Math.random() * B.length)], s1 = G.B[b.type].s, back = Math.random() < .5; const p0 = P(hq.i + 1, hq.j + 1, 90), p1 = P(b.i + s1 / 2, b.j + s1 / 2, 40); shuttles.push({ a: back ? p1 : p0, b: back ? p0 : p1, t0: t, d: 3200 + Math.random() * 1500 }); }
    shuttles = shuttles.filter(s => t < s.t0 + s.d);
    for (const s of shuttles) { const k = (t - s.t0) / s.d, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, x = s.a[0] + (s.b[0] - s.a[0]) * e, y = s.a[1] + (s.b[1] - s.a[1]) * e - Math.sin(k * Math.PI) * 30;
      SHIPS.draw(ctx, 'drone', x, y, .32, Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]), { thrust: .6, iso: .7, alpha: Math.min(1, k * 6, (1 - k) * 6) }); ctx.globalAlpha = 1; }
  }
  function skyTraffic(t) {
    if (!fx()) return; if (sky.length < 3 && Math.random() < .004) { const l2r = Math.random() < .5, y = vh * (.08 + Math.random() * .3); sky.push({ x0: l2r ? -80 : vw + 80, x1: l2r ? vw + 80 : -80, y, t0: t, d: 14000 + Math.random() * 9000, type: ['fighter', 'freighter', 'scout'][Math.floor(Math.random() * 3)], s: .25 + Math.random() * .2 }); }
    sky = sky.filter(s => t < s.t0 + s.d); for (const s of sky) { const k = (t - s.t0) / s.d; SHIPS.draw(ctx, s.type, s.x0 + (s.x1 - s.x0) * k, s.y - k * 30, s.s, s.x1 > s.x0 ? -.08 : Math.PI + .08, { thrust: .6, alpha: .8 }); ctx.globalAlpha = 1; }
  }
  // Piratenangriff als Szene: Piraten fliegen ein, Türme schießen
  function startBattle(res) {
    const hq = G.S.bld.find(b => b.type === 'hq'), target = P(hq.i + 1, hq.j + 1, 30), n = Math.min(8, 3 + Math.floor(res.str / 60));
    battle = { t0: performance.now(), d: 7000, res, target, ships: Array.from({ length: n }, (_, k) => ({ from: [P(N, 0)[0] + 260 + k * 30, P(N, 0)[1] - 200 + k * 46], off: [(k % 3 - 1) * 60, (k % 2) * 40 - 60 - k * 8], dead: res.won ? 2600 + k * 450 : (k < n / 3 ? 3200 + k * 600 : 1e9) })) };
  }
  function drawBattle(t) {
    if (!battle) return; const k = (t - battle.t0); if (k > battle.d) { const r = battle.res; battle = null; raidReport(r); return; }
    const towers = G.S.bld.filter(b => b.type === 'tower' && !b.build && !b.dmg);
    battle.ships.forEach((s, q) => { const e = Math.min(1, k / 2500), x = s.from[0] + (battle.target[0] + s.off[0] - s.from[0]) * e + Math.sin(k / 400 + q) * 12, y = s.from[1] + (battle.target[1] + s.off[1] - s.from[1]) * e + Math.cos(k / 500 + q) * 8;
      if (k > s.dead) { if (k < s.dead + 600) { const f = (k - s.dead) / 600; ART.use(ctx, P); ART.glow(x, y, 30 + f * 40, '251,146,60', 1 - f); ART.glow(x, y, 14, '254,240,138', 1 - f); } return; }
      SHIPS.draw(ctx, 'pirate', x, y, .55, e < 1 ? Math.atan2(battle.target[1] - s.from[1], battle.target[0] - s.from[0]) : Math.PI * .85, { thrust: e < 1 ? 1 : .4, iso: .7 }); ctx.globalAlpha = 1;
      // Piraten schießen
      if (e >= 1 && Math.floor(k / 260 + q) % 4 === 0) laser(x, y, battle.target[0] + (q % 3 - 1) * 20, battle.target[1] + 20, '239,68,68');
      // Türme schießen zurück
      const tw = towers[q % Math.max(1, towers.length)]; if (tw && k > 1800 && Math.floor(k / 300 + q * 2) % 3 === 0) { const [tx, ty] = P(tw.i + .5, tw.j + .5, 52 + tw.lvl * 8); laser(tx + 20, ty - 4, x, y, '103,232,249'); } });
    // Jäger starten zur Verteidigung
    const fs = G.S.fleet.filter(f => f.state === 'home' && (f.type === 'fighter' || f.type === 'cruiser')).slice(0, 4);
    fs.forEach((f, q) => { const p = slotOf(f.id); if (k < 1500) return; const e = Math.min(1, (k - 1500) / 1500), x = p[0] + (battle.target[0] + 120 - p[0]) * e + Math.sin(k / 300 + q) * 30, y = p[1] - 80 * e + (battle.target[1] - 90 - p[1]) * e + Math.cos(k / 350 + q) * 20;
      SHIPS.draw(ctx, f.type, x, y, SHSC[f.type] * 1.1, -.2 + Math.sin(k / 600 + q) * .3, { thrust: 1, iso: .8 }); if (e >= 1 && Math.floor(k / 220 + q) % 3 === 0) laser(x + 10, y, battle.ships[q % battle.ships.length].from[0] * 0 + battle.target[0] + 60, battle.target[1] - 80, '125,211,252'); });
  }
  function laser(x0, y0, x1, y1, rgb) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(${rgb},.35)`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.strokeStyle = `rgba(255,255,255,.9)`; ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore(); ART.use(ctx, P); ART.glow(x1, y1, 10, rgb, .9); }

  // ================= Bild für Bild =================
  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    if (dirty || (Math.abs(cam.z * dpr - wz) / wz > .3 && !pinch && performance.now() - lastZoom > 180)) paintWorld();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bg, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); skyTraffic(t);
    const z = cam.z * dpr; ctx.setTransform(z, 0, 0, z, (vw / 2 - cam.x * cam.z) * dpr, (vh / 2 - cam.y * cam.z) * dpr);
    ctx.drawImage(world, 0, 0, WW, WH);
    ART.use(ctx, P); const ts = t / 1000;
    // Auswahl / Vorschau unter den Effekten
    if (sel && G.S.bld.includes(sel)) outline(sel.i, sel.j, G.B[sel.type].s, '103,232,249');
    if (mode && ghost) { const ok = G.canPlace(mode, ghost.i, ghost.j).ok && G.canPay(G.B[mode].cost); outline(ghost.i, ghost.j, G.B[mode].s, ok ? '74,222,128' : '248,113,113', true); ctx.globalAlpha = ok ? .7 : .4; ART.draw({ type: mode, i: ghost.i, j: ghost.j, lvl: 1, w: G.B[mode].s }); ctx.globalAlpha = 1; }
    for (const b of sorted()) { const o = Object.assign({ w: G.B[b.type].s }, b); if (b.build) { const p = Math.min(1, (Date.now() - (b.t0 || Date.now())) / (b.build - (b.t0 || b.build - 1))); ART.construction(o, ts, p); bar(b, p); } else if (b.dmg) ART.damaged(o, ts); else if (fx() || b.type === 'pad') ART.anim(o, ts); }
    drawShips(t); ambient(t); drawBattle(t);
    if (hover && !mode && !('ontouchstart' in window && navigator.maxTouchPoints)) { const b = G.bAt(hover.i, hover.j); if (b && b !== sel) outline(b.i, b.j, G.B[b.type].s, '255,255,255', false, .35); }
  }
  function outline(i, j, s, rgb, fill, a = .9) { const q = [P(i, j, 1), P(i + s, j, 1), P(i + s, j + s, 1), P(i, j + s, 1)]; ctx.beginPath(); q.forEach((p, k) => k ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); if (fill) { ctx.fillStyle = `rgba(${rgb},.18)`; ctx.fill(); } ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = 2 / cam.z; ctx.stroke(); }
  function bar(b, p) { const s = G.B[b.type].s, [x, y] = P(b.i + s / 2, b.j + s / 2, 70 + s * 10); ctx.fillStyle = 'rgba(2,6,23,.8)'; ctx.fillRect(x - 24, y, 48, 6); ctx.fillStyle = '#fbbf24'; ctx.fillRect(x - 23, y + 1, 46 * p, 4); }

  // ================= Kamera & Eingabe =================
  function resize() { vw = innerWidth; vh = innerHeight; dpr = Math.min(window.devicePixelRatio || 1, fx() ? 2 : 1.25); cv.width = vw * dpr; cv.height = vh * dpr; cv.style.width = vw + 'px'; cv.style.height = vh + 'px'; paintBg(); dirty = true; clampCam(); }
  function clampCam() { cam.z = Math.max(.4, Math.min(2.4, cam.z)); cam.x = Math.max(OX - N * TW / 2, Math.min(OX + N * TW / 2, cam.x)); cam.y = Math.max(OY - 60, Math.min(OY + N * TH + 40, cam.y)); }
  const toWorld = (sx, sy) => [(sx - vw / 2) / cam.z + cam.x, (sy - vh / 2) / cam.z + cam.y];
  function toTile(sx, sy) { const [wx, wy] = toWorld(sx, sy), x = (wx - OX) / (TW / 2), y = (wy - OY) / (TH / 2); return { fi: (y + x) / 2, fj: (y - x) / 2 }; }
  let ptrs = new Map(), drag = null, pinch = null, lastZoom = 0;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z }; drag = null; } else drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, type: e.pointerType }; });
  cv.addEventListener('pointermove', e => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; cam.z = pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d; clampCam(); lastZoom = performance.now(); return; }
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 7) drag.moved = true; if (drag.moved) { cam.x = drag.cx - dx / cam.z; cam.y = drag.cy - dy / cam.z; clampCam(); } }
    const t = toTile(e.clientX, e.clientY); hover = { i: Math.floor(t.fi), j: Math.floor(t.fj) };
    if (mode && e.pointerType === 'mouse') { const s = G.B[mode].s; ghost = { i: Math.floor(t.fi - (s - 1) / 2), j: Math.floor(t.fj - (s - 1) / 2) }; }
  });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (drag && !drag.moved && e.type === 'pointerup') tap(e.clientX, e.clientY, drag.type); if (ptrs.size === 0) drag = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', () => { hover = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); const [wx, wy] = toWorld(e.clientX, e.clientY); cam.z *= Math.exp(-e.deltaY * .0015); clampCam(); const [nx, ny] = toWorld(e.clientX, e.clientY); cam.x += wx - nx; cam.y += wy - ny; clampCam(); lastZoom = performance.now(); }, { passive: false });
  function tap(sx, sy, ptype) {
    const t = toTile(sx, sy), i = Math.floor(t.fi), j = Math.floor(t.fj);
    if (mode) { const s = G.B[mode].s, gi = Math.floor(t.fi - (s - 1) / 2), gj = Math.floor(t.fj - (s - 1) / 2);
      if (ptype !== 'mouse' && (!ghost || ghost.i !== gi || ghost.j !== gj)) { ghost = { i: gi, j: gj }; buildBar(); return; }      // Handy: erst Vorschau, dann noch mal tippen
      const r = G.place(mode, gi, gj); if (r.ok) { dirty = true; toast(`🏗️ ${G.B[mode].n} wird gebaut`); if (!G.canPay(G.B[mode].cost)) cancelBuild(); else buildBar(); refresh(); } else toast('⚠ ' + r.why, 'bad'); return; }
    const b = G.bAt(i, j); select(b || null);
  }
  addEventListener('keydown', e => { if (e.key === 'Escape') { if (document.querySelector('.modal:not(.hidden)')) closeModals(); else if (mode) cancelBuild(); else select(null); } });

  // ================= Oberfläche =================
  function hud() {
    const S = G.S, st = G.stats(), { r, use } = G.rates(st);
    const cell = (k, v, sub, cls = '') => `<div class="res ${cls}" title="${G.RN[k] || ''}">${IC[k]}<div><b>${v}</b><small>${sub}</small></div></div>`;
    const net = k => r[k] - (k === 'ore' ? use.ore : 0);
    const capW = (k) => S.res[k] >= st.store * .98 ? ' full' : '';
    $('res').innerHTML = cell('ore', fmt(S.res.ore), fmtR(net('ore')) + '/s', capW('ore')) + cell('crys', fmt(S.res.crys), fmtR(r.crys * 60) + '/min', capW('crys')) + cell('parts', fmt(S.res.parts), fmtR(r.parts * 60) + '/min', capW('parts')) + cell('fuel', fmt(S.res.fuel), fmtR(r.fuel * 60) + '/min', capW('fuel'))
      + cell('cred', fmt(S.res.cred), 'Credits') + `<div class="res ${st.eff < 1 ? 'warn' : ''}" title="Energie: Erzeugung / Verbrauch">${IC.energy}<div><b>${Math.round(st.eP)} / ${Math.round(st.eU)}</b><small>${st.eff < 1 ? 'zu wenig Strom!' : 'Energie'}</small></div></div>`
      + `<div class="res ${st.wf < 1 ? 'warn' : ''}" title="Bewohner / Platz · Arbeiter gebraucht">${IC.pop}<div><b>${S.pop} / ${st.cap}</b><small>${st.wf < 1 ? 'Arbeiter fehlen: ' + Math.ceil(st.work - S.pop) : 'Bewohner'}</small></div></div>`;
    $('lvl').textContent = st.hq; $('cname').textContent = S.name; $('store').textContent = 'Lager ' + fmt(st.store);
    // Auftrag
    const q = G.Q[S.quest]; $('quest').innerHTML = q ? `<div class="qh"><span>AUFTRAG ${S.quest + 1}/${G.Q.length}</span></div><b>${esc(q.n)}</b><p>${esc(q.d)}</p><div class="qr">Belohnung: ${costHtml(q.r).replace(/ no/g, '')}</div>` : '<div class="qh"><span>AUFTRÄGE</span></div><b>Alle Aufträge erledigt!</b><p>Baue weiter aus und halte die Piraten fern.</p>';
    // Ereignisse
    let ev = ''; const R_ = S.raid;
    if (R_.warn > 0) ev += `<div class="alert bad"><div class="ah"><b>⚠ Piratenangriff</b><span class="tm">${dur(R_.warn)}</span></div><p>Stärke <b>${R_.str}</b> · deine Verteidigung <b class="${st.def >= R_.str ? 'ok' : 'no'}">${st.def}</b></p><small>${st.def >= R_.str ? 'Deine Abwehr hält stand.' : 'Baue Abwehrtürme oder Jäger, sonst verlierst du Rohstoffe.'}</small></div>`;
    if (S.merch.offer) { const o = S.merch.offer; ev += `<div class="alert"><div class="ah"><b>🚀 Händler im Orbit</b><span class="tm">${dur(S.merch.left)}</span></div><p>Gibt ${costHtml(o.get).replace(/ no/g, '')} für ${costHtml(o.give)}</p><div class="row2"><button class="btn sm" data-act="merch-no">Ablehnen</button><button class="btn sm pri" data-act="merch-yes" ${G.canPay(o.give) ? '' : 'disabled'}>Handeln</button></div></div>`; }
    const run = S.missions.length, rq = S.rq;
    if (run) ev += `<div class="alert info" data-act="map"><div class="ah"><b>🛰️ ${run} Mission${run > 1 ? 'en' : ''} unterwegs</b><span class="tm">${dur((Math.min(...S.missions.map(m => m.end)) - Date.now()) / 1000)}</span></div></div>`;
    if (rq) { const r0 = G.RS.find(x => x.id === rq.id); ev += `<div class="alert info" data-act="research"><div class="ah"><b>🔬 ${esc(r0.n)}</b><span class="tm">${dur((rq.end - Date.now()) / 1000)}</span></div></div>`; }
    if (S.queue.length) { const q0 = S.queue[0], f = S.fleet.find(x => x.id === q0.ship); if (f) ev += `<div class="alert info" data-act="fleet"><div class="ah"><b>🛠️ ${esc(G.SH[f.type].n)} im Bau</b><span class="tm">${dur((q0.end - Date.now()) / 1000)}</span></div></div>`; }
    $('events').innerHTML = ev;
  }
  function dock() {
    const S = G.S, list = Object.entries(G.B).filter(([k, d]) => d.cat === cat);
    $('cats').innerHTML = Object.entries(G.CATS).map(([k, n]) => `<button class="cat ${k === cat ? 'on' : ''}" data-cat="${k}">${n}</button>`).join('');
    $('cards').innerHTML = list.map(([k, d]) => { const lock = !G.unlocked(k), afford = G.canPay(d.cost); return `<button class="card ${mode === k ? 'on' : ''} ${lock ? 'lock' : ''}" data-build="${k}" ${lock ? `title="ab Kommandozentrale Stufe ${d.hq}"` : ''}><img src="${icon(k)}" alt=""><b>${d.n}</b><span class="cs">${lock ? `🔒 Zentrale Stufe ${d.hq}` : costHtml(d.cost)}</span></button>`; }).join('');
  }
  const ICONS = {};
  function icon(k) {
    if (ICONS[k]) return ICONS[k]; const c = document.createElement('canvas'), s = G.B[k].s; c.width = 168; c.height = 128; const g = c.getContext('2d'); const sc = s === 2 ? .95 : 1.55; g.scale(sc, sc);
    const p = (i, j, z = 0) => [84 / sc + (i - j) * TW / 2, 128 / sc - (s === 2 ? 22 : 14) + (i + j - s) * TH / 2 - z]; ART.use(g, p);
    for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) ART.poly([p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)], (i + j) % 2 ? '#2b3252' : '#272d4b', 'rgba(125,211,252,.12)');
    if (k === 'crys') { const [x, y] = p(.5, .5); g.fillStyle = 'rgba(168,85,247,.25)'; g.beginPath(); g.ellipse(x, y, 30, 15, 0, 0, TAU); g.fill(); }
    ART.draw({ type: k, i: 0, j: 0, lvl: 1, w: s }); if (k === 'yard') ART.front({ type: k, i: 0, j: 0, lvl: 1 });
    ART.use(ctx, P); return ICONS[k] = c.toDataURL();
  }
  function select(b) { sel = b; if (b) mode = null; info(); buildBar(); }
  function info() {
    const p = $('info'); if (!sel || !G.S.bld.includes(sel)) { p.classList.add('hidden'); return; }
    const b = sel, d = G.B[b.type], st = G.stats(), l = b.lvl, nl = l + 1, maxL = b.type === 'hq' ? 5 : d.max;
    let lines = [];
    if (b.type === 'hq') lines.push(['Energie', '+' + d.e * l], ['Wohnraum', d.house * l], ['Bauland', `${G.area(G.S).hi - G.area(G.S).lo + 1}×${G.area(G.S).hi - G.area(G.S).lo + 1} Felder`]);
    else { const F = G.LVF[l]; if (d.e) lines.push(['Energie', (d.e > 0 ? '+' : '−') + Math.round(Math.abs(d.e) * (d.e > 0 ? F : [0, 1, 1.6, 2.2][l]))]); if (d.w) lines.push(['Arbeiter', Math.round(d.w * [0, 1, 1.5, 2][l])]); if (d.house) lines.push(['Wohnraum', Math.round(d.house * F)]); if (d.food) lines.push(['Nahrung', Math.round(d.food * F)]); if (d.store) lines.push(['Lager', '+' + fmt(d.store * F)]);
      if (d.out) for (const k in d.out) { let v = d.out[k] * F; if (k === 'ore' && G.tileAt(b.i, b.j) === 'ore') v *= 1.6; lines.push([G.RN[k], fmtR(k === 'ore' ? v : v * 60) + (k === 'ore' ? '/s' : '/min')]); }
      if (d.conv) lines.push(['Verbrauch Erz', '−' + (d.conv.ore * F).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + '/s'], [G.RN[d.conv.out], fmtR(d.conv.rate * F * 60) + '/min']);
      if (d.dock) lines.push(['Schiffsplätze', d.dock + l - 1]); if (d.def) lines.push(['Verteidigung', Math.round(d.def * F)]); if (d.prot) lines.push(['Schutz', Math.round((d.prot + .1 * (l - 1)) * 100) + ' %']); }
    let act = '';
    if (b.build) { const pr = Math.min(1, (Date.now() - b.t0) / (b.build - b.t0)); act = `<div class="prog"><i style="width:${pr * 100}%"></i></div><small class="mut">${b.up ? 'Ausbau auf Stufe ' + b.up : 'Wird gebaut'} · noch ${dur((b.build - Date.now()) / 1000)}</small>`; }
    else if (b.dmg) { const c = G.repairCost(b); act = `<p class="bad">Bei einem Piratenangriff beschädigt. Produziert nichts.</p><button class="btn pri wide" data-act="repair" ${G.canPay(c) ? '' : 'disabled'}>Reparieren ${costHtml(c)}</button>`; }
    else if (l < maxL) { const c = G.upCost(b.type, nl), ok = b.type === 'hq' || nl <= G.maxLvl(b.type); act = `<button class="btn pri wide" data-act="upgrade" ${ok && G.canPay(c) ? '' : 'disabled'}>Ausbauen auf Stufe ${nl} · ${dur(G.upTime(b.type, nl))}</button><div class="costs">${costHtml(c)}</div>${ok ? '' : '<small class="mut">Erst die Kommandozentrale ausbauen.</small>'}`; }
    else act = '<small class="mut">Höchste Stufe erreicht.</small>';
    let extra = '';
    if (b.type === 'yard') extra = `<button class="btn wide" data-act="fleet">🛠️ Werft öffnen</button>`;
    if (b.type === 'lab') extra = `<button class="btn wide" data-act="research">🔬 Forschung</button>`;
    if (b.type === 'pad') { const n = G.S.fleet.filter(f => f.state === 'home').length; extra = `<button class="btn wide" data-act="map">🗺️ Sternenkarte · ${n} Schiff${n === 1 ? '' : 'e'} bereit</button>`; }
    if (b.type === 'hq') extra = `<button class="btn wide" data-act="market">💱 Markt</button>`;
    const tl = G.tileAt(b.i, b.j);
    p.innerHTML = `<div class="ih"><img src="${icon(b.type)}" alt=""><div><small>STUFE ${l} / ${maxL}</small><h3>${d.n}</h3></div><button class="x" data-act="close-info" aria-label="Schließen">✕</button></div>
      <p class="mut">${d.d}${b.type === 'mine' && tl === 'ore' ? ' <b class="ok">Steht auf einer Erzader.</b>' : ''}</p>
      ${st.f < 1 && (d.out || d.conv) && !b.build ? `<p class="warn">Läuft nur mit ${Math.round(st.f * 100)} % (${st.eff < 1 ? 'zu wenig Energie' : 'zu wenig Arbeiter'}).</p>` : ''}
      <div class="kv">${lines.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>${act}${extra}
      ${b.type !== 'hq' ? `<button class="btn ghost wide" data-act="demolish">Abreißen${b.build && !b.up ? ' (volle Erstattung)' : ' (50 % zurück)'}</button>` : ''}`;
    p.classList.remove('hidden');
  }
  function buildBar() { const el = $('buildbar'); if (!mode) { el.classList.add('hidden'); return; } const d = G.B[mode]; const touch = matchMedia('(pointer: coarse)').matches; el.innerHTML = `<b>${d.n} platzieren</b><span>${touch ? (ghost ? 'Noch einmal tippen zum Bauen' : 'Tippe auf ein freies Feld') : 'Klicke auf ein freies Feld'}${d.tile ? ' · nur auf Kristallfeldern' : ''}</span><button class="btn sm" data-act="cancel-build">Fertig</button>`; el.classList.remove('hidden'); }
  function startBuild(k) { if (!G.unlocked(k)) { toast(`🔒 ${G.B[k].n}: ab Kommandozentrale Stufe ${G.B[k].hq}`, 'bad'); return; } mode = k; ghost = null; sel = null; info(); buildBar(); dock(); }
  function cancelBuild() { mode = null; ghost = null; buildBar(); dock(); }
  function refresh() { hud(); dock(); info(); }

  // ================= Fenster =================
  function openModal(id) { closeModals(); $(id).classList.remove('hidden'); render(id); }
  function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); mapMis = null; }
  function render(id) { if (id === 'm-fleet') fleetUI(); if (id === 'm-research') researchUI(); if (id === 'm-market') marketUI(); if (id === 'm-map') mapUI(); }
  // ---- Werft & Flotte ----
  const shipIcons = {};
  function shipIcon(t) { if (shipIcons[t]) return shipIcons[t]; const c = document.createElement('canvas'); c.width = 200; c.height = 120; const g = c.getContext('2d'); const sc = { drone: 2.6, freighter: 1.55, scout: 1.9, fighter: 1.8, cruiser: .88, colony: .9, pirate: 2 }[t]; SHIPS.draw(g, t, t === 'drone' ? 92 : 104, 60, sc, -.12, { thrust: .55 }); return shipIcons[t] = c.toDataURL(); }
  function fleetUI() {
    const S = G.S, st = G.stats(), busy = S.queue.length;
    $('fl-cap').textContent = `${S.fleet.length} / ${st.docks} Plätze`;
    $('fl-classes').innerHTML = Object.entries(G.SH).map(([t, d]) => { const c = G.canBuild(t), cost = G.shipCost(t), n = G.fleetN(t);
      return `<div class="ship ${d.locked ? 'lock' : ''}"><img src="${shipIcon(t)}" alt=""><div class="sd"><b>${d.n}</b> <span class="mut">· ${n} vorhanden</span><p>${d.d}</p><div class="sv">${d.atk ? `<span>⚔ ${d.atk}</span>` : ''}${d.def ? `<span>🛡 ${d.def}</span>` : ''}${d.cargo ? `<span>📦 ${d.cargo}</span>` : ''}${d.time ? `<span>⏱ ${dur(d.time)}</span>` : ''}</div></div>
        <div class="sb">${d.locked ? '<span class="mut">🔒 bald</span>' : `<div class="costs">${costHtml(cost)}</div><button class="btn sm pri" data-ship="${t}" ${c.ok ? '' : 'disabled'} title="${esc(c.why || '')}">Bauen</button>${c.ok ? '' : `<small class="mut">${esc(c.why)}</small>`}`}</div></div>`; }).join('');
    $('fl-list').innerHTML = S.fleet.length ? S.fleet.map(f => { const q = S.queue.find(x => x.ship === f.id), m = S.missions.find(x => x.ships.includes(f.id));
      const stt = f.state === 'building' ? `🛠️ im Bau · ${dur((q ? q.end : 0) - Date.now() > 0 ? (q.end - Date.now()) / 1000 : 0)}` : f.state === 'away' ? `🛰️ ${esc(G.SBY[m ? m.sys : 'home'].n)} · ${m ? dur((m.end - Date.now()) / 1000) : ''}` : '🟢 bereit';
      return `<div class="fl"><img src="${shipIcon(f.type)}" alt=""><div><b>${esc(f.name)}</b><small>${G.SH[f.type].n} · ${stt}</small></div>${f.state === 'home' ? `<button class="x" data-scrap="${f.id}" title="Verschrotten (40 % zurück)">♻</button>` : ''}</div>`; }).join('') : '<p class="mut">Noch keine Schiffe. Baue welche in der Werft.</p>';
    $('fl-note').innerHTML = st.yards.length ? (busy ? 'Die Werft baut gerade. Weitere Werften bauen gleichzeitig.' : 'Werft bereit.') : '<b class="warn">Du brauchst zuerst eine Werft</b> (ab Kommandozentrale Stufe 3).';
  }
  // ---- Forschung ----
  function researchUI() { const S = G.S, st = G.stats();
    $('rs-note').innerHTML = st.labLvl ? `Forschungslabor Stufe ${st.labLvl}${st.labLvl > 1 ? ' · forscht ' + [0, 1, 1.5, 2][st.labLvl] + '× so schnell' : ''}` : '<b class="warn">Baue zuerst ein Forschungslabor</b> (ab Kommandozentrale Stufe 3).';
    $('rs-list').innerHTML = G.RS.map(r => { const done = S.research.includes(r.id), run = S.rq && S.rq.id === r.id;
      return `<div class="rs ${done ? 'done' : ''}"><div><b>${r.n}</b><p>${r.d}</p></div>${done ? '<span class="ok">✓ erforscht</span>' : run ? `<div class="prog"><i style="width:${Math.min(100, (Date.now() - S.rq.t0) / (S.rq.end - S.rq.t0) * 100)}%"></i></div><small>${dur((S.rq.end - Date.now()) / 1000)}</small>` : `<div class="costs">${costHtml(r.cost)} <span class="mut">⏱ ${dur(r.time)}</span></div><button class="btn sm pri" data-rs="${r.id}" ${st.labLvl && !S.rq && G.canPay(r.cost) ? '' : 'disabled'}>Starten</button>`}</div>`; }).join(''); }
  // ---- Markt ----
  function marketUI() { $('mk-list').innerHTML = G.MARKET.map(m => `<div class="mk">${IC[m.r]}<b>${fmt(m.n)} ${G.RN[m.r]}</b><span class="mut">du hast ${fmt(G.S.res[m.r])}</span><button class="btn sm" data-trade="${m.r}:sell" ${G.S.res[m.r] >= m.n ? '' : 'disabled'}>Verkaufen +${fmt(m.sell)} ${IC.cred}</button><button class="btn sm" data-trade="${m.r}:buy" ${G.S.res.cred >= m.buy ? '' : 'disabled'}>Kaufen −${fmt(m.buy)} ${IC.cred}</button></div>`).join(''); }
  // ---- Sternenkarte ----
  const mc = $('mapcv'), mctx = mc.getContext('2d'); let mapK = 1, mapO = [0, 0];
  const unknownSlot = { vega: 'unk-v', wrack: 'unk-w', titan: 'unk-t' };
  function mapUI() { mapPanel(); }
  function drawMap(t) {
    if ($('m-map').classList.contains('hidden')) return; const box = mc.parentElement.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2); if (mc.width !== Math.round(box.width * d)) { mc.width = Math.round(box.width * d); mc.height = Math.round(box.height * d); }
    const W = box.width, H = box.height; mapK = Math.min(W / 1180, H / 680); mapO = [(W - 1180 * mapK) / 2 - 60 * mapK, (H - 680 * mapK) / 2 - 40 * mapK];
    const g = mctx; g.setTransform(d, 0, 0, d, 0, 0); g.fillStyle = '#03040f'; g.fillRect(0, 0, W, H);
    g.save(); g.globalCompositeOperation = 'lighter'; const neb = (x, y, r, c, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }; neb(W * .3, H * .35, W * .4, '124,58,237', .2); neb(W * .75, H * .7, W * .4, '14,165,233', .12); g.restore();
    let s = 44; const r = () => (s = s * 16807 % 2147483647) / 2147483647; for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(255,255,255,${.15 + r() * .5})`; g.fillRect(r() * W, r() * H, 1, 1); }
    g.translate(mapO[0], mapO[1]); g.scale(mapK, mapK);
    g.strokeStyle = 'rgba(125,211,252,.05)'; for (let x = 0; x < 1300; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 720); g.stroke(); } for (let y = 0; y < 720; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(1300, y); g.stroke(); }
    const S = G.S; const kn = id => G.known(id);
    for (const [a, b] of G.LANES) { const A = G.SBY[a], B = G.SBY[b], dark = !kn(a) || !kn(b); g.strokeStyle = dark ? 'rgba(71,85,105,.45)' : 'rgba(125,211,252,.35)'; g.setLineDash(dark ? [4, 6] : []); g.lineWidth = 1.5; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); } g.setLineDash([]);
    g.strokeStyle = 'rgba(103,232,249,.3)'; g.fillStyle = 'rgba(34,211,238,.04)'; g.beginPath(); g.arc(G.SBY.home.x, G.SBY.home.y, 210, 0, TAU); g.fill(); g.stroke();
    if (Date.now() > S.nestQuietUntil) { g.strokeStyle = 'rgba(239,68,68,.35)'; g.fillStyle = 'rgba(239,68,68,.05)'; g.beginPath(); g.arc(G.SBY.pir.x, G.SBY.pir.y, 110, 0, TAU); g.fill(); g.stroke(); }
    for (const sy of G.SYS) { const k = kn(sy.id), x = sy.x, y = sy.y, col = k ? sy.col : '#475569', rr = k ? (sy.r || 0) : 9;
      if (sy.id === 'belt') { let q = 9; const rr2 = () => (q = q * 16807 % 2147483647) / 2147483647; for (let n = 0; n < 70; n++) { const a = rr2() * TAU, dd = 24 + rr2() * 16; g.fillStyle = 'rgba(203,213,225,.75)'; g.beginPath(); g.arc(x + Math.cos(a + t / 9000) * dd, y + Math.sin(a + t / 9000) * dd * .5, rr2() * 2 + .6, 0, TAU); g.fill(); } }
      else if (sy.gate) { g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.ellipse(x, y, 20, 26, 0, 0, TAU); g.stroke(); const gr = g.createRadialGradient(x, y, 0, x, y, 30); gr.addColorStop(0, 'rgba(129,140,248,.5)'); gr.addColorStop(1, 'rgba(129,140,248,0)'); g.fillStyle = gr; g.fillRect(x - 30, y - 30, 60, 60); }
      else { const gr = g.createRadialGradient(x, y, 0, x, y, rr * 3); gr.addColorStop(0, col + 'aa'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(x - rr * 3, y - rr * 3, rr * 6, rr * 6); const pg = g.createRadialGradient(x - rr * .4, y - rr * .4, 1, x, y, rr); pg.addColorStop(0, '#fff'); pg.addColorStop(.4, col); pg.addColorStop(1, '#0b1022'); g.fillStyle = pg; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); }
      if (sy.id === 'home') { g.strokeStyle = 'rgba(103,232,249,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rr + 8, 0, TAU); g.stroke(); }
      if (mapSel === sy.id) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.setLineDash([4, 4]); g.lineDashOffset = -t / 60; g.beginPath(); g.arc(x, y, Math.max(rr, 22) + 12, 0, TAU); g.stroke(); g.setLineDash([]); }
      g.font = '700 13px Inter, system-ui, sans-serif'; g.textAlign = 'center'; const nm = k ? sy.n : '???', sb = k ? sy.sub : 'unerforscht'; const w = Math.max(g.measureText(nm).width, 80) + 18, ly = y + Math.max(rr, 18) + 10;
      g.fillStyle = 'rgba(7,10,26,.82)'; g.strokeStyle = 'rgba(125,211,252,.3)'; g.lineWidth = 1; rrect(g, x - w / 2, ly, w, 36, 9); g.fill(); g.stroke(); g.fillStyle = k ? '#e2e8f0' : '#94a3b8'; g.fillText(nm, x, ly + 15); g.font = '600 10.5px Inter, system-ui, sans-serif'; g.fillStyle = '#94a3b8'; g.fillText(sb, x, ly + 29); }
    // Schiffe unterwegs
    const h = G.SBY.home; for (const m of S.missions) { const sy = G.SBY[m.sys], p = Math.min(1, (Date.now() - m.t0) / (m.end - m.t0)), e = p < .5 ? p * 2 : (1 - p) * 2, x = h.x + (sy.x - h.x) * e, y = h.y + (sy.y - h.y) * e, ang = Math.atan2(sy.y - h.y, sy.x - h.x) + (p < .5 ? 0 : Math.PI);
      const types = Object.keys(m.sel).filter(k => m.sel[k] > 0); types.forEach((tp, q) => SHIPS.draw(g, tp, x - Math.cos(ang) * q * 16, y - Math.sin(ang) * q * 16 + q * 6, tp === 'cruiser' ? .22 : .42, ang, { thrust: .6 })); }
  }
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  mc.addEventListener('click', e => { const b = mc.getBoundingClientRect(), x = (e.clientX - b.left - mapO[0]) / mapK, y = (e.clientY - b.top - mapO[1]) / mapK; let best = null, bd = 50; for (const s of G.SYS) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s.id; } } if (best) { mapSel = best; mapMis = null; mapPick = {}; mapPanel(); } });
  function mapPanel() {
    const el = $('map-side'), S = G.S; if (!mapSel) { el.innerHTML = `<h4>STERNENKARTE</h4><p class="mut">Tippe auf ein System. Schicke Schiffe auf Missionen: Erz abbauen, handeln, Anomalien scannen, unbekannte Systeme erkunden oder das Piratennest angreifen.</p>${fleetSummary()}`; return; }
    const sy = G.SBY[mapSel], kn = G.known(mapSel);
    if (sy.id === 'home') { el.innerHTML = `<h4>${esc(sy.n)}</h4><p class="mut">Deine Kolonie.</p>${fleetSummary()}`; return; }
    if (sy.gate) { el.innerHTML = `<h4>${esc(sy.n)}</h4><p class="mut">Das Sprungtor führt in einen neuen Sektor. Kommt mit dem Kolonieschiff in einem späteren Update.</p>`; return; }
    const ms = kn ? (sy.m || []) : [{ id: 'explore', n: 'Erkunden', ships: ['scout'], dur: 150, fuel: 12 }];
    if (!mapMis) { el.innerHTML = `<h4>${kn ? esc(sy.n) : '???'}</h4><p class="mut">${kn ? esc(sy.sub) : 'Unerforschtes System. Schicke einen Forscher hin.'}</p>${sy.id === 'pir' ? `<p class="${Date.now() < S.nestQuietUntil ? 'ok' : 'bad'}">${Date.now() < S.nestQuietUntil ? 'Zerstört · Ruhe noch ' + dur((S.nestQuietUntil - Date.now()) / 1000) : 'Stärke ' + Math.round(160 * Math.pow(1.7, S.nest))}</p>` : ''}
      ${ms.map(m => `<button class="mis" data-mis="${m.id}"><b>${m.n}</b><small>${m.ships.map(t => G.SH[t].n).join(', ')} · ${dur(m.dur * (S.research.includes('warp') ? .75 : 1))} · ${IC.fuel}${m.fuel}/Schiff</small></button>`).join('')}`; return; }
    const m = ms.find(x => x.id === mapMis); for (const t of m.ships) if (mapPick[t] == null) mapPick[t] = 0;
    const inf = G.missionInfo(sy, m, mapPick);
    el.innerHTML = `<h4>${kn ? esc(sy.n) : '???'} · ${m.n}</h4>${m.ships.map(t => { const av = G.home(t).length; return `<div class="pick"><img src="${shipIcon(t)}" alt=""><div><b>${G.SH[t].n}</b><small>${av} bereit</small></div><div class="step"><button data-pick="${t}:-1">−</button><b>${mapPick[t]}</b><button data-pick="${t}:1" ${mapPick[t] >= av ? 'disabled' : ''}>+</button></div></div>`; }).join('')}
      <div class="kv"><div><span>Dauer</span><b>${dur(inf.dur)}</b></div><div><span>Treibstoff</span><b>${inf.fuel}</b></div>${Object.entries(inf.take).map(([k, v]) => `<div><span>Ladung</span><b>${fmt(v)} ${G.RN[k]}</b></div>`).join('')}${m.combat ? `<div><span>Angriffskraft</span><b>${Math.round(Object.entries(mapPick).reduce((a, [t, n]) => a + G.SH[t].atk * n, 0) * (S.research.includes('armor') ? 1.4 : 1))} / ${Math.round(160 * Math.pow(1.7, S.nest))}</b></div>` : ''}</div>
      ${Object.keys(inf.gain).length ? `<p>Ertrag: ${costHtml(inf.gain).replace(/ no/g, '')}</p>` : m.id === 'explore' ? '<p>Ertrag: ein neues System</p>' : m.combat ? '<p class="mut">Gewinnt, wenn die Angriffskraft größer ist als die Stärke des Nests. Verluste sind möglich.</p>' : ''}
      <div class="row2"><button class="btn" data-act="mis-back">Zurück</button><button class="btn pri" data-act="launch" ${inf.n && G.canPay(inf.need) ? '' : 'disabled'}>🚀 Starten</button></div>`;
  }
  function fleetSummary() { const S = G.S, c = {}; S.fleet.filter(f => f.state === 'home').forEach(f => c[f.type] = (c[f.type] || 0) + 1); const e = Object.entries(c); return `<div class="kv">${e.length ? e.map(([t, n]) => `<div><span>${G.SH[t].n}</span><b>${n} bereit</b></div>`).join('') : '<div><span>Keine Schiffe bereit</span><b></b></div>'}</div>`; }

  // ================= Meldungen =================
  function toast(t, kind) { const box = $('toasts'); while (box.children.length >= 4) box.firstChild.remove(); const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.innerHTML = t; $('toasts').appendChild(el); setTimeout(() => el.classList.add('out'), 3800); setTimeout(() => el.remove(), 4300); }
  function report(title, body, kind) { $('rp-title').textContent = title; $('rp-body').innerHTML = body; $('m-report').dataset.kind = kind || ''; openModal('m-report'); }
  function raidReport(r) { const lossTxt = r.loss && Object.keys(r.loss).length ? `<p>Verloren: ${Object.entries(r.loss).map(([k, v]) => `${IC[k]}${fmt(v)}`).join(' ')}</p>` : '';
    report(r.won ? '🛡️ Angriff abgewehrt!' : '💥 Die Piraten waren stärker', `<div class="kv"><div><span>Piraten</span><b>${r.str}</b></div><div><span>Deine Verteidigung</span><b>${r.def}</b></div></div>${r.won ? `<p>Beute: ${costHtml(r.gain).replace(/ no/g, '')}</p>` : lossTxt + (r.dmg ? `<p>${G.B[r.dmg.type].n} wurde beschädigt. Tippe es an, um es zu reparieren.</p>` : '') + (r.lostShips ? `<p>${r.lostShips} Jäger zerstört.</p>` : '') + '<p class="mut">Tipp: Abwehrtürme, Jäger, Kreuzer und ein Schildgenerator helfen.</p>'}`, r.won ? 'good' : 'bad'); dirty = true; }
  function handleEvents() {
    const E = G.events.splice(0); for (const e of E) {
      if (e.type === 'built') { dirty = true; toast(`✅ ${G.B[e.b.type].n} ${e.up ? 'auf Stufe ' + e.b.lvl + ' ausgebaut' : 'fertig'}`); if (sel === e.b) info(); }
      if (e.type === 'ship') toast(`🚀 ${G.SH[e.f.type].n} „${esc(e.f.name)}“ ist fertig`);
      if (e.type === 'research') toast(`🔬 ${G.RS.find(r => r.id === e.id).n} erforscht`);
      if (e.type === 'quest') toast(`🎯 Auftrag erledigt: ${esc(e.q.n)} ${costHtml(e.q.r).replace(/ no/g, '')}`, 'good');
      if (e.type === 'ach') toast(`🏆 Erfolg: ${e.a.e} ${esc(e.a.n)}`, 'good');
      if (e.type === 'raidWarn') toast(`⚠ Piraten im Anflug! Stärke ${e.str}`, 'bad');
      if (e.type === 'merch') toast('🚀 Ein Händler bietet etwas an');
      if (e.type === 'raid') startBattle(e);
      if (e.type === 'mission') { const ang = sysAng(Object.keys(G.SBY).find(k => G.SBY[k].n === e.sys) || 'belt'); (e.ships || []).slice(0, 4).forEach((tp, q) => { const f = G.S.fleet.filter(x => x.type === tp && x.state === 'home')[q]; if (f) flyIn(f, ang); });
        toast(`${e.ok ? '✅' : '❌'} ${esc(e.title)} ${Object.keys(e.gain || {}).length ? costHtml(e.gain).replace(/ no/g, '') : ''}${e.lost ? ` · ${e.lost} Schiff${e.lost > 1 ? 'e' : ''} verloren` : ''}`, e.ok ? 'good' : 'bad'); }
    }
  }

  // ================= Klicks in der Oberfläche =================
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act],[data-build],[data-cat],[data-ship],[data-scrap],[data-rs],[data-trade],[data-mis],[data-pick],[data-open]'); if (!t) return;
    const S = G.S, d = t.dataset;
    if (d.cat) { cat = d.cat; dock(); return; }
    if (d.build) { if (mode === d.build) cancelBuild(); else startBuild(d.build); return; }
    if (d.open) { openModal(d.open); return; }
    if (d.ship) { const r = G.buildShip(d.ship); if (r.ok) toast(`🛠️ ${G.SH[d.ship].n} wird gebaut`); else toast('⚠ ' + r.why, 'bad'); fleetUI(); hud(); return; }
    if (d.scrap) { const f = S.fleet.find(x => x.id === +d.scrap); if (f && confirm(`${f.name} verschrotten? Du bekommst 40 % der Kosten zurück.`)) { G.scrapShip(f); fleetUI(); } return; }
    if (d.rs) { const r = G.startResearch(d.rs); if (!r.ok) toast('⚠ ' + r.why, 'bad'); researchUI(); hud(); return; }
    if (d.trade) { const [r, dir] = d.trade.split(':'); if (!G.trade(r, dir)) toast('⚠ Geht nicht (Lager voll oder zu wenig)', 'bad'); marketUI(); hud(); return; }
    if (d.mis) { mapMis = d.mis; mapPick = {}; mapPanel(); return; }
    if (d.pick) { const [tp, v] = d.pick.split(':'); mapPick[tp] = Math.max(0, Math.min(G.home(tp).length, (mapPick[tp] || 0) + +v)); mapPanel(); return; }
    switch (d.act) {
      case 'close-info': select(null); break;
      case 'upgrade': { const r = G.upgrade(sel); if (r.ok) { toast(`🏗️ ${G.B[sel.type].n} wird ausgebaut`); dirty = true; } else toast('⚠ ' + r.why, 'bad'); info(); hud(); break; }
      case 'repair': if (G.repair(sel)) { dirty = true; toast('🔧 Repariert'); } info(); break;
      case 'demolish': if (confirm(`${G.B[sel.type].n} abreißen?`)) { if (G.demolish(sel)) { dirty = true; select(null); } else toast('⚠ Geht gerade nicht', 'bad'); } break;
      case 'cancel-build': cancelBuild(); break;
      case 'fleet': openModal('m-fleet'); break; case 'research': openModal('m-research'); break; case 'market': openModal('m-market'); break; case 'map': openModal('m-map'); break;
      case 'menu': openMenu(); break;
      case 'close': closeModals(); break;
      case 'merch-yes': if (G.acceptOffer()) toast('🤝 Handel abgeschlossen', 'good'); hud(); break;
      case 'merch-no': S.merch.offer = null; S.merch.next = 400; hud(); break;
      case 'mis-back': mapMis = null; mapPanel(); break;
      case 'launch': { const sy = mapSel, r = G.launch(sy, mapMis, mapPick); if (r.ok) { toast(`🚀 Mission gestartet: ${esc(G.known(sy) ? G.SBY[sy].n : '???')}`); const ang = sysAng(sy); r.ms.ships.slice(0, 4).forEach(id => { const f = S.fleet.find(x => x.id === id); if (f) flyOut(f, ang); }); mapMis = null; mapPick = {}; closeModals(); } else toast('⚠ ' + r.why, 'bad'); mapPanel(); break; }
      case 'continue': closeModals(); break;
      case 'new': if (!G.S || G.S.st.built < 1 || confirm('Wirklich neu anfangen? Deine Kolonie wird gelöscht.')) { G.newGame(); dirty = true; Object.keys(ICONS); centerCam(); closeModals(); select(null); refresh(); toast('🪐 Willkommen auf Nova Prime!'); } break;
      case 'fx': S.opt.fx = S.opt.fx === 'low' ? 'full' : 'low'; G.save(); resize(); openMenu(); break;
      case 'help': $('menu-help').classList.toggle('hidden'); break;
      case 'rename': { const n = prompt('Name deiner Kolonie:', S.name); if (n && n.trim()) { S.name = n.trim().slice(0, 24); G.save(); hud(); } break; }
    }
  });
  function openMenu(welcome) {
    const S = G.S; openModal('m-menu');
    $('mm-stats').innerHTML = `<div><b>${S.pop}</b><small>Bewohner</small></div><div><b>${S.bld.length}</b><small>Gebäude</small></div><div><b>${S.fleet.length}</b><small>Schiffe</small></div><div><b>${S.ach.length}/${G.ACH.length}</b><small>Erfolge</small></div>`;
    $('mm-fx').textContent = S.opt.fx === 'low' ? 'Effekte: sparsam' : 'Effekte: voll';
    $('mm-welcome').innerHTML = welcome || '';
    $('mm-ach').innerHTML = G.ACH.map(a => `<span class="ach ${S.ach.includes(a.id) ? 'got' : ''}" title="${esc(a.d)}">${a.e} ${esc(a.n)}</span>`).join('');
  }
  function centerCam() { const hq = G.S.bld.find(b => b.type === 'hq'); const [x, y] = P(hq.i + 1, hq.j + 1); cam.x = x; cam.y = y + 20; cam.z = vw < 700 ? .72 : Math.max(.8, Math.min(1.6, Math.min(vw / 920, vh / 600))); clampCam(); }
  $('zin').onclick = () => { cam.z *= 1.25; clampCam(); lastZoom = performance.now(); }; $('zout').onclick = () => { cam.z /= 1.25; clampCam(); lastZoom = performance.now(); }; $('zhome').onclick = centerCam;

  // ================= Start =================
  let acc = 0, lastT = performance.now(), lastSave = Date.now(), playT = performance.now();
  function loop() {
    const t = performance.now(), dt = Math.min(5, (t - lastT) / 1000); lastT = t; if (!G.S) return;
    if (!document.hidden) { G.S.playMs += t - playT; } playT = t;
    G.tick(dt); handleEvents();
    acc += dt; if (acc > .5) { acc = 0; hud(); if (sel && G.S.bld.includes(sel)) info(); else if (sel) select(null); if (!$('m-fleet').classList.contains('hidden')) fleetUI(); if (!$('m-research').classList.contains('hidden')) researchUI(); if (!$('m-map').classList.contains('hidden') && !mapMis) mapPanel(); if (G.S.quest !== qSeen) { qSeen = G.S.quest; dock(); } }
    if (Date.now() - lastSave > 10000) { lastSave = Date.now(); G.save(); }
  }
  let qSeen = -1;
  function mapLoop(t) { requestAnimationFrame(mapLoop); drawMap(t); }
  function start() {
    const had = G.load(); if (!had) G.newGame();
    const back = had ? G.catchUp() : null; resize(); if (G.S.cam) Object.assign(cam, G.S.cam); else centerCam(); clampCam();
    refresh(); setInterval(loop, 100); requestAnimationFrame(frame); requestAnimationFrame(mapLoop);
    let welcome = ''; if (back) welcome = `<div class="wb"><b>Willkommen zurück!</b> Du warst ${dur(back.away / 1000)} weg.${Object.keys(back.gain).length ? ` Deine Kolonie hat produziert: ${Object.entries(back.gain).filter(([, v]) => v > 0).map(([k, v]) => `${IC[k]}+${fmt(v)}`).join(' ')}` : ''}${back.reports.length ? `<br>${back.reports.length} Mission${back.reports.length > 1 ? 'en' : ''} zurückgekehrt.` : ''}</div>`;
    openMenu(welcome); $('mm-continue').textContent = had ? 'Weiterspielen' : 'Los geht’s';
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { G.S.cam = { x: cam.x, y: cam.y, z: cam.z }; G.save(); } });
    addEventListener('pagehide', () => { G.S.cam = { x: cam.x, y: cam.y, z: cam.z }; G.save(); });
    window.KOL = { cam, P, toTile, select, startBuild, openModal, refresh, G, setDirty: () => dirty = true, centerCam };
  }
  if (window.GameSave) GameSave.ready([G.KEY], { reloadOnRemote: true, badge: true }).then(start, start); else start();
})();
