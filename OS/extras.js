// OS/extras.js – Mitteilungen (Glocke, Mitteilungsleiste, Hinweise unten rechts) und die Suche über alles für J.Mainz OS.
// Mitteilungen entstehen aus den echten Daten: neue Messenger-Nachrichten, bald fällige Rechnungen, Termine in Kürze, lange Arbeitszeit.
// Was gelesen oder weggeklickt ist, merkt sich das OS im Profil (S.nc).
(function () {
    'use strict';
    let API, U, e, S;
    const $ = id => document.getElementById(id);
    const pad = n => String(n).padStart(2, '0');
    const pDate = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    const dayDiff = s => Math.round((pDate(s) - pDate(localDate())) / 864e5);
    const eur = n => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

    // ---------- Mitteilungen ----------
    const SRC = {};              // Quelle -> Liste von Mitteilungen { id, icon, c, title, text, time, app, url, prio }
    let booted = false, toastOK = false;
    const nc = () => { S.nc = S.nc || { read: [], gone: [], toasted: [], dnd: false }; return S.nc; };
    const keep = (arr, n = 300) => arr.slice(-n);
    function all() {
        const g = new Set(nc().gone);
        return Object.values(SRC).flat().filter(n => !g.has(n.id)).sort((a, b) => (b.prio || 0) - (a.prio || 0) || b.time - a.time);
    }
    function setSrc(name, list) {
        SRC[name] = list;
        const N = nc(), fresh = list.filter(n => !N.gone.includes(n.id) && !N.toasted.includes(n.id));
        if (fresh.length) {
            N.toasted = keep([...N.toasted, ...fresh.map(n => n.id)]);
            if (toastOK && !N.dnd) { fresh.slice(0, 3).forEach(toast); }
            API.save();
        }
        paint();
    }
    function paint() {
        const list = all(), unread = list.filter(n => !nc().read.includes(n.id)).length, b = $('bell-n');
        b.hidden = !unread; b.textContent = unread > 9 ? '9+' : unread;
        $('bell').classList.toggle('dnd', !!nc().dnd);
        $('bell').querySelector('i').className = 'fa-solid ' + (nc().dnd ? 'fa-bell-slash' : 'fa-bell');
        if (!$('nc').hidden) panel();
    }
    const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'gerade eben' : m < 60 ? `vor ${m} Min.` : m < 1440 ? `vor ${Math.round(m / 60)} Std.` : new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); };
    const row = (n, cls = 'nc-i') => `<div class="${cls}${nc().read.includes(n.id) ? '' : ' new'}" data-n="${e(n.id)}" role="button" tabindex="0"><span class="ic" style="--c:${n.c}"><i class="fa-solid ${n.icon}"></i></span><span class="tx"><b>${e(n.title)}</b><span>${e(n.text)}</span><small>${e(n.appName || '')}${n.appName ? ' · ' : ''}${ago(n.time)}</small></span><button type="button" class="x" data-x="${e(n.id)}" aria-label="Mitteilung entfernen"><i class="fa-solid fa-xmark"></i></button></div>`;
    function panel() {
        const list = all();
        $('nc').innerHTML = `<div class="nc-h"><b>Mitteilungen</b><button type="button" class="nc-b" data-act="dnd" title="${nc().dnd ? 'Hinweise wieder anzeigen' : 'Nicht stören: keine Hinweise unten rechts'}"><i class="fa-solid ${nc().dnd ? 'fa-bell-slash' : 'fa-bell'}"></i>${nc().dnd ? 'Nicht stören an' : 'Nicht stören'}</button>${list.length ? '<button type="button" class="nc-b" data-act="clear"><i class="fa-solid fa-check-double"></i>Alle entfernen</button>' : ''}</div>
            <div class="nc-l">${list.length ? list.map(n => row(n)).join('') : '<div class="nc-empty"><i class="fa-solid fa-bell"></i><b>Keine neuen Mitteilungen</b><span>Hier erscheinen neue Nachrichten, fällige Rechnungen und Termine.</span></div>'}</div>`;
    }
    function openNc(on = $('nc').hidden) {
        API.closePops('nc'); $('nc').hidden = !on; $('bell').setAttribute('aria-expanded', on);
        if (on) { panel(); const N = nc(); N.read = keep([...new Set([...N.read, ...all().map(n => n.id)])]); API.save(); setTimeout(paint, 1500); }
    }
    function act(n) { if (!n) return; const N = nc(); N.read = keep([...new Set([...N.read, n.id])]); API.save(); paint(); API.closePops(); if (n.run) n.run(); else if (n.app) API.openApp(n.app, n.url ? { url: n.url } : {}); }
    function gone(id) { const N = nc(); N.gone = keep([...new Set([...N.gone, id])]); API.save(); paint(); }
    function toast(n) {
        if (window.JMOS_SOUND && !nc().dnd) JMOS_SOUND.play('notify');
        const box = $('toasts'), el = document.createElement('div'); el.className = 'tst';
        el.innerHTML = row(n, 'tst-i'); box.appendChild(el);
        const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
        el.addEventListener('click', ev => { if (ev.target.closest('[data-x]')) { gone(n.id); return kill(); } act(n); kill(); });
        let t = setTimeout(kill, 7000); el.addEventListener('mouseenter', () => clearTimeout(t)); el.addEventListener('mouseleave', () => { t = setTimeout(kill, 3000); });
        while (box.children.length > 4) box.firstChild.remove();
    }
    function wireNc() {
        $('bell').addEventListener('click', () => openNc());
        $('nc').addEventListener('click', ev => {
            const x = ev.target.closest('[data-x]'); if (x) return gone(x.dataset.x);
            const b = ev.target.closest('[data-act]');
            if (b && b.dataset.act === 'clear') { const N = nc(); N.gone = keep([...new Set([...N.gone, ...all().map(n => n.id)])]); API.save(); paint(); return; }
            if (b && b.dataset.act === 'dnd') { nc().dnd = !nc().dnd; API.save(); paint(); return; }
            const i = ev.target.closest('[data-n]'); if (i) act(all().find(n => n.id === i.dataset.n));
        });
        $('nc').addEventListener('keydown', ev => { const i = ev.target.closest('[data-n]'); if (i && ev.key === 'Enter') act(all().find(n => n.id === i.dataset.n)); });
    }
    // Quellen
    function sources() {
        const W = window.JMOS_WIDGETS;
        if (can(U, 'finanzen')) W.use('fin', ({ inv }) => {
            setSrc('inv', inv.filter(v => v.status !== 'paid' && v.due && dayDiff(v.due) <= 2).map(v => { const d = dayDiff(v.due);
                return { id: `inv:${v.id}:${v.due}:${d < 0 ? 'over' : d}`, icon: 'fa-file-invoice', c: d < 0 ? '#f87171' : '#fbbf24', prio: d < 0 ? 2 : 1, time: Date.now() - 60000,
                    title: d < 0 ? `Rechnung überfällig: ${v.vendor || 'Rechnung'}` : d === 0 ? `Heute fällig: ${v.vendor || 'Rechnung'}` : `Bald fällig: ${v.vendor || 'Rechnung'}`,
                    text: `${v.amount ? eur(v.amount) + ' · ' : ''}${d < -1 ? `seit ${-d} Tagen überfällig` : d === -1 ? 'seit gestern überfällig' : d === 0 ? 'heute fällig' : d === 1 ? 'morgen fällig' : `in ${d} Tagen fällig`}`,
                    app: 'finanzen', appName: 'Finanzen', url: '/finanzen.html#inv' }; }));
        });
        if (can(U, 'termine')) {
            let evs = [];
            const check = () => {
                if (typeof CAL === 'undefined') return; const t = localDate(), now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
                setSrc('ev', CAL.expand(evs, t, t).filter(o => o.time).map(o => { const [h, m] = o.time.split(':').map(Number); return { o, start: h * 60 + m }; })
                    .filter(x => x.start - mins <= 15 && x.start - mins >= -5).map(({ o, start }) => { const d = start - mins;
                        return { id: `ev:${o.key}`, icon: 'fa-calendar-day', c: '#818cf8', prio: 1, time: Date.now(), title: o.title, text: d > 0 ? `beginnt in ${d} Min. (${CAL.timeLabel(o)})` : `läuft jetzt (${CAL.timeLabel(o)})`, app: 'menu', appName: 'Termine' }; }));
            };
            W.use('events', d => { evs = d; check(); }); setInterval(check, 60000);
        }
        if (can(U, 'zeit')) {
            let st = null;
            const check = () => {
                const a = st && st.active, h = a ? (Date.now() - a.start) / 3600000 : 0;
                setSrc('st', a && h >= 9 ? [{ id: `st:${a.start.getTime()}:${h >= 10 ? 10 : 9}`, icon: 'fa-business-time', c: h >= 10 ? '#f87171' : '#fbbf24', prio: 2, time: a.start.getTime() + (h >= 10 ? 10 : 9) * 3600000,
                    title: h >= 10 ? 'Seit über 10 Stunden eingestempelt' : 'Seit 9 Stunden eingestempelt', text: `Eingestempelt seit ${a.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr. Ausstempeln nicht vergessen.`, app: 'zeiterfassung', appName: 'Zeiterfassung' }] : []);
            };
            W.use('zeit', d => { st = d; check(); }); setInterval(check, 60000);
        }
        if (can(U, 'messenger') && window.MSG) {
            MSG.start(); MSG.loadDirectory().catch(() => {});
            const upd = () => {
                const m = MSG.state, list = m.chats.filter(c => !MSG.isMuted(c, m.meta) && MSG.unreadCount(c, m.meta) > 0 && c.last && c.last.from !== U.uid).map(c => { const n = MSG.unreadCount(c, m.meta);
                    return { id: `msg:${c.id}:${c.seq}`, icon: 'fa-comments', c: '#f472b6', prio: 1, time: c.lastMs, title: MSG.chatTitle(c, m.dir, U.uid), text: n > 1 ? `${n} neue Nachrichten` : (MSG.prefs().preview ? MSG.previewLine(c, m.dir, U.uid) : 'Neue Nachricht'),
                        app: 'messenger', appName: 'Messenger', url: '/messenger.html#chat=' + c.id }; });
                setSrc('msg', list);
            };
            MSG.subscribe(upd); upd();
        }
        setTimeout(() => { toastOK = true; }, 4000);           // beim Start nicht alles auf einmal einblenden
    }

    // ---------- Suche über alles ----------
    const CACHE = { events: [], todos: [], notes: [], fin: { tx: [], inv: [] } };
    function search(q) {
        const words = norm(q).split(/\s+/).filter(Boolean), out = [];
        const hit = (...f) => { const h = norm(f.join(' ')); return words.every(w => h.includes(w)); };
        const A = API.apps();
        Object.values(A).forEach(a => { if (!a.hidden && !a.folder && hit(a.name)) void 0; });            // Apps zeigt das Startmenü schon oben
        // Aktionen
        [['Neue Notiz im Notizblock', 'fa-note-sticky', '#facc15', 'notiz schreiben notizblock', () => API.openApp('notizen')],
         ['Widgets hinzufügen', 'fa-table-cells-large', '#8b5cf6', 'widget hinzufuegen desktop', () => JMOS_WIDGETS.picker()],
         ['Hintergrund ändern', 'fa-image', '#6366f1', 'hintergrund wallpaper einstellungen design', () => API.openApp('einstellungen')],
         ['Bildschirm sperren', 'fa-lock', '#94a3b8', 'sperren sperrbildschirm lock pause', () => window.JMOS_LOCK && JMOS_LOCK()],
         ['Abmelden', 'fa-power-off', '#f87171', 'abmelden logout ausloggen', () => handleLogout()]]
            .forEach(([t, ic, c, k, run]) => { if (hit(t, k)) out.push({ kind: 'Aktion', title: t, sub: 'Aktion ausführen', icon: ic, c, run, s: 3 }); });
        // Termine
        if (typeof CAL !== 'undefined') CAL.nextOccurrences(CACHE.events, localDate(), 40, 365).filter(o => hit(o.title)).slice(0, 8).forEach(o =>
            out.push({ kind: 'Termin', title: o.title, sub: `${pDate(o.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}${o.time ? ' · ' + CAL.timeLabel(o) : ' · ganztägig'}`, icon: 'fa-calendar-day', c: '#818cf8', run: () => API.openApp('menu'), s: 2 }));
        // Aufgaben, Pinnwand
        CACHE.todos.filter(t => hit(t.text)).slice(0, 6).forEach(t => out.push({ kind: t.kind === 'shop' ? 'Einkauf' : 'Aufgabe', title: t.text, sub: t.done ? 'erledigt' : 'offen', icon: t.kind === 'shop' ? 'fa-cart-shopping' : 'fa-circle-check', c: t.kind === 'shop' ? '#facc15' : '#34d399', run: () => API.openApp('menu'), s: t.done ? 0 : 1 }));
        CACHE.notes.filter(n => hit(n.text, n.author)).slice(0, 5).forEach(n => out.push({ kind: 'Pinnwand', title: n.text.slice(0, 80), sub: n.author ? 'von ' + n.author : 'Notiz', icon: 'fa-thumbtack', c: '#f59e0b', run: () => API.openApp('menu'), s: 1 }));
        // Dateien
        const X = (window.JMOS_EXT || []).find(x => x.items);
        if (X && can(U, 'dokumente')) { const its = X.items(); its.filter(it => hit(it.name)).slice(0, 8).forEach(it => out.push({ kind: 'Datei', title: it.name, sub: it.src === 'rech' ? 'Rechnungen' : it.src === 'lohn' ? 'Lohnabrechnungen' : 'Eigene Dateien', icon: 'fa-file', c: '#38bdf8', run: () => X.openViewer(it, its), s: 2 })); }
        // Rechnungen und Buchungen
        CACHE.fin.inv.filter(v => hit(v.vendor, v.note, v.ref, v.category)).slice(0, 6).forEach(v => out.push({ kind: 'Rechnung', title: v.vendor || 'Rechnung', sub: `${v.amount ? eur(v.amount) : ''}${v.due ? ' · fällig ' + pDate(v.due).toLocaleDateString('de-DE') : ''}${v.status === 'paid' ? ' · bezahlt' : ''}`, icon: 'fa-file-invoice', c: '#fbbf24', run: () => API.openApp('finanzen', { url: '/finanzen.html#inv' }), s: v.status === 'paid' ? 0 : 2 }));
        CACHE.fin.tx.filter(t => hit(t.partner, t.purpose, t.category)).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5).forEach(t => out.push({ kind: 'Buchung', title: t.partner || t.category || 'Buchung', sub: `${eur(t.amount)} · ${t.date ? pDate(t.date).toLocaleDateString('de-DE') : ''}${t.category ? ' · ' + t.category : ''}`, icon: 'fa-coins', c: t.amount >= 0 ? '#4ade80' : '#f87171', run: () => API.openApp('finanzen', { url: '/finanzen.html#tx' }), s: 0 }));
        // Chats (Name und letzte Nachricht)
        if (window.MSG && can(U, 'messenger')) MSG.state.chats.map(c => ({ c, t: MSG.chatTitle(c, MSG.state.dir, U.uid), l: c.last ? c.last.text : '' })).filter(x => hit(x.t, x.l)).slice(0, 5)
            .forEach(x => out.push({ kind: 'Chat', title: x.t, sub: MSG.previewLine(x.c, MSG.state.dir, U.uid), icon: 'fa-comments', c: '#f472b6', run: () => API.openApp('messenger', { url: '/messenger.html#chat=' + x.c.id }), s: 1 }));
        (window.JMOS_SEARCH_EXTRA || []).forEach(f => { try { out.push(...f(q)); } catch (x) {} });
        return out.sort((a, b) => b.s - a.s);
    }
    function cacheSearch() {
        const W = window.JMOS_WIDGETS;
        if (can(U, 'termine')) W.use('events', d => { CACHE.events = d; });
        if (can(U, 'aufgaben')) W.use('todos', d => { CACHE.todos = d; });
        if (can(U, 'pinnwand')) W.use('notes', d => { CACHE.notes = d; });
        if (can(U, 'finanzen')) W.use('fin', d => { CACHE.fin = d; });
    }

    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        init(api, user) {
            API = api; U = user; e = api.esc; S = api.state();
            wireNc(); sources(); cacheSearch(); booted = true;
            window.JMOS_SEARCH = search;
            window.JMOS_NOTIFY = setSrc;                 // weitere Quellen (z. B. Erinnerungen aus OS/plus.js)
            window.JMOS_DISMISS = gone;
            void booted;
        },
    });
})();
