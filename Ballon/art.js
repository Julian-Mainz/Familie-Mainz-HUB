// Gezeichnete Grafiken für Ballon-Alarm (Türme, Ballons, Spielfeld). Alles mit Canvas, keine Bilddateien.
// ART.base(g, typ, stufe 0–3)  ART.head(g, typ, stufe, zeit)  ART.tower(g, typ, stufe, winkel, zeit)  ART.balloon(g, art, radius)  ART.ground(g, W, H, punkte, abstandZumWeg, thema)
(function () {
    'use strict';
    const TAU = Math.PI * 2;
    const lg = (g, x0, y0, x1, y1, stops) => { const r = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => r.addColorStop(o, c)); return r; };
    const rg = (g, x0, y0, r0, x1, y1, r1, stops) => { const r = g.createRadialGradient(x0, y0, r0, x1, y1, r1); stops.forEach(([o, c]) => r.addColorStop(o, c)); return r; };
    const poly = (g, n, r, rot = 0) => { g.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); };
    const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };

    // ---------- Sockel: Holz (Stufe 0), Stein (1–2), Stein mit Goldrand (3) ----------
    function base(g, tier, col) {
        g.save();
        g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(2, 4, 22, 20, 0, 0, TAU); g.fill();         // Schatten
        if (tier === 0) {
            g.fillStyle = lg(g, -20, -20, 20, 20, [[0, '#a0703f'], [1, '#5b3a1c']]); g.beginPath(); g.arc(0, 0, 19, 0, TAU); g.fill();
            g.save(); g.clip(); g.strokeStyle = 'rgba(40,22,8,.55)'; g.lineWidth = 1.2; for (let x = -15; x <= 15; x += 7.5) { g.beginPath(); g.moveTo(x, -20); g.lineTo(x, 20); g.stroke(); } g.restore();
            g.strokeStyle = '#3d250f'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 19, 0, TAU); g.stroke();
            g.fillStyle = '#c9a77a'; [[-11, -11], [11, -11], [-11, 11], [11, 11]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 1.2, 0, TAU); g.fill(); });
        } else {
            poly(g, 8, 21, Math.PI / 8); g.fillStyle = lg(g, -20, -20, 20, 20, [[0, '#9aa3ad'], [.5, '#6b7280'], [1, '#3f454e']]); g.fill();
            g.strokeStyle = 'rgba(15,20,28,.7)'; g.lineWidth = 2; g.stroke();
            g.save(); poly(g, 8, 21, Math.PI / 8); g.clip(); g.strokeStyle = 'rgba(20,24,30,.35)'; g.lineWidth = 1;
            for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i / 8 * TAU + TAU / 16; g.beginPath(); g.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); g.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); g.stroke(); }
            g.restore();
            poly(g, 8, 14.5, Math.PI / 8); g.fillStyle = lg(g, -14, -14, 14, 14, [[0, '#4b5563'], [1, '#1f2937']]); g.fill();
            g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 20, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
            if (tier >= 3) { poly(g, 8, 21, Math.PI / 8); g.strokeStyle = lg(g, -20, -20, 20, 20, [[0, '#fde68a'], [.5, '#f59e0b'], [1, '#b45309']]); g.lineWidth = 2.6; g.stroke(); }
        }
        g.strokeStyle = col; g.globalAlpha = .9; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, tier === 0 ? 15.5 : 16.5, 0, TAU); g.stroke(); g.globalAlpha = 1;   // Farbring = Turmart
        g.restore();
    }
    // Abzeichen für Ausbaustufen (Sterne)
    function stars(g, tier) { if (!tier) return; for (let i = 0; i < tier; i++) { const x = (i - (tier - 1) / 2) * 8, y = 22; g.fillStyle = tier >= 3 ? '#fbbf24' : '#e2e8f0'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 1.6 : 3.8, a = -Math.PI / 2 + k * Math.PI / 5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); } }

    // ---------- Turmköpfe (zeigen nach rechts = Winkel 0) ----------
    const HEAD = {
        dart(g, tier) {           // Armbrust
            const wood = tier >= 3 ? ['#cbd5e1', '#64748b'] : ['#b7834c', '#6b4423'], n = tier >= 2 ? 3 : 1;
            g.fillStyle = lg(g, -8, -4, -8, 4, [[0, wood[0]], [1, wood[1]]]); rr(g, -9, -3.5, 19, 7, 2); g.fill();
            g.strokeStyle = tier >= 3 ? '#e2e8f0' : '#4a2c12'; g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.arc(-2, 0, 13, -0.95, 0.95); g.stroke();
            g.strokeStyle = 'rgba(241,245,249,.8)'; g.lineWidth = .9; g.beginPath(); g.moveTo(-2 + 13 * Math.cos(0.95), -13 * Math.sin(0.95)); g.lineTo(-6, 0); g.lineTo(-2 + 13 * Math.cos(0.95), 13 * Math.sin(0.95)); g.stroke();
            for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 5; g.strokeStyle = '#e5e7eb'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-5, o); g.lineTo(15, o); g.stroke(); g.fillStyle = '#f8fafc'; g.beginPath(); g.moveTo(18, o); g.lineTo(14, o - 2.4); g.lineTo(14, o + 2.4); g.fill(); g.fillStyle = tier >= 3 ? '#38bdf8' : '#ef4444'; g.fillRect(-6, o - 1.8, 3, 3.6); }
        },
        boom(g, tier, t) {        // Wurfscheibe(n), drehen sich
            g.fillStyle = rg(g, -3, -3, 1, 0, 0, 10, [[0, '#fde68a'], [1, '#b45309']]); g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
            const blades = tier >= 3 ? 2 : 1;
            for (let k = 0; k < blades; k++) { g.save(); g.rotate(t * 5 + k * Math.PI); g.fillStyle = tier >= 2 ? lg(g, 0, -14, 0, 14, [[0, '#fb923c'], [1, '#dc2626']]) : '#f59e0b'; g.strokeStyle = 'rgba(60,20,0,.7)'; g.lineWidth = 1.2;
                g.beginPath(); g.moveTo(2, -2); g.quadraticCurveTo(10, -16, 17, -12); g.quadraticCurveTo(10, -9, 5, 1); g.quadraticCurveTo(10, 9, 17, 12); g.quadraticCurveTo(10, 16, 2, 2); g.closePath(); g.fill(); g.stroke(); g.restore(); }
            g.fillStyle = '#451a03'; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill();
        },
        bomb(g, tier) {           // Kanone
            const bar = (y, w) => { g.fillStyle = lg(g, 0, y - w / 2, 0, y + w / 2, [[0, '#6b7280'], [.45, '#1f2937'], [1, '#030712']]); rr(g, 0, y - w / 2, 22, w, 2); g.fill(); g.fillStyle = '#111827'; rr(g, 18, y - w / 2 - 1.5, 6, w + 3, 2); g.fill(); if (tier >= 2) { g.fillStyle = '#dc2626'; g.fillRect(9, y - w / 2, 3, w); } };
            if (tier >= 3) { bar(-5, 7.5); bar(5, 7.5); } else bar(0, tier >= 1 ? 10 : 9);
            g.fillStyle = rg(g, -4, -4, 1, 0, 0, 12, [[0, '#9ca3af'], [1, '#111827']]); g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill();
            g.strokeStyle = tier >= 3 ? '#f59e0b' : '#374151'; g.lineWidth = 1.6; g.stroke();
            g.fillStyle = '#f97316'; g.beginPath(); g.arc(-4, -4, 1.6, 0, TAU); g.fill();
        },
        ice(g, tier, t) {         // Eiskristalle, leuchten im Takt
            const pul = .5 + .5 * Math.sin(t * 3);
            g.fillStyle = `rgba(125,211,252,${.15 + pul * .2})`; g.beginPath(); g.arc(0, 0, 15 + pul * 2, 0, TAU); g.fill();
            const cr = tier >= 3 ? [[0, 13, 4], [72, 10, 3.4], [144, 11, 3.4], [216, 10, 3.4], [288, 11, 3.4]] : tier >= 1 ? [[20, 12, 3.8], [140, 10, 3.4], [260, 11, 3.4]] : [[30, 11, 3.6], [210, 9, 3.2]];
            cr.forEach(([deg, len, w]) => { g.save(); g.rotate(deg * Math.PI / 180 - Math.PI / 2); g.fillStyle = lg(g, -w, 0, w, 0, [[0, '#e0f2fe'], [.5, '#7dd3fc'], [1, '#0284c7']]); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = .8;
                g.beginPath(); g.moveTo(0, -len); g.lineTo(w, -len + w); g.lineTo(w, 0); g.lineTo(0, 2); g.lineTo(-w, 0); g.lineTo(-w, -len + w); g.closePath(); g.fill(); g.stroke(); g.restore(); });
            g.fillStyle = '#f0f9ff'; g.beginPath(); g.arc(0, 0, 3.5, 0, TAU); g.fill();
            if (tier >= 3) { g.strokeStyle = 'rgba(240,249,255,.85)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * .5; g.beginPath(); g.moveTo(Math.cos(a) * 16, Math.sin(a) * 16); g.lineTo(Math.cos(a) * 19, Math.sin(a) * 19); g.stroke(); } }
        },
        sniper(g, tier) {         // Gewehr mit Zielfernrohr
            const L = tier >= 3 ? 30 : tier >= 1 ? 26 : 22;
            g.fillStyle = '#1f2937'; rr(g, 0, -1.8, L, 3.6, 1.5); g.fill();
            if (tier >= 3) { g.fillStyle = '#111827'; rr(g, L - 3, -3.2, 6, 6.4, 1.5); g.fill(); }
            g.fillStyle = lg(g, 0, -6, 0, 6, [[0, '#a78bfa'], [1, '#4c1d95']]); rr(g, -10, -6, 16, 12, 4); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1; g.stroke();
            g.fillStyle = '#0f172a'; rr(g, -4, -9.5, 14, 4, 2); g.fill(); g.fillStyle = '#38bdf8'; g.beginPath(); g.arc(10, -7.5, 1.6, 0, TAU); g.fill();
            if (tier >= 2) { g.strokeStyle = '#fbbf24'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-9, 4); g.lineTo(4, 4); g.stroke(); }
        },
        bank(g, tier) {           // kleines Bankhaus mit Münzen (dreht sich nicht)
            g.fillStyle = tier >= 3 ? lg(g, -12, -12, 12, 12, [[0, '#fde68a'], [1, '#b45309']]) : lg(g, -12, -12, 12, 12, [[0, '#e5e7eb'], [1, '#9ca3af']]);
            rr(g, -12, -11, 24, 22, 3); g.fill(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.2; g.stroke();
            g.strokeStyle = tier >= 3 ? 'rgba(120,53,15,.6)' : 'rgba(55,65,81,.55)'; g.beginPath(); g.moveTo(-12, 0); g.lineTo(12, 0); g.stroke();      // Dachfirst
            const coins = 1 + Math.min(3, tier); for (let i = 0; i < coins; i++) { const x = 6 - i * 2, y = 6 - i * 3.2; g.fillStyle = '#b45309'; g.beginPath(); g.ellipse(x, y + 1.2, 6, 3, 0, 0, TAU); g.fill(); g.fillStyle = '#fbbf24'; g.beginPath(); g.ellipse(x, y, 6, 3, 0, 0, TAU); g.fill(); }
            g.fillStyle = '#065f46'; g.font = '800 11px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('€', -5, -5);
        },
        tesla(g, tier, t) {       // Kupferspule mit Energiekugel
            for (let i = 4; i >= 1; i--) { g.strokeStyle = i % 2 ? '#b45309' : '#f59e0b'; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 0, 3 + i * 2.6, 0, TAU); g.stroke(); }
            const p = .6 + .4 * Math.sin(t * 9);
            g.fillStyle = rg(g, 0, 0, 0, 0, 0, 8, [[0, '#ffffff'], [.35, `rgba(103,232,249,${p})`], [1, 'rgba(14,116,144,0)']]); g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
            g.strokeStyle = '#a5f3fc'; g.lineWidth = 1.1; const n = 2 + tier; for (let i = 0; i < n; i++) { const a = t * 6 + i * TAU / n; g.beginPath(); g.moveTo(Math.cos(a) * 3, Math.sin(a) * 3); g.lineTo(Math.cos(a + .4) * 8, Math.sin(a + .4) * 8); g.lineTo(Math.cos(a - .1) * 13, Math.sin(a - .1) * 13); g.stroke(); }
        },
        glue(g, tier, t) {        // Klebertank mit Düse
            g.fillStyle = '#374151'; rr(g, 4, -2.8, 15, 5.6, 2); g.fill(); g.fillStyle = '#84cc16'; g.beginPath(); g.arc(20, 0, 2.4, 0, TAU); g.fill();
            g.fillStyle = rg(g, -3, -4, 1, 0, 0, 12, [[0, '#d9f99d'], [.5, '#65a30d'], [1, '#365314']]); g.beginPath(); g.arc(-1, 0, 10, 0, TAU); g.fill();
            g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.2; g.stroke();
            g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-4, -4, 3, 1.8, -.6, 0, TAU); g.fill();
            const lv = 3 + (Math.sin(t * 2) + 1) * 1.5; g.fillStyle = 'rgba(190,242,100,.85)'; g.beginPath(); g.arc(-1, 3, lv, 0, Math.PI); g.fill();
            if (tier >= 3) { g.strokeStyle = '#facc15'; g.lineWidth = 1.6; g.beginPath(); g.arc(-1, 0, 12.5, 0, TAU); g.stroke(); }
        }
    };
    const ROTATES = { dart: 1, bomb: 1, sniper: 1, glue: 1, flame: 1, magnet: 1, heli: 1 };
    const COL = { dart: '#38bdf8', boom: '#f59e0b', bomb: '#ef4444', ice: '#7dd3fc', sniper: '#a78bfa', bank: '#fbbf24', tesla: '#22d3ee', glue: '#84cc16' };
    function baseOf(g, type, tier) { base(g, tier, COL[type]); stars(g, tier); }
    function headOf(g, type, tier, t) { g.save(); g.scale(1.18, 1.18); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 4; g.shadowOffsetY = 2; HEAD[type](g, tier, t || 0); g.restore(); }
    function tower(g, type, tier, ang, t) { baseOf(g, type, tier); g.save(); if (ROTATES[type]) g.rotate(ang); headOf(g, type, tier, t); g.restore(); }

    // ---------- Ballons ----------
    const BCOL = { rot: '#ef4444', blau: '#3b82f6', gruen: '#22c55e', gelb: '#facc15', rosa: '#ec4899' };
    function shell(g, r, fill) { g.beginPath(); g.ellipse(0, 0, r * .86, r, 0, 0, TAU); g.fillStyle = fill; g.fill(); }
    function knot(g, r, c) { g.fillStyle = c; g.beginPath(); g.moveTo(0, r - 1); g.lineTo(-3.5, r + 5); g.lineTo(3.5, r + 5); g.fill(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = .8; g.beginPath(); g.moveTo(0, r + 5); g.quadraticCurveTo(3, r + 9, 0, r + 13); g.stroke(); }
    function shine(g, r) { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-r * .32, -r * .42, r * .2, r * .3, -.5, 0, TAU); g.fill(); }
    function balloon(g, kind, r, t) {
        g.save();
        if (BCOL[kind]) { const c = BCOL[kind]; knot(g, r, c); shell(g, r, rg(g, -r * .35, -r * .4, 1, 0, 0, r * 1.15, [[0, '#ffffff'], [.22, c], [1, 'rgba(0,0,0,.5)']])); g.fillStyle = c; g.globalAlpha = .45; g.fill(); g.globalAlpha = 1; shine(g, r); }
        else if (kind === 'metall') { knot(g, r, '#64748b'); shell(g, r, lg(g, -r, -r, r, r, [[0, '#f8fafc'], [.35, '#94a3b8'], [.6, '#e2e8f0'], [1, '#334155']])); g.strokeStyle = '#1e293b'; g.lineWidth = 1.2; g.stroke();
            g.fillStyle = '#475569'; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.arc(Math.cos(a) * r * .62, Math.sin(a) * r * .72, 1.1, 0, TAU); g.fill(); } shine(g, r); }
        else if (kind === 'tarn') { knot(g, r, '#3f6212'); shell(g, r, '#4d7c0f'); g.save(); g.clip(); [['#365314', -4, -6, 6], ['#a16207', 5, -2, 5], ['#1a2e05', -2, 6, 6], ['#65a30d', 6, 7, 4], ['#78350f', -7, 2, 4]].forEach(([c, x, y, s]) => { g.fillStyle = c; g.beginPath(); g.ellipse(x * r / 15, y * r / 15, s * r / 15, s * .7 * r / 15, x, 0, TAU); g.fill(); }); g.restore();
            g.setLineDash([3, 3]); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, 0, r * .86 + 2, r + 2, 0, 0, TAU); g.stroke(); g.setLineDash([]); g.globalAlpha = .9; }
        else if (kind === 'keramik') { knot(g, r, '#92400e'); shell(g, r, rg(g, -r * .3, -r * .4, 1, 0, 0, r * 1.1, [[0, '#fdba74'], [.4, '#c2410c'], [1, '#431407']])); g.strokeStyle = '#2a0f04'; g.lineWidth = 1.2; g.stroke();
            g.strokeStyle = 'rgba(30,10,2,.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-r * .2, -r * .7); g.lineTo(0, -r * .2); g.lineTo(-r * .3, r * .15); g.lineTo(-r * .1, r * .55); g.moveTo(0, -r * .2); g.lineTo(r * .4, 0); g.stroke(); shine(g, r); }
        else if (kind === 'wachs') { knot(g, r, '#db2777'); g.save(); shell(g, r, '#f472b6'); g.clip(); ['#f472b6', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a78bfa'].forEach((c, i) => { g.fillStyle = c; g.fillRect(-r, -r + i * r / 3, 2 * r, r / 3 + .5); }); g.restore();
            shell(g, r, 'rgba(255,255,255,.12)'); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#fff'; g.font = `800 ${r}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+', 0, 1); }
        else if (kind === 'zeppelin') {             // Boss
            g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(4, 26, 40, 8, 0, 0, TAU); g.fill();
            g.fillStyle = '#334155'; [[-1, 1], [-1, -1]].forEach(([, s]) => { g.beginPath(); g.moveTo(-30, 0); g.lineTo(-46, s * 16); g.lineTo(-38, s * 2); g.fill(); });
            g.beginPath(); g.ellipse(0, 0, 42, 22, 0, 0, TAU); g.fillStyle = lg(g, 0, -22, 0, 22, [[0, '#cbd5e1'], [.45, '#64748b'], [1, '#1e293b']]); g.fill(); g.strokeStyle = '#0f172a'; g.lineWidth = 2; g.stroke();
            g.save(); g.clip(); g.fillStyle = '#dc2626'; g.fillRect(-42, -3, 84, 6); g.strokeStyle = 'rgba(15,23,42,.4)'; g.lineWidth = 1; for (let x = -30; x <= 30; x += 12) { g.beginPath(); g.moveTo(x, -22); g.lineTo(x, 22); g.stroke(); } g.restore();
            g.fillStyle = '#0f172a'; rr(g, -10, 18, 20, 7, 2); g.fill(); g.fillStyle = '#fbbf24'; [-5, 0, 5].forEach(x => g.fillRect(x - 1, 20, 2, 2.4));
            g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-12, -11, 18, 4, -.12, 0, TAU); g.fill();
        }
        g.restore();
    }

    // ---------- Spielfeld: Wiese mit Grashalmen, Blumen, Bäumen, Steinen; Weg aus Erde mit Kieseln ----------
    const THEMES = {
        wiese: { bg: ['#2f6b3a', '#285e33', '#1d4a29'], blot: ['120,190,110', '15,45,22'], blade: ['rgba(134,239,172,.22)', 'rgba(10,40,18,.3)'], path: ['#5b4a2e', '#9b7f52', '#b89a68'], peb: ['rgba(90,70,40,.45)', 'rgba(230,210,170,.45)'], stone: ['#6b7280', '#8a8f98'] },
        winter: { bg: ['#e9f1f8', '#dbe7f2', '#c3d4e4'], blot: ['255,255,255', '148,170,196'], blade: ['rgba(255,255,255,.7)', 'rgba(120,145,175,.25)'], path: ['#7d8ea6', '#a9b8cb', '#c7d3e0'], peb: ['rgba(90,110,140,.35)', 'rgba(255,255,255,.6)'], stone: ['#64748b', '#94a3b8'] },
        wueste: { bg: ['#e2a868', '#d0904f', '#b7733a'], blot: ['250,214,160', '140,80,35'], blade: ['rgba(255,236,200,.25)', 'rgba(120,60,20,.22)'], path: ['#6b3f1f', '#9a5f33', '#b77a47'], peb: ['rgba(80,40,15,.4)', 'rgba(250,220,180,.4)'], stone: ['#7c4a2a', '#a0623a'] }
    };
    function ground(g, W, H, pts, distToPath, theme) {
        const T = THEMES[theme] || THEMES.wiese;
        let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        g.fillStyle = lg(g, 0, 0, W, H, [[0, T.bg[0]], [.5, T.bg[1]], [1, T.bg[2]]]); g.fillRect(0, 0, W, H);
        for (let i = 0; i < 60; i++) { const x = rnd() * W, y = rnd() * H; g.fillStyle = `rgba(${rnd() > .5 ? T.blot[0] : T.blot[1]},${.06 + rnd() * .08})`; g.beginPath(); g.ellipse(x, y, 20 + rnd() * 50, 14 + rnd() * 30, rnd() * 3, 0, TAU); g.fill(); }
        g.lineCap = 'round';
        if (theme === 'wueste') { for (let i = 0; i < 70; i++) { const y = rnd() * H, x = rnd() * W; g.strokeStyle = rnd() > .5 ? 'rgba(255,230,190,.18)' : 'rgba(120,60,20,.14)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 30, y - 6, x + 60 + rnd() * 40, y); g.stroke(); } }
        const nb = theme === 'wueste' ? 700 : 1800;
        for (let i = 0; i < nb; i++) { const x = rnd() * W, y = rnd() * H; g.strokeStyle = rnd() > .5 ? T.blade[0] : T.blade[1];
            if (theme === 'wiese') { const l = 3 + rnd() * 4, a = -Math.PI / 2 + (rnd() - .5) * .8; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
            else { g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(x, y, .6 + rnd() * 1.2, 0, TAU); g.fill(); } }
        const free = (x, y, m) => distToPath(x, y) > m && x > 10 && y > 10 && x < W - 10 && y < H - 10;
        let lake = null;
        if (theme === 'winter') {           // zugefrorener See
            let lx = 0, ly = 0, ok = false; for (let k = 0; k < 200 && !ok; k++) { lx = 80 + rnd() * (W - 160); ly = 70 + rnd() * (H - 140); ok = free(lx, ly, 110); }
            if (ok) { lake = [lx, ly]; g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(lx, ly, 74, 46, 0, 0, TAU); g.fill(); g.fillStyle = lg(g, lx - 70, ly - 40, lx + 70, ly + 40, [[0, '#bae6fd'], [.6, '#7dd3fc'], [1, '#38bdf8']]); g.beginPath(); g.ellipse(lx, ly, 68, 40, 0, 0, TAU); g.fill();
                g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(lx - 40, ly - 10); g.lineTo(lx - 10, ly + 4); g.lineTo(lx + 22, ly - 12); g.moveTo(lx - 10, ly + 4); g.lineTo(lx + 4, ly + 26); g.stroke(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(lx - 24, ly - 18, 18, 4, -.2, 0, TAU); g.fill(); }
        }
        const line = w => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(q => g.lineTo(q[0], q[1])); g.lineWidth = w; g.stroke(); };
        g.lineJoin = 'round';
        g.strokeStyle = 'rgba(0,0,0,.22)'; g.save(); g.translate(0, 3); line(54); g.restore();
        g.strokeStyle = T.path[0]; line(52); g.strokeStyle = T.path[1]; line(44); g.strokeStyle = T.path[2]; line(36);
        const segs = []; for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
        segs.forEach(([a, b]) => { const len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
            for (let d = 0; d < len; d += 6) { const t = d / len, o = (rnd() - .5) * 34, x = a[0] + (b[0] - a[0]) * t + nx * o, y = a[1] + (b[1] - a[1]) * t + ny * o; g.fillStyle = rnd() > .5 ? T.peb[0] : T.peb[1]; g.beginPath(); g.ellipse(x, y, 1 + rnd() * 2, .8 + rnd() * 1.4, rnd() * 3, 0, TAU); g.fill(); } });
        segs.forEach(([a, b]) => { const len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
            for (let d = 0; d < len; d += 11) { const t = d / len; [-1, 1].forEach(s => { const x = a[0] + (b[0] - a[0]) * t + nx * s * 24, y = a[1] + (b[1] - a[1]) * t + ny * s * 24; if (distToPath(x, y) < 20) return; g.fillStyle = rnd() > .4 ? T.stone[0] : T.stone[1]; g.beginPath(); g.ellipse(x, y, 3 + rnd() * 2, 2.4 + rnd() * 1.5, rnd() * 3, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(x - 1, y - 1, 1.2, 0, TAU); g.fill(); }); } });
        if (theme === 'wiese') for (let i = 0; i < 70; i++) { const x = rnd() * W, y = rnd() * H; if (!free(x, y, 34)) continue; const c = ['#fde047', '#f9a8d4', '#ffffff', '#c4b5fd'][Math.floor(rnd() * 4)]; g.fillStyle = c; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8, 1.3, 0, TAU); g.fill(); } g.fillStyle = '#f59e0b'; g.beginPath(); g.arc(x, y, 1, 0, TAU); g.fill(); }
        for (let i = 0; i < 9; i++) { const x = rnd() * W, y = rnd() * H; if (!free(x, y, 40)) continue; g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 2, y + 3, 9, 6, 0, 0, TAU); g.fill(); g.fillStyle = theme === 'wueste' ? lg(g, x - 8, y - 6, x + 8, y + 6, [[0, '#c2703d'], [1, '#6b3417']]) : lg(g, x - 8, y - 6, x + 8, y + 6, [[0, '#a8a29e'], [1, '#57534e']]); g.beginPath(); g.ellipse(x, y, 8, 6, rnd(), 0, TAU); g.fill(); if (theme === 'winter') { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x - 1, y - 3, 6, 2.6, 0, 0, TAU); g.fill(); } }
        for (let i = 0; i < 26; i++) { const x = rnd() * W, y = rnd() * H, s = 13 + rnd() * 10; if (!free(x, y, 48 + s) || (lake && Math.hypot((x - lake[0]) / 1.6, y - lake[1]) < 60 + s)) continue;
            g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 6, y + 8, s * 1.05, s * .85, 0, 0, TAU); g.fill();
            if (theme === 'winter') { g.save(); g.translate(x, y); [[1, '#14532d'], [.72, '#166534'], [.45, '#15803d']].forEach(([k, c], j) => { g.fillStyle = c; poly(g, 8, s * k, j * .2); g.fill(); g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(-s * k * .3, -s * k * .3, s * k * .35, 0, TAU); g.fill(); }); g.restore(); }
            else if (theme === 'wueste') { if (i % 2) continue; g.fillStyle = '#4d7c0f'; rr(g, x - 4, y - s, 8, s * 1.8, 4); g.fill(); rr(g, x - 13, y - s * .4, 7, s * .8, 3.5); g.fill(); rr(g, x + 6, y - s * .7, 7, s * .7, 3.5); g.fill(); g.fillStyle = 'rgba(217,249,157,.35)'; g.fillRect(x - 1.5, y - s + 3, 2, s * 1.6); }
            else { [[0, 0, 1, '#166534'], [-.35, -.3, .7, '#15803d'], [.35, -.2, .65, '#16a34a'], [0, .3, .7, '#14532d'], [-.2, -.45, .4, '#22c55e']].forEach(([dx, dy, k, c]) => { g.fillStyle = c; g.beginPath(); g.arc(x + dx * s, y + dy * s, s * k, 0, TAU); g.fill(); }); g.fillStyle = 'rgba(187,247,208,.25)'; g.beginPath(); g.arc(x - s * .35, y - s * .45, s * .3, 0, TAU); g.fill(); } }
        const e = pts[pts.length - 1], ex = Math.min(W - 20, e[0]), ey = Math.min(H - 6, e[1]);
        g.fillStyle = '#e2e8f0'; g.fillRect(ex - 1, ey - 22, 2.4, 24); g.fillStyle = '#ef4444'; g.beginPath(); g.moveTo(ex + 1, ey - 22); g.lineTo(ex + 15, ey - 17); g.lineTo(ex + 1, ey - 12); g.fill();
    }
    // ---------- Neue Türme (Ballon-Alarm 3.0) ----------
    Object.assign(HEAD, {
        flame(g, tier, t) {        // Flammenwerfer: Tank mit Düse, kleine Zündflamme
            const fl = .6 + .4 * Math.sin(t * 20);
            const noz = y => { g.fillStyle = lg(g, 0, y - 3, 0, y + 3, [[0, '#9ca3af'], [1, '#374151']]); rr(g, 2, y - 3, 17, 6, 2); g.fill(); g.fillStyle = `rgba(251,146,60,${fl})`; g.beginPath(); g.moveTo(19, y - 2.5); g.quadraticCurveTo(25 + fl * 3, y, 19, y + 2.5); g.fill(); g.fillStyle = '#fde047'; g.beginPath(); g.arc(20, y, 1.4, 0, TAU); g.fill(); };
            if (tier >= 3) { noz(-4); noz(4); } else noz(0);
            g.fillStyle = rg(g, -4, -4, 1, -2, 0, 11, [[0, '#fca5a5'], [.5, '#dc2626'], [1, '#7f1d1d']]); rr(g, -12, -8, 15, 16, 5); g.fill(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.2; g.stroke();
            g.fillStyle = '#fde047'; g.beginPath(); g.moveTo(-8, -4); g.lineTo(-4, -4); g.lineTo(-6, 0); g.closePath(); g.fill(); g.fillStyle = '#111'; g.font = '700 6px system-ui'; g.textAlign = 'center'; g.fillText('!', -6, -1);
            if (tier >= 2) { g.strokeStyle = '#fbbf24'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-12, 5); g.lineTo(3, 5); g.stroke(); }
        },
        magnet(g, tier, t) {       // Hufeisen-Magnet, zieht Metall zurück
            const col = tier >= 3 ? ['#60a5fa', '#1d4ed8'] : ['#f87171', '#b91c1c'];
            g.strokeStyle = lg(g, -10, -10, 10, 10, [[0, col[0]], [1, col[1]]]); g.lineWidth = 7; g.lineCap = 'butt'; g.beginPath(); g.arc(-3, 0, 9, Math.PI / 2, Math.PI * 1.5, false); g.stroke();
            g.beginPath(); g.moveTo(-3, -9); g.lineTo(9, -9); g.moveTo(-3, 9); g.lineTo(9, 9); g.stroke();
            g.fillStyle = '#e5e7eb'; g.fillRect(9, -12.5, 6, 7); g.fillRect(9, 5.5, 6, 7); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.strokeRect(9, -12.5, 6, 7); g.strokeRect(9, 5.5, 6, 7);
            const p = (t * 1.5) % 1; g.strokeStyle = `rgba(147,197,253,${.8 * (1 - p)})`; g.lineWidth = 1.2; g.beginPath(); g.arc(14, 0, 4 + p * 12, -1, 1); g.stroke();
            if (tier >= 2) { g.strokeStyle = '#fbbf24'; g.lineWidth = 1; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(-14, i * 3); g.lineTo(-9, i * 3); g.stroke(); } }
        },
        farm(g, tier, t) {         // Bauernhof: Feld mit Bananenstauden und Scheune
            g.fillStyle = '#65a30d'; rr(g, -14, -14, 28, 28, 4); g.fill(); g.strokeStyle = '#3f6212'; g.lineWidth = 1.4; g.stroke();
            g.strokeStyle = 'rgba(54,83,20,.6)'; g.lineWidth = 1; for (let y = -10; y <= 10; y += 5) { g.beginPath(); g.moveTo(-13, y); g.lineTo(13, y); g.stroke(); }
            const n = 2 + tier; for (let i = 0; i < n; i++) { const x = -9 + (i % 3) * 9, y = -7 + Math.floor(i / 3) * 12; g.fillStyle = '#facc15'; g.strokeStyle = '#a16207'; g.lineWidth = .8; g.beginPath(); g.arc(x, y, 3.4, .3, Math.PI - .3); g.lineTo(x - 1, y + 1); g.arc(x, y + 1.6, 2, Math.PI - .3, .3, true); g.closePath(); g.fill(); g.stroke(); }
            g.fillStyle = tier >= 3 ? '#b91c1c' : '#991b1b'; rr(g, 2, 3, 11, 10, 1.5); g.fill(); g.fillStyle = '#fef3c7'; g.fillRect(5.5, 7, 4, 6); g.strokeStyle = '#fef3c7'; g.lineWidth = .8; g.beginPath(); g.moveTo(2, 3); g.lineTo(13, 13); g.moveTo(13, 3); g.lineTo(2, 13); g.globalAlpha = .4; g.stroke(); g.globalAlpha = 1;
        },
        heli(g, tier, t) {         // Hubschrauber von oben, Rotor dreht sich
            g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(3, 5, 10, 6, 0, 0, TAU); g.fill();
            g.fillStyle = tier >= 3 ? '#334155' : '#4d7c0f'; g.fillRect(-22, -1.6, 14, 3.2); g.fillRect(-23, -5, 3, 10);
            g.fillStyle = lg(g, 0, -7, 0, 7, [[0, tier >= 3 ? '#64748b' : '#84cc16'], [1, tier >= 3 ? '#1e293b' : '#365314']]); g.beginPath(); g.ellipse(0, 0, 11, 7, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.stroke();
            g.fillStyle = 'rgba(186,230,253,.85)'; g.beginPath(); g.ellipse(6, 0, 4.5, 4.2, 0, -1.3, 1.3); g.fill();
            if (tier >= 2) { g.fillStyle = '#111827'; g.fillRect(2, -9, 8, 2); g.fillRect(2, 7, 8, 2); }
            g.save(); g.rotate(t * 25); g.strokeStyle = 'rgba(30,41,59,.75)'; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(-17, 0); g.lineTo(17, 0); g.moveTo(0, -17); g.lineTo(0, 17); g.stroke(); g.restore();
            g.fillStyle = 'rgba(148,163,184,.12)'; g.beginPath(); g.arc(0, 0, 17, 0, TAU); g.fill(); g.fillStyle = '#0f172a'; g.beginPath(); g.arc(0, 0, 2.2, 0, TAU); g.fill();
        }
    });
    // Helden: eigener Sockel (sechseckig, lila-gold) und Figur. lvl 1–10
    const HERO = {
        pilot: { c: '#38bdf8', n: 'Pilotin Pia' }, magier: { c: '#a855f7', n: 'Magier Merlin' }
    };
    function hero(g, id, lvl, ang, t) {
        g.save(); g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(2, 4, 22, 20, 0, 0, TAU); g.fill();
        poly(g, 6, 22, Math.PI / 6); g.fillStyle = lg(g, -20, -20, 20, 20, [[0, '#6d28d9'], [1, '#2e1065']]); g.fill(); g.strokeStyle = lg(g, -20, -20, 20, 20, [[0, '#fde68a'], [.5, '#f59e0b'], [1, '#92400e']]); g.lineWidth = 2.6; g.stroke();
        if (lvl >= 10) { const p = .5 + .5 * Math.sin(t * 3); g.save(); g.globalCompositeOperation = 'destination-over'; g.fillStyle = `rgba(250,204,21,${.18 + p * .15})`; g.beginPath(); g.arc(0, 0, 30 + p * 3, 0, TAU); g.fill(); g.restore();
            g.fillStyle = '#fbbf24'; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.moveTo(Math.cos(a - .14) * 22, Math.sin(a - .14) * 22); g.lineTo(Math.cos(a) * 28, Math.sin(a) * 28); g.lineTo(Math.cos(a + .14) * 22, Math.sin(a + .14) * 22); g.fill(); } }
        poly(g, 6, 15, Math.PI / 6); g.fillStyle = 'rgba(15,10,40,.55)'; g.fill();
        if (lvl >= 5) { poly(g, 6, 17, Math.PI / 6); g.strokeStyle = lvl >= 10 ? '#fde68a' : 'rgba(253,230,138,.6)'; g.lineWidth = 1.4; g.stroke(); }
        if (id === 'magier') {       // Hut von oben, Stab mit leuchtender Kugel
            g.save(); g.rotate(ang); const p = .5 + .5 * Math.sin(t * 5);
            g.strokeStyle = '#78350f'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-2, 8); g.lineTo(16, 8); g.stroke();
            g.fillStyle = `rgba(251,146,60,${.35 + p * .35})`; g.beginPath(); g.arc(17, 8, 6 + p * 2, 0, TAU); g.fill(); g.fillStyle = '#fef08a'; g.beginPath(); g.arc(17, 8, 3, 0, TAU); g.fill();
            g.fillStyle = rg(g, -2, -3, 1, 0, 0, 12, [[0, '#c084fc'], [1, '#581c87']]); g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill(); g.strokeStyle = '#3b0764'; g.lineWidth = 1.2; g.stroke();
            g.fillStyle = '#7e22ce'; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill(); g.fillStyle = '#fde047'; [[-6, -4], [5, -6], [-3, 6], [7, 3]].forEach(([x, y]) => { g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? .8 : 2, a = -Math.PI / 2 + k * Math.PI / 5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); });
            g.restore();
        } else {                     // Pilotin mit Fliegerbrille und Helm; das Flugzeug kreist extra
            g.save(); g.rotate(ang);
            g.fillStyle = rg(g, -2, -3, 1, 0, 0, 11, [[0, '#7dd3fc'], [1, '#075985']]); g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.fill(); g.strokeStyle = '#0c4a6e'; g.lineWidth = 1.2; g.stroke();
            g.fillStyle = '#78350f'; g.beginPath(); g.arc(-2, 0, 7, Math.PI * .5, Math.PI * 1.5); g.fill();
            g.fillStyle = '#e0f2fe'; g.strokeStyle = '#334155'; g.lineWidth = 1; [-3.5, 3.5].forEach(y => { g.beginPath(); g.arc(6, y, 2.8, 0, TAU); g.fill(); g.stroke(); });
            g.fillStyle = '#ef4444'; g.beginPath(); g.moveTo(-9, 2); g.lineTo(-16, 6); g.lineTo(-15, 1); g.fill();
            g.restore();
        }
        g.fillStyle = '#facc15'; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 2.5; g.font = '900 10px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeText('Lv ' + lvl, 0, 24); g.fillText('Lv ' + lvl, 0, 24);
        g.restore();
    }
    function plane(g, t) {           // kleines Propellerflugzeug von oben, Spitze zeigt nach rechts
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(6, 10, 14, 5, 0, 0, TAU); g.fill();
        g.fillStyle = '#e0f2fe'; g.strokeStyle = '#0c4a6e'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(2, -18); g.lineTo(7, -18); g.lineTo(5, 18); g.lineTo(0, 18); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#38bdf8'; g.beginPath(); g.ellipse(0, 0, 15, 4, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = '#e0f2fe'; g.beginPath(); g.moveTo(-13, -6); g.lineTo(-10, -6); g.lineTo(-10, 6); g.lineTo(-13, 6); g.fill(); g.stroke();
        g.fillStyle = '#ef4444'; [-12, 12].forEach(y => { g.beginPath(); g.arc(4.5, y, 2, 0, TAU); g.fill(); });
        g.save(); g.translate(15, 0); g.rotate(t * 40); g.strokeStyle = 'rgba(30,41,59,.8)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 6); g.stroke(); g.restore();
    }
    // Neue Bosse
    function boss(g, kind, t) {
        g.save();
        if (kind === 'panzer') {     // gepanzerter Ballon mit Stahlplatten und Stacheln
            g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(4, 28, 36, 8, 0, 0, TAU); g.fill();
            g.fillStyle = '#374151'; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.beginPath(); g.moveTo(Math.cos(a - .12) * 30, Math.sin(a - .12) * 26); g.lineTo(Math.cos(a) * 38, Math.sin(a) * 33); g.lineTo(Math.cos(a + .12) * 30, Math.sin(a + .12) * 26); g.fill(); }
            g.beginPath(); g.ellipse(0, 0, 32, 28, 0, 0, TAU); g.fillStyle = lg(g, -30, -28, 30, 28, [[0, '#6b7280'], [.5, '#3f6212'], [1, '#1a2e05']]); g.fill(); g.strokeStyle = '#111827'; g.lineWidth = 2.5; g.stroke();
            g.save(); g.clip(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.4; for (let x = -24; x <= 24; x += 12) { g.beginPath(); g.moveTo(x, -30); g.lineTo(x, 30); g.stroke(); } g.beginPath(); g.moveTo(-34, 0); g.lineTo(34, 0); g.stroke(); g.restore();
            g.fillStyle = '#d1d5db'; for (let x = -18; x <= 18; x += 12) for (const y of [-8, 8]) { g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); }
            g.fillStyle = '#ef4444'; g.beginPath(); g.arc(0, -14, 5, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.font = '900 7px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 0, -14);
        } else if (kind === 'schwarm') {     // viele kleine Ballons im Netz
            g.strokeStyle = 'rgba(226,232,240,.5)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.stroke();
            const cols = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#ec4899', '#a78bfa', '#fb923c'];
            [[0, 0], [-15, -10], [15, -10], [-18, 8], [18, 8], [0, -20], [0, 18]].forEach(([x, y], i) => { g.save(); g.translate(x, y + Math.sin(t * 4 + i) * 1.2); balloon(g, ['rot', 'blau', 'gruen', 'gelb', 'rosa', 'blau', 'rot'][i], 9, t); g.restore(); void cols; });
            g.strokeStyle = 'rgba(226,232,240,.35)'; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.moveTo(0, 0); g.lineTo(Math.cos(a) * 30, Math.sin(a) * 30); } g.stroke();
        } else if (kind === 'tarnzeppelin') { // Zeppelin mit Tarnmuster, halb durchsichtig
            g.globalAlpha = .85; balloon(g, 'zeppelin', 36, t); g.globalAlpha = 1;
            g.save(); g.beginPath(); g.ellipse(0, 0, 42, 22, 0, 0, TAU); g.clip(); [['rgba(54,83,20,.8)', -20, -8, 14], ['rgba(161,98,7,.7)', 6, -10, 11], ['rgba(26,46,5,.8)', 22, 6, 13], ['rgba(101,163,13,.7)', -6, 9, 12], ['rgba(120,53,15,.7)', -32, 6, 8]].forEach(([c, x, y, s]) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, s, s * .6, x * .05, 0, TAU); g.fill(); }); g.restore();
            g.setLineDash([5, 4]); g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(0, 0, 46, 26, 0, 0, TAU); g.stroke(); g.setLineDash([]);
        }
        g.restore();
    }
    // Gegenstände
    function item(g, id, t) {
        g.save();
        if (id === 'spikes') { g.fillStyle = '#4b5563'; rr(g, -14, -6, 28, 12, 3); g.fill(); g.fillStyle = '#e5e7eb'; for (let i = 0; i < 5; i++) { const x = -11 + i * 5.5; g.beginPath(); g.moveTo(x - 2.5, 2); g.lineTo(x, -9); g.lineTo(x + 2.5, 2); g.fill(); } g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.strokeRect(-14, -6, 28, 12); }
        else if (id === 'icebomb') { g.fillStyle = rg(g, -3, -3, 1, 0, 0, 12, [[0, '#e0f2fe'], [.5, '#38bdf8'], [1, '#075985']]); g.beginPath(); g.arc(0, 2, 10, 0, TAU); g.fill(); g.fillStyle = '#0f172a'; g.fillRect(-3, -11, 6, 4); g.strokeStyle = '#fde68a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -11); g.quadraticCurveTo(5, -16, 3, -19); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 1.2; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(Math.cos(a) * -5, 2 + Math.sin(a) * -5); g.lineTo(Math.cos(a) * 5, 2 + Math.sin(a) * 5); g.stroke(); } }
        else if (id === 'heart') { g.fillStyle = lg(g, 0, -10, 0, 10, [[0, '#fb7185'], [1, '#be123c']]); g.beginPath(); g.moveTo(0, 9); g.bezierCurveTo(-14, -1, -8, -13, 0, -5); g.bezierCurveTo(8, -13, 14, -1, 0, 9); g.fill(); g.fillStyle = '#fff'; g.font = '900 8px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+20', 0, -1); }
        g.restore();
    }
    // Wetter über dem ganzen Spielfeld (wird jedes Bild gezeichnet)
    function weather(g, W, H, kind, t) {
        g.save(); let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        if (kind === 'regen') { g.fillStyle = 'rgba(30,41,59,.18)'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(186,230,253,.45)'; g.lineWidth = 1.2; g.beginPath(); for (let i = 0; i < 160; i++) { const x = (rnd() * (W + 100) + t * 60) % (W + 100) - 50, y = (rnd() * H + t * 700 * (0.8 + rnd() * .4)) % H; g.moveTo(x, y); g.lineTo(x - 4, y + 14); } g.stroke(); }
        else if (kind === 'wind') { g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1.6; g.lineCap = 'round'; for (let i = 0; i < 18; i++) { const y = rnd() * H, x = (rnd() * W * 1.5 + t * 260) % (W * 1.5) - W * .25, l = 40 + rnd() * 60; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + l * .4, y - 6, x + l * .7, y + 6, x + l, y); g.stroke(); } }
        else if (kind === 'sturm') { g.fillStyle = 'rgba(241,245,249,.22)'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 220; i++) { const x = (rnd() * W + t * 120 * (0.5 + rnd())) % W, y = (rnd() * H + t * 90 * (0.5 + rnd())) % H; g.beginPath(); g.arc(x, y, .8 + rnd() * 1.8, 0, TAU); g.fill(); } }
        g.restore();
    }
    Object.assign(COL, { flame: '#f97316', magnet: '#3b82f6', farm: '#facc15', heli: '#84cc16' });
    window.ART = { tower, base: baseOf, head: headOf, balloon, ground, hero, plane, boss, item, weather, HERO, COL, ROTATES };
})();
