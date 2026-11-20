// Kolonie/view3d.js - 3D-Ansicht der Sternenkolonie (Three.js): Asteroid, Gebäude, Schiffe, Kamera, Auswahl.
// Die Spiellogik bleibt in game.js (window.G); ui.js steuert Eingabe und Fenster und ruft diese Ansicht auf.
import * as THREE from './three.module.min.js';

const G = window.G, N = G.N, T = 4, HALF = N * T / 2, RIM = HALF * 1.2, TAU = Math.PI * 2;
const ctrOf = b => { const s = G.B[b.type].s; return new THREE.Vector3((b.i + s / 2) * T - HALF, 0, (b.j + s / 2) * T - HALF); };
const tileCtr = (i, j, s = 1) => new THREE.Vector3((i + s / 2) * T - HALF, 0, (j + s / 2) * T - HALF);
let R, S, cam, canvas, low = false, overlay, sun, shieldDome = null, clock0 = performance.now();
const C = { tx: 0, tz: 0, yaw: Math.PI / 4, pitch: .82, dist: 92 };
const LIM = { dMin: 18, dMax: 175, pMin: .32, pMax: 1.38 };

// ================= Hilfsmittel =================
let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
function ctex(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
const glowTex = {};
function glowMat(rgb, op = 1) { const t = glowTex[rgb] || (glowTex[rgb] = ctex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, `rgba(${rgb},1)`); r.addColorStop(.28, `rgba(${rgb},.42)`); r.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = r; g.fillRect(0, 0, 64, 64); })); return new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op }); }
function glow(parent, rgb, size, x, y, z, op = 1) { const s = new THREE.Sprite(glowMat(rgb, op)); s.scale.set(size, size, 1); s.position.set(x, y, z); s.userData.glow = op; parent.add(s); return s; }
function panelTex(base, lit) { return ctex(256, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { const v = 150 + rnd() * 80 | 0; g.fillStyle = `rgba(${v},${v + 4},${v + 10},${.05 + rnd() * .08})`; g.fillRect(rnd() * w | 0, rnd() * h | 0, 8 + rnd() * 40 | 0, 6 + rnd() * 24 | 0); } g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.5; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); g.beginPath(); g.moveTo(i * 32 + (i % 2) * 16, 0); g.lineTo(i * 32 + (i % 2) * 16, h); g.stroke(); } }); }

const M = {};
function mats() {
  const hullT = panelTex('#dde2e8');
  Object.assign(M, {
    hull: new THREE.MeshStandardMaterial({ map: hullT, color: 0xf2f5f8, metalness: .3, roughness: .5 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf1f3f6, metalness: .1, roughness: .55 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2b3138, metalness: .6, roughness: .5 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x7c8794, metalness: .8, roughness: .35 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xe0782a, metalness: .3, roughness: .45 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x3b6fd8, metalness: .3, roughness: .4 }),
    teal: new THREE.MeshStandardMaterial({ color: 0x1f8a8a, metalness: .3, roughness: .45 }),
    red: new THREE.MeshStandardMaterial({ color: 0xb8322f, metalness: .3, roughness: .5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xa8dcff, metalness: 0, roughness: .05, transparent: true, opacity: .34, clearcoat: 1, depthWrite: false }),
    win: new THREE.MeshBasicMaterial({ color: 0xffd38a }),
    winC: new THREE.MeshBasicMaterial({ color: 0x8fe9ff }),
    solar: new THREE.MeshStandardMaterial({ color: 0x1a3b78, metalness: .9, roughness: .22, emissive: 0x06142e }),
    plant: new THREE.MeshStandardMaterial({ color: 0x3fbf5a, roughness: .8, emissive: 0x0b2a10 }),
    crys: new THREE.MeshStandardMaterial({ color: 0xb06bff, metalness: .1, roughness: .2, emissive: 0x6a28c8, emissiveIntensity: .9 }),
    pad: new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: .4, roughness: .7 }),
    hazard: new THREE.MeshStandardMaterial({ map: ctex(64, 8, g => { for (let x = 0; x < 64; x += 8) { g.fillStyle = (x / 8) % 2 ? '#1a1a1a' : '#f0b030'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, 0); g.lineTo(x + 4, 8); g.lineTo(x - 4, 8); g.fill(); } }), roughness: .7 }),
    yellow: new THREE.MeshBasicMaterial({ color: 0xf0b030 }),
    ore: new THREE.MeshStandardMaterial({ color: 0x9a7a4a, roughness: 1 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: .6, roughness: .4 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x6b6375, roughness: 1, flatShading: true }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffb347 }),
  });
}
const GEO = {}; // geteilte Grundformen
const geo = (k, f) => GEO[k] || (GEO[k] = f());
function add(p, g, m, x, y, z, cast = true) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; p.add(o); return o; }
const box = (p, w, h, d, m, x, y, z) => add(p, geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), m, x, y + h / 2, z);
const cyl = (p, r, h, m, x, y, z, seg = 20, r2) => add(p, geo(`c${r},${h},${seg},${r2}`, () => new THREE.CylinderGeometry(r2 ?? r, r, h, seg)), m, x, y + h / 2, z);
const sph = (p, r, m, x, y, z, part) => add(p, geo(`s${r},${part}`, () => part ? new THREE.SphereGeometry(r, 28, 12, 0, TAU, 0, Math.PI / 2) : new THREE.SphereGeometry(r, 24, 14)), m, x, y, z);
function wins(p, x, y, z, n, w, ax, m = M.win) { for (let k = 0; k < n; k++) { const o = (k - (n - 1) / 2) * w * 1.7; add(p, geo(`w${w},${ax}`, () => new THREE.BoxGeometry(ax === 'x' ? w : .06, w * .55, ax === 'x' ? .06 : w)), m, ax === 'x' ? x + o : x, y, ax === 'x' ? z : z + o, false); } }
function ringWins(p, r, y, n, w, m = M.win, off = 0) { for (let k = 0; k < n; k++) { const a = k / n * TAU + off, o = add(p, geo(`rw${w}`, () => new THREE.BoxGeometry(w, w * .5, .06)), m, Math.sin(a) * r, y, Math.cos(a) * r, false); o.rotation.y = a; } }

// ================= Gebäude-Modelle =================
// Jedes Modell steht mittig auf (0,0,0) mit Grundfläche s*T. anim(t) bewegt Teile; h = ungefähre Höhe.
const MODELS = {
  hq(g, l) {
    cyl(g, 3.5, 1.1, M.dark, 0, 0, 0, 8); cyl(g, 3.05, 4.4, M.hull, 0, 1.1, 0, 8); cyl(g, 3.12, .45, M.orange, 0, 3.6, 0, 8);
    ringWins(g, 3.08, 2.4, 8, 1.3, M.winC, Math.PI / 8);
    let y = 5.5;
    if (l >= 2) { cyl(g, 2.3, 2.6, M.white, 0, y, 0, 8); ringWins(g, 2.33, y + 1.3, 8, 1, M.win, Math.PI / 8); y += 2.6; }
    if (l >= 4) { for (const s of [-1, 1]) { box(g, 2.2, 3, 3, M.hull, s * 3.6, 0, 0); wins(g, s * 4.72, 1.9, 0, 3, .45, 'z'); box(g, 2.3, .3, 3.1, M.orange, s * 3.6, 3, 0); } }
    cyl(g, 1.6, 1.1, M.steel, 0, y, 0, 12); y += 1.1;
    const dish = new THREE.Group(); dish.position.set(0, y, 0); g.add(dish);
    if (l >= 3) { const d = sph(dish, 1.2, M.white, 1.5, .4, 0, true); d.rotation.z = -.9; cyl(dish, .12, .9, M.steel, .9, 0, 0, 6); }
    const sp = l >= 5 ? 6.5 : 3.6; cyl(g, .14, sp, M.steel, 0, y, 0, 8); glow(g, '255,90,90', 2.4, 0, y + sp + .2, 0);
    if (l >= 5) { add(g, geo('hqring', () => new THREE.TorusGeometry(2.6, .14, 8, 48)), M.orange, 0, y + 2.5, 0).rotation.x = Math.PI / 2; glow(g, '125,211,252', 3, 0, y + 2.5, 0, .7); }
    return { h: y + sp, anim: t => { dish.rotation.y = t * .35; } };
  },
  hab(g, l, b) {
    const v = (b ? b.id : 0) * 1.7;
    cyl(g, 1.75, .45, M.dark, 0, 0, 0, 24); sph(g, 1.62, M.white, 0, .45, 0, true);
    add(g, geo('habr', () => new THREE.TorusGeometry(1.63, .07, 8, 32)), M.orange, 0, .95, 0).rotation.x = Math.PI / 2;
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + v, o = add(g, geo('habw', () => new THREE.BoxGeometry(.45, .3, .06)), M.win, Math.sin(a) * 1.48, 1.3, Math.cos(a) * 1.48, false); o.rotation.y = a; o.rotation.x = -.45; }
    box(g, .7, .85, .8, M.hull, Math.sin(v) * 1.75, .2, Math.cos(v) * 1.75).rotation.y = v;
    let h = 2.1;
    if (l >= 2) { cyl(g, .55, 1, M.hull, 0, 1.9, 0, 16); sph(g, .62, M.glass, 0, 2.9, 0, true); glow(g, '255,211,138', 1.2, 0, 3.1, 0, .6); h = 3.6; }
    if (l >= 3) { cyl(g, .05, 1.4, M.steel, .9, 1.5, .6, 4); glow(g, '255,90,90', .7, .9, 2.95, .6); sph(g, .8, M.white, -1.2, .1, -1.2, true); }
    return { h };
  },
  green(g, l) {
    box(g, 3.6, .35, 3.6, M.dark, 0, 0, 0);
    const rows = l >= 2 ? 3 : 2;
    for (let k = 0; k < rows * 6; k++) cyl(g, .17 + (k * 7 % 5) * .03, .55 + (k * 3 % 4) * .15, M.plant, -1.3 + (k % 6) * .52, .35, -1 + Math.floor(k / 6) * (2 / Math.max(1, rows - 1)), 6);
    const tun = geo('gtun', () => new THREE.CylinderGeometry(1.7, 1.7, 3.4, 24, 1, true, 0, Math.PI));
    const v = add(g, tun, M.glass, 0, .38, 0, false); v.rotation.set(0, Math.PI / 2, Math.PI / 2); v.scale.set(1, 1, .8);
    for (let k = -1; k <= 1; k++) { const r = add(g, geo('gring', () => new THREE.TorusGeometry(1.7, .05, 6, 24, Math.PI)), M.steel, 0, .38, k * 1.6, false); r.scale.set(1, .8, 1); }
    let h = 1.8;
    if (l >= 3) { sph(g, 1.1, M.glass, 1.1, .38, 1.1, true); cyl(g, .5, 1.2, M.plant, 1.1, .38, 1.1, 8); h = 2; }
    glow(g, '120,255,140', 4, 0, 1, 0, .25);
    return { h };
  },
  solar(g, l) {
    const panels = [], sz = 1.45 + l * .12;
    for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) { const x = -.92 + a * 1.84, z = -.92 + c * 1.84; cyl(g, .07, .7 + l * .15, M.steel, x, 0, z, 6); const pv = new THREE.Group(); pv.position.set(x, .8 + l * .15, z); g.add(pv); add(pv, geo(`sp${sz}`, () => new THREE.BoxGeometry(sz, .06, sz)), M.solar, 0, 0, 0); panels.push(pv); }
    if (l >= 3) { box(g, .9, .6, .6, M.hull, 0, 0, 0); glow(g, '120,230,255', .8, 0, .8, 0, .7); }
    return { h: 1.6, anim: t => { const a = -.45 + Math.sin(t * .05) * .12; for (const p of panels) p.rotation.x = a; } };
  },
  store(g, l) {
    const cols = [M.orange, M.blue, M.steel, M.white, M.teal], n = [0, 4, 7, 10][l];
    for (let k = 0; k < n; k++) { const lay = Math.floor(k / 4), q = k % 4; box(g, 1.5, .75, .8, cols[(k * 3) % 5], -.8 + (q % 2) * 1.6, lay * .75, -.7 + Math.floor(q / 2) * 1.4); }
    if (l >= 3) { cyl(g, .08, 3.2, M.orange, 1.6, 0, 1.6, 6); box(g, .12, .12, 2.4, M.orange, 1.6, 3.1, .6); }
    return { h: 2.4 };
  },
  mine(g, l, b) {
    const onOre = b && G.tileAt(b.i, b.j) === 'ore', h = 4 + l * 1.3;
    box(g, 3.4, .35, 3.4, M.dark, 0, 0, 0); box(g, 1.7, 1.5, 1.4, M.orange, -.7, .35, .8); wins(g, -.7, 1.4, 1.52, 2, .32, 'x');
    for (const [x, z] of [[.4, -.4], [1.4, -.4], [.4, -1.4], [1.4, -1.4]]) { const o = cyl(g, .06, h, M.steel, x, .35, z, 5); }
    box(g, 1.3, .3, 1.3, M.steel, .9, .35 + h, -.9);
    const drill = new THREE.Group(); drill.position.set(.9, .35, -.9); g.add(drill); cyl(drill, .32, h * .7, M.dark, 0, 0, 0, 10); add(drill, geo('drillb', () => new THREE.ConeGeometry(.45, .8, 10)), M.steel, 0, -.1, 0).rotation.x = Math.PI;
    const pile = add(g, geo('pile', () => new THREE.ConeGeometry(1, .9, 10)), onOre ? M.gold : M.ore, -1, .8, -1); if (l >= 2) add(g, geo('pile2', () => new THREE.ConeGeometry(.7, .6, 10)), onOre ? M.gold : M.ore, -.2, .65, -1.4);
    glow(g, '255,170,80', 1.2, .9, h + .8, -.9, .8);
    return { h: h + .7, anim: t => { drill.rotation.y = t * 2.5; drill.position.y = .35 + Math.sin(t * 1.4) * .15; } };
  },
  crys(g, l) {
    const cr = [];
    for (let k = 0; k < 4 + l * 2; k++) { const a = k * 2.39, r = .6 + (k % 3) * .45, hh = .9 + (k * 5 % 7) * .25; const m = add(g, geo('oct', () => new THREE.OctahedronGeometry(.38, 0)), M.crys, Math.cos(a) * r - .4, hh * .5, Math.sin(a) * r - .2); m.scale.set(1, hh * 1.7, 1); m.rotation.set((k % 3 - 1) * .2, k, (k % 2 - .5) * .3); cr.push(m); }
    box(g, 1.2, 1.1, 1.2, M.hull, 1, 0, 1); cyl(g, .1, 1.6 + l * .5, M.steel, 1, 1.1, 1, 6); glow(g, '255,90,90', .6, 1, 2.8 + l * .5, 1);
    if (l >= 2) for (const s of [-1, 1]) cyl(g, .12, 2.2, M.steel, s * 1.4, 0, -1.3, 6);
    const gl = glow(g, '180,110,255', 6, -.3, 1.2, -.2, .55);
    return { h: 3, anim: t => { gl.material.opacity = .4 + Math.sin(t * 1.6) * .15; } };
  },
  factory(g, l) {
    box(g, 6.6, 2.6, 5, M.hull, 0, 0, 0);
    for (let k = 0; k < 4; k++) { const r = box(g, 1.65, .1, 5, M.steel, -2.45 + k * 1.65, 3, 0); r.rotation.z = .5; add(g, geo('fwin', () => new THREE.BoxGeometry(.06, .9, 4.8)), M.win, -1.8 + k * 1.65, 3.05, 0, false); }
    const st = [[2.4, -1.6]]; if (l >= 2) st.push([1.3, -1.6]);
    for (const [x, z] of st) { cyl(g, .45, 5.6 + l * .5, M.steel, x, 0, z, 14); cyl(g, .55, .4, M.orange, x, 4.8 + l * .5, z, 14); }
    box(g, 2.2, 1.7, .1, M.dark, -1.4, 0, 2.52); wins(g, 1.7, 1.8, 2.52, 3, .42, 'x');
    if (l >= 3) { box(g, 2.4, 1.8, 1.6, M.orange, -2, 0, -2.9); }
    const puffs = st.map(([x, z]) => Array.from({ length: 4 }, (_, k) => glow(g, '200,205,215', 1.5, x, 6 + l * .5, z, .3))).flat();
    glow(g, '255,150,60', 3, -1.4, 1, 2.8, .7);
    return { h: 6.5, anim: t => { puffs.forEach((p, k) => { const q = ((t * .35 + k * .25) % 1); p.position.y = 6 + l * .5 + q * 3.5; p.scale.setScalar(1.2 + q * 2.4); p.material.opacity = .35 * (1 - q); }); } };
  },
  refinery(g, l) {
    box(g, 6.8, .35, 6.8, M.dark, 0, 0, 0);
    const tanks = [[-1.6, -1.6, 1.25, 4.2], [1.6, -1.6, 1.25, 4.2], [-1.6, 1.6, 1.05, 3.2], [1.4, 1.9, .8, 2.4]].slice(0, 1 + l);
    for (const [x, z, r, h] of tanks) { cyl(g, r, h, M.white, x, .35, z, 24); sph(g, r, M.white, x, .35 + h, z, true); cyl(g, r + .02, .32, M.orange, x, .35 + h * .6, z, 24); }
    add(g, geo('pipe', () => new THREE.TorusGeometry(1.6, .13, 8, 24, Math.PI)), M.steel, 0, 3.8, -1.6);
    cyl(g, .18, 6.5, M.steel, 2.6, .35, 2.6, 8);
    const fl = add(g, geo('flame', () => new THREE.ConeGeometry(.25, 1, 8)), M.flame, 2.6, 7.4, 2.6, false); const fg = glow(g, '255,140,60', 2.6, 2.6, 7.4, 2.6);
    return { h: 7.5, anim: t => { const f = .8 + Math.sin(t * 9) * .15 + Math.sin(t * 13) * .1; fl.scale.set(f, f * 1.3, f); fg.material.opacity = .7 + Math.sin(t * 7) * .2; } };
  },
  pad(g, l) {
    add(g, geo('padb', () => new THREE.CylinderGeometry(3.75, 3.85, .35, 8)), M.pad, 0, .17, 0).rotation.y = Math.PI / 8;
    const r = add(g, geo('padr', () => new THREE.RingGeometry(2.6, 2.85, 48)), M.yellow, 0, .37, 0, false); r.rotation.x = -Math.PI / 2;
    const hT = geo('padH', () => new THREE.PlaneGeometry(2, 2)); const hm = add(g, hT, new THREE.MeshBasicMaterial({ map: ctex(128, 128, x => { x.fillStyle = '#f0b030'; x.font = 'bold 110px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', 64, 70); }), transparent: true }), 0, .38, 0, false); hm.rotation.x = -Math.PI / 2;
    const lights = []; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + Math.PI / 8; lights.push(glow(g, '255,200,120', 1, Math.cos(a) * 3.4, .6, Math.sin(a) * 3.4)); }
    if (l >= 2) { cyl(g, .35, 3, M.steel, 3.2, 0, -3.2, 8); box(g, 1.2, .9, 1.2, M.hull, 3.2, 3, -3.2); wins(g, 3.2, 3.5, -2.58, 2, .35, 'x', M.winC); }
    if (l >= 3) { cyl(g, .7, 1.8, M.orange, -3.1, 0, 3.1, 14); sph(g, .7, M.orange, -3.1, 1.8, 3.1, true); }
    return { h: 1, anim: t => { lights.forEach((s, k) => { s.material.opacity = (Math.floor(t * 2.5) % 8 === k) ? 1 : .35; }); } };
  },
  yard(g, l) {
    box(g, 7.6, .35, 7.6, M.dark, 0, 0, 0); const h = 5.5 + l * .8;
    for (const x of [-3.4, 3.4]) for (const z of [-3.4, 3.4]) cyl(g, .22, h, M.orange, x, .35, z, 8);
    for (const z of [-3.4, 3.4]) box(g, 7.2, .45, .45, M.orange, 0, .35 + h, z);
    const cr = new THREE.Group(); cr.position.set(0, .35 + h - .4, 0); g.add(cr); box(cr, .7, .7, 7.2, M.steel, 0, -.35, 0); const hook = cyl(cr, .04, 2.6, M.steel, 0, -2.9, 0, 4);
    if (l >= 3) { const c2 = cyl(g, .3, h + 3, M.steel, -3.4, .35, 0, 8); box(g, 5, .3, .3, M.steel, -1.4, h + 3, 0); }
    const sparks = [glow(g, '255,230,150', 1, 0, 2.5, 0), glow(g, '140,230,255', 1.4, 1, 2, 0)];
    for (let k = 0; k < 4; k++) glow(g, '255,220,150', 1, -3 + k * 2, .35 + h + .4, -3.4, .6);
    return { h: h + 1, anim: t => { cr.position.x = Math.sin(t * .4) * 2.4; sparks.forEach((s, k) => { s.material.opacity = (Math.sin(t * 17 + k * 3) > .3) ? 1 : 0; s.position.x = cr.position.x + (k - .5) * .6; }); } };
  },
  tower(g, l) {
    cyl(g, 1.2, .9, M.dark, 0, 0, 0, 8); cyl(g, .65, 2 + l * .5, M.steel, 0, .9, 0, 8);
    const head = new THREE.Group(); head.position.y = 2.9 + l * .5; g.add(head); box(head, 1.5, .85, 1.5, M.hull, 0, 0, 0); box(head, 1.55, .15, 1.55, M.red, 0, .85, 0);
    const n = l >= 2 ? 2 : 1; for (let k = 0; k < n * 2; k++) { const x = (k % 2 ? 1 : -1) * (.3 + Math.floor(k / 2) * .35); const br = add(head, geo('barrel', () => new THREE.CylinderGeometry(.11, .11, 2, 8)), M.dark, x, .45, 1.3); br.rotation.x = Math.PI / 2; }
    glow(g, '255,80,80', 1.2, 0, 4.1 + l * .5, 0);
    return { h: 4.5 + l * .5, head, anim: t => { if (!head.userData.aim) head.rotation.y = Math.sin(t * .3 + l) * 1.2; } };
  },
  lab(g, l) {
    box(g, 3, 1.7, 2.4, M.white, 0, 0, 0); wins(g, 0, 1.05, 1.22, 4, .38, 'x', M.winC);
    if (l >= 2) { box(g, 2, 1, 1.8, M.hull, -.4, 1.7, 0); wins(g, -.4, 2.2, .92, 2, .32, 'x', M.winC); }
    const top = l >= 2 ? 2.7 : 1.7, dish = new THREE.Group(); dish.position.set(.9, top, 0); g.add(dish);
    cyl(dish, .08, .9, M.steel, 0, 0, 0, 6); const d = sph(dish, .95, M.white, 0, 1.4, 0, true); d.rotation.z = .8;
    if (l >= 3) { sph(g, .9, M.steel, -1, top, -.3, true); }
    return { h: top + 2, anim: t => { dish.rotation.y = t * .6; } };
  },
  shield(g, l) {
    cyl(g, 1.15, 1.1, M.dark, 0, 0, 0, 12); cyl(g, .5, 1.8 + l * .4, M.steel, 0, 1.1, 0, 12);
    for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; const o = cyl(g, .07, 2.4, M.steel, Math.cos(a) * .8, .9, Math.sin(a) * .8, 5); o.rotation.z = Math.cos(a) * .25; o.rotation.x = -Math.sin(a) * .25; }
    const y = 3.4 + l * .4, orb = sph(g, .65, new THREE.MeshBasicMaterial({ color: 0x9be3ff }), 0, y, 0); const gl = glow(g, '125,211,252', 4, 0, y, 0);
    return { h: y + 1, anim: t => { const f = 1 + Math.sin(t * 2.2) * .08; orb.scale.setScalar(f); gl.material.opacity = .7 + Math.sin(t * 2.2) * .25; } };
  },
};

// ================= Schiffe =================
const SHIP_SC = { drone: .55, scout: .8, fighter: .8, freighter: 1, cruiser: 1.6, colony: 1.6, pirate: .85 };
function shipModel(type) {
  const g = new THREE.Group(), hull = type === 'pirate' ? M.dark : M.hull, acc = type === 'pirate' ? M.red : type === 'scout' ? M.teal : type === 'fighter' ? M.blue : M.orange;
  const flames = [];
  const eng = (x, y, z, r) => { const e = add(g, geo(`eng${r}`, () => new THREE.CylinderGeometry(r, r * 1.15, r * 2.2, 12)), M.dark, x, y, z, false); e.rotation.x = Math.PI / 2; const f = glow(g, type === 'pirate' ? '255,110,80' : '140,225,255', r * 5, x, y, z - r * 1.4, 0); flames.push(f); };
  if (type === 'drone') {
    const b = sph(g, .55, M.orange, 0, 0, 0); b.scale.set(1, .55, 1); for (const [x, z] of [[-.75, -.75], [.75, -.75], [-.75, .75], [.75, .75]]) { const r = add(g, geo('rotor', () => new THREE.TorusGeometry(.38, .05, 6, 16)), M.dark, x, 0, z, false); r.rotation.x = Math.PI / 2; } glow(g, '255,220,120', .6, 0, -.25, 0, .8);
  } else if (type === 'freighter' || type === 'colony') {
    const b = add(g, geo('frb', () => new THREE.CapsuleGeometry(.75, 2.8, 6, 14)), hull, 0, 0, 0, false); b.rotation.x = Math.PI / 2; b.scale.set(1.2, .8, 1);
    for (const s of [-1, 1]) { box(g, .9, .9, 2.4, acc, s * 1.2, -.45, -.3); } box(g, 2.6, .1, 1, hull, 0, .1, -1.4); eng(-.8, 0, -2.1, .32); eng(.8, 0, -2.1, .32);
    add(g, geo('cockF', () => new THREE.SphereGeometry(.5, 14, 8, 0, TAU, 0, 1.2)), M.winC, 0, .4, 1.4, false).scale.set(1, .5, 1.3);
  } else if (type === 'cruiser') {
    const b = add(g, geo('crb', () => new THREE.CylinderGeometry(.5, 1.1, 5.4, 6)), hull, 0, 0, 0, false); b.rotation.x = -Math.PI / 2; b.scale.set(1.3, .7, 1);
    box(g, 1.2, .7, 2.6, M.dark, 0, .5, -.9); box(g, .3, 1.2, 1.2, acc, 0, 1.1, -1.4); for (const s of [-1, 1]) box(g, 1.8, .15, 2, hull, s * 1.5, -.1, -1.2); eng(-.7, 0, -2.9, .38); eng(.7, 0, -2.9, .38); eng(0, .35, -2.9, .3);
    wins(g, 0, .6, -.5, 1, .3, 'x', M.winC);
  } else {
    // Jäger, Forscher, Pirat: schlanke Keilform
    const b = add(g, geo('fib', () => new THREE.ConeGeometry(.55, 3, 6)), hull, 0, 0, .3, false); b.rotation.x = Math.PI / 2; b.scale.set(1.1, .55, 1);
    const wl = type === 'scout' ? 1.2 : 1.9; for (const s of [-1, 1]) { const w = add(g, geo(`fw${wl}`, () => new THREE.BoxGeometry(wl, .08, 1.1)), type === 'pirate' ? M.red : hull, s * wl / 2, -.05, -.6, false); w.rotation.y = s * .35; if (type !== 'scout') box(g, .12, .1, .9, acc, s * wl * .92, -.05, -.9); }
    if (type === 'scout') { cyl(g, .05, 1.2, M.steel, 0, .2, 1.2, 4).rotation.x = Math.PI / 2; add(g, geo('scd', () => new THREE.SphereGeometry(.35, 12, 8, 0, TAU, 0, 1.1)), M.white, 0, .25, -.3, false); }
    add(g, geo('cockS', () => new THREE.SphereGeometry(.3, 12, 8, 0, TAU, 0, 1.2)), M.winC, 0, .2, .5, false).scale.set(1, .6, 1.6);
    eng(0, 0, -1.3, .28); if (type === 'pirate') { eng(-.5, 0, -1.1, .2); eng(.5, 0, -1.1, .2); }
  }
  g.traverse(o => { o.castShadow = false; });
  g.scale.setScalar(SHIP_SC[type] || 1); g.userData.flames = flames; g.userData.type = type;
  return g;
}
function thrust(sh, v) { for (const f of sh.userData.flames) f.material.opacity = v; }
const shipPool = {};
function getShip(key, type) { if (shipPool[key]) return shipPool[key]; const m = shipModel(type); m.userData.flames.forEach(f => f.material = f.material.clone()); S.add(m); return shipPool[key] = m; }
function dropShip(key) { const m = shipPool[key]; if (m) { S.remove(m); delete shipPool[key]; } }

// ================= Szene =================
let ground, groundTex, groundCtx, worldG, bldG, crysG, uiG, fxG;
const bldObj = new Map();     // id -> { g, key, info }
function buildBackdrop() {
  const n = 5000, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = rnd() * 2 - 1, th = rnd() * TAU, r = 3000, s = Math.sqrt(1 - u * u); p.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3); const k = .5 + rnd() * .5, tt = rnd(); c.set(tt < .15 ? [k, k * .82, k * .65] : tt < .3 ? [k * .7, k * .85, k] : [k, k, k], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  S.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true })));
  const neb = ctex(1024, 512, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { const px = w * (.15 + rnd() * .7), py = h * (.3 + (rnd() - .5) * .35), r = 50 + rnd() * 150, gr = x.createRadialGradient(px, py, 0, px, py, r), col = rnd() < .55 ? '110,50,200' : rnd() < .5 ? '20,100,180' : '190,60,140'; gr.addColorStop(0, `rgba(${col},.11)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); } });
  const nm = new THREE.Mesh(new THREE.SphereGeometry(2800, 32, 16), new THREE.MeshBasicMaterial({ map: neb, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); nm.rotation.set(.2, 2.1, .1); S.add(nm);
  // Ringplanet (wie bisher lila)
  const pt = ctex(1024, 512, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3b1d7a'); gr.addColorStop(.5, '#8b5cf6'); gr.addColorStop(1, '#2e1065'); x.fillStyle = gr; x.fillRect(0, 0, w, h); for (let i = 0; i < 46; i++) { x.fillStyle = `rgba(${rnd() < .5 ? '237,233,254' : '60,20,120'},${.06 + rnd() * .16})`; x.fillRect(0, rnd() * h, w, 3 + rnd() * 22); } });
  const pl = new THREE.Mesh(new THREE.SphereGeometry(260, 64, 40), new THREE.MeshStandardMaterial({ map: pt, roughness: 1 })); pl.position.set(-900, 420, -1500); pl.rotation.z = .35; S.add(pl);
  const rt = ctex(512, 4, (x, w) => { for (let i = 0; i < w; i++) { const a = (.15 + .55 * Math.abs(Math.sin(i * .07) * Math.sin(i * .021))) * Math.min(1, i / 40); x.fillStyle = `rgba(224,218,255,${a})`; x.fillRect(i, 0, 1, 4); } });
  const rg = new THREE.RingGeometry(330, 560, 128, 1), uv = rg.attributes.uv, ps = rg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (Math.hypot(ps.getX(i), ps.getY(i)) - 330) / 230, .5);
  const rm = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: rt, transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false })); rm.position.copy(pl.position); rm.rotation.set(-1.2, .3, .2); S.add(rm);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 20), new THREE.MeshStandardMaterial({ color: 0xb6bcc8, roughness: 1 })); moon.position.set(1300, 300, -700); S.add(moon);
}
function buildAsteroid() {
  // Oberseite: abgerundetes Quadrat, Bodentextur wird aus dem Spielfeld gemalt
  const sh = new THREE.Shape(), seg = 96, sup = (a, r) => { const c = Math.cos(a), s = Math.sin(a), p = 5; return r / Math.pow(Math.pow(Math.abs(c), p) + Math.pow(Math.abs(s), p), 1 / p); };
  const outline = []; for (let k = 0; k < seg; k++) { const a = k / seg * TAU, r = sup(a, RIM) * (1 + Math.sin(a * 7) * .018 + Math.sin(a * 13 + 1) * .012); outline.push([Math.cos(a) * r, Math.sin(a) * r]); }
  outline.forEach(([x, y], k) => k ? sh.lineTo(x, y) : sh.moveTo(x, y));
  const cap = new THREE.ShapeGeometry(sh, 4); const pu = cap.attributes.position, uv = cap.attributes.uv; for (let i = 0; i < pu.count; i++) uv.setXY(i, (pu.getX(i) + RIM * 1.05) / (RIM * 2.1), (pu.getY(i) + RIM * 1.05) / (RIM * 2.1));
  cap.rotateX(-Math.PI / 2);   // Shape-y -> -z; Textur wird passend gemalt
  const c = document.createElement('canvas'); c.width = c.height = 2048; groundCtx = c.getContext('2d'); groundTex = new THREE.CanvasTexture(c); groundTex.colorSpace = THREE.SRGBColorSpace; groundTex.anisotropy = 8;
  ground = new THREE.Mesh(cap, new THREE.MeshStandardMaterial({ map: groundTex, roughness: .95, metalness: .05 })); ground.receiveShadow = true; worldG.add(ground);
  // Unterseite: zerklüfteter Felsen, nach unten spitz
  const rings = 9, pos = [], col = [], idx = [];
  for (let k = 0; k <= rings; k++) { const t = k / rings, f = Math.pow(Math.cos(t * Math.PI / 2), .65), y = -t * HALF * 1.5 - .05;
    for (let q = 0; q < seg; q++) { const [ox, oz] = outline[q], n = k === 0 ? 1 : (1 + (rnd() - .5) * .22), yy = k === 0 ? -.02 : y + (rnd() - .5) * 2.5; pos.push(ox * f * n, yy, -oz * f * n); const d = .55 - t * .35; col.push(d * .55, d * .5, d * .68); } }
  for (let k = 0; k < rings; k++) for (let q = 0; q < seg; q++) { const a = k * seg + q, b = k * seg + (q + 1) % seg, c2 = a + seg, d = b + seg; idx.push(a, c2, b, b, c2, d); }
  const ug = new THREE.BufferGeometry(); ug.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ug.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); ug.setIndex(idx); ug.computeVertexNormals();
  const um = new THREE.Mesh(ug, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide })); worldG.add(um);
  // kleine schwebende Felsbrocken
  for (let k = 0; k < 14; k++) { const r = 1 + rnd() * 3.5, m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), M.rock), a = rnd() * TAU, d = RIM * (1.25 + rnd() * .6); m.position.set(Math.cos(a) * d, -6 - rnd() * 30, Math.sin(a) * d); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); m.userData.spin = (rnd() - .5) * .2; worldG.add(m); }
}
// Welt-Koordinate -> Pixel der Bodentextur (Shape-y wurde zu -z gedreht; flipY der Textur gleicht die Richtung aus)
const TX = 2048 / (RIM * 2.1);
function paintGround() {
  const g = groundCtx, W = 2048; let s = (G.S.seed % 9999) + 3; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
  const py = z => W - (( -z + RIM * 1.05) * TX);   // Canvas-y für Welt-z (flipY)
  const px = x => (x + RIM * 1.05) * TX;
  g.fillStyle = '#4a4458'; g.fillRect(0, 0, W, W);
  for (let k = 0; k < 7000; k++) { const v = 60 + r() * 50 | 0; g.fillStyle = `rgba(${v + 6},${v},${v + 18},${.18 + r() * .25})`; g.beginPath(); g.arc(r() * W, r() * W, 1 + r() * 5, 0, TAU); g.fill(); }
  for (let k = 0; k < 26; k++) { const x = r() * W, y = r() * W, rr = 10 + r() * 40; if (Math.abs(x - W / 2) < HALF * TX && Math.abs(y - W / 2) < HALF * TX) continue; g.fillStyle = 'rgba(20,16,30,.35)'; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); g.strokeStyle = 'rgba(160,150,190,.18)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y + 2, rr, 0, Math.PI); g.stroke(); }
  const a = G.area(G.S), ts = T * TX;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x0 = px(i * T - HALF), y0 = py(j * T - HALF), inA = i >= a.lo && i <= a.hi && j >= a.lo && j <= a.hi, t = G.tileAt(i, j), v = (i * 7 + j * 13) % 5;
    if (inA) { g.fillStyle = (i + j) % 2 ? '#5a5f6c' : '#555a67'; g.fillRect(x0, y0, ts, ts); g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(x0 + 4, y0 + 4, ts - 8, ts - 8); g.strokeStyle = 'rgba(20,24,32,.55)'; g.lineWidth = 3; g.strokeRect(x0 + 1.5, y0 + 1.5, ts - 3, ts - 3); }
    else { g.fillStyle = `rgba(${74 + v * 3},${68 + v * 2},${88 + v * 3},.55)`; g.fillRect(x0, y0, ts, ts); }
    const cx = x0 + ts / 2, cy = y0 + ts / 2;
    if (t === 'ore') for (let k = 0; k < 9; k++) { g.fillStyle = k % 2 ? 'rgba(240,190,70,.9)' : 'rgba(170,115,40,.9)'; g.beginPath(); g.ellipse(cx + (r() - .5) * ts * .75, cy + (r() - .5) * ts * .75, 5 + r() * 9, 3 + r() * 6, r() * 3, 0, TAU); g.fill(); }
    if (t === 'crys') { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, ts * .6); gr.addColorStop(0, 'rgba(190,120,255,.55)'); gr.addColorStop(1, 'rgba(190,120,255,0)'); g.fillStyle = gr; g.fillRect(x0, y0, ts, ts); }
    if (t === 'crater') { g.fillStyle = 'rgba(10,8,20,.75)'; g.beginPath(); g.ellipse(cx, cy, ts * .42, ts * .42, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(170,160,200,.3)'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, ts * .44, .3, Math.PI - .3); g.stroke(); }
  }
  // Leitungen von der Zentrale zu den Gebäuden
  const hq = G.S.bld.find(b => b.type === 'hq');
  if (hq) { g.lineCap = 'round'; const h0 = ctrOf(hq); for (const b of G.S.bld) { if (b === hq || (b.build && !b.up)) continue; const c1 = ctrOf(b); const pts = [[px(h0.x), py(h0.z)], [px(c1.x), py(h0.z)], [px(c1.x), py(c1.z)]];
      g.strokeStyle = 'rgba(34,211,238,.16)'; g.lineWidth = 16; g.beginPath(); pts.forEach((p, k) => k ? g.lineTo(...p) : g.moveTo(...p)); g.stroke(); g.strokeStyle = 'rgba(103,232,249,.6)'; g.lineWidth = 3; g.stroke(); } g.lineCap = 'butt'; }
  // Rand des Baulands
  g.strokeStyle = 'rgba(103,232,249,.75)'; g.lineWidth = 5; g.setLineDash([22, 16]); g.strokeRect(px(a.lo * T - HALF), py(a.lo * T - HALF), (a.hi - a.lo + 1) * ts, (a.hi - a.lo + 1) * ts); g.setLineDash([]);
  groundTex.needsUpdate = true;
}
function buildCrystals() {
  crysG.clear();
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { if (G.tileAt(i, j) !== 'crys') continue; const b = G.bAt(i, j); if (b) continue; const c = tileCtr(i, j);
    for (let k = 0; k < 5; k++) { const hh = .5 + ((i * 3 + j * 5 + k * 7) % 6) * .2, m = add(crysG, geo('oct', () => new THREE.OctahedronGeometry(.38, 0)), M.crys, c.x + Math.cos(k * 2.4 + i) * (.4 + k * .25), hh * .55, c.z + Math.sin(k * 2.4 + j) * (.4 + k * .25)); m.scale.set(.8, hh * 1.6, .8); m.rotation.set((k % 3 - 1) * .25, k + i, (k % 2 - .5) * .35); }
    glow(crysG, '180,110,255', 4.5, c.x, .8, c.z, .45); }
}

// ================= Gebäude abgleichen =================
const keyOf = b => `${b.type}|${b.i},${b.j}|${b.lvl}|${b.build && !b.up ? 'B' : ''}|${b.up ? 'U' : ''}|${b.dmg ? 'D' : ''}`;
function makeBuilding(b) {
  const g = new THREE.Group(), s = G.B[b.type].s, c = ctrOf(b); g.position.copy(c);
  const inner = new THREE.Group(); g.add(inner);
  const info = MODELS[b.type] ? MODELS[b.type](inner, Math.max(1, b.lvl), b) : { h: 2 };
  inner.traverse(o => { o.userData.bid = b.id; });
  if (b.build && !b.up) {      // Neubau: Fundament, Gerüst, Gebäude wächst
    box(g, s * T * .94, .22, s * T * .94, M.hazard, 0, 0, 0);
    const hh = info.h || 3; for (const x of [-1, 1]) for (const z of [-1, 1]) cyl(g, .06, hh, M.yellow, x * s * T * .44, .2, z * s * T * .44, 4);
    info.grow = true; inner.scale.y = .05;
    info.sparks = [glow(g, '255,230,150', 1.2, 0, 1, 0), glow(g, '255,200,100', 1, .5, 1.2, .3)];
  }
  if (b.up) { const crane = new THREE.Group(); crane.position.set(s * T * .42, 0, -s * T * .42); g.add(crane); cyl(crane, .12, (info.h || 3) + 2.5, M.yellow, 0, 0, 0, 6); box(crane, .2, .2, s * T * .8, M.yellow, 0, (info.h || 3) + 2.4, s * T * .3); info.crane = crane; info.sparks = [glow(g, '255,230,150', 1.2, 0, (info.h || 3) * .7, 0)]; }
  if (b.dmg) { info.smoke = Array.from({ length: 5 }, (_, k) => glow(g, '60,60,70', 2, (k % 2 - .5) * 1.2, 2, (k % 3 - 1) * .8, .6)); info.fire = glow(g, '255,120,40', 3, 0, 1, 0, .8);
    inner.traverse(o => { if (o.isMesh && o.material && o.material.color && !o.material._dmg) { o.material = o.material.clone(); o.material.color.multiplyScalar(.45); o.material._dmg = 1; } }); }
  g.traverse(o => { if (o.isMesh) o.userData.bid = b.id; });
  bldG.add(g); return { g, inner, info };
}
let shadowDirty = true;
function syncBuildings() {
  const seen = new Set();
  for (const b of G.S.bld) { seen.add(b.id); const k = keyOf(b), o = bldObj.get(b.id); if (o && o.key === k) continue; if (o) bldG.remove(o.g); const n = makeBuilding(b); n.key = k; bldObj.set(b.id, n); }
  for (const [id, o] of bldObj) if (!seen.has(id)) { bldG.remove(o.g); bldObj.delete(id); }
  // Schutzschild über der Kolonie
  const sh = G.S.bld.find(b => b.type === 'shield' && !(b.build && !b.up) && !b.dmg), a = G.area(G.S), rad = (a.hi - a.lo + 1) * T * .74;
  if (sh && !shieldDome) { shieldDome = new THREE.Group(); const dm = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 24, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5cc8ff, transparent: true, opacity: .05, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); shieldDome.add(dm); const ring = new THREE.Mesh(new THREE.RingGeometry(.985, 1, 128), new THREE.MeshBasicMaterial({ color: 0x5cc8ff, transparent: true, opacity: .4, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .08; shieldDome.add(ring); S.add(shieldDome); }
  if (!sh && shieldDome) { S.remove(shieldDome); shieldDome = null; }
  if (shieldDome) shieldDome.scale.set(rad, rad * .55, rad);
  paintGround(); buildCrystals(); shadowDirty = true;
}

// ================= Auswahlrahmen, Vorschau, Balken =================
function frameMesh(rgb) {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: new THREE.Color(`rgb(${rgb})`), transparent: true, opacity: .9, depthWrite: false });
  for (let k = 0; k < 4; k++) { const o = new THREE.Mesh(geo('frm', () => new THREE.BoxGeometry(1, .12, .22)), m); g.add(o); }
  const fill = new THREE.Mesh(geo('frf', () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: .16, depthWrite: false })); fill.rotation.x = -Math.PI / 2; g.add(fill);
  g.userData = { m, fill }; g.visible = false; g.renderOrder = 2; uiG.add(g); return g;
}
function placeFrame(f, i, j, s, fillOn, op = .9) {
  const L = s * T, c = tileCtr(i, j, s), [a, b, c2, d] = f.children; f.position.set(c.x, .12, c.z);
  a.scale.set(L + .22, 1, 1); a.position.set(0, 0, -L / 2); b.scale.set(L + .22, 1, 1); b.position.set(0, 0, L / 2);
  c2.scale.set(L + .22, 1, 1); c2.rotation.y = Math.PI / 2; c2.position.set(-L / 2, 0, 0); d.scale.set(L + .22, 1, 1); d.rotation.y = Math.PI / 2; d.position.set(L / 2, 0, 0);
  f.userData.fill.scale.set(L, L, 1); f.userData.fill.visible = !!fillOn; f.userData.m.opacity = op; f.visible = true;
}
let frSel, frMove, frHover, frGhost, ghostObj = null, ghostKey = '';
const ghostMat = { ok: new THREE.MeshStandardMaterial({ color: 0x4ade80, transparent: true, opacity: .55, emissive: 0x166534, depthWrite: false }), no: new THREE.MeshStandardMaterial({ color: 0xf87171, transparent: true, opacity: .45, emissive: 0x7f1d1d, depthWrite: false }) };
function setGhost(gh) {
  if (!gh) { if (ghostObj) ghostObj.visible = false; frGhost.visible = false; return; }
  const k = gh.k + '|' + (gh.lvl || 1) + '|' + (gh.ok ? 1 : 0);
  if (k !== ghostKey) { if (ghostObj) uiG.remove(ghostObj); ghostObj = new THREE.Group(); const info = MODELS[gh.k](ghostObj, gh.lvl || 1, null); ghostObj.traverse(o => { if (o.isMesh) { o.material = gh.ok ? ghostMat.ok : ghostMat.no; o.castShadow = false; } if (o.isSprite) o.visible = false; }); ghostObj.userData.anim = info.anim; uiG.add(ghostObj); ghostKey = k; }
  const s = G.B[gh.k].s, c = tileCtr(gh.i, gh.j, s); ghostObj.position.set(c.x, .05, c.z); ghostObj.visible = true;
  placeFrame(frGhost, gh.i, gh.j, s, true, .95); frGhost.userData.m.color.set(gh.ok ? 0x4ade80 : 0xf87171); frGhost.userData.fill.material.color.set(gh.ok ? 0x4ade80 : 0xf87171);
}
const bars = new Map();
function updateBars() {
  const live = new Set();
  for (const b of G.S.bld) { if (!b.build) continue; live.add(b.id); let el = bars.get(b.id); if (!el) { el = document.createElement('div'); el.className = 'v3bar'; el.innerHTML = '<i></i>'; overlay.appendChild(el); bars.set(b.id, el); }
    const o = bldObj.get(b.id), h = o && o.info.h ? o.info.h : 3, p = Math.min(1, (Date.now() - (b.t0 || Date.now())) / Math.max(1, b.build - (b.t0 || b.build - 1)));
    const v = ctrOf(b); v.y = h + 2; v.project(cam); const vis = v.z < 1; el.style.display = vis ? '' : 'none'; if (vis) { el.style.transform = `translate(${(v.x * .5 + .5) * innerWidth - 24}px,${(-v.y * .5 + .5) * innerHeight}px)`; el.firstChild.style.width = (p * 100) + '%'; }
    if (o && o.info.grow) { o.inner.scale.y = Math.max(.05, p); } }
  for (const [id, el] of bars) if (!live.has(id)) { el.remove(); bars.delete(id); }
}

// ================= Schiffe in der Kolonie =================
let anims = [], battle = null, shuttles = [], lastShuttle = 0, sky = [];
function slots() { const out = []; for (const b of G.S.bld) { if (b.type !== 'pad' || (b.build && !b.up)) continue; const c = ctrOf(b), n = 2 + (b.lvl - 1); [[-1.6, -1.2], [1.6, 1.2], [1.4, -1.8], [-1.4, 1.8]].slice(0, n).forEach(o => out.push(new THREE.Vector3(c.x + o[0], .4, c.z + o[1]))); } return out; }
function slotOf(id) { const s = slots(); const list = G.S.fleet.filter(f => f.state === 'home' || anims.some(a => a.id === f.id && a.mode === 'in')); const k = list.findIndex(f => f.id === id); return (s[k] || new THREE.Vector3(0, .4, 0)).clone(); }
function dirOf(ang) { return new THREE.Vector3(Math.cos(ang - Math.PI / 4), 0, Math.sin(ang - Math.PI / 4)); }
function updateShips(t, now) {
  const used = new Set();
  // geparkt
  const defend = battle && t - battle.t0 > 1.5 ? new Set(G.S.fleet.filter(f => f.state === 'home' && (f.type === 'fighter' || f.type === 'cruiser')).slice(0, 4).map(f => f.id)) : null;
  const s = slots(), list = G.S.fleet.filter(f => f.state === 'home' && !anims.some(a => a.id === f.id));
  list.forEach((f, k) => { if (!s[k] || (defend && defend.has(f.id))) return; const key = 'p' + f.id, m = getShip(key, f.type); used.add(key); m.position.copy(s[k]); if (f.type === 'drone') m.position.y += .8 + Math.sin(t * 2 + f.id) * .15; else m.position.y += .35 * (SHIP_SC[f.type] || 1); m.rotation.set(0, -Math.PI / 4 + (k % 2) * Math.PI, 0); thrust(m, 0); });
  // in der Werft
  for (const q of G.S.queue) { const y = G.S.bld.find(b => b.id === q.yard), f = G.S.fleet.find(x => x.id === q.ship); if (!y || !f) continue; const key = 'q' + f.id, m = getShip(key, f.type); used.add(key); const c = ctrOf(y); m.position.set(c.x, 2.2, c.z); m.rotation.set(0, Math.PI / 2, 0); const p = Math.min(1, (now - q.t0) / (q.end - q.t0)); m.scale.setScalar((SHIP_SC[f.type] || 1) * (1.3 + .2 * p)); thrust(m, 0); }
  // Starts und Landungen
  anims = anims.filter(a => t * 1000 < a.t0 + a.d + 50);
  for (const a of anims) { const key = 'a' + a.id, m = getShip(key, a.type); used.add(key); let k = (t * 1000 - a.t0) / a.d; const from = a.mode === 'out' ? a.from : slotOf(a.id);
    if (k < 0) { if (a.mode === 'out') { m.position.copy(from); m.position.y += .35; thrust(m, 0); } else m.visible = false; continue; } m.visible = true; k = Math.min(1, k);
    const e = a.mode === 'out' ? k : 1 - k, lift = Math.min(1, e * 4), ee = Math.max(0, (e - .2) / .8), dir = dirOf(a.ang);
    const p = from.clone(); p.y += lift * 7 + ee * ee * 120; p.addScaledVector(dir, ee * ee * 420); m.position.copy(p);
    const look = from.clone().addScaledVector(dir, 1000); look.y = p.y + (ee > 0 ? 300 : 0); if (a.mode === 'in' && ee > 0) { m.lookAt(look); m.rotateY(Math.PI); } else m.lookAt(look);
    m.scale.setScalar((SHIP_SC[a.type] || 1) * (e > .85 ? Math.max(.01, (1 - e) / .15) : 1)); thrust(m, .3 + Math.min(1, ee * 2) * .7); }
  // Shuttles zwischen Zentrale und Gebäuden
  if (!low) { const B = G.S.bld.filter(b => !b.build && b.type !== 'hq'), hq = G.S.bld.find(b => b.type === 'hq');
    if (hq && B.length && t - lastShuttle > 3.5) { lastShuttle = t; const b = B[Math.floor(Math.random() * B.length)], back = Math.random() < .5, p0 = ctrOf(hq).add(new THREE.Vector3(0, 13, 0)), p1 = ctrOf(b).add(new THREE.Vector3(0, 6, 0)); shuttles.push({ id: Math.random(), a: back ? p1 : p0, b: back ? p0 : p1, t0: t, d: 3.4 + Math.random() * 1.6 }); }
    shuttles = shuttles.filter(s => t < s.t0 + s.d);
    for (const s of shuttles) { const key = 's' + s.id, m = getShip(key, 'drone'); used.add(key); const k = (t - s.t0) / s.d, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; m.position.lerpVectors(s.a, s.b, e); m.position.y += Math.sin(k * Math.PI) * 6; m.lookAt(s.b.x, m.position.y, s.b.z); m.scale.setScalar(.45 * Math.min(1, k * 6, (1 - k) * 6)); }
    if (sky.length < 3 && Math.random() < .003) { const a = Math.random() * TAU, r = 260, y = 55 + Math.random() * 50; sky.push({ id: Math.random(), a: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), b: new THREE.Vector3(-Math.cos(a) * r + (Math.random() - .5) * 120, y + 20, -Math.sin(a) * r), t0: t, d: 18 + Math.random() * 10, type: ['fighter', 'freighter', 'scout'][Math.floor(Math.random() * 3)] }); }
    sky = sky.filter(s => t < s.t0 + s.d); for (const s of sky) { const key = 'k' + s.id, m = getShip(key, s.type); used.add(key); m.position.lerpVectors(s.a, s.b, (t - s.t0) / s.d); m.lookAt(s.b); thrust(m, .8); } }
  // Kampf
  if (battle) drawBattle(t, used);
  for (const k in shipPool) if (!used.has(k)) dropShip(k);
}
// Laser und Explosionen
const lasers = [], booms = [];
function laser(a, b, rgb) { let L = lasers.find(l => !l.visible); if (!L) { L = new THREE.Mesh(geo('laser', () => { const g = new THREE.CylinderGeometry(.09, .09, 1, 6, 1, true); g.translate(0, .5, 0); g.rotateX(Math.PI / 2); return g; }), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false })); fxG.add(L); lasers.push(L); }
  L.material.color.set(`rgb(${rgb})`); L.position.copy(a); L.lookAt(b); L.scale.set(1, 1, a.distanceTo(b)); L.visible = true; L.userData.ttl = 2; }
function boom(p, size) { const s = new THREE.Sprite(glowMat('251,146,60')), s2 = new THREE.Sprite(glowMat('254,240,138')); s.position.copy(p); s2.position.copy(p); fxG.add(s, s2); booms.push({ s, s2, t0: performance.now(), size }); }
function startBattle(res, done) {
  const hq = G.S.bld.find(b => b.type === 'hq'), target = hq ? ctrOf(hq) : new THREE.Vector3(), n = Math.min(8, 3 + Math.floor(res.str / 60)), from = new THREE.Vector3(260, 70, -200);
  battle = { t0: performance.now() / 1000, d: 7, res, done, target, ships: Array.from({ length: n }, (_, k) => ({ id: k, from: from.clone().add(new THREE.Vector3(k * 8, k * 4, k * 10)), off: new THREE.Vector3(Math.cos(k * 1.3) * 12, 14 + (k % 3) * 4, Math.sin(k * 1.3) * 12), dead: res.won ? 2.6 + k * .45 : (k < n / 3 ? 3.2 + k * .6 : 1e9), boomed: false })) };
}
function drawBattle(t, used) {
  const k = t - battle.t0; if (k > battle.d) { const b = battle; battle = null; b.done && b.done(b.res); return; }
  const towers = G.S.bld.filter(b => b.type === 'tower' && !b.build && !b.dmg), tg = battle.target, pos = [];
  battle.ships.forEach((s, q) => { const e = Math.min(1, k / 2.5), key = 'r' + q, goal = tg.clone().add(s.off); goal.x += Math.sin(k * 1.4 + q) * 5; goal.z += Math.cos(k * 1.2 + q) * 5;
    const p = s.from.clone().lerp(goal, e * (2 - e)); pos[q] = p;
    if (k > s.dead) { if (!s.boomed) { s.boomed = true; boom(p, 7); } return; }
    const m = getShip(key, 'pirate'); used.add(key); m.position.copy(p); m.lookAt(e < 1 ? goal : tg.clone().setY(0)); thrust(m, e < 1 ? 1 : .4);
    if (e >= 1 && Math.floor(k * 4 + q) % 4 === 0) laser(p, tg.clone().add(new THREE.Vector3((q % 3 - 1) * 2, 2, 0)), '239,68,68');
    const tw = towers[q % Math.max(1, towers.length)]; if (tw && k > 1.8 && Math.floor(k * 3.3 + q * 2) % 3 === 0) { const o = bldObj.get(tw.id); const tp = ctrOf(tw); tp.y = 4.4 + tw.lvl * .5; laser(tp, p, '103,232,249'); if (o && o.info.head) { o.info.head.userData.aim = 1; o.info.head.lookAt(p.x, o.g.position.y + 3, p.z); } } });
  const fs = G.S.fleet.filter(f => f.state === 'home' && (f.type === 'fighter' || f.type === 'cruiser')).slice(0, 4);
  fs.forEach((f, q) => { if (k < 1.5) return; const key = 'd' + f.id, m = getShip(key, f.type); used.add(key); const p0 = slotOf(f.id), e = Math.min(1, (k - 1.5) / 1.5), goal = tg.clone().add(new THREE.Vector3(Math.cos(k + q * 1.6) * 18, 20 + q * 2, Math.sin(k + q * 1.6) * 18)); m.position.copy(p0.lerp(goal, e)); m.lookAt(goal.x + Math.cos(k + q * 1.6 + .3) * 18, goal.y, goal.z + Math.sin(k + q * 1.6 + .3) * 18); thrust(m, 1);
    const tgt = pos[q % pos.length]; if (e >= 1 && tgt && Math.floor(k * 4.5 + q) % 3 === 0) laser(m.position, tgt, '125,211,252'); });
}
function updateFx() {
  for (const L of lasers) if (L.visible && --L.userData.ttl <= 0) L.visible = false;
  for (let i = booms.length - 1; i >= 0; i--) { const b = booms[i], f = (performance.now() - b.t0) / 650; if (f >= 1) { fxG.remove(b.s, b.s2); booms.splice(i, 1); continue; } b.s.scale.setScalar(b.size * (1 + f * 2)); b.s.material.opacity = 1 - f; b.s2.scale.setScalar(b.size * .6); b.s2.material.opacity = 1 - f; }
  if (!battle) for (const o of bldObj.values()) if (o.info.head) o.info.head.userData.aim = 0;
}

// ================= Kamera =================
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function applyCam() {
  C.dist = Math.max(LIM.dMin, Math.min(LIM.dMax, C.dist)); C.pitch = Math.max(LIM.pMin, Math.min(LIM.pMax, C.pitch));
  const lim = HALF * 1.05; C.tx = Math.max(-lim, Math.min(lim, C.tx)); C.tz = Math.max(-lim, Math.min(lim, C.tz));
  const cp = Math.cos(C.pitch); cam.position.set(C.tx + Math.sin(C.yaw) * cp * C.dist, Math.sin(C.pitch) * C.dist, C.tz + Math.cos(C.yaw) * cp * C.dist); cam.lookAt(C.tx, 0, C.tz); cam.updateMatrixWorld();
}
function groundAt(sx, sy) { const r = canvas.getBoundingClientRect(); ndc.set((sx - r.left) / r.width * 2 - 1, -(sy - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, cam); const p = new THREE.Vector3(); return ray.ray.intersectPlane(plane, p) ? p : null; }
let panStart = null;
const V3D = {
  C,
  init(cv, opt = {}) {
    canvas = cv; low = !!opt.low; mats();
    R = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.1;
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.shadowMap.autoUpdate = false;
    S = new THREE.Scene(); cam = new THREE.PerspectiveCamera(36, 1, 1, 8000);
    worldG = new THREE.Group(); bldG = new THREE.Group(); crysG = new THREE.Group(); uiG = new THREE.Group(); fxG = new THREE.Group(); S.add(worldG, bldG, crysG, uiG, fxG);
    sun = new THREE.DirectionalLight(0xfff0dc, 3); sun.position.set(-70, 110, 50); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -HALF * 1.3, right: HALF * 1.3, top: HALF * 1.3, bottom: -HALF * 1.3, near: 10, far: 400 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; S.add(sun);
    S.add(new THREE.HemisphereLight(0x9ab0e8, 0x2a2238, .75)); const fill = new THREE.DirectionalLight(0x8fa8ff, .45); fill.position.set(80, 40, -60); S.add(fill);
    buildBackdrop(); buildAsteroid();
    frSel = frameMesh('103,232,249'); frMove = frameMesh('251,191,36'); frHover = frameMesh('255,255,255'); frGhost = frameMesh('74,222,128');
    overlay = document.createElement('div'); overlay.className = 'v3ov'; document.body.appendChild(overlay);
    this.setLow(low); this.resize(); applyCam(); syncBuildings();
  },
  setLow(v) { low = !!v; if (!R) return; R.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1 : 2)); R.shadowMap.enabled = !low; sun.castShadow = !low; shadowDirty = true; S.traverse(o => { if (o.material) o.material.needsUpdate = true; }); this.resize(); },
  resize() { if (!R) return; const w = innerWidth, h = innerHeight; R.setSize(w, h, false); canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; cam.aspect = w / h; cam.fov = w < 700 ? 46 : 36; cam.updateProjectionMatrix(); applyCam(); },
  dirty() { if (S) syncBuildings(); },
  render(now, st) {
    const t = (performance.now() - clock0) / 1000;
    for (const o of bldObj.values()) { if (!low && o.info.anim) o.info.anim(t); if (o.info.sparks) o.info.sparks.forEach((s, k) => { s.material.opacity = Math.sin(t * 19 + k * 2.1) > .2 ? 1 : 0; s.position.x = Math.sin(t * 1.3 + k) * 1.2; }); if (o.info.smoke) o.info.smoke.forEach((s, k) => { const q = (t * .3 + k * .2) % 1; s.position.y = 1.5 + q * 5; s.scale.setScalar(1.5 + q * 3); s.material.opacity = .55 * (1 - q); }); if (o.info.fire) o.info.fire.material.opacity = .6 + Math.sin(t * 11) * .3; }
    worldG.children.forEach(o => { if (o.userData.spin) { o.rotation.y += o.userData.spin * .016; o.rotation.x += o.userData.spin * .008; } });
    if (shieldDome) shieldDome.children[0].material.opacity = .04 + Math.sin(t * 1.3) * .012;
    // Auswahl
    const sel = st.sel && G.S.bld.includes(st.sel) ? st.sel : null; if (sel) placeFrame(frSel, sel.i, sel.j, G.B[sel.type].s, false, .65 + Math.sin(t * 4) * .3); else frSel.visible = false;
    if (st.moveB && G.S.bld.includes(st.moveB)) placeFrame(frMove, st.moveB.i, st.moveB.j, G.B[st.moveB.type].s, false, .55); else frMove.visible = false;
    const hb = st.hover && G.bAt(st.hover.i, st.hover.j); if (hb && hb !== sel && !st.ghost) placeFrame(frHover, hb.i, hb.j, G.B[hb.type].s, false, .35); else frHover.visible = false;
    setGhost(st.ghost); if (ghostObj && ghostObj.visible && ghostObj.userData.anim) ghostObj.userData.anim(t);
    updateBars(); updateShips(t, now); updateFx();
    if (shadowDirty && !low) { R.shadowMap.needsUpdate = true; shadowDirty = false; }
    if (G.S.bld.some(b => b.build && !b.up) && Math.floor(t) !== this._st) { this._st = Math.floor(t); shadowDirty = true; }
    R.render(S, cam);
  },
  pick(sx, sy) {
    const r = canvas.getBoundingClientRect(); ndc.set((sx - r.left) / r.width * 2 - 1, -(sy - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects(bldG.children, true).find(h => h.object.userData.bid != null);
    const p = groundAt(sx, sy), out = p ? { fi: (p.x + HALF) / T, fj: (p.z + HALF) / T } : { fi: -99, fj: -99 };
    if (hit) out.b = G.S.bld.find(b => b.id === hit.object.userData.bid) || null;
    return out;
  },
  // Kamera-Steuerung
  panBegin(sx, sy) { panStart = { tx: C.tx, tz: C.tz, p: groundAt(sx, sy) }; },
  panMove(sx, sy) { if (!panStart || !panStart.p) return; const tx0 = C.tx, tz0 = C.tz; C.tx = panStart.tx; C.tz = panStart.tz; applyCam(); const p = groundAt(sx, sy); if (!p) { C.tx = tx0; C.tz = tz0; applyCam(); return; } C.tx = panStart.tx + (panStart.p.x - p.x); C.tz = panStart.tz + (panStart.p.z - p.z); applyCam(); },
  panEnd() { panStart = null; },
  orbit(dyaw, dpitch) { C.yaw += dyaw; C.pitch += dpitch; applyCam(); },
  zoomAt(f, sx, sy) { const p = sx != null ? groundAt(sx, sy) : null, d0 = C.dist; C.dist *= f; applyCam(); const k = 1 - C.dist / d0; if (p && k) { C.tx += (p.x - C.tx) * k; C.tz += (p.z - C.tz) * k; applyCam(); } },
  panBy(dx, dz) { const c = Math.cos(C.yaw), s = Math.sin(C.yaw); C.tx += dx * c + dz * s; C.tz += -dx * s + dz * c; applyCam(); },
  center(b) { const c = b ? ctrOf(b) : new THREE.Vector3(); C.tx = c.x; C.tz = c.z; C.yaw = Math.PI / 4; C.pitch = .82; C.dist = innerWidth < 700 ? 105 : 68; applyCam(); },
  getCam() { return { tx: C.tx, tz: C.tz, yaw: C.yaw, pitch: C.pitch, dist: C.dist, v3: 1 }; },
  setCam(o) { if (!o || !o.v3) return false; Object.assign(C, { tx: o.tx, tz: o.tz, yaw: o.yaw, pitch: o.pitch, dist: o.dist }); applyCam(); return true; },
  project(i, j, h = 0) { const v = tileCtr(i, j); v.y = h; v.project(cam); return [(v.x * .5 + .5) * innerWidth, (-v.y * .5 + .5) * innerHeight]; },
  // Schiffe
  flyOut(f, ang) { anims.push({ id: f.id, type: f.type, mode: 'out', from: slotOf(f.id), ang, t0: performance.now() - clock0 + Math.random() * 500, d: 3600 }); },
  flyIn(f, ang) { anims.push({ id: f.id, type: f.type, mode: 'in', ang, t0: performance.now() - clock0 + Math.random() * 600, d: 3600 }); },
  battle(res, done) { startBattle(res, done); battle.t0 = (performance.now() - clock0) / 1000; },
  get busy() { return !!battle; },
  // Vorschaubild eines Gebäudes für die Bauleiste
  _ir: null,
  icon(k) {
    if (!this._ir) { const c = document.createElement('canvas'); c.width = 168; c.height = 128; this._ir = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true }); this._ir.outputColorSpace = THREE.SRGBColorSpace; this._ir.toneMapping = THREE.ACESFilmicToneMapping; this._ir.setSize(168, 128, false);
      const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xbfd0ff, 0x30283c, 1.1)); const l = new THREE.DirectionalLight(0xffffff, 2.6); l.position.set(-3, 6, 4); sc.add(l); this._is = sc; this._ic = new THREE.PerspectiveCamera(30, 168 / 128, .1, 200); }
    const sc = this._is, s = G.B[k].s, g = new THREE.Group(), tile = new THREE.Mesh(new THREE.BoxGeometry(s * T, .3, s * T), new THREE.MeshStandardMaterial({ color: 0x3a4152, roughness: .9 })); tile.position.y = -.15; g.add(tile);
    const inner = new THREE.Group(); g.add(inner); const info = MODELS[k](inner, 1, null); if (k === 'crys') { /* Kristallfeld */ }
    sc.add(g); const h = Math.max(2, info.h || 3), d = s * T * 1.9 + h * .9; this._ic.position.set(d * .72, d * .62 + h * .2, d * .72); this._ic.lookAt(0, h * .32, 0);
    this._ir.setClearColor(0x000000, 0); this._ir.render(sc, this._ic); const url = this._ir.domElement.toDataURL(); sc.remove(g); return url;
  },
};
window.V3D = V3D;
window.dispatchEvent(new Event('v3d-ready'));
