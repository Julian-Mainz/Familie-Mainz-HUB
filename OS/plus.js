// OS/plus.js – Schnellstart-Leiste, mehrere Desktops, Zwischenablage-Verlauf und Erinnerungen für J.Mainz OS.
(function () {
    'use strict';
    let API, U, e, S;
    const $ = id => document.getElementById(id);
    const pad = n => String(n).padStart(2, '0');

    // ---------- Töne (Lautstärke aus der Schnellstart-Leiste) ----------
    let actx = null;
    function sound(kind) {
        const v = S.vol ?? .5; if (!v) return;
        try {
            actx = actx || new (window.AudioContext || window.webkitAudioContext)();
            const notes = kind === 'alarm' ? [[880, 0], [880, .3], [880, .6], [1175, .9]] : [[784, 0], [1047, .12]];
            notes.forEach(([f, d]) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
                g.gain.setValueAtTime(.0001, actx.currentTime + d); g.gain.exponentialRampToValueAtTime(.25 * v, actx.currentTime + d + .02); g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + d + .28); o.start(actx.currentTime + d); o.stop(actx.currentTime + d + .3); });
        } catch (x) {}
    }

    // ---------- Erinnerungen ----------
    const rems = () => (S.reminders = Array.isArray(S.reminders) ? S.reminders : []);
    function addReminder(text, at) {
        text = String(text || '').trim().slice(0, 120) || 'Erinnerung'; if (!(at > Date.now())) return uiAlert('Der Zeitpunkt liegt in der Vergangenheit.');
        rems().push({ id: 'r' + Date.now().toString(36), text, at }); rems().sort((a, b) => a.at - b.at); API.save(); paintQs();
        toastInfo(`Erinnerung um ${fmtAt(at)}: ${text}`);
    }
    const fmtAt = at => { const d = new Date(at), today = new Date(); const t = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        if (d.toDateString() === today.toDateString()) return t + ' Uhr'; const tm = new Date(); tm.setDate(tm.getDate() + 1); return (d.toDateString() === tm.toDateString() ? 'morgen ' : d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' ') + t + ' Uhr'; };
    function fired() { return (S.remFired = Array.isArray(S.remFired) ? S.remFired.slice(-20) : []); }
    function pushFired() {
        if (window.JMOS_NOTIFY) JMOS_NOTIFY('rem', fired().map(r => ({ id: 'rem:' + r.id, icon: 'fa-alarm-clock', c: '#f472b6', prio: 3, time: r.at, title: 'Erinnerung', text: r.text, appName: 'Erinnerung', run: () => {} })));
    }
    function checkReminders() {
        const now = Date.now(), due = rems().filter(r => r.at <= now); if (!due.length) return;
        S.reminders = rems().filter(r => r.at > now); due.forEach(r => fired().push(r)); S.remFired = fired();
        API.save(); pushFired(); sound('alarm'); paintQs();
    }
    // "erinnere mich in 20 min an Wäsche", "erinnerung um 17:30 Müll rausbringen", "erinnere mich morgen um 8 an Arzt"
    function parseReminder(q) {
        const m = /^\s*erinner(?:e|ung)?\s*(?:mich\s*)?(.*)$/i.exec(q); if (!m) return null;
        let rest = m[1], at = null;
        const rel = /\bin\s+(\d+(?:[.,]\d+)?)\s*(min(?:uten?)?|m|std|stunden?|h|tag(?:en)?|d)\b/i.exec(rest);
        const abs = /\b(morgen\s+)?um\s+(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr)?\b/i.exec(rest);
        if (rel) { const n = parseFloat(rel[1].replace(',', '.')), u = rel[2].toLowerCase(); at = Date.now() + n * (u.startsWith('m') ? 60000 : u.startsWith('t') || u === 'd' ? 864e5 : 3600000); rest = rest.replace(rel[0], ' '); }
        else if (abs) { const d = new Date(); d.setHours(+abs[2], +(abs[3] || 0), 0, 0); if (abs[1] || d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); at = d.getTime(); rest = rest.replace(abs[0], ' '); }
        const text = rest.replace(/^\s*(an|dass|daran|zu)\s+/i, '').replace(/\s+/g, ' ').trim();
        return { at, text };
    }
    function searchExtra(q) {
        const r = parseReminder(q); if (!r) return [];
        if (!r.at) return [{ kind: 'Erinnerung', title: 'Erinnerung: Zeit fehlt', sub: 'z. B. „erinnere mich in 20 min an Wäsche“ oder „… um 17:30 an Müll“', icon: 'fa-alarm-clock', c: '#f472b6', run: () => openQs(), s: 5 }];
        return [{ kind: 'Erinnerung', title: `Erinnerung erstellen: ${r.text || 'Erinnerung'}`, sub: fmtAt(r.at), icon: 'fa-alarm-clock', c: '#f472b6', run: () => addReminder(r.text, r.at), s: 5 }];
    }
    function toastInfo(text) {
        const box = $('toasts'), el = document.createElement('div'); el.className = 'tst';
        el.innerHTML = `<div class="tst-i"><span class="ic" style="--c:#f472b6"><i class="fa-solid fa-alarm-clock"></i></span><span class="tx"><b>Erinnerung gespeichert</b><span>${e(text)}</span></span></div>`;
        box.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, 3500);
    }

    // ---------- Zwischenablage-Verlauf (nur in diesem Browser, nie aus dem Passwort-Safe) ----------
    const CKEY = () => 'jmos-clip-' + U.uid;
    const clips = () => { try { return JSON.parse(localStorage.getItem(CKEY()) || '[]'); } catch (x) { return []; } };
    const setClips = a => { try { localStorage.setItem(CKEY(), JSON.stringify(a.slice(0, 25))); } catch (x) {} };
    function record(text, src) {
        if (S.clipOff) return; text = String(text || '').trim(); if (!text || text.length > 5000) return;
        setClips([{ t: text, at: Date.now(), src: src || '' }, ...clips().filter(c => c.t !== text)]);
        if (!$('clip').hidden) paintClip();
    }
    function hookDoc(doc, src) {
        if (/passwort/i.test((doc.location && doc.location.pathname) || '')) return;           // Passwörter nie mitschreiben
        const grab = () => { let t = String(doc.getSelection ? doc.getSelection() : ''); const a = doc.activeElement;
            if (!t && a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.type !== 'password' && a.selectionStart !== a.selectionEnd) t = a.value.slice(a.selectionStart, a.selectionEnd);
            if (a && a.type === 'password') return; record(t, src); };
        doc.addEventListener('copy', grab, true); doc.addEventListener('cut', grab, true);
        const nav = doc.defaultView && doc.defaultView.navigator;
        if (nav && nav.clipboard && nav.clipboard.writeText && !nav.clipboard.__jm) {
            const orig = nav.clipboard.writeText.bind(nav.clipboard);
            try { nav.clipboard.writeText = t => { record(t, src); return orig(t); }; nav.clipboard.__jm = 1; } catch (x) {}
        }
    }
    function paintClip() {
        const list = clips(), ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'gerade' : m < 60 ? `vor ${m} Min.` : m < 1440 ? `vor ${Math.round(m / 60)} Std.` : new Date(t).toLocaleDateString('de-DE'); };
        $('clip').innerHTML = `<div class="nc-h"><b>Zwischenablage</b><button type="button" class="nc-b" data-c="off">${S.clipOff ? 'Verlauf aus' : 'Verlauf an'}</button>${list.length ? '<button type="button" class="nc-b" data-c="clear"><i class="fa-solid fa-trash-can"></i>Leeren</button>' : ''}</div>
            <div class="nc-l">${list.length ? list.map((c, i) => `<div class="cl-i" data-i="${i}" role="button" tabindex="0" title="Klicken zum Kopieren"><p>${e(c.t.length > 220 ? c.t.slice(0, 220) + ' …' : c.t)}</p><small>${e(c.src)}${c.src ? ' · ' : ''}${ago(c.at)}</small><button type="button" class="x" data-del="${i}" aria-label="Entfernen"><i class="fa-solid fa-xmark"></i></button></div>`).join('')
                : `<div class="nc-empty"><i class="fa-solid fa-clipboard"></i><b>${S.clipOff ? 'Verlauf ist ausgeschaltet' : 'Noch nichts kopiert'}</b><span>Was du im OS kopierst (Strg+C oder Kopieren-Knöpfe), erscheint hier. Nur in diesem Browser, nie aus dem Passwort-Safe. Alt+V öffnet die Liste.</span></div>`}</div>`;
    }
    function openClip(on = $('clip').hidden) { API.closePops('clip'); $('clip').hidden = !on; if (on) paintClip(); }
    function wireClip() {
        $('clip').addEventListener('click', async ev => {
            const d = ev.target.closest('[data-del]'); if (d) { const a = clips(); a.splice(+d.dataset.del, 1); setClips(a); return paintClip(); }
            const c = ev.target.closest('[data-c]');
            if (c && c.dataset.c === 'clear') { setClips([]); return paintClip(); }
            if (c && c.dataset.c === 'off') { S.clipOff = !S.clipOff; API.save(); return paintClip(); }
            const i = ev.target.closest('[data-i]'); if (!i) return; const t = clips()[+i.dataset.i]; if (!t) return;
            try { await navigator.clipboard.writeText(t.t); i.classList.add('ok'); i.querySelector('small').textContent = 'Kopiert – mit Strg+V einfügen'; setTimeout(() => openClip(false), 900); } catch (x) { uiAlert('Kopieren nicht möglich: ' + x.message); }
        });
    }

    // ---------- Mehrere Desktops ----------
    function deskBar() {
        const D = API.desks(), cur = API.curDesk();
        return `<div class="dk-bar">${D.map(d => `<div class="dk${d.id === cur ? ' on' : ''}" data-dk="${e(d.id)}" role="button" tabindex="0" title="Doppelklick zum Umbenennen"><i class="fa-solid fa-display"></i><span>${e(d.name)}</span><em>${API.wins.filter(w => !w.closing && (w.desk || 'd1') === d.id).length}</em>${D.length > 1 ? `<button type="button" class="x" data-dkdel="${e(d.id)}" aria-label="Desktop entfernen"><i class="fa-solid fa-xmark"></i></button>` : ''}</div>`).join('')}${D.length < 6 ? '<button type="button" class="dk add" data-dkadd="1"><i class="fa-solid fa-plus"></i>Neuer Desktop</button>' : ''}</div>`;
    }
    function wireDesks() {
        document.addEventListener('click', ev => {
            const bar = ev.target.closest('.dk-bar'); if (!bar) return;
            const del = ev.target.closest('[data-dkdel]');
            if (del) { const id = del.dataset.dkdel, D = API.desks(), to = D.find(d => d.id !== id).id; if (API.curDesk() === id) API.switchDesk(to);
                API.wins.filter(w => (w.desk || 'd1') === id).forEach(w => API.moveToDesk(w, to)); S.desks = D.filter(d => d.id !== id); if (S.deskData) delete S.deskData[id]; API.save(); repaint(); return; }
            if (ev.target.closest('[data-dkadd]')) { const n = API.desks().length + 1, id = 'd' + Date.now().toString(36); S.desks = [...API.desks(), { id, name: n === 2 ? 'Arbeit' : n === 3 ? 'Privat' : 'Desktop ' + n }]; API.save(); API.switchDesk(id); repaint(); return; }
            const d = ev.target.closest('[data-dk]'); if (d) { API.switchDesk(d.dataset.dk); repaint(); }
        });
        document.addEventListener('dblclick', async ev => { const d = ev.target.closest('.dk-bar [data-dk]'); if (!d) return; const D = API.desks(), x = D.find(k => k.id === d.dataset.dk);
            const bg = document.createElement('div'); bg.className = 'uidlg-bg';
            bg.innerHTML = `<form class="uidlg" style="max-width:360px"><div class="uidlg-h"><span class="uidlg-i"><i class="fa-solid fa-display"></i></span><span>Desktop umbenennen</span></div><input class="xp-ask" maxlength="24" value="${e(x.name)}"><div class="uidlg-a"><button type="button" data-r="0">Abbrechen</button><button type="submit" class="ok">Speichern</button></div></form>`;
            document.body.appendChild(bg); const inp = bg.querySelector('input'); inp.select();
            bg.addEventListener('click', ev2 => { if (ev2.target === bg || ev2.target.closest('[data-r="0"]')) bg.remove(); });
            bg.querySelector('form').addEventListener('submit', ev2 => { ev2.preventDefault(); const v = inp.value.trim(); if (v) { x.name = v; API.save(); repaint(); } bg.remove(); });
        });
        (window.JMOS_DESK_HOOKS = window.JMOS_DESK_HOOKS || []).push(() => { paintChip(); repaint(); });
    }
    const repaint = () => { if (window.JMOS_TV_REPAINT) JMOS_TV_REPAINT(); paintChip(); if (!$('qs').hidden) paintQs(); };
    function paintChip() {
        const D = API.desks(), c = $('desk-chip'); c.hidden = D.length < 2;
        const cur = D.find(d => d.id === API.curDesk()); c.innerHTML = `<i class="fa-solid fa-display"></i>${e(cur ? cur.name : '')}`;
    }
    function stepDesk(dir) { const D = API.desks(), i = D.findIndex(d => d.id === API.curDesk()), n = D[(i + dir + D.length) % D.length]; if (n && D.length > 1) { API.switchDesk(n.id); flash(n.name); } }
    function flash(name) { const el = document.createElement('div'); el.className = 'dk-flash'; el.innerHTML = `<i class="fa-solid fa-display"></i>${e(name)}`; document.body.appendChild(el); setTimeout(() => el.classList.add('out'), 700); setTimeout(() => el.remove(), 1000); }

    // ---------- Schnellstart-Leiste ----------
    let st = null;
    function paintQs() {
        if ($('qs').hidden) return;
        const N = S.nc || {}, on = !!(st && st.active), D = API.desks(), cur = API.curDesk(), canZ = can(U, 'zeit');
        let nextEv = '';
        try { if (typeof CAL !== 'undefined' && window.JMOS_WIDGETS && can(U, 'termine')) { const src = []; JMOS_WIDGETS.use('events', d => { src.push(...d); })(); const t = localDate(), now = new Date(), hn = now.getHours() * 60 + now.getMinutes();
            const o = CAL.nextOccurrences(src, t, 10, 30).find(x => x.date !== t || !x.time || (+x.time.slice(0, 2) * 60 + +x.time.slice(3)) > hn);
            if (o) { let cd = ''; if (o.date === t && o.time) { const m = +o.time.slice(0, 2) * 60 + +o.time.slice(3) - hn; cd = m < 60 ? `in ${m} Min.` : `in ${Math.floor(m / 60)} Std. ${m % 60} Min.`; } else cd = new Date(o.date + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + (o.time ? ' ' + o.time : '');
                nextEv = `<div class="qs-ev"><i class="fa-solid fa-calendar-day"></i><span><small>Nächster Termin · ${e(cd)}</small><b>${e(o.title)}</b></span></div>`; } } } catch (x) {}
        const tile = (k, ic, label, active, sub) => `<button type="button" class="qs-t${active ? ' on' : ''}" data-q="${k}"><i class="fa-solid ${ic}"></i><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</button>`;
        $('qs').innerHTML = `<div class="qs-g">
                ${tile('dnd', N.dnd ? 'fa-bell-slash' : 'fa-bell', 'Nicht stören', N.dnd, N.dnd ? 'an' : 'aus')}
                ${canZ ? tile('stamp', 'fa-business-time', on ? 'Ausstempeln' : 'Einstempeln', on, on ? 'seit ' + st.active.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'nicht eingestempelt') : ''}
                ${tile('lock', 'fa-lock', 'Sperren', false, 'Alt+L')}
                ${tile('desk', 'fa-display', 'Desktop', false, 'anzeigen')}
                ${tile('clip', 'fa-clipboard', 'Zwischen­ablage', false, clips().length + ' Einträge')}
                ${tile('tv', 'fa-clone', 'Fenster', false, 'Übersicht')}
                ${tile('wg', 'fa-table-cells-large', 'Widgets', false, 'hinzufügen')}
                ${tile('set', 'fa-gear', 'Einstel­lungen', false, '')}
            </div>
            <div class="qs-vol"><i class="fa-solid ${(S.vol ?? .5) ? 'fa-volume-high' : 'fa-volume-xmark'}" data-q="mute"></i><input type="range" min="0" max="100" value="${Math.round((S.vol ?? .5) * 100)}" aria-label="Lautstärke der Hinweistöne"><span>${Math.round((S.vol ?? .5) * 100)} %</span></div>
            ${D.length > 1 ? `<div class="qs-dk">${D.map(d => `<button type="button" data-dk2="${e(d.id)}" class="${d.id === cur ? 'on' : ''}">${e(d.name)}</button>`).join('')}</div>` : ''}
            ${nextEv}
            <form class="qs-rem"><b><i class="fa-solid fa-alarm-clock"></i>Erinnerung</b><div><input class="t" maxlength="120" placeholder="Woran erinnern?" aria-label="Woran erinnern"><select aria-label="Wann">${[[5, 'in 5 Min.'], [15, 'in 15 Min.'], [30, 'in 30 Min.'], [60, 'in 1 Std.'], [120, 'in 2 Std.'], [240, 'in 4 Std.'], [-1, 'morgen 8 Uhr']].map(([v, n]) => `<option value="${v}" ${v === 30 ? 'selected' : ''}>${n}</option>`).join('')}</select><button type="submit" aria-label="Erinnerung speichern"><i class="fa-solid fa-plus"></i></button></div>
                ${rems().length ? `<ul>${rems().slice(0, 5).map(r => `<li><span>${e(fmtAt(r.at))}</span><b>${e(r.text)}</b><button type="button" class="x" data-rdel="${e(r.id)}" aria-label="Erinnerung löschen"><i class="fa-solid fa-xmark"></i></button></li>`).join('')}</ul>` : '<small>Tipp: in der Suche „erinnere mich in 20 min an …“ tippen</small>'}</form>
            <div class="qs-f"><span class="${navigator.onLine ? 'g' : 'r'}"><i class="fa-solid fa-wifi"></i>${navigator.onLine ? 'Verbunden' : 'Keine Verbindung'}</span><span>${e(U.firstName || '')}</span></div>`;
    }
    function openQs(on = $('qs').hidden) { API.closePops('qs'); $('qs').hidden = !on; $('net').setAttribute('aria-expanded', on); if (on) paintQs(); }
    function wireQs() {
        $('net').addEventListener('click', () => openQs());
        $('qs').addEventListener('click', async ev => {
            const r = ev.target.closest('[data-rdel]'); if (r) { S.reminders = rems().filter(x => x.id !== r.dataset.rdel); API.save(); return paintQs(); }
            const d = ev.target.closest('[data-dk2]'); if (d) { API.switchDesk(d.dataset.dk2); return paintQs(); }
            const q = ev.target.closest('[data-q]'); if (!q) return;
            const k = q.dataset.q;
            if (k === 'dnd') { S.nc = S.nc || { read: [], gone: [], toasted: [] }; S.nc.dnd = !S.nc.dnd; API.save(); $('bell').querySelector('i').className = 'fa-solid ' + (S.nc.dnd ? 'fa-bell-slash' : 'fa-bell'); $('bell').classList.toggle('dnd', S.nc.dnd); return paintQs(); }
            if (k === 'mute') { S.vol = (S.vol ?? .5) ? 0 : .5; API.save(); return paintQs(); }
            if (k === 'stamp') { const b = document.querySelector('.wgt-stamp .go'); if (b) { b.click(); return; } return stampToggle(); }
            API.closePops();
            ({ lock: () => window.JMOS_LOCK && JMOS_LOCK(), desk: () => $('show-desk').click(), clip: () => openClip(true), tv: () => $('bar-tv').click(), wg: () => JMOS_WIDGETS.picker(), set: () => API.openApp('einstellungen') })[k]();
        });
        $('qs').addEventListener('input', ev => { if (ev.target.type === 'range') { S.vol = +ev.target.value / 100; ev.target.nextElementSibling.textContent = ev.target.value + ' %'; ev.target.previousElementSibling.className = 'fa-solid ' + (S.vol ? 'fa-volume-high' : 'fa-volume-xmark'); } });
        $('qs').addEventListener('change', ev => { if (ev.target.type === 'range') { API.save(); sound('note'); } });
        $('qs').addEventListener('submit', ev => {
            ev.preventDefault(); const f = ev.target, t = f.querySelector('.t').value, v = +f.querySelector('select').value;
            let at; if (v === -1) { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); at = d.getTime(); } else at = Date.now() + v * 60000;
            addReminder(t, at);
        });
    }
    async function stampToggle() {
        const W = () => ({ pause: 60, after: 6, ...(U.userPrefs?.work || {}) });
        try {
            if (st && st.active) {
                if (!(await uiConfirm('Jetzt ausstempeln?', { ok: 'Ausstempeln', title: 'Ausstempeln' }))) return;
                const start = st.active.start, end = new Date(), total = Math.max(0, Math.round((end - start) / 60000)), pause = Math.min(total, total >= W().after * 60 ? (st.active.pause ?? W().pause) : 0), f = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
                await db.collection('worktime').add({ type: 'work', date: localDate(start), start: f(start), end: f(end), pauseMinutes: pause, netMinutes: total - pause, note: 'Live erfasst (Desktop)', owner: U.email, createdAt: TS() });
                await db.collection('active_work').doc(U.uid).delete();
            } else await db.collection('active_work').doc(U.uid).set({ startTime: firebase.firestore.Timestamp.fromDate(new Date()), pauseMinutes: W().pause, owner: U.email });
        } catch (x) { uiAlert('Stempeln fehlgeschlagen: ' + x.message); }
    }

    function keys(ev) {
        if (ev.altKey && !ev.shiftKey && (ev.key === 'v' || ev.key === 'V')) { openClip(); return true; }
        if (ev.altKey && !ev.shiftKey && (ev.key === 'a' || ev.key === 'A')) { openQs(); return true; }
        if (ev.altKey && (ev.key === 'PageDown' || ev.key === 'PageUp')) { stepDesk(ev.key === 'PageDown' ? 1 : -1); return true; }
    }

    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        init(api, user) {
            API = api; U = user; e = api.esc; S = api.state();
            window.JMOS_SOUND = sound; window.JMOS_DESKBAR = deskBar; window.JMOS_REMIND = addReminder;
            (window.JMOS_SEARCH_EXTRA = window.JMOS_SEARCH_EXTRA || []).push(searchExtra);
            wireQs(); wireClip(); wireDesks(); paintChip();
            API.keys.push(keys);
            $('desk-chip').addEventListener('click', () => $('bar-tv').click());
            hookDoc(document, 'Desktop');
            (window.JMOS_EMBED_HOOKS = window.JMOS_EMBED_HOOKS || []).push((doc, win) => hookDoc(doc, win.app.name));
            if (can(U, 'zeit') && window.JMOS_WIDGETS) JMOS_WIDGETS.use('zeit', d => { st = d; paintQs(); });
            pushFired(); checkReminders(); setInterval(checkReminders, 15000);
        },
    });
})();
