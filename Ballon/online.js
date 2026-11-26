// Ballon-Alarm online: Bestenliste, geteilte Karten und Zusammenspielen über Firestore.
// Braucht eine Anmeldung im Portal (über js/gamesave.js) und das Recht "Web-Apps". Ohne beides bleibt alles aus.
// Zusammenspielen: Der Gastgeber rechnet das Spiel. Der Gast schickt nur seine Aktionen (Turm bauen, verbessern ...) und
// bekommt etwa jede Sekunde den Spielstand zurück. So bleiben die Schreibvorgänge im Gratis-Plan klein.
(function () {
  'use strict';
  const N = { db: null, user: null, name: '', best: {}, room: null, st: 0, writing: false };
  const LBK = 'ballon-lb', CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const TS = () => firebase.firestore.FieldValue.serverTimestamp();
  const ok = () => !!(N.db && N.user);
  const flat = pts => pts.flat().map(v => Math.round(v)), unflat = a => { const o = []; for (let i = 0; i + 1 < a.length; i += 2) o.push([+a[i], +a[i + 1]]); return o; };
  let inited = false;
  async function init() {
    if (inited) return; inited = true;
    try { if (!window.firebase || !firebase.apps || !firebase.apps.length || !GameSave.user) return; N.user = GameSave.user; N.db = firebase.firestore();
      try { N.best = JSON.parse(localStorage.getItem(LBK) || '{}') || {}; } catch (e) { N.best = {}; }
      const d = await N.db.collection('users').doc(N.user.uid).get(), u = d.exists ? d.data() : {}; N.name = String(u.firstName || String(u.name || '').split(' ')[0] || 'Spieler').slice(0, 40);
    } catch (e) { N.db = null; }
  }
  // ---------- Bestenliste ----------
  const boardOf = () => (S.ch ? 'daily_' + S.ch.id : S.map + '_' + S.diff).toLowerCase().replace(/[^a-z0-9_]/g, '');
  async function score(final) {
    if (!ok() || !S || S.map === 'c_test') return; const board = boardOf(), reached = S.round - 1, old = N.best[board] || 0;
    if (reached <= old || (!final && reached % 5 !== 0)) return;
    N.best[board] = reached; try { localStorage.setItem(LBK, JSON.stringify(N.best)); } catch (e) {}
    try { await N.db.collection('ballon_scores').doc(N.user.uid + '_' + board).set({ uid: N.user.uid, name: N.name, board, round: reached, diff: S.diff, lost: Math.floor(S.lost), at: TS() }); } catch (e) { N.best[board] = old; }
  }
  let lbSel = null;
  async function renderBoard(el) {
    if (!ok()) { el.innerHTML = '<p class="note">Die Bestenliste braucht eine Anmeldung im Portal, das Recht „Web-Apps“ und eine Internetverbindung.</p>'; return; }
    lbSel = lbSel || { map: BUILTIN.includes(pickMap) ? pickMap : 'wiese', diff: M.diff, day: false };
    const tabs = `<div class="lbt">${BUILTIN.map(k => `<button data-lm="${k}" class="${!lbSel.day && lbSel.map === k ? 'on' : ''}">${MAPS[k].e} ${MAPS[k].n}</button>`).join('')}<button data-lm="day" class="${lbSel.day ? 'on' : ''}">📅 Heute</button></div>
      ${lbSel.day ? '' : `<div class="lbt sm">${Object.entries(DIFF).map(([k, d]) => `<button data-ld="${k}" class="${lbSel.diff === k ? 'on' : ''}">${d.n}</button>`).join('')}</div>`}`;
    el.innerHTML = tabs + '<p class="note">Lade …</p>';
    el.querySelectorAll('[data-lm]').forEach(b => b.onclick = () => { if (b.dataset.lm === 'day') lbSel.day = true; else { lbSel.day = false; lbSel.map = b.dataset.lm; } renderBoard(el); });
    el.querySelectorAll('[data-ld]').forEach(b => b.onclick = () => { lbSel.diff = b.dataset.ld; renderBoard(el); });
    const board = lbSel.day ? 'daily_' + dayId() : lbSel.map + '_' + lbSel.diff;
    try {
      const s = await N.db.collection('ballon_scores').where('board', '==', board).get(), rows = s.docs.map(d => d.data()).sort((a, b) => b.round - a.round || a.lost - b.lost).slice(0, 25);
      const medal = i => ['🥇', '🥈', '🥉'][i] || i + 1, col = n => `hsl(${[...String(n)].reduce((a, c) => a + c.charCodeAt(0), 0) * 47 % 360} 70% 62%)`;
      el.querySelector('.note').outerHTML = rows.length ? `<table class="lb"><tr><th>#</th><th>Name</th><th>${lbSel.day ? 'Tages-Challenge' : 'Schwierigkeit'}</th><th class="r">Runde</th></tr>${rows.map((r, i) => `<tr class="${r.uid === N.user.uid ? 'me' : ''}"><td>${medal(i)}</td><td><span class="av" style="background:${col(r.name)}">${esc(String(r.name).slice(0, 2).toUpperCase())}</span>${esc(r.name)}</td><td>${lbSel.day ? (r.round >= daily().goal ? '✓ geschafft' : 'läuft') : esc((DIFF[r.diff] || DIFF.normal).n)}</td><td class="r">${r.round}</td></tr>`).join('')}</table>`
        : '<p class="note">Noch keine Einträge. Sei die oder der Erste!</p>';
    } catch (e) { const n = el.querySelector('.note'); if (n) n.textContent = e && e.code === 'permission-denied' ? 'Kein Zugriff: Die neuen Datenbank-Regeln fehlen noch oder das Recht „Web-Apps“ ist aus.' : 'Bestenliste gerade nicht erreichbar.'; }
  }
  // ---------- Geteilte Karten ----------
  async function publishMap(def) {
    if (!ok()) return null; const r = await N.db.collection('ballon_maps').add({ uid: N.user.uid, author: N.name, title: def.n, theme: def.theme, pts: flat(def.pts), at: TS() }); return { id: r.id, by: N.name };
  }
  async function browseMaps(o) {
    o.innerHTML = `<div class="card box"><h2>🌍 Karten der anderen</h2><p class="lead">Karten, die andere im Portal gebaut und geteilt haben. „Hinzufügen“ legt sie bei deinen eigenen Karten ab.</p><div id="mlist"><p class="note">Lade …</p></div><div class="row"><button class="btn" id="o-back2">Zurück</button></div></div>`;
    $('o-back2').onclick = () => showOverlay('menu');
    try {
      const s = await N.db.collection('ballon_maps').orderBy('at', 'desc').limit(50).get(), have = new Set(Object.values(M.custom).map(c => c.remote).filter(Boolean));
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      $('mlist').innerHTML = list.length ? `<div class="svs">${list.map(m => `<div class="sv"><span class="se">${{ wiese: '🌿', winter: '❄️', wueste: '🌵' }[m.theme] || '✏️'}</span><div class="t"><b>${esc(m.title)}</b><small>von ${esc(m.author)}${m.uid === N.user.uid ? ' (du)' : ''} · ${Math.round(m.pts.length / 2)} Wegpunkte</small></div><div class="sb">${have.has(m.id) ? '<span class="note">✓ hinzugefügt</span>' : `<button class="btn go" data-add="${m.id}">Hinzufügen</button>`}${m.uid === N.user.uid ? `<button class="btn bad" data-rm="${m.id}" aria-label="Karte löschen">🗑</button>` : ''}</div></div>`).join('')}</div>` : '<p class="note">Noch keine geteilten Karten.</p>';
      $('mlist').querySelectorAll('[data-add]').forEach(b => b.onclick = () => { const m = list.find(x => x.id === b.dataset.add); if (!m) return; const id = 'r' + m.id.slice(0, 12).replace(/[^\w]/g, ''), def = { n: m.title, theme: m.theme, pts: unflat(m.pts), by: m.author, mine: m.uid === N.user.uid, remote: m.id }; M.custom[id] = def; registerCustom(id, def); saveMeta(); toast(`„${m.title}“ hinzugefügt`); pickMap = 'c_' + id; browseMaps(o); });
      $('mlist').querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { if (!confirm('Diese Karte für alle löschen?')) return; try { await N.db.collection('ballon_maps').doc(b.dataset.rm).delete(); toast('Karte gelöscht'); } catch (e) { toast('Löschen fehlgeschlagen'); } browseMaps(o); });
    } catch (e) { $('mlist').innerHTML = `<p class="note">${e && e.code === 'permission-denied' ? 'Kein Zugriff: Die neuen Datenbank-Regeln fehlen noch.' : 'Gerade nicht erreichbar.'}</p>`; }
  }
  // ---------- Zusammen spielen ----------
  const roomRef = c => N.db.collection('ballon_rooms').doc(c);
  function code() { let s = ''; const r = crypto.getRandomValues(new Uint32Array(6)); for (let i = 0; i < 6; i++) s += CODE_CH[r[i] % CODE_CH.length]; return s; }
  function stop() { const R = N.room; if (!R) return; (R.unsub || (() => {}))(); (R.actsUnsub || (() => {}))(); N.room = null; }
  async function leave() { const R = N.room; if (!R) return; stop(); if (S && S.coop) S.coop = null; if (R.role === 'host') { try { await roomRef(R.code).delete(); } catch (e) {} } }
  function rerender() { const o = $('ov'); if (o && !o.classList.contains('hidden') && o.querySelector('[data-coop]')) render($('ovm') || o); }
  async function host() {
    const c = code(), m = MAPS[pickMap], def = m.custom ? { n: m.n, theme: m.theme, pts: flat(m.pts) } : null;
    await roomRef(c).set({ host: N.user.uid, hostName: N.name, guest: null, guestName: null, map: pickMap, diff: M.diff, mapDef: def, state: 'lobby', at: TS() });
    N.room = { code: c, role: 'host', other: '', map: pickMap, diff: M.diff, seen: new Set() };
    N.room.unsub = roomRef(c).onSnapshot(s => { if (!s.exists) return; const d = s.data(); if (N.room && d.guestName && N.room.other !== d.guestName) { N.room.other = d.guestName; if (S && S.coop) { S.coop.other = d.guestName; toast(`🤝 ${d.guestName} spielt mit`); } rerender(); } }, () => {});
    rerender();
  }
  async function startHost() {
    const R = N.room; if (!R || R.role !== 'host') return; newRun(R.map, R.diff, { coop: { role: 'host', code: R.code, other: R.other } }); hideOverlay();
    await roomRef(R.code).update({ state: 'play', snap: JSON.stringify(snapState()), at: TS() }).catch(() => {});
    R.actsUnsub = roomRef(R.code).collection('acts').orderBy('at').onSnapshot(s => s.docChanges().forEach(ch => { if (ch.type !== 'added' || R.seen.has(ch.doc.id)) return; R.seen.add(ch.doc.id); const a = ch.doc.data(); if (a.by !== N.user.uid) apply(a); }), () => {});
  }
  async function join(c) {
    c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); if (c.length !== 6) return toast('Der Code hat 6 Zeichen');
    try {
      const s = await roomRef(c).get(); if (!s.exists) return toast('Raum nicht gefunden'); const d = s.data();
      if (d.host === N.user.uid) return toast('Das ist dein eigener Raum'); if (d.state !== 'lobby' || (d.guest && d.guest !== N.user.uid)) return toast('Der Raum ist schon voll oder das Spiel läuft');
      await roomRef(c).update({ guest: N.user.uid, guestName: N.name });
      let map = d.map; if (d.mapDef && Array.isArray(d.mapDef.pts)) map = registerCustom('coop' + c.toLowerCase(), { n: d.mapDef.n, theme: d.mapDef.theme, pts: unflat(d.mapDef.pts), by: d.hostName });
      if (!MAPS[map]) return toast('Diese Karte gibt es hier nicht');
      N.room = { code: c, role: 'guest', other: d.hostName, map, diff: d.diff, seen: new Set() }; rerender();
      N.room.unsub = roomRef(c).onSnapshot(sn => {
        if (!sn.exists) { if (S && S.coop) { toast('Der Gastgeber hat das Spiel beendet', 4000); S.coop = null; S.over = true; S.paid = true; showOverlay('menu'); } stop(); return; }
        const x = sn.data(); if (x.state === 'play' && (!S || !S.coop)) { newRun(N.room.map, N.room.diff, { coop: { role: 'guest', code: c, other: x.hostName } }); hideOverlay(); toast(`🤝 Spiel mit ${x.hostName} läuft. Du baust auf der rechten Hälfte.`, 4500); }
        if (x.snap && S && S.coop) { try { applySnap(JSON.parse(x.snap)); } catch (e) {} }
      }, () => {});
    } catch (e) { toast(e && e.code === 'permission-denied' ? 'Kein Zugriff: Die neuen Datenbank-Regeln fehlen noch.' : 'Beitreten fehlgeschlagen'); }
  }
  // Gast: eigene Aktion an den Gastgeber schicken
  let actN = 0;
  function act(type, data) { const R = N.room; if (!R || R.role !== 'guest' || !ok()) return; roomRef(R.code).collection('acts').add({ by: N.user.uid, n: ++actN, type, data: data || {}, at: TS() }).catch(() => toast('Verbindung zum Mitspieler unterbrochen')); }
  // Gastgeber: Aktion des Gastes ausführen (mit eigener Prüfung)
  function apply(a) {
    if (!S || !S.coop || S.over) return; const d = a.data || {}, t = typeof d.x === 'number' ? towerAt(d.x, d.y) : null;
    const guestSpot = (x, y, ign) => x >= W / 2 && x <= W - 22 && y >= 22 && y <= H - 22 && distToPath(x, y) >= 30 && !S.towers.some(o => o !== ign && Math.hypot(o.x - x, o.y - y) < 36);
    switch (a.type) {
      case 'place': if (TOWERS[d.t] && guestSpot(d.x, d.y)) { const n = place(d.t, d.x, d.y, true); if (n) n.own = 'guest'; } break;
      case 'up': if (t && (d.p === 'A' || d.p === 'B')) upgrade(t, d.p, true); break;
      case 'radar': if (t) buyRadar(t, true); break;
      case 'sell': if (t && t.own === 'guest') sell(t, true); break;
      case 'mode': if (t && MODES.some(m => m[0] === d.m)) t.mode = d.m; break;
      case 'move': if (t && t.own === 'guest' && guestSpot(d.nx, d.ny, t)) moveTower(t, d.nx, d.ny, true); break;
      case 'abil': if (ABIL[d.type]) useGroup(d.type, true); break;
      case 'abil1': if (t) useAbility(t); break;
      case 'start': startRound(true); break;
      case 'item': if (d.id === 'heart') { if (!S.heart) { S.heart = true; S.lives += 20; } } else if (ITEMS[d.id]) useItem(d.id, d.x, d.y, true); break;
      case 'banana': { const i = S.loot.findIndex(l => Math.hypot(l.x - d.x, l.y - d.y) < 6); if (i >= 0) collect(i, true); break; }
    }
    snap(true);
  }
  function snapState() {
    return { r: S.round, m: Math.round(S.money), l: S.lives, lo: S.lost, a: S.active, sp: S.speed, p: S.paused, wx: S.wx, q: S.queue.length, o: S.over, w: S.won, c: Math.round(S.cash), pp: S.popped, h: S.hist.slice(-60), pb: S.popBy, he: S.heart,
      t: S.towers.map(t => [t.t, t.x, t.y, t.a, t.b, t.mode, t.radar ? 1 : 0, t.pops || 0, Math.round(t.xp || 0), Math.round(t.abCd || 0), t.own === 'guest' ? 1 : 0]),
      b: S.balloons.slice(0, 400).map(b => [b.id, Math.round(b.d), b.layer, b.kind || 0, b.hp || 0, b.camo ? 1 : 0, b.regrow || 0, b.boss ? b.bk : 0, b.max || 0, b.slowT > 0 ? 1 : 0, b.glueT > 0 ? 1 : 0]),
      lt: S.loot.map(l => [Math.round(l.x), Math.round(l.y), l.v, l.keep ? 1 : 0]), sk: S.spikes.map(s => [Math.round(s.d), s.n]) };
  }
  async function snap(now) {
    const R = N.room; if (!R || R.role !== 'host' || !S || !S.coop || N.writing) return; if (!now && N.st < 1.2) return; N.st = 0; N.writing = true;
    try { await roomRef(R.code).update({ snap: JSON.stringify(snapState()), at: TS() }); } catch (e) {} N.writing = false;
  }
  // Gast: Spielstand vom Gastgeber übernehmen
  function applySnap(x) {
    if (!S || !S.coop) return; Object.assign(S, { round: x.r, money: x.m, lives: x.l, lost: x.lo, active: x.a, speed: x.sp, paused: x.p, wx: x.wx || '', qn: x.q, cash: x.c, popped: x.pp, hist: x.h || [], popBy: x.pb || {}, heart: !!x.he, won: !!x.w }); S.queue = [];
    const old = new Map(S.towers.map(t => [t.t + t.x + ',' + t.y, t]));
    S.towers = x.t.map(([id, tx, ty, a, b, mode, radar, pops, xp, abCd, g]) => { if (!TOWERS[id]) return null; const o = old.get(id + tx + ',' + ty) || { id: S.tid++, t: id, x: tx, y: ty, cd: .2, ang: 0, boostT: 0, flash: 0, stun: 0, hx: tx, hy: ty, pa: 0, spent: 0 }; Object.assign(o, { a, b, mode, radar: !!radar, pops, xp, abCd, own: g ? 'guest' : 'host' }); o.s = stats(o); if (!S.types.includes(id)) S.types.push(id); return o; }).filter(Boolean);
    const ob = new Map(S.balloons.map(b => [b.id, b]));
    S.balloons = x.b.map(([id, d, layer, kind, hp, camo, regrow, bk, max, sl, gl]) => { const b = ob.get(id) || { id, slowF: 1, glueF: 1, acid: 0, acAcc: 0, burn: 0, burnD: 0, brAcc: 0, rgT: 0 }; Object.assign(b, { d, layer, kind: kind || null, hp, camo: !!camo, regrow, boss: !!bk, bk: bk || undefined, max, slowT: sl ? Math.max(b.slowT || 0, .3) : 0, glueT: gl ? Math.max(b.glueT || 0, .3) : 0, dead: false }); if (sl && b.slowF === 1) b.slowF = .5; if (gl && b.glueF === 1) b.glueF = .5; const p = posAt(b.d); b.x = p.x; b.y = p.y; return b; });
    S.loot = (x.lt || []).map(([lx, ly, v, k]) => ({ x: lx, y: ly, v, keep: !!k, t: 0 })); S.spikes = (x.sk || []).map(([d, n]) => { const p = posAt(d); return { d, n, x: p.x, y: p.y, ids: [] }; });
    if (selTower && !S.towers.includes(selTower)) selTower = S.towers.find(t => t.x === selTower.x && t.y === selTower.y) || null;
    if (x.o && !S.over) { S.over = true; const dn = S.round - 1; S.earned = Math.floor(Math.pow(Math.max(0, dn), 1.3) / 2 * D().dia); S.paid = false; checkAch(); showOverlay('over'); }
    renderShop(); if (selTower) renderInfo();
  }
  function tick(dt) { if (N.room && N.room.role === 'host' && S && S.coop) { N.st += dt; snap(false); } }
  // Fenster "Zusammen spielen"
  function render(o) {
    const R = N.room, back = '<button class="btn" id="o-back">Zurück</button>';
    if (!ok()) { o.innerHTML = `<div class="card box" data-coop><h2>🤝 Zusammen spielen</h2><p class="lead">Dafür musst du im Portal angemeldet sein und das Recht „Web-Apps“ haben.</p><div class="row">${back}</div></div>`; }
    else if (!R) {
      o.innerHTML = `<div class="card box" data-coop><h2>🤝 Zusammen spielen</h2><p class="lead">Zwei Leute, eine Karte. Der Gastgeber baut links, der Gast rechts. Geld und Leben werden geteilt. Karte und Schwierigkeit bestimmt der Gastgeber: <b>${esc(MAPS[pickMap].n)}</b>, ${DIFF[M.diff].n}.</p>
        <div class="coop2"><div class="sv"><span class="se">🏠</span><div class="t"><b>Raum erstellen</b><small>Du bekommst einen Code, den du weitergibst.</small></div><div class="sb"><button class="btn go" id="c-host">Erstellen</button></div></div>
        <div class="sv"><span class="se">🔑</span><div class="t"><b>Beitreten</b><small>Code vom Gastgeber eingeben.</small></div><div class="sb"><input id="c-code" class="code-in" maxlength="7" placeholder="ABC123" autocomplete="off" aria-label="Raum-Code"><button class="btn go" id="c-join">Beitreten</button></div></div></div>
        <p class="note">Läuft über deine Firebase-Datenbank. Etwa jede Sekunde wird der Spielstand übertragen. Spiele lieber nicht stundenlang am Stück, damit der Gratis-Plan reicht.</p><div class="row">${back}</div></div>`;
      $('c-host').onclick = async () => { try { await host(); } catch (e) { toast(e && e.code === 'permission-denied' ? 'Kein Zugriff: Die neuen Datenbank-Regeln fehlen noch.' : 'Raum konnte nicht erstellt werden'); } };
      $('c-join').onclick = () => join($('c-code').value); $('c-code').onkeydown = e => { if (e.key === 'Enter') join(e.target.value); };
    } else if (R.role === 'host') {
      o.innerHTML = `<div class="card box" data-coop><h2>🤝 Dein Raum</h2><p class="lead">${esc(MAPS[R.map].n)} · ${DIFF[R.diff].n}. Gib diesen Code weiter:</p><div class="codebox">${R.code.slice(0, 3)}-${R.code.slice(3)}</div>
        <div class="lobby"><div class="pl"><span class="av" style="background:#38bdf8">${esc(N.name.slice(0, 2).toUpperCase())}</span><b>${esc(N.name)}</b><small>linke Hälfte · bereit ✓</small></div><div class="plus">+</div><div class="pl${R.other ? '' : ' wait'}"><span class="av" style="background:${R.other ? '#f472b6' : '#334155'}">${R.other ? esc(R.other.slice(0, 2).toUpperCase()) : '?'}</span><b>${R.other ? esc(R.other) : 'Wartet …'}</b><small>${R.other ? 'rechte Hälfte · bereit ✓' : 'noch niemand da'}</small></div></div>
        <div class="row"><button class="btn" id="c-cancel">Raum schließen</button><button class="btn go" id="c-start" ${R.other ? '' : 'disabled'}>Spiel starten</button></div></div>`;
      $('c-cancel').onclick = async () => { await leave(); render(o); }; $('c-start').onclick = startHost;
    } else {
      o.innerHTML = `<div class="card box" data-coop><h2>🤝 Beigetreten</h2><p class="lead">Raum ${R.code} bei <b>${esc(R.other)}</b> · ${esc(MAPS[R.map].n)}. Warte, bis ${esc(R.other)} das Spiel startet …</p><div class="row"><button class="btn" id="c-cancel">Verlassen</button></div></div>`;
      $('c-cancel').onclick = async () => { await leave(); render(o); };
    }
    const b = $('o-back'); if (b) b.onclick = () => showOverlay('menu');
  }
  window.NET = { init, ok, score, renderBoard, publishMap, browseMaps, act, snap, tick, leave, render, get room() { return N.room; }, _apply: apply, _applySnap: applySnap, _snapState: snapState };
  if (window.TD) init();       // Spiel ist schon gestartet (Anmeldung war schneller als diese Datei)
})();
