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
        { id: 'einstellungen', name: 'Einstellungen', icon: 'fa-gear', c: '#6366f1', native: 'set', w: 720, h: 560 },
        { id: 'info', name: 'Über J.Mainz OS', icon: 'fa-circle-info', c: '#8b5cf6', native: 'about', w: 460, h: 380, hidden: true },
    ];
    const FOLDER = { id: 'spiele', name: 'Spiele', icon: 'fa-gamepad', folder: true, items: ['gamecenter', 'kolonie', 'ballon', 'keks', 'buero'], w: 560, h: 380 };

    let USER = null, APPS = {}, ORDER = [], WEBSET = [];
    const slug = href => href.replace(/^\/|\/$|\.html$/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'start';

    function buildApps(user) {
        APPS = {}; ORDER = []; WEBSET = [];
        const add = (a, list) => { APPS[a.id] = a; if (list) list.push(a.id); };
        (typeof DRAWER_LINKS !== 'undefined' ? DRAWER_LINKS : []).forEach(l => {
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
    }
    const appByPath = path => {
        const p = path.replace(/index\.html$/, '');
        return Object.values(APPS).find(a => a.url && (a.url === p || a.url === path || (a.url.endsWith('/') && p.startsWith(a.url))));
    };

    // ---------- Gespeicherter Zustand (je Person, nur in diesem Browser) ----------
    let KEY = 'jmos-v1', S = { icons: {}, wins: [], wall: 'weltall', linkWin: true };
    const load = () => { try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {} };
    let saveT = 0;
    const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { S.wins = WINS.filter(w => !w.closing).map(w => ({ app: w.app.id, x: w.x, y: w.y, w: w.w, h: w.h, max: w.max, min: w.min, url: w.url })); localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }, 250); };

    const $ = id => document.getElementById(id);
    const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const tile = (a, cls = '') => a.folder ? `<span class="ico-t folder ${cls}"><i class="fa-solid fa-folder"></i></span>` : `<span class="ico-t ${cls}" style="--c:${a.c}"><i class="fa-solid ${a.icon}"></i></span>`;
    const deskH = () => window.innerHeight - parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bar-h'));

    // ---------- Sternenhimmel ----------
    function stars() {
        const cv = $('stars'), cx = cv.getContext('2d'); let pts = [], raf = 0;
        const size = () => {
            const d = Math.min(2, window.devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0);
            pts = Array.from({ length: Math.round(innerWidth * innerHeight / 3800) }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * 1.2 + .2, a: Math.random(), s: Math.random() * .015 + .003, p: Math.random() * 6.3 }));
        };
        const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const draw = t => {
            cx.clearRect(0, 0, innerWidth, innerHeight);
            for (const p of pts) { const a = calm ? p.a : .35 + .65 * Math.abs(Math.sin(p.p + t * p.s * .06)); cx.globalAlpha = a; cx.fillStyle = p.r > 1.1 ? '#c7d2fe' : '#fff'; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill(); }
            if (!calm && !document.hidden) raf = requestAnimationFrame(draw);
        };
        size(); draw(0);
        addEventListener('resize', () => { cancelAnimationFrame(raf); size(); draw(performance.now()); });
        document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); if (!document.hidden) draw(performance.now()); });
    }
    const setWall = w => { S.wall = w; document.documentElement.dataset.wall = w; save(); };

    // ---------- Desktop-Symbole ----------
    const CW = 104, CH = 108, PAD = 12;
    const rows = () => Math.max(1, Math.floor((deskH() - PAD) / CH));
    const cols = () => Math.max(1, Math.floor((innerWidth - PAD) / CW));
    const deskApps = () => [...ORDER.filter(id => !APPS[id].hidden), ...(APPS.spiele ? ['spiele'] : [])];
    function placeIcons() {
        const taken = new Set(), R = rows(), C = cols(), ids = deskApps();
        ids.forEach(id => { const p = S.icons[id]; if (p && p.c < C && p.r < R && !taken.has(p.c + ',' + p.r)) taken.add(p.c + ',' + p.r); else delete S.icons[id]; });
        ids.forEach(id => { if (S.icons[id]) return; for (let i = 0; ; i++) { const c = Math.floor(i / R), r = i % R; if (!taken.has(c + ',' + r) || i > 400) { S.icons[id] = { c, r }; taken.add(c + ',' + r); break; } } });
    }
    function renderIcons() {
        placeIcons();
        $('icons').innerHTML = deskApps().map(id => { const a = APPS[id], p = S.icons[id];
            return `<button type="button" class="ico" role="option" data-id="${id}" style="left:${PAD + p.c * CW}px;top:${PAD + p.r * CH}px" title="${e(a.name)}${a.url ? ' – ' + e(a.url) : ''}">${tile(a)}<span class="ico-l">${e(a.name)}</span></button>`; }).join('');
    }
    function arrangeIcons() { S.icons = {}; renderIcons(); save(); }
    function wireIcons() {
        const box = $('icons'); let drag = null;
        const sel = (ids, add) => box.querySelectorAll('.ico').forEach(el => el.classList.toggle('sel', ids.includes(el.dataset.id) || (add && el.classList.contains('sel'))));
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
        });
        box.addEventListener('pointerup', () => {
            if (!drag) return; const d = drag; drag = null; d.el.classList.remove('dragging');
            if (!d.moved) { if (d.type === 'touch') openApp(d.id); return; }
            const c = Math.max(0, Math.min(cols() - 1, Math.round((d.el.offsetLeft - PAD) / CW))), r = Math.max(0, Math.min(rows() - 1, Math.round((d.el.offsetTop - PAD) / CH)));
            const other = Object.keys(S.icons).find(k => k !== d.id && S.icons[k].c === c && S.icons[k].r === r);
            if (other) S.icons[other] = { ...S.icons[d.id] };              // Platz besetzt: tauschen
            S.icons[d.id] = { c, r }; renderIcons(); sel([d.id]); save();
        });
        box.addEventListener('dblclick', ev => { const el = ev.target.closest('.ico'); if (el) openApp(el.dataset.id); });
        box.addEventListener('keydown', ev => { const el = ev.target.closest('.ico'); if (el && ev.key === 'Enter') { ev.preventDefault(); openApp(el.dataset.id); } });
        // Rahmen aufziehen zum Markieren
        const desk = $('desk'), sb = $('select-box'); let m = null;
        desk.addEventListener('pointerdown', ev => {
            if (ev.target.closest('.ico') || ev.button > 0) return; closePops(); sel([]);
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
            ev.preventDefault(); const el = ev.target.closest('.ico');
            if (el) { const a = APPS[el.dataset.id]; sel([a.id]);
                return ctx(ev.clientX, ev.clientY, [['fa-up-right-from-square', 'Öffnen', () => openApp(a.id)], a.url && ['fa-arrow-up-right-from-square', 'In neuem Browser-Tab öffnen', () => window.open(a.url, '_blank', 'noopener')]]); }
            ctx(ev.clientX, ev.clientY, [
                ['fa-table-cells-large', 'Symbole automatisch anordnen', arrangeIcons],
                ['fa-rotate-right', 'Aktualisieren', () => { renderIcons(); }], null,
                ['fa-image', 'Hintergrund ändern', () => openApp('einstellungen')],
                ['fa-note-sticky', 'Neue Notiz', () => openApp('notizen')], null,
                ['fa-circle-info', 'Über J.Mainz OS', () => openApp('info')],
            ]);
        });
        addEventListener('resize', () => { clearTimeout(wireIcons.t); wireIcons.t = setTimeout(renderIcons, 150); });
    }

    // ---------- Fenster ----------
    const WINS = []; let zTop = 20, seq = 0;
    const EMBED_CSS = `#sb, #sb-backdrop, #tabbar { display: none !important; }
        body.has-sb { padding-left: 18px !important; padding-bottom: 18px !important; }
        header button[onclick^="toggleSideMenu"], header button[onclick^="handleLogout"] { display: none !important; }`;
    const area = () => ({ w: innerWidth, h: deskH() });

    function openApp(id, o = {}) {
        const a = APPS[id]; if (!a) return;
        closePops();
        const ex = WINS.find(w => w.app.id === id && !w.closing);
        if (ex && !o.restore) { if (ex.min) toggleMin(ex, false); focus(ex); return ex; }
        const ar = area(), n = WINS.length % 8;
        const w = Math.min(a.w || 1180, ar.w - 120), h = Math.min(a.h || 760, ar.h - 70);
        const win = { id: 'w' + (++seq), app: a, url: o.url || a.url, x: o.x ?? Math.max(10, Math.round((ar.w - w) / 2) - 120 + n * 34), y: o.y ?? Math.max(8, Math.round((ar.h - h) / 2) - 50 + n * 30), w: o.w || w, h: o.h || h, max: !!o.max, min: false };
        win.x = Math.min(Math.max(-win.w + 120, win.x), ar.w - 120); win.y = Math.min(Math.max(0, win.y), ar.h - 40);
        const el = document.createElement('div'); el.className = 'win'; el.id = win.id; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', a.name);
        el.innerHTML = `<div class="wt"><span class="wt-ico${a.folder ? ' folder' : ''}" style="--c:${a.c || '#818cf8'}"><i class="fa-solid ${a.folder ? 'fa-folder' : a.icon}"></i></span><span class="wt-title">${e(a.name)}</span>
            <div class="wt-btns">${a.url ? '<button type="button" class="wt-b" data-a="tab" title="In neuem Browser-Tab öffnen" aria-label="In neuem Tab öffnen"><i class="fa-solid fa-up-right-from-square"></i></button>' : ''}<button type="button" class="wt-b" data-a="min" title="Minimieren" aria-label="Minimieren"><i class="fa-regular fa-window-minimize"></i></button>${a.noMax ? '' : '<button type="button" class="wt-b" data-a="max" title="Maximieren" aria-label="Maximieren"><i class="fa-regular fa-window-maximize"></i></button>'}<button type="button" class="wt-b x" data-a="close" title="Schließen" aria-label="Schließen"><i class="fa-solid fa-xmark"></i></button></div></div>
            <div class="wb"></div>${['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(d => `<div class="rz ${d}" data-d="${d}"></div>`).join('')}`;
        win.el = el; $('wins').appendChild(el); WINS.push(win);
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
        if (!doc.getElementById('jmos-embed')) { const st = doc.createElement('style'); st.id = 'jmos-embed'; st.textContent = EMBED_CSS; doc.head.appendChild(st); }
        const path = win.frame.contentWindow.location.pathname, now = appByPath(path);
        win.url = path + win.frame.contentWindow.location.search + win.frame.contentWindow.location.hash;
        if (now && now.id !== win.app.id && !WINS.some(w => w !== win && w.app.id === now.id)) {    // Seite hat innerhalb des Fensters gewechselt
            win.app = now; win.el.querySelector('.wt-ico').style.setProperty('--c', now.c); win.el.querySelector('.wt-ico i').className = 'fa-solid ' + now.icon;
        }
        const t = (doc.title || win.app.name).replace(/\s*[–-]\s*J\.Mainz.*$/i, '').trim();
        win.el.querySelector('.wt-title').textContent = t || win.app.name; renderTasks(); save();
        doc.addEventListener('pointerdown', () => focus(win), true);
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
    const topWin = () => WINS.filter(w => !w.min && !w.closing).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
    function toggleMin(win, on = !win.min) { win.min = on; place(win); if (on) { win.el.classList.remove('focus'); const t = topWin(); if (t) focus(t); else document.title = 'J.Mainz OS'; } else focus(win); renderTasks(); save(); }
    function toggleMax(win, on = !win.max) { if (win.app.noMax) return; animate(win, () => { win.max = on; place(win); }); save(); }
    function closeWin(win) {
        win.closing = true; win.el.classList.add('closing');
        setTimeout(() => { win.el.remove(); WINS.splice(WINS.indexOf(win), 1); const t = topWin(); if (t) focus(t); else document.title = 'J.Mainz OS'; renderTasks(); save(); }, 170);
        renderTasks();
    }
    function wireWin(win) {
        const el = win.el, bar = el.querySelector('.wt');
        el.addEventListener('pointerdown', () => focus(win), true);
        el.querySelector('.wt-btns').addEventListener('click', ev => {
            const b = ev.target.closest('[data-a]'); if (!b) return;
            ({ min: () => toggleMin(win, true), max: () => toggleMax(win), close: () => closeWin(win), tab: () => window.open(win.url || win.app.url, '_blank', 'noopener') })[b.dataset.a]();
        });
        bar.addEventListener('dblclick', ev => { if (!ev.target.closest('.wt-btns')) toggleMax(win); });
        // Verschieben (mit Andocken: oben = Vollbild, links/rechts = halber Bildschirm)
        bar.addEventListener('pointerdown', ev => {
            if (ev.target.closest('.wt-btns') || ev.button > 0 || innerWidth <= 760) return;
            ev.preventDefault(); bar.setPointerCapture(ev.pointerId);
            const ar = area(); let sx = ev.clientX, sy = ev.clientY, ox = win.x, oy = win.y, moved = false, snap = null;
            const mv = m => {
                const dx = m.clientX - sx, dy = m.clientY - sy;
                if (!moved && Math.hypot(dx, dy) < 4) return;
                if (!moved) { moved = true; document.body.classList.add('dragging');
                    if (win.max) { const rel = (m.clientX) / ar.w; win.max = false; win.x = Math.round(m.clientX - win.w * rel); win.y = 0; ox = win.x; oy = win.y; sx = m.clientX; sy = m.clientY; place(win); } }
                win.x = ox + (m.clientX - sx); win.y = Math.max(0, Math.min(ar.h - 40, oy + (m.clientY - sy)));
                el.style.left = win.x + 'px'; el.style.top = win.y + 'px';
                snap = m.clientY <= 2 ? 'max' : m.clientX <= 2 ? 'l' : m.clientX >= innerWidth - 3 ? 'r' : null;
                showSnap(snap);
            };
            const up = () => {
                bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
                document.body.classList.remove('dragging'); showSnap(null);
                if (snap === 'max') toggleMax(win, true);
                else if (snap) animate(win, () => { Object.assign(win, { x: snap === 'l' ? 0 : Math.round(ar.w / 2), y: 0, w: Math.round(ar.w / 2), h: ar.h }); place(win); });
                if (moved) save();
            };
            bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
        });
        // Größe ändern
        el.querySelectorAll('.rz').forEach(h => h.addEventListener('pointerdown', ev => {
            ev.preventDefault(); ev.stopPropagation(); h.setPointerCapture(ev.pointerId); document.body.classList.add('dragging');
            const d = h.dataset.d, s = { x: ev.clientX, y: ev.clientY, l: win.x, t: win.y, w: win.w, h: win.h }, MW = 320, MH = 220;
            const mv = m => {
                const dx = m.clientX - s.x, dy = m.clientY - s.y;
                if (d.includes('e')) win.w = Math.max(MW, s.w + dx);
                if (d.includes('s')) win.h = Math.max(MH, s.h + dy);
                if (d.includes('w')) { win.w = Math.max(MW, s.w - dx); win.x = s.l + s.w - win.w; }
                if (d.includes('n')) { win.h = Math.max(MH, s.h - dy); win.y = Math.max(0, s.t + s.h - win.h); if (s.t + s.h - win.h < 0) win.h = s.t + s.h; }
                place(win);
            };
            const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); document.body.classList.remove('dragging'); save(); };
            h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up);
        }));
    }
    function showSnap(s) {
        const sn = $('snap'), ar = area();
        if (!s) { sn.hidden = true; return; }
        const r = s === 'max' ? [8, 8, ar.w - 16, ar.h - 16] : s === 'l' ? [8, 8, ar.w / 2 - 12, ar.h - 16] : [ar.w / 2 + 4, 8, ar.w / 2 - 12, ar.h - 16];
        Object.assign(sn.style, { left: r[0] + 'px', top: r[1] + 'px', width: r[2] + 'px', height: r[3] + 'px' }); sn.hidden = false;
    }
    // Klick in eine Seite im Fenster: das Fenster kommt nach vorne
    addEventListener('blur', () => setTimeout(() => { const f = document.activeElement; if (f && f.tagName === 'IFRAME') { const w = WINS.find(x => x.frame === f); if (w) focus(w); } closePops(); }, 0));
    addEventListener('resize', () => WINS.forEach(w => { if (w.max) place(w); }));

    // ---------- Taskleiste ----------
    function renderTasks() {
        const t = topWin();
        $('tasks').innerHTML = WINS.filter(w => !w.closing).map(w => `<button type="button" class="task${w === t && !w.min && w.el.classList.contains('focus') ? ' on' : ''}${w.min ? ' mini' : ''}" data-w="${w.id}" title="${e(w.el.querySelector('.wt-title').textContent)}"><span class="wt-ico${w.app.folder ? ' folder' : ''}" style="--c:${w.app.c || '#818cf8'}"><i class="fa-solid ${w.app.folder ? 'fa-folder' : w.app.icon}"></i></span><span>${e(w.el.querySelector('.wt-title').textContent)}</span></button>`).join('');
    }
    function wireBar() {
        $('tasks').addEventListener('click', ev => {
            const b = ev.target.closest('.task'); if (!b) return; const w = WINS.find(x => x.id === b.dataset.w); closePops();
            if (w.min) toggleMin(w, false); else if (b.classList.contains('on')) toggleMin(w, true); else focus(w);
        });
        $('tasks').addEventListener('contextmenu', ev => {
            const b = ev.target.closest('.task'); if (!b) return; ev.preventDefault(); const w = WINS.find(x => x.id === b.dataset.w);
            ctx(ev.clientX, ev.clientY - 10, [[w.min ? 'fa-window-restore' : 'fa-window-minimize', w.min ? 'Wiederherstellen' : 'Minimieren', () => toggleMin(w)], !w.app.noMax && ['fa-window-maximize', w.max ? 'Verkleinern' : 'Maximieren', () => { if (w.min) toggleMin(w, false); toggleMax(w); }], w.app.url && ['fa-up-right-from-square', 'In neuem Browser-Tab öffnen', () => window.open(w.url || w.app.url, '_blank', 'noopener')], null, ['fa-xmark', 'Fenster schließen', () => closeWin(w)]], true);
        });
        let shown = null;
        $('show-desk').addEventListener('click', () => {
            const open = WINS.filter(w => !w.min && !w.closing);
            if (open.length) { shown = open.map(w => w.id); open.forEach(w => toggleMin(w, true)); }
            else if (shown) { shown.forEach(id => { const w = WINS.find(x => x.id === id); if (w) toggleMin(w, false); }); shown = null; }
        });
        $('start-btn').addEventListener('click', () => toggleStart());
        $('bar-search').addEventListener('click', () => toggleStart(true));
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
        if (on) { $('st-q').value = ''; renderStart(); setTimeout(() => $('st-q').focus(), 30); }
    }
    function renderStart() {
        const q = $('st-q').value.trim().toLowerCase(), hit = id => !q || APPS[id].name.toLowerCase().includes(q);
        const pinned = ORDER.filter(hit), web = WEBSET.filter(hit), btn = id => `<button type="button" class="st-app" data-id="${id}">${tile(APPS[id])}<span>${e(APPS[id].name)}</span></button>`;
        $('st-apps').innerHTML = pinned.map(btn).join(''); $('st-web').innerHTML = web.map(btn).join('');
        $('st-apps').previousElementSibling.hidden = !pinned.length; $('st-web').previousElementSibling.hidden = !web.length;
        $('st-empty').hidden = !!(pinned.length + web.length);
        $('st-count').textContent = q ? '' : `${ORDER.length + WEBSET.length} Apps`;
        const first = $('start').querySelector('.st-app'); if (first && q) first.classList.add('hl');
    }
    function wireStart() {
        $('st-q').addEventListener('input', renderStart);
        $('st-q').addEventListener('keydown', ev => { if (ev.key === 'Enter') { const f = $('start').querySelector('.st-app'); if (f) openApp(f.dataset.id); } });
        $('start').addEventListener('click', ev => {
            const a = ev.target.closest('.st-app'); if (a) return openApp(a.dataset.id);
            const b = ev.target.closest('[data-act]'); if (!b) return;
            if (b.dataset.act === 'settings') openApp('einstellungen');
            if (b.dataset.act === 'logout') { closePops(); handleLogout(); }
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
    function closePops(keep) {
        if (keep !== 'start') { $('start').hidden = true; $('start-btn').setAttribute('aria-expanded', false); }
        if (keep !== 'cal') { $('cal').hidden = true; $('clock').setAttribute('aria-expanded', false); }
        if (keep !== 'ctx') $('ctx').hidden = true;
    }
    document.addEventListener('pointerdown', ev => { if (!ev.target.closest('.pop, #start-btn, #bar-search, #clock')) closePops(); });
    document.addEventListener('keydown', ev => {
        if (ev.key === 'Escape') closePops();
        if (ev.altKey && (ev.key === 'w' || ev.key === 'W' || ev.key === 'F4')) { const t = topWin(); if (t) { ev.preventDefault(); closeWin(t); } }
    });

    // ---------- Eingebaute Apps ----------
    const NATIVE_UI = {
        pad(body) {
            const k = KEY + '-notes';
            body.innerHTML = `<div class="app-pad"><textarea spellcheck="true" aria-label="Notiz" placeholder="Hier kannst du schreiben … wird automatisch gespeichert (nur in diesem Browser)."></textarea><div class="bar"><i class="fa-solid fa-floppy-disk"></i><span class="st">Gespeichert</span><span style="margin-left:auto" class="cnt"></span></div></div>`;
            const ta = body.querySelector('textarea'), st = body.querySelector('.st'), cnt = body.querySelector('.cnt'); let t = 0;
            try { ta.value = localStorage.getItem(k) || ''; } catch (x) {}
            const count = () => { cnt.textContent = `${ta.value.length} Zeichen`; }; count();
            ta.addEventListener('input', () => { st.textContent = 'Wird gespeichert …'; count(); clearTimeout(t); t = setTimeout(() => { try { localStorage.setItem(k, ta.value); st.textContent = 'Gespeichert'; } catch (x) { st.textContent = 'Speichern nicht möglich'; } }, 400); });
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
                <section><h3>Fenster</h3>
                    <label class="set-row"><div><b>Links als neues Fenster öffnen</b><small>Klickst du in einer App auf einen Link zu einer anderen App (z. B. „Zur Zeiterfassung“), öffnet sie sich in einem eigenen Fenster.</small></div><input type="checkbox" class="tgl" id="set-lw" ${S.linkWin ? 'checked' : ''}></label>
                </section>
                <section><h3>Desktop</h3>
                    <div class="set-row"><div><b>Symbole neu anordnen</b><small>Stellt die ursprüngliche Reihenfolge der Desktop-Symbole wieder her.</small></div><button type="button" class="btn" data-b="arr"><i class="fa-solid fa-table-cells-large"></i>Anordnen</button></div>
                    <div class="set-row"><div><b>Alle Fenster schließen</b><small>Beim nächsten Start ist der Desktop dann leer.</small></div><button type="button" class="btn" data-b="closeall"><i class="fa-solid fa-xmark"></i>Schließen</button></div>
                    <div class="set-row"><div><b>Normales Dashboard</b><small>Zurück zur gewohnten Ansicht mit Seitenleiste.</small></div><a class="btn pri" href="/menu.html"><i class="fa-solid fa-border-all"></i>Öffnen</a></div>
                </section></div>`;
            body.addEventListener('click', ev => {
                const w = ev.target.closest('[data-w]'); if (w) { setWall(w.dataset.w); body.querySelectorAll('.wall-o').forEach(x => x.classList.toggle('on', x === w)); }
                const b = ev.target.closest('[data-b]'); if (!b) return;
                if (b.dataset.b === 'arr') arrangeIcons();
                if (b.dataset.b === 'closeall') WINS.filter(x => x.app.id !== 'einstellungen').forEach(closeWin);
            });
            body.querySelector('#set-lw').addEventListener('change', ev => { S.linkWin = ev.target.checked; save(); });
        },
        about(body) {
            body.innerHTML = `<div class="app-about"><div class="boot-logo"><span></span><span></span><span></span><span></span></div><h2 style="margin:6px 0 0">J.Mainz <span style="background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent">OS</span></h2>
                <p>Version 0.1 · Testversion</p><p>Dein Dashboard als Desktop: Apps öffnen sich in Fenstern, die du verschieben, an den Rand andocken, maximieren und minimieren kannst.</p>
                <p style="font-size:12px">Tipps: Doppelklick auf die Titelleiste = Vollbild · Fenster an den oberen Rand ziehen = Vollbild, an links/rechts = halber Bildschirm · Alt+W schließt das aktive Fenster.</p></div>`;
        },
    };

    // ---------- Start ----------
    function boot(user) {
        USER = user;
        if (!user) return;
        KEY = 'jmos-v1-' + (user.uid || user.email || 'x'); load();
        if (typeof can === 'function' && !can(user, 'webapps')) { $('boot-msg').innerHTML = 'Für J.Mainz OS brauchst du die Berechtigung „Web-Apps“.<br><a href="/menu.html" style="color:#c4b5fd">Zum Dashboard</a>'; document.querySelector('.boot-bar').hidden = true; return; }
        buildApps(user);
        document.documentElement.dataset.wall = S.wall || 'weltall';
        const name = user.firstName || user.name || (user.email || '').split('@')[0];
        $('st-name').textContent = [user.firstName, user.lastName].filter(Boolean).join(' ') || name;
        $('st-role').textContent = isAdmin(user) ? 'Administrator' : 'Mitglied';
        $('st-av').innerHTML = typeof avatarInner === 'function' ? avatarInner({ ...user, name }) : e((name || '?')[0]);
        renderIcons(); wireIcons(); wireBar(); wireStart();
        (S.wins || []).forEach(w => { if (APPS[w.app]) { const win = openApp(w.app, { ...w, restore: true }); if (win && w.min) toggleMin(win, true); } });
        $('boot-msg').textContent = `Willkommen, ${name}`;
        setTimeout(() => document.documentElement.classList.remove('os-boot'), 450);
    }
    stars();
    if (typeof initAuthGuard === 'function') initAuthGuard(boot);
    else $('boot-msg').textContent = 'Anmeldung konnte nicht geladen werden.';
    window.JMOS = { openApp, WINS, APPS: () => APPS };          // für Tests in der Konsole
})();
