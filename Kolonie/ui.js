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
  const cv = $('cv'), touchDev = matchMedia('(pointer: coarse)').matches;
  let mode = null, moveB = null, ghost = null, rot = 0, sel = null, hover = null, cat = 'basis', mapSel = null, mapMis = null, mapPick = {}, dirty = true, sig = '';
  const fx = () => G.S.opt.fx !== 'low';
  const sysAng = id => { const s = G.SBY[id], h = G.SBY.home; return Math.atan2(s.y - h.y, s.x - h.x) * .6 - .5; };
  const flyOut = (f, ang) => V3D.flyOut(f, ang), flyIn = (f, ang) => V3D.flyIn(f, ang);
  const startBattle = res => V3D.battle(res, raidReport);
  // Bauzustand als Kurzform: ändert sich etwas, wird die 3D-Welt neu abgeglichen
  const bldSig = () => G.S.cid + ':' + G.hqLvl() + ':' + G.S.bld.map(b => `${b.id}${b.type}${b.i},${b.j}r${b.rot || 0}${b.lvl}${b.build && !b.up ? 'B' : ''}${b.up ? 'U' : ''}${b.dmg ? 'D' : ''}`).join(';');

  // ================= Bild für Bild =================
  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const s2 = bldSig(); if (dirty || s2 !== sig) { sig = s2; dirty = false; V3D.dirty(); }
    const gk = mode || (moveB && moveB.type);
    const gh = gk && ghost ? { k: gk, i: ghost.i, j: ghost.j, rot: moveB ? (moveB.rot || 0) : rot, lvl: moveB ? moveB.lvl : 1, ok: G.canPlace(gk, ghost.i, ghost.j, moveB).ok && (!!moveB || G.canPay(G.B[gk].cost)) } : null;
    V3D.render(Date.now(), { sel, moveB, ghost: gh, hover: !touchDev && !gk ? hover : null });
  }

  // ================= Kamera & Eingabe =================
  function resize() { V3D.resize(); }
  const ghostAt = (t, k) => { const s = G.B[k].s; return { i: Math.floor(t.fi - (s - 1) / 2), j: Math.floor(t.fj - (s - 1) / 2) }; };
  let ptrs = new Map(), drag = null, pinch = null, lastPick = 0;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; V3D.panEnd(); drag = null; return; }
    const rot = e.pointerType === 'mouse' && (e.button === 2 || e.button === 1 || e.altKey);
    drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, type: e.pointerType, rot, btn: e.button };
    if (!rot) V3D.panBegin(e.clientX, e.clientY);
  });
  cv.addEventListener('pointermove', e => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      V3D.panBegin(pinch.mx, pinch.my); V3D.panMove(mx, my); V3D.panEnd(); V3D.zoomAt(pinch.d / Math.max(1, d), mx, my); let da = ang - pinch.ang; if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2; V3D.orbit(-da, (my - pinch.my) * .004);
      Object.assign(pinch, { d, ang, mx, my }); return; }
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 6) drag.moved = true;
      if (drag.moved) { if (drag.rot) V3D.orbit(-(e.clientX - drag.lx) * .006, (e.clientY - drag.ly) * .004); else V3D.panMove(e.clientX, e.clientY); } drag.lx = e.clientX; drag.ly = e.clientY; }
    if (e.pointerType === 'mouse' && !(drag && drag.moved)) { const now = performance.now(); if (now - lastPick < 40 && !(mode || moveB)) return; lastPick = now; const t = V3D.pick(e.clientX, e.clientY); hover = t.b ? { i: t.b.i, j: t.b.j } : { i: Math.floor(t.fi), j: Math.floor(t.fj) }; if (mode || moveB) ghost = ghostAt(t, mode || moveB.type); }
  });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (drag && !drag.moved && e.type === 'pointerup' && !drag.rot) tap(e.clientX, e.clientY, drag.type); if (ptrs.size === 0) { drag = null; V3D.panEnd(); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', () => { hover = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); V3D.zoomAt(Math.exp(e.deltaY * .0012), e.clientX, e.clientY); }, { passive: false });
  function tap(sx, sy, ptype) {
    const t = V3D.pick(sx, sy), i = Math.floor(t.fi), j = Math.floor(t.fj);
    if (mode) { const { i: gi, j: gj } = ghostAt(t, mode);
      if (ptype !== 'mouse' && (!ghost || ghost.i !== gi || ghost.j !== gj)) { ghost = { i: gi, j: gj }; buildBar(); return; }      // Handy: erst Vorschau, dann noch mal tippen
      const r = G.place(mode, gi, gj, rot); if (r.ok) { dirty = true; toast(`🏗️ ${G.B[mode].n} wird gebaut`); if (!G.canPay(G.B[mode].cost)) cancelBuild(); else buildBar(); refresh(); } else toast('⚠ ' + r.why, 'bad'); return; }
    if (moveB) { const { i: gi, j: gj } = ghostAt(t, moveB.type);
      if (ptype !== 'mouse' && (!ghost || ghost.i !== gi || ghost.j !== gj)) { ghost = { i: gi, j: gj }; buildBar(); return; }
      const mb = moveB, r = G.move(mb, gi, gj); if (r.ok) { if (!r.same) toast(`✥ ${G.B[mb.type].n} verschoben`); dirty = true; cancelBuild(); select(mb); refresh(); } else toast('⚠ ' + r.why, 'bad'); return; }
    select(t.b || G.bAt(i, j) || null);
  }
  const keys = new Set();
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (document.querySelector('.modal:not(.hidden)')) closeModals(); else if (mode || moveB) cancelBuild(); else select(null); return; }
    if (/input|textarea/i.test((e.target && e.target.tagName) || '') || document.querySelector('.modal:not(.hidden)')) return;
    const k = e.key.toLowerCase(); if (k === 'q') V3D.orbit(Math.PI / 8, 0); if (k === 'e') V3D.orbit(-Math.PI / 8, 0); if (k === 'r' && (mode || moveB)) { if (moveB) G.rotate(moveB); else rot = (rot + 1) & 3; }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); e.preventDefault(); }
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  setInterval(() => { if (!keys.size) return; const sp = V3D.C.dist * .02; let dx = 0, dz = 0; if (keys.has('w') || keys.has('arrowup')) dz -= sp; if (keys.has('s') || keys.has('arrowdown')) dz += sp; if (keys.has('a') || keys.has('arrowleft')) dx -= sp; if (keys.has('d') || keys.has('arrowright')) dx += sp; V3D.panBy(dx, dz); }, 16);

  // ================= Oberfläche =================
  function hud() {
    const S = G.S, st = G.stats(), { r, use } = G.rates(st);
    const cell = (k, v, sub, cls = '') => `<div class="res ${cls}" title="${G.RN[k] || ''}">${IC[k]}<div><b>${v}</b><small>${sub}</small></div></div>`;
    const net = k => r[k] - (k === 'ore' ? use.ore : 0);
    const capW = (k) => S.res[k] >= st.store * .98 ? ' full' : '';
    $('res').innerHTML = cell('ore', fmt(S.res.ore), fmtR(net('ore')) + '/s', capW('ore')) + cell('crys', fmt(S.res.crys), fmtR(r.crys * 60) + '/min', capW('crys')) + cell('parts', fmt(S.res.parts), fmtR(r.parts * 60) + '/min', capW('parts')) + cell('fuel', fmt(S.res.fuel), fmtR(r.fuel * 60) + '/min', capW('fuel'))
      + cell('cred', fmt(S.res.cred), 'Credits') + `<div class="res ${st.eff < 1 ? 'warn' : ''}" title="Energie: Erzeugung / Verbrauch">${IC.energy}<div><b>${Math.round(st.eP)} / ${Math.round(st.eU)}</b><small>${st.eff < 1 ? 'zu wenig Strom!' : 'Energie'}</small></div></div>`
      + `<div class="res ${st.wf < 1 ? 'warn' : ''}" title="Bewohner / Platz · Arbeiter gebraucht">${IC.pop}<div><b>${S.pop} / ${st.cap}</b><small>${st.wf < 1 ? 'Arbeiter fehlen: ' + Math.ceil(st.work - S.pop) : 'Bewohner'}</small></div></div>`;
    $('lvl').textContent = st.hq; $('cname').textContent = S.name; $('t-cols').classList.toggle('hidden', !S.cols.length && !S.fleet.some(f => f.type === 'colony')); $('store').textContent = 'Lager ' + fmt(st.store);
    // Auftrag
    const q = G.Q[S.quest]; $('quest').innerHTML = q ? `<div class="qh"><span>AUFTRAG ${S.quest + 1}/${G.Q.length}</span></div><b>${esc(q.n)}</b><p>${esc(q.d)}</p><div class="qr">Belohnung: ${costHtml(q.r).replace(/ no/g, '')}</div>` : '<div class="qh"><span>AUFTRÄGE</span></div><b>Alle Aufträge erledigt!</b><p>Baue weiter aus und halte die Piraten fern.</p>';
    // Ereignisse
    let ev = ''; const R_ = S.raid;
    if (R_.warn > 0) ev += `<div class="alert bad"><div class="ah"><b>⚠ Piratenangriff</b><span class="tm">${dur(R_.warn)}</span></div><p>Stärke <b>${R_.str}</b> · deine Verteidigung <b class="${st.def >= R_.str ? 'ok' : 'no'}">${st.def}</b></p><small>${st.def >= R_.str ? 'Deine Abwehr hält stand.' : 'Baue Abwehrtürme oder Jäger, sonst verlierst du Rohstoffe.'}</small></div>`;
    for (const c of S.cols) if (c.raid && c.raid.warn > 0) ev += `<div class="alert bad" data-act="col" data-cid="${c.cid}"><div class="ah"><b>⚠ Piraten greifen ${esc(c.name)} an</b><span class="tm">${dur(c.raid.warn)}</span></div><small>Tippen, um hinzufliegen.</small></div>`;
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
  const icon = k => ICONS[k] || (ICONS[k] = V3D.icon(k));
  function select(b) { sel = b; if (b) { mode = null; moveB = null; } info(); buildBar(); }
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
      <div class="row2" style="margin:8px 0 0"><button class="btn" data-act="move">✥ Verschieben</button><button class="btn" data-act="rotate">⟳ Drehen</button></div>
      ${b.type !== 'hq' ? `<button class="btn ghost wide" data-act="demolish">Abreißen${b.build && !b.up ? ' (volle Erstattung)' : ' (50 % zurück)'}</button>` : ''}`;
    p.classList.remove('hidden');
  }
  function buildBar() { const el = $('buildbar'); if (moveB) { const touch = matchMedia('(pointer: coarse)').matches; el.innerHTML = `<b>${G.B[moveB.type].n} verschieben</b><span>${touch ? (ghost ? 'Noch einmal tippen zum Abstellen' : 'Tippe auf den neuen Platz') : 'Klicke auf den neuen Platz · R dreht'} · kostenlos</span><button class="btn sm" data-act="rot" title="Drehen">⟳</button><button class="btn sm" data-act="cancel-build">Abbrechen</button>`; el.classList.remove('hidden'); return; } if (!mode) { el.classList.add('hidden'); return; } const d = G.B[mode]; const touch = matchMedia('(pointer: coarse)').matches; el.innerHTML = `<b>${d.n} platzieren</b><span>${touch ? (ghost ? 'Noch einmal tippen zum Bauen' : 'Tippe auf ein freies Feld') : 'Klicke auf ein freies Feld'}${d.tile ? ' · nur auf Kristallfeldern' : ''}${touch ? '' : ' · R dreht'}</span><button class="btn sm" data-act="rot" title="Drehen">⟳</button><button class="btn sm" data-act="cancel-build">Fertig</button>`; el.classList.remove('hidden'); }
  function startBuild(k) { if (!G.unlocked(k)) { toast(`🔒 ${G.B[k].n}: ab Kommandozentrale Stufe ${G.B[k].hq}`, 'bad'); return; } mode = k; moveB = null; ghost = null; sel = null; info(); buildBar(); dock(); }
  function cancelBuild() { mode = null; moveB = null; ghost = null; buildBar(); dock(); }
  function refresh() { hud(); dock(); info(); }

  // ================= Fenster =================
  function openModal(id) { closeModals(); $(id).classList.remove('hidden'); render(id); }
  function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); mapMis = null; }
  function render(id) { if (id === 'm-cols') colsUI(); if (id === 'm-fleet') fleetUI(); if (id === 'm-research') researchUI(); if (id === 'm-market') marketUI(); if (id === 'm-map') mapUI(); }
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
    if (sy.id === 'home') { el.innerHTML = `<h4>${esc(sy.n)}</h4><p class="mut">Deine Heimatkolonie.${S.cols.length ? ' Weitere Kolonien: ' + G.colList().filter(c => c.cid !== 0).map(c => esc(c.name)).join(', ') + ' (hinter dem Sprungtor).' : ''}</p>${fleetSummary()}`; return; }
    if (sy.gate && !mapMis) { const free = (sy.m || []).filter(m => !G.founded(m.found) && !S.missions.some(x => x.m === m.id)), has = G.home('colony').length;
      el.innerHTML = `<h4>${esc(sy.n)}</h4><p class="mut">Das Sprungtor führt nach Sektor 1. Dort kannst du mit einem Kolonieschiff neue Kolonien gründen.</p>${has ? '' : '<p class="warn">Du brauchst ein Kolonieschiff: in der Werft (Stufe 3) bauen, Kommandozentrale Stufe 4.</p>'}${free.length ? free.map(m => `<button class="mis" data-mis="${m.id}"><b>${m.n}</b><small>${esc(m.sub)} · ${dur(m.dur * (S.research.includes('warp') ? .75 : 1))} · ${IC.fuel}${m.fuel}</small></button>`).join('') : '<p class="ok">Alle Kolonieplätze in Sektor 1 sind besiedelt.</p>'}${S.missions.some(x => String(x.m).startsWith('found-')) ? '<p class="mut">🚀 Ein Kolonieschiff ist unterwegs.</p>' : ''}`; return; }
    const ms = kn ? (sy.m || []) : [{ id: 'explore', n: 'Erkunden', ships: ['scout'], dur: 150, fuel: 12 }];
    if (!mapMis) { el.innerHTML = `<h4>${kn ? esc(sy.n) : '???'}</h4><p class="mut">${kn ? esc(sy.sub) : 'Unerforschtes System. Schicke einen Forscher hin.'}</p>${sy.id === 'pir' ? `<p class="${Date.now() < S.nestQuietUntil ? 'ok' : 'bad'}">${Date.now() < S.nestQuietUntil ? 'Zerstört · Ruhe noch ' + dur((S.nestQuietUntil - Date.now()) / 1000) : 'Stärke ' + Math.round(160 * Math.pow(1.7, S.nest))}</p>` : ''}
      ${ms.map(m => `<button class="mis" data-mis="${m.id}"><b>${m.n}</b><small>${m.ships.map(t => G.SH[t].n).join(', ')} · ${dur(m.dur * (S.research.includes('warp') ? .75 : 1))} · ${IC.fuel}${m.fuel}/Schiff</small></button>`).join('')}`; return; }
    const m = ms.find(x => x.id === mapMis); for (const t of m.ships) if (mapPick[t] == null) mapPick[t] = m.found ? Math.min(1, G.home(t).length) : 0;
    const inf = G.missionInfo(sy, m, mapPick);
    el.innerHTML = `<h4>${kn ? esc(sy.n) : '???'} · ${m.n}</h4>${m.ships.map(t => { const av = G.home(t).length; return `<div class="pick"><img src="${shipIcon(t)}" alt=""><div><b>${G.SH[t].n}</b><small>${av} bereit</small></div><div class="step"><button data-pick="${t}:-1">−</button><b>${mapPick[t]}</b><button data-pick="${t}:1" ${mapPick[t] >= av ? 'disabled' : ''}>+</button></div></div>`; }).join('')}
      <div class="kv"><div><span>Dauer</span><b>${dur(inf.dur)}</b></div><div><span>Treibstoff</span><b>${inf.fuel}</b></div>${Object.entries(inf.take).map(([k, v]) => `<div><span>Ladung</span><b>${fmt(v)} ${G.RN[k]}</b></div>`).join('')}${m.combat ? `<div><span>Angriffskraft</span><b>${Math.round(Object.entries(mapPick).reduce((a, [t, n]) => a + G.SH[t].atk * n, 0) * (S.research.includes('armor') ? 1.4 : 1))} / ${Math.round(160 * Math.pow(1.7, S.nest))}</b></div>` : ''}</div>
      ${Object.keys(inf.gain).length ? `<p>Ertrag: ${costHtml(inf.gain).replace(/ no/g, '')}</p>` : m.id === 'explore' ? '<p>Ertrag: ein neues System</p>' : m.combat ? '<p class="mut">Gewinnt, wenn die Angriffskraft größer ist als die Stärke des Nests. Verluste sind möglich.</p>' : ''}
      <div class="row2"><button class="btn" data-act="mis-back">Zurück</button><button class="btn pri" data-act="launch" ${inf.n && G.canPay(inf.need) ? '' : 'disabled'}>🚀 Starten</button></div>`;
  }
  function fleetSummary() { const S = G.S, c = {}; S.fleet.filter(f => f.state === 'home').forEach(f => c[f.type] = (c[f.type] || 0) + 1); const e = Object.entries(c); return `<div class="kv">${e.length ? e.map(([t, n]) => `<div><span>${G.SH[t].n}</span><b>${n} bereit</b></div>`).join('') : '<div><span>Keine Schiffe bereit</span><b></b></div>'}</div>`; }

  // ================= Kolonien =================
  const KIND = { rock: ['Felsasteroid', 'radial-gradient(circle at 35% 30%,#c4b5fd,#6d28d9 55%,#1e1b4b)'], ice: ['Eiswelt', 'radial-gradient(circle at 35% 30%,#f0f9ff,#38bdf8 55%,#0c4a6e)'], lava: ['Lavawelt', 'radial-gradient(circle at 35% 30%,#fed7aa,#f97316 50%,#450a0a)'] };
  function colsUI() {
    const L = G.colList(), free = G.SITES.filter(z => !G.founded(z.id));
    $('cols-list').innerHTML = L.map(c => { const hq = (c.bld.find(b => b.type === 'hq') || { lvl: 1 }).lvl, k = KIND[c.kind] || KIND.rock;
      return `<div class="colrow ${c.active ? 'on' : ''}"><div class="ci" style="background:${k[1]}"></div><div class="cd"><b>${esc(c.name)}</b><small>${k[0]} · Zentrale Stufe ${hq} · ${c.pop} Bewohner · ${c.bld.length} Gebäude</small></div>${c.active ? '<span class="mut">hier bist du</span>' : `<button class="btn sm pri" data-act="col" data-cid="${c.cid}">Hinfliegen</button>`}</div>`; }).join('')
      + (free.length ? `<p class="mut" style="margin:10px 0 0">Noch frei in Sektor 1: ${free.map(z => `<b>${z.n}</b> (${z.sub})`).join(', ')}. Baue ein Kolonieschiff in der Werft und schicke es auf der Sternenkarte durchs Sprungtor.</p>` : '');
  }
  function switchTo(cid) {
    if (cid === G.S.cid) { closeModals(); return; }
    G.S.cam = V3D.getCam(); if (!G.switchCol(cid)) return; G.save();
    cancelBuild(); select(null); closeModals(); dirty = true; V3D.dirty(); if (!V3D.setCam(G.S.cam)) centerCam();
    refresh(); toast(`🪐 Willkommen auf ${esc(G.S.name)}`);
  }

  // ================= Meldungen =================
  function toast(t, kind) { const box = $('toasts'); while (box.children.length >= 4) box.firstChild.remove(); const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.innerHTML = t; $('toasts').appendChild(el); setTimeout(() => el.classList.add('out'), 3800); setTimeout(() => el.remove(), 4300); }
  function report(title, body, kind) { $('rp-title').textContent = title; $('rp-body').innerHTML = body; $('m-report').dataset.kind = kind || ''; openModal('m-report'); }
  function raidReport(r) { const lossTxt = r.loss && Object.keys(r.loss).length ? `<p>Verloren: ${Object.entries(r.loss).map(([k, v]) => `${IC[k]}${fmt(v)}`).join(' ')}</p>` : '';
    report((r.won ? '🛡️ Angriff abgewehrt!' : '💥 Die Piraten waren stärker') + (r.col ? ' (' + r.col + ')' : ''), `<div class="kv"><div><span>Piraten</span><b>${r.str}</b></div><div><span>Deine Verteidigung</span><b>${r.def}</b></div></div>${r.won ? `<p>Beute: ${costHtml(r.gain).replace(/ no/g, '')}</p>` : lossTxt + (r.dmg ? `<p>${G.B[r.dmg.type].n} wurde beschädigt. Tippe es an, um es zu reparieren.</p>` : '') + (r.lostShips ? `<p>${r.lostShips} Jäger zerstört.</p>` : '') + '<p class="mut">Tipp: Abwehrtürme, Jäger, Kreuzer und ein Schildgenerator helfen.</p>'}`, r.won ? 'good' : 'bad'); dirty = true; }
  function handleEvents() {
    const E = G.events.splice(0); for (const e of E) {
      if (e.type === 'built') { dirty = true; toast(`✅ ${e.col ? esc(e.col) + ': ' : ''}${G.B[e.b.type].n} ${e.up ? 'auf Stufe ' + e.b.lvl + ' ausgebaut' : 'fertig'}`); if (sel === e.b) info(); }
      if (e.type === 'ship') toast(`🚀 ${G.SH[e.f.type].n} „${esc(e.f.name)}“ ist fertig${e.f.type === 'colony' ? ' · Sternenkarte → Sprungtor' : ''}`);
      if (e.type === 'research') toast(`🔬 ${G.RS.find(r => r.id === e.id).n} erforscht`);
      if (e.type === 'quest') toast(`🎯 Auftrag erledigt: ${esc(e.q.n)} ${costHtml(e.q.r).replace(/ no/g, '')}`, 'good');
      if (e.type === 'ach') toast(`🏆 Erfolg: ${e.a.e} ${esc(e.a.n)}`, 'good');
      if (e.type === 'raidWarn') toast(`⚠ Piraten im Anflug${e.col ? ' auf ' + esc(e.col) : ''}! Stärke ${e.str}`, 'bad');
      if (e.type === 'merch') toast('🚀 Ein Händler bietet etwas an');
      if (e.type === 'raid') { if (e.col) raidReport(e); else startBattle(e); }
      if (e.type === 'mission') { const ang = sysAng(Object.keys(G.SBY).find(k => G.SBY[k].n === e.sys) || 'belt'); (e.ships || []).slice(0, 4).forEach((tp, q) => { const f = G.S.fleet.filter(x => x.type === tp && x.state === 'home')[q]; if (f) flyIn(f, ang); });
        if (e.found != null) { report('🪐 ' + e.title, `<p>Dein Kolonieschiff ist durchs Sprungtor geflogen und hat eine neue Kolonie gegründet. Sie startet mit einer Kommandozentrale und 6 Bewohnern. Rohstoffe, Schiffe und Forschung teilst du mit allen Kolonien.</p><button class="btn pri wide" data-act="col" data-cid="${e.found}">Jetzt hinfliegen</button>`, 'good'); continue; }
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
      case 'rot': if (moveB) G.rotate(moveB); else rot = (rot + 1) & 3; break;
      case 'rotate': if (sel && G.rotate(sel)) dirty = true; break;
      case 'cols': openModal('m-cols'); break;
      case 'col': switchTo(+d.cid); break;
      case 'dn': S.opt.dn = S.opt.dn === 0 ? 1 : 0; G.save(); V3D.setDayNight(S.opt.dn !== 0); openMenu(); break;
      case 'move': { const mb = sel; select(null); mode = null; moveB = mb; ghost = null; buildBar(); dock(); break; }
      case 'fleet': openModal('m-fleet'); break; case 'research': openModal('m-research'); break; case 'market': openModal('m-market'); break; case 'map': openModal('m-map'); break;
      case 'menu': openMenu(); break;
      case 'close': closeModals(); break;
      case 'merch-yes': if (G.acceptOffer()) toast('🤝 Handel abgeschlossen', 'good'); hud(); break;
      case 'merch-no': S.merch.offer = null; S.merch.next = 400; hud(); break;
      case 'mis-back': mapMis = null; mapPanel(); break;
      case 'launch': { const sy = mapSel, r = G.launch(sy, mapMis, mapPick); if (r.ok) { toast(`🚀 Mission gestartet: ${esc(G.known(sy) ? G.SBY[sy].n : '???')}`); const ang = sysAng(sy); r.ms.ships.slice(0, 4).forEach(id => { const f = S.fleet.find(x => x.id === id); if (f) flyOut(f, ang); }); mapMis = null; mapPick = {}; closeModals(); } else toast('⚠ ' + r.why, 'bad'); mapPanel(); break; }
      case 'continue': closeModals(); break;
      case 'new': if (!G.S || G.S.st.built < 1 || confirm('Wirklich neu anfangen? Deine Kolonie wird gelöscht.')) { G.newGame(); dirty = true; Object.keys(ICONS); centerCam(); closeModals(); select(null); refresh(); toast('🪐 Willkommen auf Nova Prime!'); } break;
      case 'fx': S.opt.fx = S.opt.fx === 'low' ? 'full' : 'low'; G.save(); V3D.setLow(!fx()); openMenu(); break;
      case 'help': $('menu-help').classList.toggle('hidden'); break;
      case 'rename': { const n = prompt('Name deiner Kolonie:', S.name); if (n && n.trim()) { S.name = n.trim().slice(0, 24); G.save(); hud(); } break; }
    }
  });
  function openMenu(welcome) {
    const S = G.S; openModal('m-menu');
    $('mm-stats').innerHTML = `<div><b>${S.pop}</b><small>Bewohner</small></div><div><b>${S.bld.length}</b><small>Gebäude</small></div><div><b>${S.fleet.length}</b><small>Schiffe</small></div><div><b>${S.ach.length}/${G.ACH.length}</b><small>Erfolge</small></div>`;
    $('mm-fx').textContent = S.opt.fx === 'low' ? 'Effekte: sparsam' : 'Effekte: voll'; $('mm-dn').textContent = S.opt.dn === 0 ? '☀️ Immer Tag' : '🌗 Tag & Nacht';
    $('mm-welcome').innerHTML = welcome || '';
    $('mm-ach').innerHTML = G.ACH.map(a => `<span class="ach ${S.ach.includes(a.id) ? 'got' : ''}" title="${esc(a.d)}">${a.e} ${esc(a.n)}</span>`).join('');
  }
  function centerCam() { V3D.center(G.S.bld.find(b => b.type === 'hq')); }
  $('zin').onclick = () => V3D.zoomAt(.8); $('zout').onclick = () => V3D.zoomAt(1.25); $('zhome').onclick = centerCam;
  if ($('zrl')) { $('zrl').onclick = () => V3D.orbit(Math.PI / 4, 0); $('zrr').onclick = () => V3D.orbit(-Math.PI / 4, 0); }

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
    const back = had ? G.catchUp() : null;
    try { V3D.init(cv, { low: !fx() }); } catch (err) { console.error(err); document.body.insertAdjacentHTML('beforeend', '<div class="nogl">Dein Browser kann leider keine 3D-Grafik (WebGL) anzeigen. Bitte Hardwarebeschleunigung aktivieren oder einen anderen Browser nutzen.</div>'); return; }
    V3D.setDayNight(G.S.opt.dn !== 0); if (!V3D.setCam(G.S.cam)) centerCam();
    refresh(); setInterval(loop, 100); requestAnimationFrame(frame); requestAnimationFrame(mapLoop);
    let welcome = ''; if (back) welcome = `<div class="wb"><b>Willkommen zurück!</b> Du warst ${dur(back.away / 1000)} weg.${Object.keys(back.gain).length ? ` Deine Kolonie hat produziert: ${Object.entries(back.gain).filter(([, v]) => v > 0).map(([k, v]) => `${IC[k]}+${fmt(v)}`).join(' ')}` : ''}${back.reports.length ? `<br>${back.reports.length} Mission${back.reports.length > 1 ? 'en' : ''} zurückgekehrt.` : ''}</div>`;
    openMenu(welcome); $('mm-continue').textContent = had ? 'Weiterspielen' : 'Los geht’s';
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { G.S.cam = V3D.getCam(); G.save(); } });
    addEventListener('pagehide', () => { G.S.cam = V3D.getCam(); G.save(); });
    window.KOL = { cam: V3D.C, V3D, mapSelect: (id, mis) => { mapSel = id; mapMis = mis || null; mapPick = {}; mapPanel(); }, toTile: (sx, sy) => V3D.pick(sx, sy), select, startBuild, openModal, refresh, G, setDirty: () => dirty = true, centerCam };
  }
  const v3dReady = new Promise(r => window.V3D ? r() : addEventListener('v3d-ready', r, { once: true }));
  const saveReady = window.GameSave ? GameSave.ready([G.KEY], { reloadOnRemote: true, badge: true }).catch(() => {}) : Promise.resolve();
  Promise.all([saveReady, v3dReady]).then(start);
})();
