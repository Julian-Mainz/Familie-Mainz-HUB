// OS/os.js – J.Mainz OS: Desktop, Fenster, Taskleiste und Startmenü im Stil des Dashboards.
// Die Apps sind die normalen Seiten des Dashboards, geladen in Fenstern (iframe, gleiche Domain, gleiche Anmeldung).
// Am Dashboard selbst wird nichts verändert: Die Seitenleiste der Seiten wird nur innerhalb der Fenster per CSS ausgeblendet.
// Alles, was das OS sich merkt (Symbole, offene Fenster, Hintergrund, Notizen), liegt im Browser (localStorage) je Person.
(function () {
    'use strict';

    // ---------- Apps ----------
    const GAMES = [
        { id: 'kolonie', name: 'Sternenkolonie', url: '/Kolonie/', icon: 'fa-rocket', c: '#a78bfa' },
        { id: 'ballon', name: 'Ballon-Alarm', url: '/Ballon/', icon: 'fa-bullseye', c: '#34d399' },
        { id: 'keks', name: 'Keks-Fabrik', url: '/Keks/', icon: 'fa-cookie-bite', c: '#f59e0b' },
        { id: 'buero', name: 'Büro-Imperium', url: '/Buero/', icon: 'fa-building', c: '#38bdf8' },
    ];
    const NATIVE = [
        { id: 'notizen', name: 'Notizblock', icon: 'fa-note-sticky', c: '#facc15', native: 'pad', w: 620, h: 480 },
        { id: 'rechner', name: 'Rechner', icon: 'fa-calculator', c: '#64748b', native: 'calc', w: 340, h: 500, noMax: true },
        { id: 'einstellungen', name: 'Einstellungen', icon: 'fa-gear', c: '#6366f1', native: 'set', w: 1060, h: 720 },
        { id: 'info', name: 'Über J.Mainz OS', icon: 'fa-circle-info', c: '#8b5cf6', native: 'about', w: 460, h: 380, hidden: true },
    ];
    const FOLDER = { id: 'spiele', name: 'Spiele', icon: 'fa-gamepad', folder: true, items: ['gamecenter', 'kolonie', 'ballon', 'keks', 'buero'], w: 560, h: 380 };

    let USER = null, APPS = {}, ORDER = [], WEBSET = [];
    const slug = href => href.replace(/^\/|\/$|\.html$/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'start';

    function buildApps(user) {
        APPS = {}; ORDER = []; WEBSET = [];
        const add = (a, list) => { APPS[a.id] = a; if (list) list.push(a.id); };
        (typeof DRAWER_LINKS !== 'undefined' ? DRAWER_LINKS : []).forEach(l => {
            if (l.href.startsWith('/OS')) return;
            if (l.perm && !can(user, l.perm)) return;
            if (l.admin && !isAdmin(user)) return;
            add({ id: slug(l.href), name: l.label, icon: l.icon, c: l.c, url: l.href }, ORDER);
        });
        const webOk = typeof can === 'function' && can(user, 'webapps');
        if (webOk) {
            (typeof WEB_APPS !== 'undefined' ? WEB_APPS : []).forEach(w => add({ id: w.href === '/Spiele/' ? 'gamecenter' : slug(w.href), name: w.label, icon: w.icon, c: w.c, url: w.href }, WEBSET));
            GAMES.forEach(g => add(g, WEBSET));
            add({ ...FOLDER, items: FOLDER.items.filter(i => APPS[i]) });
        }
        NATIVE.forEach(n => add(n, n.hidden ? null : ORDER));
        (window.JMOS_EXT || []).forEach(x => (x.apps || []).forEach(a => { if ((!a.perm || can(user, a.perm)) && (!a.admin || isAdmin(user))) add(a, a.hidden ? null : (a.web ? WEBSET : ORDER)); }));
    }
    const appByPath = path => {
        const p = path.replace(/index\.html$/, '');
        return Object.values(APPS).find(a => a.url && (a.url === p || a.url === path || (a.url.endsWith('/') && p.startsWith(a.url))));
    };

    // ---------- Gespeicherter Zustand: im Profil (users/{uid}.userPrefs.os), damit er auf allen Geräten gleich ist ----------
    // Zusätzlich im Browser als Zwischenstand. Ins Profil wird gebündelt geschrieben (höchstens alle paar Sekunden).
    let KEY = 'jmos-v1', S = { icons: {}, wins: [], wall: 'weltall', linkWin: true };
    function load(user) {
        let local = null; try { local = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
        const prof = user.userPrefs && user.userPrefs.os;
        Object.assign(S, prof && typeof prof === 'object' ? prof : (local || {}));
        if (S.notes === undefined) { try { const n = localStorage.getItem(KEY + '-notes'); if (n) S.notes = n; } catch (e) {} }   // alte Notizen übernehmen
    }
    let saveT = 0, cloudT = 0, dirty = false;
    const snapshot = () => { S.wins = WINS.filter(w => !w.closing && !w.params && !w.app.noRestore).map(w => ({ app: w.app.id, x: w.x, y: w.y, w: w.w, h: w.h, max: w.max, min: w.min, url: w.url, desk: w.desk, grp: w.grp || null, tabAway: !!w.tabAway })); return JSON.parse(JSON.stringify(S)); };
    function cloud() {
        clearTimeout(cloudT); if (!dirty || !USER) return; dirty = false;
        db.collection('users').doc(USER.uid).update({ 'userPrefs.os': snapshot() }).catch(() => { dirty = true; });
    }
    const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch (e) {} dirty = true; clearTimeout(cloudT); cloudT = setTimeout(cloud, 2500); }, 250); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(saveT); if (USER) { try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch (e) {} dirty = true; cloud(); } } });

    const $ = id => document.getElementById(id);
    const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const tile = (a, cls = '') => a.folder ? `<span class="ico-t folder ${cls}"><i class="fa-solid fa-folder"></i></span>` : a.thumb ? `<span class="ico-t thumb ${cls}"><img src="${a.thumb}" alt=""></span>` : `<span class="ico-t ${cls}${a.file ? ' file' : ''}" style="--c:${a.c}"><i class="fa-solid ${a.icon}"></i></span>`;
    const deskH = () => window.innerHeight - parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bar-h'));

    // Leistungsmodus: ohne Glas-Unschärfe und mit ruhigerem Hintergrund. „Automatisch“ = an in Firefox (dort ist die Unschärfe sehr teuer). Pro Gerät gespeichert.
    const FF = /firefox/i.test(navigator.userAgent); if (FF) document.documentElement.classList.add('ff');
    window.JMOS_PERF = {
        get() { try { return localStorage.getItem('jmos-perf') || 'auto'; } catch (x) { return 'auto'; } },
        on() { const v = this.get(); return v === 'on' || (v === 'auto' && FF); },
        set(v) { try { localStorage.setItem('jmos-perf', v); } catch (x) {} this.apply(); },
        apply() { const on = this.on(); document.documentElement.classList.toggle('perf', on); WINS.forEach(w => { try { w.frame && w.frame.contentDocument.documentElement.classList.toggle('jmos-perf', on); } catch (x) {} }); document.dispatchEvent(new Event('jmos-perf')); },
    };
    document.documentElement.classList.toggle('perf', JMOS_PERF.on());
    // ---------- Sternenhimmel ----------
    function stars() {
        const cv = $('stars'), cx = cv.getContext('2d'); let pts = [], raf = 0;
        const size = () => {
            const d = Math.min(2, window.devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0);
            pts = Array.from({ length: Math.round(innerWidth * innerHeight / 3800) }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * 1.2 + .2, a: Math.random(), s: Math.random() * .015 + .003, p: Math.random() * 6.3 }));
        };
        const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
        let lastD = -1e9;
        const draw = t => {
            const still = calm || JMOS_PERF.on();          // Leistungsmodus: Sterne einmal zeichnen, kein Funkeln
            if (t && (t - lastD < 66 || document.body.classList.contains('dragging'))) { if (!still && !document.hidden) raf = requestAnimationFrame(draw); return; }   // Funkeln ist langsam: ~15 Bilder/s reichen, beim Ziehen Pause
            lastD = t;
            cx.clearRect(0, 0, innerWidth, innerHeight);
            for (const p of pts) { const a = calm ? p.a : .35 + .65 * Math.abs(Math.sin(p.p + t * p.s * .06)); cx.globalAlpha = a; cx.fillStyle = p.r > 1.1 ? '#c7d2fe' : '#fff'; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill(); }
            if (!still && !document.hidden) raf = requestAnimationFrame(draw);
        };
        size(); draw(0);
        addEventListener('resize', () => { cancelAnimationFrame(raf); size(); draw(performance.now()); });
        document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); if (!document.hidden) draw(performance.now()); });
        document.addEventListener('jmos-perf', () => { cancelAnimationFrame(raf); lastD = -1e9; draw(performance.now()); });
    }
    const setWall = w => { S.wall = w; document.documentElement.dataset.wall = w; save(); };

    // ---------- Desktop-Symbole ----------
    const ICS = { s: [88, 92], m: [104, 108], l: [124, 130] }, PAD = 12;
    let CW = 104, CH = 108;
    const rows = () => Math.max(1, Math.floor((deskH() - PAD) / CH));
    const cols = () => Math.max(1, Math.floor((innerWidth - PAD) / CW));
    const deskHidden = () => (S.deskHide = Array.isArray(S.deskHide) ? S.deskHide : []);
    const deskApps = () => [...[...ORDER.filter(id => !APPS[id].hidden && !APPS[id].noDesk), ...(APPS.spiele ? ['spiele'] : [])].filter(id => !deskHidden().includes(id)), ...(() => { try { return window.JMOS_DESK_EXTRA ? JMOS_DESK_EXTRA() : []; } catch (x) { return []; } })().filter(id => APPS[id])];
    function placeIcons() {
        const taken = new Set(), R = rows(), C = cols(), ids = deskApps();
        ids.forEach(id => { const p = S.icons[id]; if (p && p.c < C && p.r < R && !taken.has(p.c + ',' + p.r)) taken.add(p.c + ',' + p.r); else delete S.icons[id]; });
        ids.forEach(id => { if (S.icons[id]) return; for (let i = 0; ; i++) { const c = Math.floor(i / R), r = i % R; if (!taken.has(c + ',' + r) || i > 400) { S.icons[id] = { c, r }; taken.add(c + ',' + r); break; } } });
    }
    function renderIcons() {
        [CW, CH] = ICS[S.iconSize] || ICS.m; document.documentElement.dataset.icons = S.iconSize || 'm';
        placeIcons();
        $('icons').innerHTML = deskApps().map(id => { const a = APPS[id], p = S.icons[id];
            return `<button type="button" class="ico" role="option" data-id="${id}" style="left:${PAD + p.c * CW}px;top:${PAD + p.r * CH}px" title="${e(a.name)}${a.url ? ' – ' + e(a.url) : ''}">${tile(a)}<span class="ico-l">${e(a.name)}</span></button>`; }).join('');
    }
    function arrangeIcons() { S.icons = {}; renderIcons(); save(); }
    // Symbole vom Desktop entfernen: Apps werden ausgeblendet (im Startmenü bleiben sie), Dateien und Ordner nur vom Desktop genommen
    function removeIcons(ids) {
        ids.forEach(id => { if (id.startsWith('file:')) { if (window.JMOS_FILES && JMOS_FILES.unDesk) JMOS_FILES.unDesk(id.slice(5)); } else if (!deskHidden().includes(id)) deskHidden().push(id); delete S.icons[id]; });
        renderIcons(); save();
    }
    const onDeskIcon = id => !deskHidden().includes(id);
    function toggleDeskIcon(id) { if (onDeskIcon(id)) removeIcons([id]); else { S.deskHide = deskHidden().filter(x => x !== id); renderIcons(); save(); } }
    function wireIcons() {
        const box = $('icons'); let drag = null;
        const sel = (ids, add) => box.querySelectorAll('.ico').forEach(el => el.classList.toggle('sel', !!(ids.includes(el.dataset.id) || (add && el.classList.contains('sel')))));
        box.addEventListener('pointerdown', ev => {
            const el = ev.target.closest('.ico'); if (!el || ev.button > 0) return;
            closePops();
            if (!el.classList.contains('sel')) sel([el.dataset.id], ev.ctrlKey);
            drag = { el, id: el.dataset.id, sx: ev.clientX, sy: ev.clientY, ox: el.offsetLeft, oy: el.offsetTop, moved: false, type: ev.pointerType };
            el.setPointerCapture(ev.pointerId);
        });
        box.addEventListener('pointermove', ev => {
            if (!drag) return; const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
            if (!drag.moved && Math.hypot(dx, dy) < 5) return;
            drag.moved = true; drag.el.classList.add('dragging');
            drag.el.style.left = drag.ox + dx + 'px'; drag.el.style.top = drag.oy + dy + 'px';
            const rc = drag.el.getBoundingClientRect(), fo = document.elementsFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2).map(n => n.closest && n.closest('.ico')).find(n => n && n !== drag.el && /^file:dir:/.test(n.dataset.id));
            box.querySelectorAll('.ico.drop-on').forEach(x => x !== fo && x.classList.remove('drop-on')); if (fo) fo.classList.add('drop-on');
        });
        box.addEventListener('pointerup', () => {
            if (!drag) return; const d = drag; drag = null; d.el.classList.remove('dragging'); box.querySelectorAll('.ico.drop-on').forEach(x => x.classList.remove('drop-on'));
            if (!d.moved) { if (d.type === 'touch') openApp(d.id); return; }
            const rc = d.el.getBoundingClientRect(), tgt = document.elementsFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2).map(n => n.closest && n.closest('.ico')).find(n => n && n !== d.el);
            if (tgt && window.JMOS_DESK_DROP) { const ids = d.el.classList.contains('sel') ? [...box.querySelectorAll('.ico.sel')].map(x => x.dataset.id) : [d.id];
                if (JMOS_DESK_DROP(ids, tgt.dataset.id)) { renderIcons(); return; } }
            const c = Math.max(0, Math.min(cols() - 1, Math.round((d.el.offsetLeft - PAD) / CW))), r = Math.max(0, Math.min(rows() - 1, Math.round((d.el.offsetTop - PAD) / CH)));
            const other = Object.keys(S.icons).find(k => k !== d.id && S.icons[k].c === c && S.icons[k].r === r);
            if (other) S.icons[other] = { ...S.icons[d.id] };              // Platz besetzt: tauschen
            S.icons[d.id] = { c, r }; renderIcons(); sel([d.id]); save();
        });
        box.addEventListener('dblclick', ev => { const el = ev.target.closest('.ico'); if (el) openApp(el.dataset.id); });
        box.addEventListener('keydown', ev => { const el = ev.target.closest('.ico'); if (el && ev.key === 'Enter') { ev.preventDefault(); openApp(el.dataset.id); }
            if (el && ev.key === 'Delete') { ev.preventDefault(); const ids = [...box.querySelectorAll('.ico.sel')].map(x => x.dataset.id); removeIcons(ids.length ? ids : [el.dataset.id]); } });
        // Rahmen aufziehen zum Markieren
        const desk = $('desk'), sb = $('select-box'); let m = null;
        desk.addEventListener('pointerdown', ev => {
            if (ev.target.closest('.ico, .wg') || ev.button > 0) return; closePops(); sel([]);
            m = { x: ev.clientX, y: ev.clientY }; desk.setPointerCapture(ev.pointerId);
        });
        desk.addEventListener('pointermove', ev => {
            if (!m) return; const x = Math.min(m.x, ev.clientX), y = Math.min(m.y, ev.clientY), w = Math.abs(ev.clientX - m.x), h = Math.abs(ev.clientY - m.y);
            if (w + h < 6) return; sb.hidden = false; Object.assign(sb.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
            const ids = [...box.querySelectorAll('.ico')].filter(el => { const r = el.getBoundingClientRect(); return r.right > x && r.left < x + w && r.bottom > y && r.top < y + h; }).map(el => el.dataset.id);
            sel(ids);
        });
        desk.addEventListener('pointerup', () => { m = null; sb.hidden = true; });
        desk.addEventListener('contextmenu', ev => {
            if (ev.target.closest('.wg')) { if (!ev.target.closest('input, textarea')) ev.preventDefault(); return; }
            ev.preventDefault(); const el = ev.target.closest('.ico');
            if (el) { const a = APPS[el.dataset.id]; sel([a.id]);
                if (a.ctx) return ctx(ev.clientX, ev.clientY, a.ctx());
                const selIds = [...box.querySelectorAll('.ico.sel')].map(x => x.dataset.id);
                return ctx(ev.clientX, ev.clientY, [['fa-up-right-from-square', 'Öffnen', () => openApp(a.id)], !a.folder && ['fa-thumbtack', isPinned(a.id) ? 'Von Taskleiste lösen' : 'An Taskleiste anheften', () => togglePin(a.id)], a.url && ['fa-arrow-up-right-from-square', 'In neuem Browser-Tab öffnen', () => window.open(a.url, '_blank', 'noopener')], null,
                    selIds.length > 1 ? ['fa-eye-slash', `${selIds.length} Symbole vom Desktop entfernen`, () => removeIcons(selIds)] : ['fa-eye-slash', 'Vom Desktop entfernen', () => removeIcons([a.id])]]); }
            ctx(ev.clientX, ev.clientY, [
                ['fa-plus', 'Widgets hinzufügen', () => JMOS_WIDGETS.picker()],
                ['fa-table-cells-large', 'Symbole automatisch anordnen', arrangeIcons],
                ['fa-rotate-right', 'Aktualisieren', () => { renderIcons(); }], null,
                ['fa-image', 'Hintergrund ändern', () => openApp('einstellungen')],
                window.JMOS_FILES && JMOS_FILES.newDeskFolder && can(USER, 'dokumente') && ['fa-folder-plus', 'Neuer Ordner', () => JMOS_FILES.newDeskFolder()],
                ['fa-note-sticky', 'Neue Notiz', () => openApp('notizen')], window.JMOS_WRITER && can(USER, 'dokumente') && ['fa-file-word', 'Neues Word-Dokument', () => JMOS_WRITER.create('')], window.JMOS_CALC && can(USER, 'dokumente') && ['fa-file-excel', 'Neue Tabelle', () => JMOS_CALC.create('')], window.JMOS_SLIDES && can(USER, 'dokumente') && ['fa-file-powerpoint', 'Neue Präsentation', () => JMOS_SLIDES.create('')], window.JMOS_EDITOR && JMOS_EDITOR.ok() && ['fa-file-lines', 'Neues Textdokument', () => JMOS_EDITOR.newOnDesk()], null,
                ['fa-circle-info', 'Über J.Mainz OS', () => openApp('info')],
            ]);
        });
        addEventListener('resize', () => { clearTimeout(wireIcons.t); wireIcons.t = setTimeout(renderIcons, 150); });
    }

    // ---------- Fenster ----------
    const WINS = [], API = {}; let zTop = 20, seq = 0;
    const EMBED_CSS = `#sb, #sb-backdrop, #tabbar { display: none !important; }
        body.has-sb { padding-left: 18px !important; padding-bottom: 18px !important; }
        header button[onclick^="toggleSideMenu"], header button[onclick^="handleLogout"] { display: none !important; }`;
    const area = () => ({ w: innerWidth, h: deskH() });

    function openApp(id, o = {}) {
        const a = APPS[id]; if (!a) return;
        if (a.run) { closePops(); return a.run(o); }
        closePops();
        const key = o.key || '';
        const ex = WINS.find(w => w.app.id === id && (w.key || '') === key && !w.closing);
        if (ex && !o.restore) {
            if (ex.tabAway && window.JMOS_TABACT) JMOS_TABACT(ex); else if (!onDesk(ex)) switchDesk(ex.desk);
            if (ex.min) toggleMin(ex, false); focus(ex);
            if (o.url && ex.frame && ex.url !== o.url) { ex.url = o.url; ex.frame.src = o.url; }          // z. B. Finanzen direkt auf "Rechnungen"
            if (o.params && ex.onParams) ex.onParams(o.params);
            return ex;
        }
        const ar = area(), n = WINS.length % 8;
        const w = Math.min(a.w || 1180, ar.w - 120), h = Math.min(a.h || 760, ar.h - 70);
        const win = { id: 'w' + (++seq), app: a, key, desk: o.desk || curDesk(), params: o.params, url: o.url || a.url, x: o.x ?? Math.max(10, Math.round((ar.w - w) / 2) - 120 + n * 34), y: o.y ?? Math.max(8, Math.round((ar.h - h) / 2) - 50 + n * 30), w: o.w || w, h: o.h || h, max: !!o.max, min: false, grp: o.grp || null, tabAway: !!o.tabAway };
        win.x = Math.min(Math.max(-win.w + 120, win.x), ar.w - 120); win.y = Math.min(Math.max(0, win.y), ar.h - 40);
        const el = document.createElement('div'); el.className = 'win'; el.id = win.id; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', a.name);
        el.innerHTML = `<div class="wt"><span class="wt-ico${a.folder ? ' folder' : ''}" style="--c:${a.c || '#818cf8'}"><i class="fa-solid ${a.folder ? 'fa-folder' : a.icon}"></i></span><span class="wt-title">${e(o.title || a.name)}</span>
            <div class="wt-btns">${a.url ? '<button type="button" class="wt-b" data-a="pop" title="Als eigenes Fenster herauslösen" aria-label="Als eigenes Fenster herauslösen"><i class="fa-solid fa-window-restore"></i></button>' : ''}${a.url ? '<button type="button" class="wt-b" data-a="tab" title="In neuem Browser-Tab öffnen" aria-label="In neuem Tab öffnen"><i class="fa-solid fa-up-right-from-square"></i></button>' : ''}<button type="button" class="wt-b" data-a="min" title="Minimieren" aria-label="Minimieren"><i class="fa-regular fa-window-minimize"></i></button>${a.noMax ? '' : '<button type="button" class="wt-b" data-a="max" title="Maximieren" aria-label="Maximieren"><i class="fa-regular fa-window-maximize"></i></button>'}<button type="button" class="wt-b x" data-a="close" title="Schließen" aria-label="Schließen"><i class="fa-solid fa-xmark"></i></button></div></div>
            <div class="wb"></div>${['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(d => `<div class="rz ${d}" data-d="${d}"></div>`).join('')}`;
        win.el = el; $('wins').appendChild(el); WINS.push(win);
        if (!a.hidden && !o.restore) S.recent = [id, ...(S.recent || []).filter(x => x !== id)].slice(0, 8);
        fill(win); place(win); focus(win); wireWin(win); renderTasks(); save();
        return win;
    }
    function fill(win) {
        const a = win.app, body = win.el.querySelector('.wb');
        if (a.url) {
            body.innerHTML = `<div class="wb-load">${tile(a)}<span>${e(a.name)} wird geladen …</span></div><iframe title="${e(a.name)}" src="${e(win.url)}" allow="clipboard-write; fullscreen; autoplay"></iframe><div class="shield"></div>`;
            const fr = body.querySelector('iframe'); win.frame = fr;
            fr.addEventListener('load', () => { body.querySelector('.wb-load').classList.add('done'); embed(win); });
        } else if (a.folder) {
            body.innerHTML = `<div class="app-folder">${a.items.map(id => { const x = APPS[id]; return `<button type="button" class="ico" data-id="${id}" title="${e(x.name)}">${tile(x)}<span class="ico-l">${e(x.name)}</span></button>`; }).join('')}</div>`;
            const f = body.firstChild;
            f.addEventListener('dblclick', ev => { const b = ev.target.closest('.ico'); if (b) openApp(b.dataset.id); });
            f.addEventListener('click', ev => { const b = ev.target.closest('.ico'); f.querySelectorAll('.ico').forEach(x => x.classList.toggle('sel', x === b)); if (b && matchMedia('(pointer: coarse)').matches) openApp(b.dataset.id); });
            f.addEventListener('keydown', ev => { const b = ev.target.closest('.ico'); if (b && ev.key === 'Enter') openApp(b.dataset.id); });
        } else NATIVE_UI[a.native](body, win);
    }
    // Seite im Fenster: Seitenleiste ausblenden, Titel übernehmen, Links zu anderen Apps als eigenes Fenster öffnen
    function embed(win) {
        let doc; try { doc = win.frame.contentDocument; } catch (x) { return; }
        if (!doc || !doc.head) return;
        if (!doc.getElementById('jmos-embed')) { const st = doc.createElement('style'); st.id = 'jmos-embed'; st.textContent = EMBED_CSS + ' html.jmos-perf #space-bg i, html.jmos-perf #space-bg b { animation: none !important; display: none; } html.jmos-perf * { backdrop-filter: none !important; }'; doc.head.appendChild(st); }
        doc.documentElement.classList.toggle('jmos-perf', JMOS_PERF.on());
        const path = win.frame.contentWindow.location.pathname, now = appByPath(path);
        win.url = path + win.frame.contentWindow.location.search + win.frame.contentWindow.location.hash;
        if (now && now.id !== win.app.id && !WINS.some(w => w !== win && w.app.id === now.id)) {    // Seite hat innerhalb des Fensters gewechselt
            win.app = now; win.el.querySelector('.wt-ico').style.setProperty('--c', now.c); win.el.querySelector('.wt-ico i').className = 'fa-solid ' + now.icon;
        }
        const t = (doc.title || win.app.name).replace(/\s*[–-]\s*J\.Mainz.*$/i, '').trim();
        win.el.querySelector('.wt-title').textContent = t || win.app.name; renderTasks(); save();
        doc.addEventListener('pointerdown', () => focus(win), true);
        (window.JMOS_EMBED_HOOKS || []).forEach(f => { try { f(doc, win); } catch (x) {} });
        doc.addEventListener('keydown', ev => { if ((ev.ctrlKey && (ev.code === 'Space' || ev.key === ' ')) || ev.altKey) { if (onKeys(ev)) { ev.stopPropagation(); window.focus(); } } }, true);
        doc.addEventListener('click', ev => {
            if (!S.linkWin || ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
            const ln = ev.target.closest && ev.target.closest('a[href]'); if (!ln || (ln.target && ln.target !== '_self')) return;
            let u; try { u = new URL(ln.href, win.frame.contentWindow.location.href); } catch (x) { return; }
            if (u.origin !== location.origin || u.pathname.startsWith('/OS')) return;
            const tgt = appByPath(u.pathname);
            if (tgt && tgt.id !== win.app.id) { ev.preventDefault(); const w2 = openApp(tgt.id); if (w2 && w2.frame && (u.hash || u.search) && w2.url !== u.pathname + u.search + u.hash) { w2.url = u.pathname + u.search + u.hash; w2.frame.src = w2.url; } }
        }, true);
    }
    function place(win) {
        const el = win.el, ar = area();
        if (win.max) Object.assign(el.style, { left: '0px', top: '0px', width: ar.w + 'px', height: ar.h + 'px' });
        else Object.assign(el.style, { left: win.x + 'px', top: win.y + 'px', width: win.w + 'px', height: win.h + 'px' });
        el.classList.toggle('max', win.max); el.classList.toggle('min', win.min);
        const mb = el.querySelector('[data-a="max"]'); if (mb) { mb.innerHTML = `<i class="fa-regular ${win.max ? 'fa-window-restore' : 'fa-window-maximize'}"></i>`; mb.title = win.max ? 'Verkleinern' : 'Maximieren'; }
    }
    function animate(win, fn) { win.el.classList.add('anim'); fn(); setTimeout(() => win.el.classList.remove('anim'), 260); }
    function focus(win) {
        if (!win || win.closing) return;
        if (!win.el.classList.contains('focus') || +win.el.style.zIndex !== zTop) win.el.style.zIndex = ++zTop;
        WINS.forEach(w => w.el.classList.toggle('focus', w === win));
        document.title = win.el.querySelector('.wt-title').textContent + ' – J.Mainz OS';
        renderTasks();
    }
    const topWin = () => WINS.filter(w => !w.min && !w.closing && onDesk(w)).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
    // ---------- Mehrere Desktops: Fenster, Widgets und Hintergrund je Desktop, Symbole gemeinsam ----------
    const curDesk = () => S.desk || 'd1';
    const onDesk = w => (w.desk || 'd1') === curDesk() && !w.tabAway;          // Fenster in einer Tab-Gruppe, die gerade nicht vorne sind, zählen nicht
    const desks = () => (Array.isArray(S.desks) && S.desks.length ? S.desks : (S.desks = [{ id: 'd1', name: 'Desktop 1' }]));
    function switchDesk(id) {
        if (!desks().some(d => d.id === id) || id === curDesk()) return;
        S.deskData = S.deskData || {}; S.deskData[curDesk()] = { widgets: S.widgets || [], wall: S.wall };
        S.desk = id; const d = S.deskData[id] || {};
        S.widgets = Array.isArray(d.widgets) ? d.widgets : []; if (d.wall) { S.wall = d.wall; document.documentElement.dataset.wall = d.wall; }
        WINS.forEach(w => w.el.classList.toggle('away', !onDesk(w)));
        if (window.JMOS_WIDGETS) JMOS_WIDGETS.render();
        const t = topWin(); if (t) focus(t); else { WINS.forEach(w => w.el.classList.remove('focus')); document.title = 'J.Mainz OS'; }
        renderTasks(); save(); (window.JMOS_DESK_HOOKS || []).forEach(f => { try { f(id); } catch (x) {} });
    }
    function moveToDesk(win, id) { win.desk = id; win.el.classList.toggle('away', !onDesk(win)); if (!onDesk(win)) { win.el.classList.remove('focus'); const t = topWin(); if (t) focus(t); } renderTasks(); save(); }
    function toggleMin(win, on = !win.min) { win.min = on; place(win); if (on) { win.el.classList.remove('focus'); const t = topWin(); if (t) focus(t); else document.title = 'J.Mainz OS'; } else focus(win); renderTasks(); save(); }
    function toggleMax(win, on = !win.max) { if (win.app.noMax) return; animate(win, () => { win.max = on; place(win); }); save(); }
    function closeWin(win, force) {
        if (win.closing) return;
        if (!force && win.beforeClose) { const msg = win.beforeClose(); if (msg) { focus(win); uiConfirm(msg, { ok: 'Ohne Speichern schließen', danger: true, title: win.app.name }).then(ok => { if (ok) closeWin(win, true); }); return; } }   // z. B. Texteditor mit ungespeicherten Änderungen
        win.closing = true; win.el.classList.add('closing'); try { win.onClose && win.onClose(); } catch (x) {} try { window.JMOS_ONCLOSE && JMOS_ONCLOSE(win); } catch (x) {}
        setTimeout(() => { win.el.remove(); WINS.splice(WINS.indexOf(win), 1); const t = topWin(); if (t) focus(t); else document.title = 'J.Mainz OS'; renderTasks(); save(); }, 170);
        renderTasks();
    }
    function wireWin(win) {
        const el = win.el, bar = el.querySelector('.wt');
        el.addEventListener('pointerdown', () => focus(win), true);
        el.querySelector('.wt-btns').addEventListener('click', ev => {
            const b = ev.target.closest('[data-a]'); if (!b) return;
            ({ min: () => toggleMin(win, true), max: () => toggleMax(win), close: () => closeWin(win), tab: () => window.open(win.url || win.app.url, '_blank', 'noopener'), pop: () => popOut(win) })[b.dataset.a]();
        });
        bar.addEventListener('dblclick', ev => { if (!ev.target.closest('.wt-btns')) toggleMax(win); });
        // Verschieben (mit Andocken: oben = Vollbild, links/rechts = halber Bildschirm)
        bar.addEventListener('pointerdown', ev => {
            if (ev.target.closest('.wt-btns') || ev.button > 0 || innerWidth <= 760) return;
            ev.preventDefault(); bar.setPointerCapture(ev.pointerId);
            const ar = area(); let sx = ev.clientX, sy = ev.clientY, ox = win.x, oy = win.y, moved = false, snap = null, tabT = null, last = null, fr = 0, bx = 0, by = 0;
            const mv = m => { last = m; if (!fr) fr = requestAnimationFrame(step); };
            const step = () => { fr = 0; const m = last; if (!m) return;
                const dx = m.clientX - sx, dy = m.clientY - sy;
                if (!moved && Math.hypot(dx, dy) < 4) return;
                if (!moved) { moved = true; document.body.classList.add('dragging');
                    if (win.max) { const rel = (m.clientX) / ar.w; win.max = false; win.x = Math.round(m.clientX - win.w * rel); win.y = 0; ox = win.x; oy = win.y; sx = m.clientX; sy = m.clientY; place(win); }
                    bx = win.x; by = win.y; el.classList.add('mv'); }
                win.x = ox + (m.clientX - sx); win.y = Math.max(0, Math.min(ar.h - 40, oy + (m.clientY - sy)));
                el.style.transform = `translate3d(${win.x - bx}px, ${win.y - by}px, 0)`;            // nur verschieben, kein neues Layout
                const L = m.clientX <= 2, R = m.clientX >= innerWidth - 3, T = m.clientY <= 2, C = 80, ah = deskH();
                snap = (L || m.clientX < C) && T ? 'tl' : (R || m.clientX > innerWidth - C) && T ? 'tr' : L && m.clientY < C ? 'tl' : R && m.clientY < C ? 'tr' : L && m.clientY > ah - C ? 'bl' : R && m.clientY > ah - C ? 'br' : T ? 'max' : L ? 'l' : R ? 'r' : null;
                tabT = window.JMOS_TABTARGET ? JMOS_TABTARGET(win, m.clientX, m.clientY) : null; if (tabT) snap = null;          // auf die Titelleiste eines anderen Fensters = als Tab einfügen
                showSnap(snap);
            };
            const up = () => {
                bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
                if (fr) { cancelAnimationFrame(fr); step(); }
                if (moved) { el.style.transform = ''; el.style.left = win.x + 'px'; el.style.top = win.y + 'px'; el.classList.remove('mv'); }
                document.body.classList.remove('dragging'); showSnap(null);
                if (window.JMOS_TABDROP) JMOS_TABDROP(win, tabT);
                if (tabT) { /* als Tab eingefügt */ }
                else if (snap === 'max') toggleMax(win, true);
                else if (snap) { snapTo(win, snap); if (window.JMOS_SNAPPED) JMOS_SNAPPED(win, snap); }
                if (moved) save();
            };
            bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
        });
        // Größe ändern
        el.querySelectorAll('.rz').forEach(h => h.addEventListener('pointerdown', ev => {
            ev.preventDefault(); ev.stopPropagation(); h.setPointerCapture(ev.pointerId); document.body.classList.add('dragging');
            const d = h.dataset.d, s = { x: ev.clientX, y: ev.clientY, l: win.x, t: win.y, w: win.w, h: win.h }, MW = 320, MH = 220;
            let last = null, fr = 0;
            const mv = m => { last = m; if (!fr) fr = requestAnimationFrame(() => { fr = 0; step(last); }); };
            const step = m => {
                const dx = m.clientX - s.x, dy = m.clientY - s.y;
                if (d.includes('e')) win.w = Math.max(MW, s.w + dx);
                if (d.includes('s')) win.h = Math.max(MH, s.h + dy);
                if (d.includes('w')) { win.w = Math.max(MW, s.w - dx); win.x = s.l + s.w - win.w; }
                if (d.includes('n')) { win.h = Math.max(MH, s.h - dy); win.y = Math.max(0, s.t + s.h - win.h); if (s.t + s.h - win.h < 0) win.h = s.t + s.h; }
                place(win);
            };
            const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); if (fr) { cancelAnimationFrame(fr); fr = 0; if (last) step(last); } document.body.classList.remove('dragging'); save(); };
            h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up);
        }));
    }
    // Bereiche zum Andocken: Hälften und Viertel
    function snapRect(s) {
        const ar = area(), hw = Math.round(ar.w / 2), hh = Math.round(ar.h / 2);
        const t1 = Math.round(ar.w / 3), t2 = Math.round(ar.w * 2 / 3);
        return { l: [0, 0, hw, ar.h], r: [hw, 0, ar.w - hw, ar.h], l13: [0, 0, t1, ar.h], c13: [t1, 0, t2 - t1, ar.h], r13: [t2, 0, ar.w - t2, ar.h], l23: [0, 0, t2, ar.h], r23: [t1, 0, ar.w - t1, ar.h], tl: [0, 0, hw, hh], tr: [hw, 0, ar.w - hw, hh], bl: [0, hh, hw, ar.h - hh], br: [hw, hh, ar.w - hw, ar.h - hh] }[s];
    }
    function snapTo(win, s) {
        if (s === 'max') return toggleMax(win, true);
        const r = snapRect(s); if (!r) return;
        animate(win, () => { win.max = false; Object.assign(win, { x: r[0], y: r[1], w: r[2], h: r[3], snap: s }); place(win); }); save();
    }
    function showSnap(s) {
        const sn = $('snap'), ar = area();
        if (!s) { sn.hidden = true; return; }
        const q = s === 'max' ? [0, 0, ar.w, ar.h] : snapRect(s), r = [q[0] + 8, q[1] + 8, q[2] - 16, q[3] - 16];
        Object.assign(sn.style, { left: r[0] + 'px', top: r[1] + 'px', width: r[2] + 'px', height: r[3] + 'px' }); sn.hidden = false;
    }
    // Klick in eine Seite im Fenster: das Fenster kommt nach vorne
    addEventListener('blur', () => setTimeout(() => { const f = document.activeElement; if (f && f.tagName === 'IFRAME') { const w = WINS.find(x => x.frame === f); if (w) focus(w); } closePops(); }, 0));
    addEventListener('resize', () => WINS.forEach(w => { if (w.max) place(w); }));

    // ---------- Taskleiste ----------
    // Taskleiste: zuerst angeheftete Apps (mit ihren Fenstern), danach alle anderen offenen Fenster
    const pins = () => (S.pinned || []).filter(id => APPS[id]);
    const isPinned = id => pins().includes(id);
    function togglePin(id) { S.pinned = isPinned(id) ? pins().filter(x => x !== id) : [...pins(), id]; renderTasks(); save(); }
    function renderTasks() {
        const t = topWin(), open = WINS.filter(w => !w.closing && onDesk(w)), used = new Set();
        const winBtn = w => { used.add(w); const ttl = w.el.querySelector('.wt-title').textContent;
            return `<button type="button" class="task${w === t && !w.min && w.el.classList.contains('focus') ? ' on' : ''}${w.min ? ' mini' : ''}${isPinned(w.app.id) ? ' pinned' : ''}" data-w="${w.id}" title="${e(ttl)}"><span class="wt-ico${w.app.folder ? ' folder' : ''}" style="--c:${w.app.c || '#818cf8'}"><i class="fa-solid ${w.app.folder ? 'fa-folder' : w.app.icon}"></i></span><span>${e(ttl)}</span></button>`; };
        const pinBtn = id => { const a = APPS[id]; return `<button type="button" class="task pin" data-pin="${id}" title="${e(a.name)} öffnen"><span class="wt-ico${a.folder ? ' folder' : ''}" style="--c:${a.c || '#818cf8'}"><i class="fa-solid ${a.folder ? 'fa-folder' : a.icon}"></i></span><span>${e(a.name)}</span></button>`; };
        const html = pins().map(id => { const ws = open.filter(w => w.app.id === id); return ws.length ? ws.map(winBtn).join('') : pinBtn(id); }).join('') + open.filter(w => !used.has(w)).map(winBtn).join('');
        $('tasks').innerHTML = html;
    }
    function wireBar() {
        $('tasks').addEventListener('click', ev => {
            const b = ev.target.closest('.task'); if (!b) return; closePops();
            if (b.dataset.pin) return openApp(b.dataset.pin);
            const w = WINS.find(x => x.id === b.dataset.w);
            if (w.min) toggleMin(w, false); else if (b.classList.contains('on')) toggleMin(w, true); else focus(w);
        });
        $('tasks').addEventListener('contextmenu', ev => {
            const b = ev.target.closest('.task'); if (!b) return; ev.preventDefault();
            if (b.dataset.pin) return ctx(ev.clientX, ev.clientY - 10, [['fa-up-right-from-square', 'Öffnen', () => openApp(b.dataset.pin)], ['fa-thumbtack', 'Von Taskleiste lösen', () => togglePin(b.dataset.pin)]], true);
            const w = WINS.find(x => x.id === b.dataset.w);
            ctx(ev.clientX, ev.clientY - 10, [...desks().filter(d => d.id !== w.desk).map(d => ['fa-clone', 'Verschieben nach „' + d.name + '“', () => moveToDesk(w, d.id)]), desks().length > 1 && null, !w.params && !w.app.hidden && ['fa-thumbtack', isPinned(w.app.id) ? 'Von Taskleiste lösen' : 'An Taskleiste anheften', () => togglePin(w.app.id)], null, [w.min ? 'fa-window-restore' : 'fa-window-minimize', w.min ? 'Wiederherstellen' : 'Minimieren', () => toggleMin(w)], !w.app.noMax && ['fa-window-maximize', w.max ? 'Verkleinern' : 'Maximieren', () => { if (w.min) toggleMin(w, false); toggleMax(w); }], w.app.url && ['fa-window-restore', 'Als eigenes Fenster herauslösen', () => popOut(w)], w.app.url && ['fa-up-right-from-square', 'In neuem Browser-Tab öffnen', () => window.open(w.url || w.app.url, '_blank', 'noopener')], null, ['fa-xmark', 'Fenster schließen', () => closeWin(w)]], true);
        });
        let shown = null;
        $('show-desk').addEventListener('click', () => {
            const open = WINS.filter(w => !w.min && !w.closing && onDesk(w));
            if (open.length) { shown = open.map(w => w.id); open.forEach(w => toggleMin(w, true)); }
            else if (shown) { shown.forEach(id => { const w = WINS.find(x => x.id === id); if (w) toggleMin(w, false); }); shown = null; }
        });
        $('start-btn').addEventListener('click', () => toggleStart());
        $('bar-search').addEventListener('click', () => toggleStart(true));
        $('bar-wg').addEventListener('click', () => JMOS_WIDGETS.picker());
        $('clock').addEventListener('click', () => toggleCal());
        const net = () => { $('net').classList.toggle('off', !navigator.onLine); $('net').title = navigator.onLine ? 'Verbunden' : 'Keine Verbindung'; };
        addEventListener('online', net); addEventListener('offline', net); net();
        const tick = () => { const d = new Date(); $('clk-t').textContent = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); $('clk-d').textContent = d.toLocaleDateString('de-DE');
            if (!$('cal').hidden) $('cal-time').textContent = d.toLocaleTimeString('de-DE'); };
        tick(); setInterval(tick, 1000);
    }

    // ---------- Startmenü ----------
    function toggleStart(on = $('start').hidden) {
        closePops('start'); $('start').hidden = !on; $('start-btn').setAttribute('aria-expanded', on);
        if (on) { $('st-q').value = ''; renderStart(); $('st-q').focus(); setTimeout(() => { if (document.activeElement !== $('st-q')) $('st-q').focus(); }, 30); }
    }
    let RES = [];
    // Startmenü: oben zuletzt geöffnet, darunter alle Apps alphabetisch als Liste (mit Buchstaben wie bei Windows) oder als Raster
    const startView = () => (S.startView === 'grid' ? 'grid' : 'list');
    function renderStart() {
        const raw = $('st-q').value.trim(), q = raw.toLowerCase(), hit = id => !q || APPS[id].name.toLowerCase().includes(q);
        const ids = [...new Set([...ORDER, ...WEBSET])].filter(id => APPS[id] && hit(id)).sort((a, b) => APPS[a].name.localeCompare(APPS[b].name, 'de'));
        const web = new Set(WEBSET), view = startView();
        const row = id => `<button type="button" class="st-app" data-id="${id}">${tile(APPS[id])}<span>${e(APPS[id].name)}</span>${view === 'list' && web.has(id) ? '<em>Web</em>' : ''}</button>`;
        let html = '';
        if (view === 'list' && !q) {
            const groups = {}; ids.forEach(id => { const ch = APPS[id].name[0].toUpperCase(), k = /[A-ZÄÖÜ]/.test(ch) ? ch.replace('Ä', 'A').replace('Ö', 'O').replace('Ü', 'U') : '#'; (groups[k] = groups[k] || []).push(id); });
            html = Object.keys(groups).sort().map(k => `<div class="st-grp" data-l="${k}"><button type="button" class="st-l" data-az title="Zum Buchstaben springen">${k}</button>${groups[k].map(row).join('')}</div>`).join('');
        } else html = ids.map(row).join('');
        const all = $('st-all'); all.className = view === 'list' ? 'st-list' : 'st-grid'; all.innerHTML = html;
        $('start').querySelectorAll('[data-sv]').forEach(b => b.classList.toggle('on', b.dataset.sv === view));
        $('st-all').previousElementSibling.hidden = !ids.length;
        // Suche über alles (Termine, Aufgaben, Dateien … aus OS/extras.js)
        RES = q.length >= 2 && window.JMOS_SEARCH ? JMOS_SEARCH(raw) : [];
        $('st-res').innerHTML = RES.length ? `<div class="st-head"><span>Gefunden</span><small>${RES.length > 30 ? '30+' : RES.length} Treffer</small></div>` + RES.slice(0, 30).map((r, i) => `<button type="button" class="st-r" data-r="${i}"><span class="ic" style="--c:${r.c || '#818cf8'}"><i class="fa-solid ${r.icon}"></i></span><span class="tx"><b>${e(r.title)}</b><small>${e(r.sub || '')}</small></span><em>${e(r.kind || '')}</em></button>`).join('') : '';
        if (window.JMOS_RECENT && !q) $('st-res').innerHTML = JMOS_RECENT();
        $('st-empty').hidden = !!(ids.length + RES.length);
        $('st-count').textContent = q ? `${ids.length} gefunden` : `${ids.length}`;
        closeAz();
        const first = $('start').querySelector('.st-app, .st-r'); if (first && q) first.classList.add('hl');
    }
    // Buchstaben-Übersicht: Klick auf einen Buchstaben zeigt A–Z, Klick darauf springt hin
    function openAz() {
        const have = new Set([...$('st-all').querySelectorAll('.st-grp')].map(g => g.dataset.l)), box = document.createElement('div');
        box.className = 'st-az'; box.innerHTML = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(l => `<button type="button" data-azl="${l}" ${have.has(l) ? '' : 'disabled'}>${l}</button>`).join('');
        $('start').querySelector('.st-body').appendChild(box); $('start').classList.add('az');
        const f = box.querySelector('button:not([disabled])'); if (f) f.focus();
    }
    function closeAz() { const b = $('start').querySelector('.st-az'); if (b) b.remove(); $('start').classList.remove('az'); }
    function wireStart() {
        $('st-q').addEventListener('input', renderStart);
        $('st-q').addEventListener('keydown', ev => {
            const all = [...$('start').querySelectorAll('.st-app, .st-r')], i = all.findIndex(x => x.classList.contains('hl'));
            if (ev.key === 'Enter') { (all[i] || all[0])?.click(); }
            else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); if (!all.length) return; const n = all[(i + (ev.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]; all.forEach(x => x.classList.toggle('hl', x === n)); n.scrollIntoView({ block: 'nearest' }); }
        });
        $('start').addEventListener('click', ev => {
            const sv = ev.target.closest('[data-sv]'); if (sv) { S.startView = sv.dataset.sv; save(); renderStart(); return; }
            if (ev.target.closest('[data-az]')) return openAz();
            const az = ev.target.closest('[data-azl]'); if (az) { const g = $('st-all').querySelector(`.st-grp[data-l="${az.dataset.azl}"]`); closeAz(); if (g) { const body = $('start').querySelector('.st-body'); body.scrollTo({ top: g.offsetTop - 4, behavior: 'smooth' }); } return; }
            const a = ev.target.closest('.st-app'); if (a) return openApp(a.dataset.id);
            const r = ev.target.closest('.st-r'); if (r) { closePops(); const x = r.dataset.recent !== undefined ? (window.JMOS_RECENT_LIST || [])[+r.dataset.recent] : RES[+r.dataset.r]; if (x) x.run(); return; }
            const b = ev.target.closest('[data-act]'); if (!b) return;
            if (b.dataset.act === 'settings') openApp('einstellungen');
            if (b.dataset.act === 'logout') { closePops(); handleLogout(); }
            if (b.dataset.act === 'lock' && window.JMOS_LOCK) { closePops(); JMOS_LOCK(); }
        });
    }

    // ---------- Kalender ----------
    let calM = null;
    function toggleCal(on = $('cal').hidden) { closePops('cal'); $('cal').hidden = !on; $('clock').setAttribute('aria-expanded', on); if (on) { calM = new Date(); calM.setDate(1); renderCal(); } }
    function renderCal() {
        const d = new Date(); $('cal-time').textContent = d.toLocaleTimeString('de-DE'); $('cal-date').textContent = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        $('cal-title').textContent = calM.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
        const start = new Date(calM); start.setDate(1 - ((calM.getDay() + 6) % 7));
        let h = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(x => `<span class="h">${x}</span>`).join('');
        for (let i = 0; i < 42; i++) { const x = new Date(start); x.setDate(start.getDate() + i);
            h += `<span class="d${x.getMonth() !== calM.getMonth() ? ' o' : ''}${x.toDateString() === d.toDateString() ? ' t' : ''}${i % 7 > 4 ? ' we' : ''}">${x.getDate()}</span>`; }
        $('cal-grid').innerHTML = h;
    }
    $('cal').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (b) { calM.setMonth(calM.getMonth() + +b.dataset.m); renderCal(); } });

    // ---------- Kontextmenü und Aufklapper ----------
    // Fenster herauslösen: öffnet die Seite als eigenes Browserfenster an gleicher Stelle und schließt das OS-Fenster
    function popOut(win) {
        const url = win.url || win.app.url; if (!url) return false;
        const r = win.el.getBoundingClientRect(), top = (window.screenY || 0) + (outerHeight - innerHeight) + r.top, left = (window.screenX || 0) + r.left;
        const w = window.open(url, 'jmos_' + win.app.id + '_' + Date.now(), `popup=yes,width=${Math.round(r.width)},height=${Math.round(r.height)},left=${Math.round(left)},top=${Math.round(top)}`);
        if (!w) { if (typeof uiAlert === 'function') uiAlert('Der Browser hat das Fenster blockiert. Bitte Pop-ups für diese Seite erlauben.'); return false; }
        closeWin(win); return true;
    }
    function ctx(x, y, items, above) {
        const m = $('ctx');
        m.innerHTML = items.filter(i => i !== false && i !== undefined && i !== '').map(i => i === null ? '<div class="cx-sep"></div>' : `<button type="button" class="cx" role="menuitem"><i class="${/window-/.test(i[0]) ? 'fa-regular' : 'fa-solid'} ${i[0]}"></i>${e(i[1])}</button>`).join('');
        const fns = items.filter(i => i); m.querySelectorAll('.cx').forEach((b, k) => b.addEventListener('click', () => { closePops(); fns[k][2](); }));
        closePops('ctx'); m.hidden = false;
        const r = m.getBoundingClientRect();
        m.style.left = Math.min(x, innerWidth - r.width - 6) + 'px';
        m.style.top = (above ? Math.max(6, y - r.height) : Math.min(y, innerHeight - r.height - 6)) + 'px';
        m.querySelector('.cx')?.focus();
    }
    // Alle Aufklapp-Fenster (.pop) schließen, außer dem mit der id "keep"; zugehörige Knöpfe zurücksetzen
    function closePops(keep) {
        document.querySelectorAll('.pop').forEach(p => { if (p.id !== keep && !p.hidden) p.hidden = true; });
        document.querySelectorAll('[aria-controls][aria-expanded="true"]').forEach(b => { if (b.getAttribute('aria-controls') !== keep) b.setAttribute('aria-expanded', false); });
    }
    document.addEventListener('pointerdown', ev => { if (!ev.target.closest('.pop, [aria-controls], #bar-search, #bar-wg, .wg-b, #toasts, .uidlg-bg')) closePops(); });
    const KEYS = [];          // weitere Tastenkürzel aus Erweiterungen: fn(ev) -> true, wenn erledigt
    function onKeys(ev) {
        if (ev.key === 'Escape') closePops();
        if (ev.ctrlKey && (ev.code === 'Space' || ev.key === ' ')) { ev.preventDefault(); toggleStart(true); return true; }
        if (ev.altKey && (ev.key === 'w' || ev.key === 'W' || ev.key === 'F4')) { const t = topWin(); if (t) { ev.preventDefault(); closeWin(t); } return true; }
        for (const f of KEYS) if (f(ev)) { ev.preventDefault(); return true; }
    }
    document.addEventListener('keydown', onKeys);

    // ---------- Eingebaute Apps ----------
    const NATIVE_UI = window.JMOS_NATIVE_UI = {
        pad(body) {
            body.innerHTML = `<div class="app-pad"><textarea spellcheck="true" maxlength="20000" aria-label="Notiz" placeholder="Hier kannst du schreiben … wird automatisch in deinem Profil gespeichert."></textarea><div class="bar"><i class="fa-solid fa-floppy-disk"></i><span class="st">Gespeichert</span><span style="margin-left:auto" class="cnt"></span></div></div>`;
            const ta = body.querySelector('textarea'), st = body.querySelector('.st'), cnt = body.querySelector('.cnt'); let t = 0;
            ta.value = S.notes || '';
            const count = () => { cnt.textContent = `${ta.value.length} Zeichen`; }; count();
            ta.addEventListener('input', () => { st.textContent = 'Wird gespeichert …'; count(); clearTimeout(t); t = setTimeout(() => { S.notes = ta.value; save(); st.textContent = 'Gespeichert'; }, 400); });
            setTimeout(() => ta.focus(), 50);
        },
        calc(body) {
            body.innerHTML = `<div class="app-calc"><div class="calc-d"><small class="h"></small><b class="v">0</b></div><div class="calc-k">${['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '±', '0', ',', '='].map(k => `<button type="button" class="${'÷×−+'.includes(k) ? 'op' : k === '=' ? 'eq' : ''}">${k}</button>`).join('')}</div></div>`;
            let ex = '';
            const v = body.querySelector('.v'), h = body.querySelector('.h');
            const show = () => { v.textContent = ex.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−').replace(/\./g, ',') || '0'; };
            const calc = s => { // kleiner Rechner ohne eval: + − × ÷ und Klammern
                let i = 0; const peek = () => s[i], num = () => { let m = s.slice(i).match(/^\d+(\.\d+)?/); if (!m) throw 0; i += m[0].length; return +m[0]; };
                const fac = () => { if (peek() === '-') { i++; return -fac(); } if (peek() === '(') { i++; const r = sum(); if (s[i++] !== ')') throw 0; return r; } return num(); };
                const prod = () => { let r = fac(); while (peek() === '*' || peek() === '/') { const o = s[i++], b = fac(); r = o === '*' ? r * b : r / b; } return r; };
                const sum = () => { let r = prod(); while (peek() === '+' || peek() === '-') { const o = s[i++], b = prod(); r = o === '+' ? r + b : r - b; } return r; };
                const r = sum(); if (i !== s.length || !isFinite(r)) throw 0; return Math.round(r * 1e10) / 1e10;
            };
            const press = k => {
                if (k === 'C') ex = ''; else if (k === '=') { try { const r = calc(ex); h.textContent = v.textContent + ' ='; ex = String(r); } catch (x) { h.textContent = 'Ungültige Eingabe'; } }
                else if (k === '±') ex = ex.startsWith('-') ? ex.slice(1) : '-' + ex;
                else ex += ({ '÷': '/', '×': '*', '−': '-', ',': '.' })[k] || k;
                show();
            };
            body.querySelector('.calc-k').addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) press(b.textContent); });
            body.tabIndex = 0;
            body.addEventListener('keydown', ev => { const map = { Enter: '=', Escape: 'C', '/': '÷', '*': '×', '-': '−', ',': ',', '.': ',' }; const k = map[ev.key] || ev.key;
                if (ev.key === 'Backspace') { ex = ex.slice(0, -1); show(); } else if (/^[\d()+=C÷×−,]$/.test(k)) { ev.preventDefault(); press(k); } });
            setTimeout(() => body.focus(), 50);
        },
        set(body) {
            const walls = [['weltall', 'Weltall', 'radial-gradient(circle at 20% 10%, rgba(99,102,241,.6), transparent 60%), radial-gradient(circle at 80% 100%, rgba(139,92,246,.6), transparent 60%), #060a14'],
                ['planet', 'Planet', 'url(/assets/img/menu-planet.webp) right bottom / 90% auto no-repeat, radial-gradient(circle at 20% 10%, rgba(99,102,241,.5), transparent 60%), #060a14'],
                ['nebel', 'Nebel', 'radial-gradient(circle at 20% 30%, rgba(236,72,153,.55), transparent 60%), radial-gradient(circle at 80% 60%, rgba(99,102,241,.6), transparent 60%), #070512'],
                ['pastell', 'Pastell (abgedunkelt)', 'linear-gradient(rgba(10,8,30,.45), rgba(10,8,30,.45)), url(/assets/img/space-bg-hell.webp) center / cover']];
            body.innerHTML = `<div class="app-set">
                <section><h3>Hintergrund</h3><div class="walls">${walls.map(w => `<button type="button" class="wall-o${S.wall === w[0] ? ' on' : ''}" data-w="${w[0]}"><i class="prev" style="background:${w[2]}"></i><span>${w[1]}</span></button>`).join('')}</div></section>
                <section><h3>Start &amp; Widgets</h3>
                    <label class="set-row"><div><b>Desktop-Modus als Start</b><small>Nach der Anmeldung am PC direkt hier starten statt im normalen Dashboard. Am Handy startet immer das Dashboard.</small></div><input type="checkbox" class="tgl" id="set-sv" ${USER.userPrefs?.startView === 'os' ? 'checked' : ''}></label>
                    <div class="set-row"><div><b>Widgets</b><small>Uhr, Wetter, Stempeluhr, Termine, Aufgaben, Finanzen, Pinnwand, Notiz und Kalender auf dem Desktop.</small></div><button type="button" class="btn" data-b="wg"><i class="fa-solid fa-plus"></i>Hinzufügen</button></div>
                </section>
                <section><h3>Fenster</h3>
                    <label class="set-row"><div><b>Links als neues Fenster öffnen</b><small>Klickst du in einer App auf einen Link zu einer anderen App (z. B. „Zur Zeiterfassung“), öffnet sie sich in einem eigenen Fenster.</small></div><input type="checkbox" class="tgl" id="set-lw" ${S.linkWin ? 'checked' : ''}></label>
                </section>
                <section><h3>Desktop</h3>
                    <div class="set-row"><div><b>Symbole neu anordnen</b><small>Stellt die ursprüngliche Reihenfolge der Desktop-Symbole wieder her.</small></div><button type="button" class="btn" data-b="arr"><i class="fa-solid fa-table-cells-large"></i>Anordnen</button></div>
                    <div class="set-row"><div><b>Ausgeblendete Desktop-Symbole</b><small class="set-dh"></small></div><button type="button" class="btn" data-b="unhide"><i class="fa-solid fa-eye"></i>Alle wieder anzeigen</button></div>
                    <div class="set-row"><div><b>Alle Fenster schließen</b><small>Beim nächsten Start ist der Desktop dann leer.</small></div><button type="button" class="btn" data-b="closeall"><i class="fa-solid fa-xmark"></i>Schließen</button></div>
                    <div class="set-row"><div><b>Normales Dashboard</b><small>Zurück zur gewohnten Ansicht mit Seitenleiste.</small></div><a class="btn pri" href="/menu.html"><i class="fa-solid fa-border-all"></i>Öffnen</a></div>
                </section></div>`;
            body.querySelector('.app-set').addEventListener('click', ev => {
                const w = ev.target.closest('[data-w]'); if (w) { setWall(w.dataset.w); body.querySelectorAll('.wall-o').forEach(x => x.classList.toggle('on', x === w)); }
                const b = ev.target.closest('[data-b]'); if (!b) return;
                if (b.dataset.b === 'arr') arrangeIcons();
                if (b.dataset.b === 'unhide') { S.deskHide = []; renderIcons(); save(); paintDh(); }
                if (b.dataset.b === 'wg') JMOS_WIDGETS.picker();
                if (b.dataset.b === 'closeall') WINS.filter(x => x.app.id !== 'einstellungen').forEach(closeWin);
            });
            const paintDh = () => { const h = deskHidden().filter(id => APPS[id]), el = body.querySelector('.set-dh'); if (el) el.textContent = h.length ? h.map(id => APPS[id].name).join(', ') : 'Keine – alle Apps sind auf dem Desktop. Rechtsklick auf ein Symbol → „Vom Desktop entfernen“.'; const bt = body.querySelector('[data-b="unhide"]'); if (bt) bt.disabled = !h.length; };
            paintDh();
            body.querySelector('#set-lw').addEventListener('change', ev => { S.linkWin = ev.target.checked; save(); });
            body.querySelector('#set-sv').addEventListener('change', async ev => {
                const v = ev.target.checked ? 'os' : 'dash'; USER.userPrefs = USER.userPrefs || {}; USER.userPrefs.startView = v;
                try { await db.collection('users').doc(USER.uid).update({ 'userPrefs.startView': v }); } catch (x) { ev.target.checked = !ev.target.checked; uiAlert('Speichern fehlgeschlagen: ' + x.message); }
            });
        },
        about(body) {
            body.innerHTML = `<div class="app-about"><div class="boot-logo"><span></span><span></span><span></span><span></span></div><h2 style="margin:6px 0 0">J.Mainz <span style="background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent">OS</span></h2>
                <p>Version 0.2 · Testversion</p><p>Dein Dashboard als Desktop: Apps öffnen sich in Fenstern, die du verschieben, an den Rand andocken, maximieren und minimieren kannst.</p>
                <p style="font-size:12px">Tipps: Doppelklick auf die Titelleiste = Vollbild · Fenster an den oberen Rand ziehen = Vollbild, an links/rechts = halber Bildschirm · Alt+W schließt das aktive Fenster.</p></div>`;
        },
    };

    // ---------- Start ----------
    function boot(user) {
        USER = user;
        if (!user) return;
        KEY = 'jmos-v1-' + (user.uid || user.email || 'x'); load(user);
        buildApps(user);
        document.documentElement.dataset.wall = S.wall || 'weltall';
        const name = user.firstName || user.name || (user.email || '').split('@')[0];
        $('st-name').textContent = [user.firstName, user.lastName].filter(Boolean).join(' ') || name;
        $('st-role').textContent = isAdmin(user) ? 'Administrator' : 'Mitglied';
        $('st-av').innerHTML = typeof avatarInner === 'function' ? avatarInner({ ...user, name }) : e((name || '?')[0]);
        renderIcons(); wireIcons(); wireBar(); wireStart();
        Object.assign(API, { state: () => S, save, openApp, closeWin, focus, ctx, closePops, toggleStart, renderStart, topWin, toggleMin, toggleMax, place, animate, area, showSnap, renderTasks, renderIcons, keys: KEYS, registerApp: a => { APPS[a.id] = a; }, removeIcons, onDeskIcon, toggleDeskIcon, unregisterApp: id => { delete APPS[id]; }, switchDesk, moveToDesk, desks, curDesk, onDesk, snapTo, snapRect, popOut, togglePin, isPinned, deskH, user: () => USER, apps: () => APPS, order: () => ORDER, webset: () => WEBSET, wins: WINS, hasApp: id => !!APPS[id], appName: id => APPS[id] ? APPS[id].name : '', tile, esc: e });
        if (window.JMOS_WIDGETS) JMOS_WIDGETS.init(API, user);
        (window.JMOS_EXT || []).forEach(x => { if (x.ui) Object.assign(NATIVE_UI, x.ui); try { x.init && x.init(API, user); } catch (err) { console.error('J.Mainz OS Erweiterung:', err); } });
        if (!desks().some(d => d.id === curDesk())) S.desk = desks()[0].id;
        (S.wins || []).forEach(w => { if (APPS[w.app]) { const win = openApp(w.app, { ...w, desk: desks().some(d => d.id === w.desk) ? w.desk : curDesk(), restore: true }); if (win) { win.el.classList.toggle('away', !onDesk(win)); if (w.min) toggleMin(win, true); } } });
        renderTasks();
        $('boot-msg').textContent = `Willkommen, ${name}`;
        setTimeout(() => document.documentElement.classList.remove('os-boot'), 450);
    }
    stars();
    if (typeof initAuthGuard === 'function') initAuthGuard(boot);
    else $('boot-msg').textContent = 'Anmeldung konnte nicht geladen werden.';
    window.JMOS = API;          // für Erweiterungen und Tests in der Konsole
})();
