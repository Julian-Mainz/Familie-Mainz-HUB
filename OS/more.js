/* J.Mainz OS – Paket D: Snap-Layouts, Fenster mit Tabs, Tastenkürzel-Übersicht, Offline-Anzeige */
(function () {
    'use strict';
    let API, U, S, e;
    const $ = id => document.getElementById(id);
    const winOf = el => API.wins.find(w => w.el === el && !w.closing);

    // ================= Snap-Layouts (über dem Maximieren-Knopf) =================
    const LAYOUTS = [
        { cols: '1fr 1fr', rows: '1fr', z: [['l', '1/2', '1/2'], ['r', '2/3', '1/2']] },
        { cols: '2fr 1fr', rows: '1fr', z: [['l23', '1/2', '1/2'], ['r13', '2/3', '1/2']] },
        { cols: '1fr 1fr 1fr', rows: '1fr', z: [['l13', '1/2', '1/2'], ['c13', '2/3', '1/2'], ['r13', '3/4', '1/2']] },
        { cols: '1fr 2fr', rows: '1fr', z: [['l13', '1/2', '1/2'], ['r23', '2/3', '1/2']] },
        { cols: '1fr 1fr', rows: '1fr 1fr', z: [['l', '1/2', '1/3'], ['tr', '2/3', '1/2'], ['br', '2/3', '2/3']] },
        { cols: '1fr 1fr', rows: '1fr 1fr', z: [['tl', '1/2', '1/2'], ['tr', '2/3', '1/2'], ['bl', '1/2', '2/3'], ['br', '2/3', '2/3']] },
    ];
    const ZNAME = { l: 'links', r: 'rechts', l23: 'links, zwei Drittel', r13: 'rechts, ein Drittel', l13: 'links, ein Drittel', c13: 'Mitte', r23: 'rechts, zwei Drittel', tr: 'oben rechts', br: 'unten rechts', tl: 'oben links', bl: 'unten links' };
    let slEl = null, slWin = null, slT = 0, slHide = 0;
    function slShow(btn) {
        const w = winOf(btn.closest('.win')); if (!w || w.app.noMax || innerWidth <= 760) return;
        slClose(); slWin = w;
        slEl = document.createElement('div'); slEl.className = 'sl-pop'; slEl.setAttribute('role', 'menu'); slEl.setAttribute('aria-label', 'Fenster anordnen');
        slEl.innerHTML = LAYOUTS.map(L => `<div class="sl-l" style="grid-template-columns:${L.cols};grid-template-rows:${L.rows}">${L.z.map(([z, c, r]) => `<button type="button" data-z="${z}" style="grid-column:${c};grid-row:${r}" title="${ZNAME[z]}" aria-label="${ZNAME[z]}"></button>`).join('')}</div>`).join('');
        document.body.appendChild(slEl);
        const r = btn.getBoundingClientRect(), pw = slEl.offsetWidth;
        slEl.style.left = Math.max(8, Math.min(innerWidth - pw - 8, r.left + r.width / 2 - pw / 2)) + 'px'; slEl.style.top = (r.bottom + 6) + 'px';
        slEl.addEventListener('pointerenter', () => clearTimeout(slHide));
        slEl.addEventListener('pointerleave', () => { slHide = setTimeout(slClose, 250); });
        slEl.addEventListener('click', ev => { const b = ev.target.closest('[data-z]'); if (!b || !slWin) return; const w2 = slWin, z = b.dataset.z; slClose(); if (w2.min) API.toggleMin(w2, false); API.snapTo(w2, z); API.focus(w2); if ((z === 'l' || z === 'r') && window.JMOS_SNAPPED) JMOS_SNAPPED(w2, z); });
    }
    function slClose() { clearTimeout(slT); clearTimeout(slHide); if (slEl) slEl.remove(); slEl = null; slWin = null; }
    function wireSnapLayouts() {
        const wins = $('wins');
        wins.addEventListener('pointerover', ev => { const b = ev.target.closest('.wt-b[data-a="max"]'); if (!b || ev.pointerType === 'touch') return; clearTimeout(slHide); clearTimeout(slT); if (!slEl) slT = setTimeout(() => slShow(b), 420); });
        wins.addEventListener('pointerout', ev => { const b = ev.target.closest('.wt-b[data-a="max"]'); if (!b || b.contains(ev.relatedTarget)) return; clearTimeout(slT); slHide = setTimeout(slClose, 250); });
        wins.addEventListener('pointerdown', ev => { if (!ev.target.closest('.sl-pop')) slClose(); }, true);
        addEventListener('blur', slClose);
    }

    // ================= Fenster mit Tabs =================
    const members = g => API.wins.filter(w => w.grp === g && !w.closing);
    const activeOf = g => members(g).find(w => !w.tabAway) || members(g)[0];
    function activate(t) {
        if (!t || !t.grp) return; const cur = activeOf(t.grp);
        if (cur && cur !== t) {
            Object.assign(t, { x: cur.x, y: cur.y, w: cur.w, h: cur.h, max: cur.max, snap: cur.snap, desk: cur.desk });
            cur.tabAway = true; cur.el.classList.add('away'); cur.el.classList.remove('focus');
        }
        members(t.grp).forEach(w => { if (w !== t) { w.tabAway = true; w.el.classList.add('away'); } });
        t.tabAway = false; if (t.min) { t.min = false; t.el.classList.remove('min'); }
        t.el.classList.toggle('away', !API.onDesk(t)); API.place(t); API.focus(t);
        paintTabs(t.grp); API.renderTasks(); API.save();
    }
    function paintTabs(g) {
        const ms = members(g);
        API.wins.forEach(w => { if (!w.grp || !members(w.grp).length) clearTabs(w); });
        if (ms.length < 2) { ms.forEach(w => { w.grp = null; w.tabAway = false; clearTabs(w); w.el.classList.toggle('away', !API.onDesk(w)); }); return; }
        const act = activeOf(g);
        ms.forEach(w => {
            if (!w._tobs) { w._tobs = new MutationObserver(() => { if (w.grp) paintTabs(w.grp); }); w._tobs.observe(w.el.querySelector('.wt-title'), { childList: true, characterData: true, subtree: true }); }   // Titel ändern sich (z. B. Vorschau)
            let strip = w.el.querySelector('.wtabs');
            if (!strip) { strip = document.createElement('div'); strip.className = 'wtabs'; strip.setAttribute('role', 'tablist'); const t = w.el.querySelector('.wt-title'); t.after(strip); w.el.classList.add('tabbed'); wireStrip(strip); }
            strip.innerHTML = ms.map(m => { const a = m.app, ttl = m.el.querySelector('.wt-title').textContent;
                return `<div class="wtab${m === act ? ' on' : ''}" role="tab" aria-selected="${m === act}" data-tw="${m.id}" title="${e(ttl)}"><span class="wt-ico${a.folder ? ' folder' : ''}" style="--c:${a.c || '#818cf8'}"><i class="fa-solid ${a.folder ? 'fa-folder' : a.icon}"></i></span><span class="wtab-t">${e(ttl)}</span><button type="button" class="wtab-x" data-tx="${m.id}" aria-label="Tab schließen"><i class="fa-solid fa-xmark"></i></button></div>`; }).join('');
        });
    }
    function clearTabs(w) { const s = w.el.querySelector('.wtabs'); if (s) s.remove(); w.el.classList.remove('tabbed'); }
    const byId = id => API.wins.find(w => w.id === id && !w.closing);
    function wireStrip(strip) {
        strip.addEventListener('pointerdown', ev => { if (ev.target.closest('.wtab')) ev.stopPropagation(); });   // Tabs nicht als Fenster-Ziehen werten
        strip.addEventListener('click', ev => {
            const x = ev.target.closest('[data-tx]'); if (x) { ev.stopPropagation(); const w = byId(x.dataset.tx); if (w) API.closeWin(w); return; }
            const t = ev.target.closest('[data-tw]'); if (t) { ev.stopPropagation(); activate(byId(t.dataset.tw)); }
        });
        strip.addEventListener('auxclick', ev => { const t = ev.target.closest('[data-tw]'); if (t && ev.button === 1) { ev.preventDefault(); const w = byId(t.dataset.tw); if (w) API.closeWin(w); } });
        strip.addEventListener('dblclick', ev => { if (ev.target.closest('.wtab')) ev.stopPropagation(); });
        strip.addEventListener('contextmenu', ev => {
            const t = ev.target.closest('[data-tw]'); if (!t) return; ev.preventDefault(); ev.stopPropagation(); const w = byId(t.dataset.tw); if (!w) return;
            API.ctx(ev.clientX, ev.clientY, [['fa-window-restore', 'Als eigenes Fenster lösen', () => detach(w)], null, ['fa-xmark', 'Tab schließen', () => API.closeWin(w)], members(w.grp).length > 2 && ['fa-xmark', 'Andere Tabs schließen', () => members(w.grp).filter(m => m !== w).forEach(m => API.closeWin(m))]]);
        });
    }
    function detach(w) {
        const g = w.grp; if (!g) return; const wasActive = !w.tabAway, ref = activeOf(g);
        w.grp = null; w.tabAway = false; clearTabs(w);
        Object.assign(w, { x: ref.x + 40, y: ref.y + 40, w: ref.w, h: ref.h, max: false, desk: ref.desk });
        if (wasActive) { const n = members(g)[0]; if (n) activate(n); }
        w.el.classList.toggle('away', !API.onDesk(w)); API.place(w); API.focus(w); paintTabs(g); API.renderTasks(); API.save();
    }
    function onClose(win) {
        const g = win.grp; if (!g) return;
        const rest = members(g).filter(w => w !== win);
        if (!win.tabAway && rest.length) { const n = rest[rest.length - 1]; win.tabAway = true; activate(n); }
        win.grp = null; paintTabs(g);
    }
    let dropHi = null;
    function tabTarget(win, x, y) {
        const el = document.elementsFromPoint(x, y).find(n => n.closest && n.closest('.wt') && n.closest('.win') && n.closest('.win') !== win.el);
        const t = el ? winOf(el.closest('.win')) : null;
        const ok = t && !t.tabAway && !t.min && (!win.grp || t.grp !== win.grp) && !t.app.noTabs && !win.app.noTabs ? t : null;
        if (dropHi && dropHi !== ok) dropHi.el.classList.remove('tab-drop');
        if (ok) ok.el.classList.add('tab-drop'); dropHi = ok; return ok;
    }
    function tabDrop(win, t) {
        if (dropHi) dropHi.el.classList.remove('tab-drop'); dropHi = null;
        if (!t) return;
        const g = t.grp || 'g' + Date.now().toString(36);
        t.grp = g; (win.grp ? members(win.grp) : [win]).forEach(w => { w.grp = g; });
        activate(win);
    }
    function restoreGroups() {
        const gs = [...new Set(API.wins.filter(w => w.grp).map(w => w.grp))];
        gs.forEach(g => { const ms = members(g); if (ms.length < 2) { ms.forEach(w => { w.grp = null; w.tabAway = false; w.el.classList.toggle('away', !API.onDesk(w)); }); return; } const a = ms.find(w => !w.tabAway) || ms[0]; activate(a); });
        API.renderTasks();
    }
    // ================= Tastenkürzel-Übersicht =================
    const KEYS = [
        ['Allgemein', [[['Strg', 'Leertaste'], 'Suche und Startmenü'], [['Alt', 'A'], 'Schnellstart-Leiste'], [['Alt', 'V'], 'Zwischenablage-Verlauf'], [['Alt', 'L'], 'Bildschirm sperren'], [['Alt', '?'], 'Diese Übersicht (auch F1)'], [['Esc'], 'Menü oder Dialog schließen']]],
        ['Fenster', [[['Alt', 'Q'], 'Fenster wechseln (Alt gedrückt halten)'], [['Alt', 'W'], 'Fenster schließen'], [['Alt', 'M'], 'Fenster minimieren'], [['Alt', 'Umschalt', '← → ↑'], 'Fenster andocken'], [['Alt', '1 … 9'], 'Angeheftete App öffnen'], [['Ziehen'], 'auf eine andere Titelleiste: als Tab einfügen']]],
        ['Desktops', [[['Alt', 'Umschalt', 'D'], 'Desktop anzeigen'], [['Alt', 'Bild ↑ / ↓'], 'Desktop wechseln']]],
        ['Explorer', [[['Leertaste'], 'Schnellvorschau'], [['Enter'], 'Öffnen'], [['F2'], 'Umbenennen'], [['Entf'], 'In den Papierkorb'], [['Rücktaste'], 'Zurück zur Übersicht'], [['← ↑ → ↓'], 'Auswahl bewegen']]],
    ];
    let kbEl = null;
    function kbOpen() {
        if (kbEl) return kbClose(); API.closePops();
        kbEl = document.createElement('div'); kbEl.className = 'ks-ov'; kbEl.setAttribute('role', 'dialog'); kbEl.setAttribute('aria-label', 'Tastenkürzel');
        const kb = k => k ? `<kbd>${e(k)}</kbd>` : '';
        kbEl.innerHTML = `<div class="ks-card" tabindex="-1"><div class="ks-top"><b><i class="fa-solid fa-keyboard"></i>Tastenkürzel</b><button type="button" class="ks-x" aria-label="Schließen"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="ks-cols">${KEYS.map(([h, rows]) => `<section><h4>${h}</h4>${rows.map(([ks, t]) => `<div class="ks-r"><span class="ks-k">${ks.map(kb).join('<i>+</i>')}</span><span>${e(t)}</span></div>`).join('')}</section>`).join('')}</div>
            <small class="ks-f">Ein Tastendruck oder Klick schließt die Übersicht.</small></div>`;
        document.body.appendChild(kbEl); kbEl.querySelector('.ks-card').focus();
        kbEl.addEventListener('click', ev => { if (ev.target === kbEl || ev.target.closest('.ks-x')) kbClose(); });
    }
    function kbClose() { if (kbEl) { kbEl.remove(); kbEl = null; } }

    // ================= Offline-Anzeige =================
    let offT = null;
    function netToast(icon, c, title, text, ms) {
        const box = $('toasts'), el = document.createElement('div'); el.className = 'tst';
        el.innerHTML = `<div class="tst-i"><span class="ic" style="--c:${c}"><i class="fa-solid ${icon}"></i></span><span class="tx"><b>${title}</b><span>${text}</span></span></div>`;
        box.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, ms || 4500); return el;
    }
    function netState() {
        const off = !navigator.onLine, b = $('net');
        document.documentElement.classList.toggle('offline', off);
        if (b) { b.classList.toggle('off', off); b.title = off ? 'Keine Internetverbindung – Änderungen werden nachgeschickt (Alt+A: Schnellstart)' : 'Schnellstart (Alt+A)'; }
        let bar = $('off-bar');
        if (off && !bar) { bar = document.createElement('div'); bar.id = 'off-bar'; bar.setAttribute('role', 'status'); bar.innerHTML = '<i class="fa-solid fa-plug-circle-xmark"></i><span><b>Offline</b> – Änderungen werden gespeichert, sobald die Verbindung wieder da ist.</span>'; document.body.appendChild(bar); }
        if (!off && bar) bar.remove();
    }
    function wireNet() {
        addEventListener('offline', () => { netState(); });
        addEventListener('online', async () => {
            netState(); const t = netToast('fa-wifi', '#4ade80', 'Wieder online', 'Ungespeicherte Änderungen werden jetzt übertragen …', 6000);
            try { const db = firebase.firestore(); if (db.waitForPendingWrites) { await db.waitForPendingWrites(); t.querySelector('.tx span').textContent = 'Alles ist gespeichert.'; } } catch (x) { }
        });
        netState();
    }

    function keys(ev) {
        if (ev.altKey && (ev.key === '?' || ev.key === 'ß' || ev.code === 'Minus' && ev.shiftKey)) { kbOpen(); return true; }
        if (ev.key === 'F1' && !ev.altKey && !ev.ctrlKey) { kbOpen(); return true; }
        if (kbEl && !['Alt', 'Shift', 'Control', 'Meta'].includes(ev.key)) { kbClose(); return true; }
        if (ev.key === 'Escape' && slEl) { slClose(); return true; }
    }
    function searchExtra(q) {
        q = (q || '').toLowerCase(); if (q.length < 3 || !/(tast|kürzel|kuerzel|shortcut|hilfe)/.test(q)) return [];
        return [{ kind: 'System', title: 'Tastenkürzel anzeigen', sub: 'Alt+? oder F1', icon: 'fa-keyboard', c: '#a5b4fc', run: kbOpen, s: 4 }];
    }

    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        init(api, user) {
            API = api; U = user; e = api.esc; S = api.state();
            wireSnapLayouts(); wireNet();
            window.JMOS_TABTARGET = tabTarget; window.JMOS_TABDROP = tabDrop; window.JMOS_TABACT = activate; window.JMOS_ONCLOSE = onClose; window.JMOS_KEYS_HELP = kbOpen;
            API.keys.push(keys);
            (window.JMOS_SEARCH_EXTRA = window.JMOS_SEARCH_EXTRA || []).push(searchExtra);
            setTimeout(restoreGroups, 0);       // nach dem Wiederherstellen der Fenster
        },
    });
})();
