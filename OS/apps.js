// OS/apps.js – Paket 3 für J.Mainz OS: weitere Widgets (Messenger, Spotify, Budgets, Überstunden-Verlauf)
// und kleine Apps (Fotos, Aufgaben-Board, Stoppuhr & Timer).
(function () {
    'use strict';
    let API, U, e, S;
    const pad = n => String(n).padStart(2, '0');
    const eur = n => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    const CATM = { 'Supermarkt': ['#34d399', 'fa-cart-shopping'], 'Gehalt': ['#facc15', 'fa-coins'], 'Miete / Wohnen': ['#818cf8', 'fa-house'], 'Tanken / Auto': ['#fb923c', 'fa-gas-pump'], 'Freizeit / Abo': ['#f472b6', 'fa-film'], 'Versicherung': ['#22d3ee', 'fa-shield-halved'], 'Sparen / Rücklagen': ['#2dd4bf', 'fa-piggy-bank'], 'Sonstiges': ['#94a3b8', 'fa-wallet'] };
    const catM = c => CATM[c] || CATM.Sonstiges;
    const W = () => window.JMOS_WIDGETS;

    // ---------- Spotify (nutzt die Anmeldung der Seite „Spotify“ in diesem Browser) ----------
    const SP = 'https://api.spotify.com/v1';
    const spStore = () => { try { return localStorage.getItem('sp_persist') === '1' ? localStorage : sessionStorage; } catch (x) { return sessionStorage; } };
    const spTok = () => { try { return JSON.parse(spStore().getItem('sp_tok') || 'null'); } catch (x) { return null; } };
    const spCid = () => (U.userPrefs && U.userPrefs.spotify && U.userPrefs.spotify.clientId) || (() => { try { return localStorage.getItem('sp_client_id') || ''; } catch (x) { return ''; } })();
    async function spAccess() {
        let t = spTok(); if (!t || !t.access) return null;
        if (Date.now() > t.exp - 60000 && t.refresh) {
            const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: spCid() }) });
            if (!r.ok) return null; const j = await r.json(); t = { access: j.access_token, refresh: j.refresh_token || t.refresh, exp: Date.now() + j.expires_in * 1000, scope: j.scope || t.scope || '' };
            try { spStore().setItem('sp_tok', JSON.stringify(t)); } catch (x) {}
        }
        return t.access;
    }
    async function sp(path, method = 'GET') {
        const a = await spAccess(); if (!a) throw Object.assign(new Error('nicht verbunden'), { auth: true });
        const r = await fetch(SP + path, { method, headers: { Authorization: 'Bearer ' + a } });
        if (r.status === 401) throw Object.assign(new Error('abgelaufen'), { auth: true });
        if (r.status === 204 || r.status === 202) return null;
        if (!r.ok) throw new Error('Spotify antwortet nicht (' + r.status + ')');
        return r.json().catch(() => null);
    }

    const TYPES = {
        msg: { name: 'Messenger', icon: 'fa-comments', c: '#f472b6', perm: 'messenger', app: 'messenger', desc: 'Die letzten Chats mit ungelesenen Nachrichten', sizes: { s: [280, 220], m: [300, 320], l: [340, 430] },
            mount(b, w) {
                if (!window.MSG) { b.innerHTML = '<div class="wg-empty">Messenger nicht geladen</div>'; return; }
                MSG.start(); if (!Object.keys(MSG.state.dir).length) MSG.loadDirectory().then(draw).catch(() => {});
                function draw() {
                    const m = MSG.state, n = { s: 3, m: 5, l: 7 }[w.size], list = m.chats.slice(0, n);
                    b.innerHTML = list.length ? `<div class="wg-list wg-msg">${list.map(c => { const u = MSG.isMuted(c, m.meta) ? 0 : MSG.unreadCount(c, m.meta), t = MSG.chatTitle(c, m.dir, U.uid);
                        return `<button type="button" class="ev mc" data-chat="${e(c.id)}"><span class="av">${e((t || '?').slice(0, 1))}</span><span><small>${e(MSG.listTime(c.lastMs))}</small><b>${e(t)}</b><em>${e(MSG.previewLine(c, m.dir, U.uid))}</em></span>${u ? `<i class="ub">${u > 9 ? '9+' : u}</i>` : ''}</button>`; }).join('')}</div>`
                        : '<div class="wg-empty"><i class="fa-solid fa-comments"></i>Noch keine Chats</div>';
                }
                b.addEventListener('click', ev => { const c = ev.target.closest('[data-chat]'); if (c) API.openApp('messenger', { url: '/messenger.html#chat=' + c.dataset.chat }); });
                draw(); const off = MSG.subscribe(draw), id = setInterval(draw, 60000);
                return () => { off(); clearInterval(id); };
            } },
        spotify: { name: 'Spotify', icon: 'fa-headphones', c: '#4ade80', perm: 'spotify', app: 'spotify', desc: 'Was gerade läuft, mit Zurück, Pause und Weiter', sizes: { s: [280, 130], m: [300, 210], l: [320, 330] },
            mount(b, w) {
                let st = null, busy = false, err = '';
                const draw = () => {
                    if (err === 'auth') { b.innerHTML = `<div class="wg-empty"><i class="fa-solid fa-headphones" style="color:#4ade80"></i>Nicht mit Spotify verbunden<button type="button" class="wg-btn sp-go" data-sp="open">Spotify öffnen</button></div>`; return; }
                    const it = st && st.item;
                    if (!it) { b.innerHTML = `<div class="wg-empty"><i class="fa-solid fa-music"></i>${err ? e(err) : 'Gerade läuft nichts'}<small>Starte Musik in der Spotify-App</small></div>`; return; }
                    const art = (it.album && it.album.images && (it.album.images[w.size === 'l' ? 0 : 1] || it.album.images[0]) || {}).url || '', pct = it.duration_ms ? (st.progress_ms || 0) / it.duration_ms * 100 : 0;
                    const tm = ms => `${Math.floor(ms / 60000)}:${pad(Math.floor(ms % 60000 / 1000))}`;
                    b.innerHTML = `<div class="wg-sp ${w.size}">${art ? `<img src="${e(art)}" alt="" class="art">` : '<span class="art"></span>'}<div class="inf"><b>${e(it.name)}</b><span>${e((it.artists || []).map(a => a.name).join(', '))}</span>
                        ${w.size !== 's' ? `<div class="pr"><i style="width:${pct.toFixed(1)}%"></i></div><small>${tm(st.progress_ms || 0)} / ${tm(it.duration_ms)}${st.device ? ' · ' + e(st.device.name) : ''}</small>` : ''}
                        <div class="ctl"><button type="button" data-sp="prev" aria-label="Zurück"><i class="fa-solid fa-backward-step"></i></button><button type="button" class="pp" data-sp="pp" aria-label="${st.is_playing ? 'Pause' : 'Abspielen'}"><i class="fa-solid ${st.is_playing ? 'fa-pause' : 'fa-play'}"></i></button><button type="button" data-sp="next" aria-label="Weiter"><i class="fa-solid fa-forward-step"></i></button></div></div></div>`;
                };
                const load = async () => { if (document.hidden) return; try { st = await sp('/me/player'); err = ''; } catch (x) { err = x.auth ? 'auth' : x.message; st = null; } draw(); };
                b.addEventListener('click', async ev => {
                    const k = ev.target.closest('[data-sp]'); if (!k || busy) return;
                    if (k.dataset.sp === 'open') return API.openApp('spotify');
                    busy = true;
                    try { if (k.dataset.sp === 'pp') await sp(st && st.is_playing ? '/me/player/pause' : '/me/player/play', 'PUT'); else await sp(k.dataset.sp === 'next' ? '/me/player/next' : '/me/player/previous', 'POST'); }
                    catch (x) { uiAlert('Spotify: ' + (x.auth ? 'Bitte zuerst in der App „Spotify“ verbinden.' : x.message)); }
                    busy = false; setTimeout(load, 600);
                });
                load(); const id = setInterval(load, 5000);
                return () => clearInterval(id);
            } },
        budget: { name: 'Budgets', icon: 'fa-piggy-bank', c: '#2dd4bf', perm: 'finanzen', app: 'finanzen', desc: 'Wie viel von deinen Monats-Budgets schon verbraucht ist', sizes: { s: [280, 200], m: [300, 290], l: [340, 400] },
            mount(b, w) {
                let tx = [], bud = {};
                const draw = () => {
                    const ym = localDate().slice(0, 7), by = {};
                    tx.filter(t => t.date?.startsWith(ym) && t.amount < 0).forEach(t => { const c = t.category || 'Sonstiges'; by[c] = (by[c] || 0) - t.amount; });
                    const cats = Object.keys(bud).filter(c => bud[c] > 0).sort((a, c) => (by[c] || 0) / bud[c] - (by[a] || 0) / bud[a]).slice(0, { s: 3, m: 4, l: 6 }[w.size]);
                    b.innerHTML = cats.length ? `<div class="wg-bud">${cats.map(c => { const v = by[c] || 0, pct = v / bud[c], col = pct >= 1 ? '#f43f5e' : pct >= .8 ? '#fbbf24' : '#34d399';
                        return `<div class="bd"><div class="h"><i class="fa-solid ${catM(c)[1]}" style="color:${catM(c)[0]}"></i><span>${e(c)}</span><b class="${pct >= 1 ? 'r' : ''}">${eur(v)} <small>/ ${eur(bud[c])}</small></b></div><div class="bar"><i style="width:${Math.min(100, pct * 100).toFixed(1)}%;background:${col}"></i></div><small>${pct >= 1 ? 'überschritten um ' + eur(v - bud[c]) : 'noch ' + eur(bud[c] - v)}</small></div>`; }).join('')}</div>`
                        : '<div class="wg-empty"><i class="fa-solid fa-piggy-bank"></i>Noch keine Budgets<small>In Finanzen → Budgets festlegen</small></div>';
                };
                const off1 = W().use('fin', d => { tx = d.tx; draw(); }), off2 = W().use('budgets', d => { bud = d || {}; draw(); });
                return () => { off1(); off2(); };
            } },
        ot: { name: 'Überstunden-Verlauf', icon: 'fa-chart-column', c: '#34d399', perm: 'zeit', app: 'zeiterfassung', desc: 'Mehr- oder Minderstunden der letzten Monate als Balken', sizes: { s: [280, 190], m: [320, 240], l: [400, 280] },
            mount(b, w) {
                return W().use('zeit', d => {
                    const n = { s: 4, m: 6, l: 9 }[w.size], now = new Date(), today = localDate(now), months = [];
                    for (let i = n - 1; i >= 0; i--) { const x = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(`${x.getFullYear()}-${pad(x.getMonth() + 1)}`); }
                    const rows = months.map(ym => { const first = `${ym}-01`, end = `${ym}-${pad(new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate())}`, to = end > today ? today : end;
                        const ist = d.entries.reduce((a, x) => a + (x.date >= first && x.date <= to ? Number(x.netMinutes) || 0 : 0), 0);
                        const soll = W().sollMin(first, to); return { ym, diff: ist - soll, has: d.entries.some(x => x.date >= first && x.date <= end) }; });
                    const max = Math.max(60, ...rows.map(r => Math.abs(r.diff))), sum = rows.reduce((a, r) => a + (r.has ? r.diff : 0), 0);
                    const hh = m => `${m < 0 ? '-' : '+'}${Math.floor(Math.abs(Math.round(m)) / 60)}:${pad(Math.abs(Math.round(m)) % 60)}`;
                    b.innerHTML = `<div class="wg-ot"><div class="sm"><span>Summe ${n} Monate</span><b class="${sum >= 0 ? 'g' : 'r'}">${hh(sum)} h</b></div><div class="ch">${rows.map(r => { const hgt = r.has ? Math.max(3, Math.abs(r.diff) / max * 50) : 0;
                        return `<div class="col" title="${new Date(+r.ym.slice(0, 4), +r.ym.slice(5) - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}: ${r.has ? hh(r.diff) + ' h' : 'keine Einträge'}"><div class="up">${r.has && r.diff >= 0 ? `<i style="height:${hgt}%"></i>` : ''}</div><div class="dn">${r.has && r.diff < 0 ? `<i style="height:${hgt}%"></i>` : ''}</div><span>${new Date(+r.ym.slice(0, 4), +r.ym.slice(5) - 1, 1).toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')}</span></div>`; }).join('')}</div></div>`;
                });
            } },
    };

    // ---------- App: Fotos ----------
    function fotos(body, win) {
        const X = () => (window.JMOS_EXT || []).find(x => x.items);
        body.innerHTML = `<div class="ph"><div class="ph-h"><b>Fotos</b><small class="ph-n"></small></div><div class="ph-g" tabindex="0"></div></div>`;
        const g = body.querySelector('.ph-g');
        const draw = () => {
            const its = X() ? X().items().filter(it => it.k === 'img').sort((a, b) => b.date - a.date) : [];
            body.querySelector('.ph-n').textContent = `${its.length} ${its.length === 1 ? 'Bild' : 'Bilder'} aus deinen Dokumenten`;
            let lastM = '';
            g.innerHTML = its.length ? its.map(it => { const m = it.date ? new Date(it.date).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) : 'Ohne Datum', head = m !== lastM ? `<div class="ph-m">${e(m)}</div>` : ''; lastM = m;
                return head + `<button type="button" class="ph-i" data-key="${e(it.key)}" title="${e(it.name)}">${it.thumb ? `<img src="${it.thumb}" alt="${e(it.name)}" loading="lazy">` : '<i class="fa-solid fa-file-image"></i>'}</button>`; }).join('')
                : '<div class="xp-empty"><i class="fa-solid fa-images"></i><b>Noch keine Bilder</b><span>Lade Fotos im Explorer hoch, dann erscheinen sie hier.</span></div>';
            win.photos = its;
        };
        g.addEventListener('click', ev => { const i = ev.target.closest('[data-key]'); if (!i) return; const its = win.photos, it = its.find(x => x.key === i.dataset.key); if (it) X().openViewer(it, its); });
        draw(); const id = setInterval(draw, 4000); win.onClose = () => clearInterval(id);
    }

    // ---------- App: Aufgaben-Board (Kanban) ----------
    function board(body, win) {
        const COLS = [['open', 'Offen', '#818cf8'], ['doing', 'In Arbeit', '#fbbf24'], ['done', 'Erledigt', '#34d399']];
        let all = [], filter = 'all';
        const stage = t => t.done ? 'done' : t.stage === 'doing' ? 'doing' : 'open';
        body.innerHTML = `<div class="kb"><div class="kb-h"><div class="seg">${[['all', 'Alle'], ['task', 'Aufgaben'], ['shop', 'Einkauf']].map(([k, n]) => `<button type="button" data-f="${k}" class="${k === 'all' ? 'on' : ''}">${n}</button>`).join('')}</div><small>Karten zwischen den Spalten ziehen</small></div><div class="kb-c"></div></div>`;
        const box = body.querySelector('.kb-c');
        const draw = () => {
            const list = all.filter(t => filter === 'all' || (t.kind === 'shop' ? 'shop' : 'task') === filter);
            box.innerHTML = COLS.map(([k, n, c]) => { const items = list.filter(t => stage(t) === k);
                return `<section class="kb-col" data-col="${k}" style="--c:${c}"><header><i></i><b>${n}</b><em>${items.length}</em></header><div class="kb-l">${items.map(t => `<div class="kb-k${t.kind === 'shop' ? ' shop' : ''}" draggable="true" data-id="${e(t.id)}"><p>${e(t.text)}</p><small>${t.kind === 'shop' ? '<i class="fa-solid fa-cart-shopping"></i> Einkauf' : '<i class="fa-solid fa-circle-check"></i> Aufgabe'}${t.author ? ' · ' + e(t.author) : ''}</small></div>`).join('') || '<div class="kb-e">Leer</div>'}</div>
                ${k === 'open' ? '<form class="kb-add"><input maxlength="200" placeholder="+ Neue Karte" aria-label="Neue Aufgabe"></form>' : ''}</section>`; }).join('');
        };
        const move = (id, col) => { const t = all.find(x => x.id === id); if (!t || stage(t) === col) return;
            const data = col === 'done' ? { done: true } : { done: false, stage: col === 'doing' ? 'doing' : 'open' };
            db.collection('todos').doc(id).update(data).catch(x => uiAlert('Verschieben fehlgeschlagen: ' + (x.code === 'permission-denied' ? 'Die Firestore-Regel für das Board fehlt noch, oder die Karte gehört jemand anderem.' : x.message))); };
        body.addEventListener('click', ev => { const f = ev.target.closest('[data-f]'); if (f) { filter = f.dataset.f; body.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === f)); draw(); } });
        body.addEventListener('submit', ev => { ev.preventDefault(); const i = ev.target.querySelector('input'), text = i.value.trim(); if (!text) return;
            db.collection('todos').add({ text, kind: filter === 'shop' ? 'shop' : 'task', done: false, author: U.firstName || '', owner: U.email, createdAt: TS() }).then(() => { i.value = ''; i.focus(); }).catch(x => uiAlert(x.message)); });
        body.addEventListener('dragstart', ev => { const k = ev.target.closest('[data-id]'); if (k) { ev.dataTransfer.setData('text/x-todo', k.dataset.id); k.classList.add('drag'); } });
        body.addEventListener('dragend', ev => { const k = ev.target.closest('[data-id]'); if (k) k.classList.remove('drag'); body.querySelectorAll('.kb-col.over').forEach(x => x.classList.remove('over')); });
        body.addEventListener('dragover', ev => { const c = ev.target.closest('[data-col]'); if (c) { ev.preventDefault(); body.querySelectorAll('.kb-col.over').forEach(x => x !== c && x.classList.remove('over')); c.classList.add('over'); } });
        body.addEventListener('drop', ev => { const c = ev.target.closest('[data-col]'), id = ev.dataTransfer.getData('text/x-todo'); if (c && id) { ev.preventDefault(); move(id, c.dataset.col); } });
        body.addEventListener('contextmenu', ev => { const k = ev.target.closest('[data-id]'); if (!k) return; ev.preventDefault(); const id = k.dataset.id;
            API.ctx(ev.clientX, ev.clientY, [...COLS.map(([c, n]) => ['fa-arrow-right', 'Nach „' + n + '“', () => move(id, c)]), null, ['fa-trash-can', 'Löschen', async () => { if (await uiConfirm('Karte löschen?', { danger: true, ok: 'Löschen' })) db.collection('todos').doc(id).delete().catch(x => uiAlert(x.message)); }]]); });
        const off = W().use('todos', d => { all = d; draw(); }); win.onClose = off;
    }

    // ---------- App: Stoppuhr & Timer ----------
    const CLK = { sw: { run: false, t0: 0, acc: 0, laps: [] }, tm: { run: false, end: 0, left: 5 * 60000, total: 5 * 60000 } };
    const beep = () => { try { const a = new (window.AudioContext || window.webkitAudioContext)(); [0, .35, .7].forEach(d => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.25, a.currentTime + d); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + d + .3); o.start(a.currentTime + d); o.stop(a.currentTime + d + .32); }); } catch (x) {} };
    setInterval(() => { const t = CLK.tm; if (t.run && Date.now() >= t.end) { t.run = false; t.left = 0; beep(); uiAlert('Die Zeit ist abgelaufen.', { title: 'Timer', icon: 'fa-hourglass-half' }); } }, 500);
    function clock(body, win) {
        let tab = 'sw';
        const f = (ms, cs) => { ms = Math.max(0, ms); const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000); return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(s) + (cs ? ',' + pad(Math.floor(ms % 1000 / 10)) : ''); };
        body.innerHTML = `<div class="ck"><div class="seg ck-t"><button type="button" data-t="sw" class="on"><i class="fa-solid fa-stopwatch"></i>Stoppuhr</button><button type="button" data-t="tm"><i class="fa-solid fa-hourglass-half"></i>Timer</button></div><div class="ck-b"></div></div>`;
        const box = body.querySelector('.ck-b');
        const render = () => {
            const sw = CLK.sw, tm = CLK.tm;
            if (tab === 'sw') box.innerHTML = `<div class="ck-d sw">00:00,00</div><div class="ck-a"><button type="button" class="btn" data-k="lap" ${sw.run ? '' : 'disabled'}><i class="fa-solid fa-flag"></i>Runde</button><button type="button" class="btn pri ck-go" data-k="sw">${sw.run ? '<i class="fa-solid fa-pause"></i>Stopp' : '<i class="fa-solid fa-play"></i>Start'}</button><button type="button" class="btn" data-k="reset"><i class="fa-solid fa-rotate-left"></i>Zurücksetzen</button></div>
                <ol class="ck-laps">${sw.laps.map((l, i) => `<li><span>Runde ${sw.laps.length - i}</span><b>${f(l.lap, true)}</b><small>${f(l.total, true)}</small></li>`).join('')}</ol>`;
            else box.innerHTML = `<div class="ck-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" class="tr"/><circle cx="60" cy="60" r="54" class="pr" pathLength="100"/></svg><div class="ck-d tm"></div></div>
                <div class="ck-pre">${[1, 3, 5, 10, 15, 25, 30, 60].map(m => `<button type="button" data-m="${m}">${m < 60 ? m + ' Min' : '1 Std'}</button>`).join('')}</div>
                <div class="ck-a"><label class="ck-in"><input type="number" min="0" max="999" value="${Math.round(tm.total / 60000)}" aria-label="Minuten"> Min</label><button type="button" class="btn pri ck-go" data-k="tm">${tm.run ? '<i class="fa-solid fa-pause"></i>Pause' : '<i class="fa-solid fa-play"></i>Start'}</button><button type="button" class="btn" data-k="treset"><i class="fa-solid fa-rotate-left"></i>Zurück</button></div>`;
            tick();
        };
        const tick = () => {
            const sw = CLK.sw, tm = CLK.tm;
            if (tab === 'sw') { const d = box.querySelector('.ck-d'); if (d) d.textContent = f(sw.acc + (sw.run ? Date.now() - sw.t0 : 0), true); }
            else { const left = tm.run ? tm.end - Date.now() : tm.left, d = box.querySelector('.ck-d'), p = box.querySelector('.pr'); if (d) d.textContent = f(left); if (p) p.style.strokeDashoffset = 100 - (tm.total ? Math.max(0, left) / tm.total * 100 : 0); }
            const go = box.querySelector('.ck-go'); if (go && tab === 'tm' && !CLK.tm.run && go.textContent.includes('Pause')) render();
        };
        body.addEventListener('click', ev => {
            const t = ev.target.closest('[data-t]'); if (t) { tab = t.dataset.t; body.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === t)); return render(); }
            const sw = CLK.sw, tm = CLK.tm, m = ev.target.closest('[data-m]'); if (m) { tm.run = false; tm.total = tm.left = +m.dataset.m * 60000; return render(); }
            const k = ev.target.closest('[data-k]'); if (!k) return;
            ({ sw: () => { if (sw.run) { sw.acc += Date.now() - sw.t0; sw.run = false; } else { sw.t0 = Date.now(); sw.run = true; } },
               lap: () => { const total = sw.acc + Date.now() - sw.t0, prev = sw.laps[0] ? sw.laps[0].total : 0; sw.laps.unshift({ lap: total - prev, total }); },
               reset: () => { sw.run = false; sw.acc = 0; sw.laps = []; },
               tm: () => { if (tm.run) { tm.left = tm.end - Date.now(); tm.run = false; } else { if (tm.left <= 0) tm.left = tm.total; tm.end = Date.now() + tm.left; tm.run = true; } },
               treset: () => { tm.run = false; tm.left = tm.total; } })[k.dataset.k](); render();
        });
        body.addEventListener('change', ev => { if (ev.target.matches('.ck-in input')) { const v = Math.max(0, Math.min(999, +ev.target.value || 0)); CLK.tm.run = false; CLK.tm.total = CLK.tm.left = v * 60000; render(); } });
        render(); const id = setInterval(tick, 50); win.onClose = () => clearInterval(id);
    }

    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        apps: [
            { id: 'fotos', name: 'Fotos', icon: 'fa-images', c: '#38bdf8', native: 'fotos', perm: 'dokumente', w: 900, h: 620 },
            { id: 'board', name: 'Aufgaben-Board', icon: 'fa-table-columns', c: '#34d399', native: 'board', perm: 'aufgaben', w: 980, h: 600 },
            { id: 'stoppuhr', name: 'Stoppuhr & Timer', icon: 'fa-stopwatch', c: '#f472b6', native: 'clock', w: 420, h: 560, noMax: true },
        ],
        ui: { fotos, board, clock },
        init(api, user) {
            API = api; U = user; e = api.esc; S = api.state();
            Object.assign(W().TYPES, TYPES); window.JMOS_SP = sp; window.JMOS_SP_TOK = spTok;
            W().addSource('budgets', set => db.collection('finance_settings').doc(U.uid).onSnapshot(d => set(d.exists ? (d.data().budgets || {}) : {}), () => set({})));
            W().render();
            // neue Apps auf dem Desktop einmalig ergänzen (freie Plätze)
            if (!S.p3) { S.p3 = 1; API.renderIcons(); API.save(); }
        },
    });
})();
