// js/search.js - Suche über alles (Strg+K / Cmd+K). Wird vom Menü automatisch nachgeladen.
(function () {
    const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
    const eur = n => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    const gd = d => (d || '').split('-').reverse().join('.');
    let box, input, list, results = [], sel = 0, cache = null, loadedAt = 0, loading = null, timer;

    const PAGES = () => [
        ['Start', '/menu.html', 'fa-border-all', 'startseite uebersicht dashboard home'],
        can(currentUser, 'wand') && ['Wandkalender', '/wand.html', 'fa-display', 'tablet kueche anzeige kiosk'],
        can(currentUser, 'messenger') && ['Messenger', '/messenger.html', 'fa-comments', 'chat nachricht schreiben kollegen gruppe unterhaltung'],
        can(currentUser, 'webapps') && ['Uhr (Web-App)', '/Uhr/', 'fa-clock', 'uhr uhrzeit timer feierabend webapp web-app'],
        can(currentUser, 'spotify') && ['Spotify', '/spotify.html', 'fa-headphones', 'musik fernbedienung player lied playlist handy'],
        can(currentUser, 'zeit') && ['Zeiterfassung', '/zeiterfassung.html', 'fa-business-time', 'stempeln stunden arbeitszeit urlaub ueberstunden stundenzettel'],
        can(currentUser, 'finanzen') && ['Finanzen', '/finanzen.html', 'fa-coins', 'buchungen geld fixkosten budget lohn sparkasse konto'],
        can(currentUser, 'tresor') && ['Passwort-Safe', '/passwort.html', 'fa-shield-halved', 'tresor passwoerter zugangsdaten'],
        isAdmin(currentUser) && ['Admin', '/admin.html', 'fa-user-shield', 'mitglieder rechte logs system nachrichten fehler'],
        ['Mein Profil', '/profil.html', 'fa-user', 'profil konto account passwort bild foto avatar name aendern'],
        ['Impressum', '/impressum.html', 'fa-scale-balanced', 'recht anbieter kontakt'],
        ['Datenschutz', '/datenschutz.html', 'fa-lock', 'datenschutzerklaerung dsgvo']
    ].filter(Boolean).map(p => ({ kind: 'page', title: p[0], sub: 'Seite öffnen', icon: p[2], href: p[1], hay: norm(p[0] + ' ' + p[3]) }));

    const ACTIONS = () => [
        ['Neue Aufgabe', '/menu.html#neu-task', 'fa-circle-check text-emerald-400', 'todo erledigen', undefined, 'aufgaben'],
        ['Neuer Einkauf', '/menu.html#neu-shop', 'fa-cart-shopping text-yellow-400', 'einkaufsliste kaufen', undefined, 'aufgaben'],
        ['Neue Notiz', '/menu.html#neu-note', 'fa-note-sticky text-amber-400', 'pinnwand', undefined, 'pinnwand'],
        ['Neuer Termin', '/menu.html#neu-event', 'fa-calendar-plus text-indigo-400', 'kalender', undefined, 'termine'],
        ['Design umschalten (Hell/Dunkel)', null, 'fa-circle-half-stroke text-slate-300', 'theme dunkel hell modus', () => toggleTheme()],
        ['Einstellungen & Alarm', null, 'fa-gear text-slate-300', 'push benachrichtigung daten export konto loeschen', () => window.openSettingsModal && openSettingsModal()],
        ['Abmelden', null, 'fa-arrow-right-from-bracket text-rose-400', 'logout ausloggen', () => handleLogout()]
    ].map(a => ({ kind: 'action', title: a[0], sub: 'Aktion', icon: a[2], href: a[1], run: a[4], perm: a[5], hay: norm(a[0] + ' ' + a[3]) })).filter(a => !a.perm || can(currentUser, a.perm));

    function build() {
        if (box) return;
        document.body.insertAdjacentHTML('beforeend', `
        <div id="search-box" class="fixed inset-0 z-[80] hidden bg-slate-950/70 flex items-start justify-center p-4 pt-[12vh]">
            <div class="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-800"><i class="fa-solid fa-magnifying-glass text-slate-500"></i>
                    <input id="search-input" autocomplete="off" placeholder="Suchen: Seiten, Termine, Aufgaben, Buchungen, Notizen..." class="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none">
                    <kbd class="text-[10px] text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">Esc</kbd></div>
                <div id="search-list" class="max-h-[55vh] overflow-y-auto p-2"></div>
                <div class="flex items-center justify-between px-4 py-2 border-t border-slate-800 text-[10px] text-slate-500"><span>↑ ↓ wählen · Enter öffnen</span><span id="search-status"></span></div>
            </div>
        </div>`);
        box = document.getElementById('search-box'); input = document.getElementById('search-input'); list = document.getElementById('search-list');
        box.addEventListener('mousedown', e => { if (e.target === box) close(); });
        input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 120); });
        input.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown') { sel = Math.min(results.length - 1, sel + 1); paint(); e.preventDefault(); }
            else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); paint(); e.preventDefault(); }
            else if (e.key === 'Enter') { choose(sel); e.preventDefault(); }
            else if (e.key === 'Escape') close();
        });
        list.addEventListener('mousemove', e => { const r = e.target.closest('[data-i]'); if (r && +r.dataset.i !== sel) { sel = +r.dataset.i; paint(true); } });
        list.addEventListener('click', e => { const r = e.target.closest('[data-i]'); if (r) choose(+r.dataset.i); });
    }

    // Daten einmalig holen (Cache für 5 Minuten), nur Bereiche, für die das Mitglied Rechte hat
    async function load() {
        if (cache && Date.now() - loadedAt < 300000) return cache;
        if (loading) return loading;
        const me = currentUser.email, get = async q => { try { return (await q.get()).docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { return []; } };
        loading = (async () => {
            const [pub, mine, notes, todos, tx, work] = await Promise.all([
                can(currentUser, 'termine') ? get(db.collection('events').where('isPublic', '==', true)) : [], can(currentUser, 'termine') ? get(db.collection('events').where('owner', '==', me)) : [],
                can(currentUser, 'pinnwand') ? get(db.collection('notes').orderBy('createdAt', 'desc').limit(100)) : [], can(currentUser, 'aufgaben') ? get(db.collection('todos').orderBy('createdAt', 'desc').limit(200)) : [],
                can(currentUser, 'finanzen') ? get(db.collection('finance_transactions').where('owner', '==', me).limit(1500)) : [],
                can(currentUser, 'zeit') ? get(db.collection('worktime').where('owner', '==', me).limit(1500)) : []]);
            const ev = new Map(); [...pub, ...mine].forEach(e => ev.set(e.id, e));
            cache = [
                ...[...ev.values()].map(e => {
                    const C = window.CAL, rec = !!(C && C.isRecurring(e)), nx = C ? C.nextOccurrences([e], localDate(), 1, 400)[0] : null, d = nx ? nx.date : e.date;
                    return { kind: 'Termine', title: e.title, sub: gd(d) + (e.time ? ' · ' + e.time : '') + (rec ? ' · ' + C.repeatLabel(e) : '') + (e.isPublic ? '' : ' · privat'), icon: 'fa-calendar-day text-indigo-400', href: '/menu.html', hay: norm(e.title + ' ' + e.date + ' ' + gd(e.date) + ' ' + gd(d)), date: d };
                }),
                ...todos.map(t => ({ kind: 'Aufgaben & Einkauf', title: t.text, sub: (t.kind === 'shop' ? 'Einkauf' : 'Aufgabe') + (t.done ? ' · erledigt' : ''), icon: t.kind === 'shop' ? 'fa-cart-shopping text-yellow-400' : 'fa-circle-check text-emerald-400', href: '/menu.html', hay: norm(t.text) })),
                ...notes.map(n => ({ kind: 'Notizen', title: n.text, sub: n.author || 'Mitglied', icon: 'fa-note-sticky text-amber-400', href: '/menu.html', hay: norm(n.text + ' ' + (n.author || '')) })),
                ...tx.map(t => ({ kind: 'Buchungen', title: t.partner, sub: `${gd(t.date)} · ${eur(t.amount)} · ${t.category || 'Sonstiges'}`, icon: 'fa-coins text-yellow-400', href: '/finanzen.html#tx', hay: norm(`${t.partner} ${t.purpose || ''} ${t.category || ''} ${t.date} ${gd(t.date)} ${String(t.amount).replace('.', ',')}`), date: t.date })),
                ...work.filter(w => (w.note || '') && w.note !== 'Live erfasst').map(w => ({ kind: 'Arbeitszeiten', title: w.note, sub: `${gd(w.date)} · ${Math.floor((w.netMinutes || 0) / 60)}:${String((w.netMinutes || 0) % 60).padStart(2, '0')} Std`, icon: 'fa-business-time text-emerald-400', href: '/zeiterfassung.html', hay: norm(w.note + ' ' + w.date + ' ' + gd(w.date)), date: w.date }))
            ];
            loadedAt = Date.now(); loading = null; return cache;
        })();
        return loading;
    }

    function score(item, words) {
        let sc = 0;
        for (const w of words) {
            const i = item.hay.indexOf(w); if (i < 0) return -1;
            sc += i === 0 ? 3 : item.hay.includes(' ' + w) ? 2 : 1;
        }
        return sc;
    }

    async function run() {
        const q = norm(input.value).trim(), words = q.split(/\s+/).filter(Boolean), fixed = [...PAGES(), ...ACTIONS()];
        if (!words.length) { results = fixed.slice(0, 12); sel = 0; paint(); return; }
        const pick = arr => arr.map(it => ({ it, sc: score(it, words) })).filter(x => x.sc >= 0).sort((a, b) => b.sc - a.sc || String(b.it.date || '').localeCompare(String(a.it.date || '')));
        results = pick(fixed).slice(0, 6).map(x => x.it); sel = 0; paint();
        if (!cache) { document.getElementById('search-status').innerText = 'Lade Daten...'; await load(); document.getElementById('search-status').innerText = ''; if (norm(input.value).trim() !== q) return; }
        const groups = {};
        pick(cache).forEach(x => { (groups[x.it.kind] = groups[x.it.kind] || []).length < (x.it.kind === 'Buchungen' ? 8 : 5) && groups[x.it.kind].push(x.it); });
        results = [...results, ...Object.values(groups).flat()]; paint();
    }

    function paint(keepScroll) {
        let lastKind = '', h = '';
        results.forEach((r, i) => {
            const k = r.kind === 'page' || r.kind === 'action' ? 'Seiten & Aktionen' : r.kind;
            if (k !== lastKind) { h += `<div class="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-slate-500">${esc(k)}</div>`; lastKind = k; }
            h += `<div data-i="${i}" class="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer ${i === sel ? 'bg-indigo-600/25' : ''}"><i class="fa-solid ${r.icon} w-5 text-center"></i>
                <div class="min-w-0 flex-1"><div class="text-sm text-slate-100 truncate">${esc(r.title)}</div><div class="text-[11px] text-slate-500 truncate">${esc(r.sub)}</div></div>${i === sel ? '<i class="fa-solid fa-turn-down text-slate-500 text-[10px] rotate-90"></i>' : ''}</div>`;
        });
        list.innerHTML = h || '<div class="text-center text-sm text-slate-500 py-8">Nichts gefunden.</div>';
        if (keepScroll !== true) { const el = list.querySelector(`[data-i="${sel}"]`); if (el) el.scrollIntoView({ block: 'nearest' }); }
    }

    function choose(i) {
        const r = results[i]; if (!r) return;
        close();
        if (r.run) return r.run();
        if (r.href) location.href = r.href;
    }
    function close() { if (box) box.classList.add('hidden'); }
    window.openSearch = function () {
        if (typeof currentUser === 'undefined' || !currentUser) return;
        build(); box.classList.remove('hidden'); input.value = ''; sel = 0; run(); setTimeout(() => input.focus(), 30);
    };
    document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (box && !box.classList.contains('hidden')) close(); else openSearch(); } });
})();
