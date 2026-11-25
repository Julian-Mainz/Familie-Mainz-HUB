// OS/taskman.js – Task-Manager für J.Mainz OS (Alt+Entf oder Rechtsklick auf die freie Taskleiste).
// Prozesse: offene Fenster mit Status, Elementen, geladener Datenmenge; beenden, neu laden, wechseln. Dazu die Dienste des Desktops.
// Leistung: Bilder pro Sekunde, Arbeitsspeicher (Chrome/Edge), Elemente, Netzwerk – als Verlauf; Gerätedaten und Leistungsmodus.
// Speicher: belegter Platz in Dokumente nach Dateiart und die größten Dateien; Speicher im Browser.  Benutzer: wer gerade online ist.
(function () {
    'use strict';
    let API, U, e, S;
    const PAGES = [['proc', 'Prozesse', 'fa-table-list'], ['perf', 'Leistung', 'fa-chart-line'], ['disk', 'Speicher', 'fa-hard-drive'], ['users', 'Benutzer', 'fa-users']];
    const size = b => b < 1024 ? Math.round(b) + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
    const BROWSER = (() => { const u = navigator.userAgent; return /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Browser'; })();

    // ---------- Messwerte (laufen nur, solange der Task-Manager oder die Anzeige offen ist) ----------
    const M = { fps: [], mem: [], dom: [], net: [], users: 0, raf: 0, frames: 0, last: 0, tick: 0, seen: new WeakMap() };
    const docsOf = () => { const out = [{ doc: document, win: null }]; API.wins.forEach(w => { if (w.frame) { try { const d = w.frame.contentDocument; if (d) out.push({ doc: d, win: w }); } catch (x) {} } }); return out; };
    const domOf = d => { try { return d.getElementsByTagName('*').length; } catch (x) { return 0; } };
    function netOf(d) {          // neue Übertragungen seit der letzten Messung (Bytes)
        let sum = 0; try { const w = d.defaultView, list = w.performance.getEntriesByType('resource'), from = M.seen.get(d) || 0;
            for (let i = from; i < list.length; i++) sum += list[i].transferSize || 0; M.seen.set(d, list.length); } catch (x) {} return sum;
    }
    function sample() {
        const now = performance.now(), dt = (now - (M.last || now - 1000)) / 1000; M.last = now;
        const push = (a, v) => { a.push(v); if (a.length > 60) a.shift(); };
        push(M.fps, Math.round(M.frames / Math.max(.2, dt))); M.frames = 0;
        push(M.mem, performance.memory ? performance.memory.usedJSHeapSize : 0);
        let dom = 0, net = 0; docsOf().forEach(x => { dom += domOf(x.doc); net += netOf(x.doc); });
        push(M.dom, dom); push(M.net, net / Math.max(.2, dt));
        if (fpsEl) fpsEl.textContent = M.fps[M.fps.length - 1] + ' FPS';
    }
    let users = 0;
    function startMeter() { users++; if (users > 1) return; M.last = 0; M.frames = 0; docsOf().forEach(x => netOf(x.doc));
        const loop = () => { M.frames++; M.raf = requestAnimationFrame(loop); }; M.raf = requestAnimationFrame(loop); M.tick = setInterval(() => { sample(); views.forEach(v => v()); }, 1000); }
    function stopMeter() { users = Math.max(0, users - 1); if (users) return; cancelAnimationFrame(M.raf); clearInterval(M.tick); }
    const views = new Set();

    // kleine Bildrate-Anzeige oben rechts (zum Prüfen, ob etwas ruckelt)
    let fpsEl = null;
    function fpsOverlay(on) {
        if (on && !fpsEl) { fpsEl = document.createElement('div'); fpsEl.id = 'tm-fps'; fpsEl.title = 'Bilder pro Sekunde – ausschalten im Task-Manager unter „Leistung“'; fpsEl.textContent = '… FPS'; document.body.appendChild(fpsEl); startMeter(); }
        else if (!on && fpsEl) { fpsEl.remove(); fpsEl = null; stopMeter(); }
    }

    // ---------- Fenster ----------
    function ui(body, win) {
        let page = (win.params && win.params.page) || 'proc', selW = null, metric = 'fps', disk = null, dir = null, dirT = 0;
        body.innerHTML = `<div class="tm2"><nav class="tm2-nav">${PAGES.filter(p => p[0] !== 'users' || can(U, 'messenger')).map(([id, n, ic]) => `<button type="button" data-pg="${id}"><i class="fa-solid ${ic}"></i><span>${n}</span></button>`).join('')}</nav><section class="tm2-main"></section></div>`;
        const main = body.querySelector('.tm2-main');
        const go = p => { page = p; body.querySelectorAll('[data-pg]').forEach(b => b.classList.toggle('on', b.dataset.pg === p)); main.innerHTML = ''; paint(true); };

        // ----- Prozesse -----
        const state = w => w.closing ? 'Wird beendet' : w.tabAway ? 'Als Tab' : !API.onDesk(w) ? 'Anderer Desktop' : w.min ? 'Minimiert' : w === API.topWin() ? 'Aktiv' : 'Im Hintergrund';
        function procRows() {
            return API.wins.filter(w => !w.closing && w.app.id !== 'taskman').map(w => {
                let dom = 0, load = 0, bytes = 0, d = null;
                if (w.frame) { try { d = w.frame.contentDocument; dom = domOf(d); const n = d.defaultView.performance.getEntriesByType('navigation')[0]; load = n ? n.duration : 0;
                    bytes = d.defaultView.performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || 0), 0) + (n ? n.transferSize || 0 : 0); } catch (x) {} }
                else dom = w.el.getElementsByTagName('*').length;
                return { w, name: w.el.querySelector('.wt-title')?.textContent || w.app.name, dom, load, bytes, page: !!w.frame };
            });
        }
        function services() {
            const L = S.live || {}, perf = window.JMOS_PERF && JMOS_PERF.on(), calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
            return [
                ['fa-star', 'Sternenhimmel', calm ? 'Ruhig (System: weniger Bewegung)' : perf ? 'Ruhig (Leistungsmodus)' : 'Funkeln, ca. 15 Bilder/s'],
                ['fa-wand-magic-sparkles', 'Sternschnuppen & Wetter', L.shoot === false && L.wx === false ? 'Aus' : perf ? 'An, 30 Bilder/s' : 'An'],
                ['fa-user-astronaut', 'Astro', document.getElementById('pet') && S.pet !== false ? 'An' : 'Aus'],
                ['fa-table-cells-large', 'Widgets', document.querySelectorAll('.wg').length + ' auf diesem Desktop'],
                ['fa-gauge-high', 'Leistungsmodus', perf ? 'An' : 'Aus'],
                ['fa-cloud', 'Datenbank-Verbindung', navigator.onLine ? 'Verbunden' : 'Offline'],
            ];
        }
        function paintProc(full) {
            const rows = procRows(); if (selW && !rows.some(r => r.w === selW)) selW = null;
            const maxDom = Math.max(1, ...rows.map(r => r.dom));
            const tr = r => `<tr class="${r.w === selW ? 'sel' : ''}" data-w="${r.w.id}"><td class="nm">${API.tile(r.w.app, 'sm')}<span>${e(r.name)}</span></td><td>${e(state(r.w))}</td>
                <td class="num" style="--h:${Math.round(r.dom / maxDom * 100)}%">${r.dom.toLocaleString('de-DE')}</td><td class="num">${r.page && r.load ? (r.load / 1000).toFixed(1).replace('.', ',') + ' s' : '–'}</td><td class="num">${r.page ? size(r.bytes) : '–'}</td></tr>`;
            const html = `<div class="tm2-h"><h2>Prozesse</h2><span class="tm2-fill"></span>
                    <button type="button" class="btn" data-pa="go" ${selW ? '' : 'disabled'}><i class="fa-solid fa-arrow-up-right-from-square"></i>Wechseln zu</button>
                    <button type="button" class="btn" data-pa="reload" ${selW && selW.frame ? '' : 'disabled'}><i class="fa-solid fa-arrows-rotate"></i>Neu laden</button>
                    <button type="button" class="btn bad" data-pa="kill" ${selW ? '' : 'disabled'}><i class="fa-solid fa-circle-xmark"></i>Task beenden</button></div>
                <div class="tm2-scroll"><table class="tm2-t"><thead><tr><th>Name</th><th>Status</th><th class="num" title="Anzahl der Bausteine auf der Seite – viele Elemente machen langsam">Elemente</th><th class="num" title="Wie lange die Seite zum Laden gebraucht hat">Ladezeit</th><th class="num" title="Übertragene Daten seit dem Öffnen">Daten</th></tr></thead>
                <tbody><tr class="grp"><td colspan="5">Apps (${rows.length})</td></tr>${rows.map(tr).join('') || '<tr><td colspan="5" class="tm2-e">Keine Fenster offen</td></tr>'}
                <tr class="grp"><td colspan="5">Dienste des Desktops</td></tr>${services().map(([ic, n, st]) => `<tr class="svc"><td class="nm"><span class="tm2-si"><i class="fa-solid ${ic}"></i></span><span>${e(n)}</span></td><td colspan="4">${e(st)}</td></tr>`).join('')}</tbody></table></div>`;
            const sc = main.querySelector('.tm2-scroll'), top = sc ? sc.scrollTop : 0; main.innerHTML = html; if (!full) main.querySelector('.tm2-scroll').scrollTop = top;
        }

        // ----- Leistung -----
        const fmt = { fps: v => v + ' FPS', mem: v => v ? size(v) : '–', dom: v => v.toLocaleString('de-DE'), net: v => size(v) + '/s' };
        const META = { fps: ['Bildrate', '#22d3ee', 'Bilder pro Sekunde. Unter 30 wirkt es ruckelig, 60 ist flüssig.'], mem: ['Arbeitsspeicher', '#a78bfa', performance.memory ? 'Belegter JavaScript-Speicher dieses Tabs (inklusive aller Fenster).' : `${BROWSER} zeigt den Arbeitsspeicher nicht an – das geht nur in Chrome und Edge.`],
            dom: ['Elemente', '#34d399', 'Alle Bausteine auf dem Desktop und in allen Fenstern zusammen.'], net: ['Netzwerk', '#fbbf24', 'Was gerade über das Internet geladen wird.'] };
        function spark(a, c, big) {
            const W = big ? 600 : 120, H = big ? 180 : 34, n = 60, mx = Math.max(1, ...a) * 1.15, pts = a.map((v, i) => `${(W - (a.length - 1 - i) * W / (n - 1)).toFixed(1)},${(H - v / mx * (H - 2) - 1).toFixed(1)}`);
            if (!pts.length) return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"></svg>`;
            const first = pts[0].split(',')[0];
            return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${big ? [1, 2, 3].map(k => `<line x1="0" x2="${W}" y1="${H * k / 4}" y2="${H * k / 4}" class="gl"/>`).join('') : ''}<path d="M${first},${H} L${pts.join(' L')} L${W},${H} Z" fill="${c}" fill-opacity=".16"/><polyline points="${pts.join(' ')}" fill="none" stroke="${c}" stroke-width="${big ? 2 : 1.5}" vector-effect="non-scaling-stroke"/></svg>`;
        }
        function paintPerf(full) {
            const lastOf = k => { const a = M[k]; return a.length ? a[a.length - 1] : 0; };
            const cards = Object.keys(META).map(k => `<button type="button" class="tm2-card${metric === k ? ' on' : ''}" data-mt="${k}"><span class="tm2-cs">${spark(M[k], META[k][1])}</span><span><b>${META[k][0]}</b><small>${k === 'mem' && !performance.memory ? 'nicht verfügbar' : fmt[k](lastOf(k))}</small></span></button>`).join('');
            const a = M[metric], avg = a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, [nm, c, desc] = META[metric];
            const perfV = window.JMOS_PERF ? JMOS_PERF.get() : 'auto';
            const info = [['Browser', BROWSER], ['Prozessorkerne', navigator.hardwareConcurrency || '–'], ['Gerätespeicher', navigator.deviceMemory ? '≈ ' + navigator.deviceMemory + ' GB' : '–'], ['Bildschirm', `${screen.width} × ${screen.height}`], ['Pixeldichte', (devicePixelRatio || 1).toFixed(2).replace('.', ',') + '×'],
                ['Fenster offen', API.wins.filter(w => !w.closing).length], ['Läuft seit', (() => { const m = Math.round(performance.now() / 60000); return m < 60 ? m + ' Min.' : Math.floor(m / 60) + ' Std. ' + (m % 60) + ' Min.'; })()]];
            if (full) main.innerHTML = `<div class="tm2-h"><h2>Leistung</h2></div><div class="tm2-perf"><div class="tm2-cards"></div><div class="tm2-big">
                    <div class="tm2-bh"><b class="tm2-bn"></b><span class="tm2-bv"></span></div><div class="tm2-graph"></div><small class="tm2-bd"></small>
                    <div class="tm2-stats"></div>
                    <div class="tm2-opts"><label class="set-row"><div><b>Leistungsmodus</b><small>Ohne Glas-Unschärfe und mit ruhigerem Hintergrund. „Automatisch“ = an in Firefox.</small></div><select class="sh-sel tm2-pm">${[['auto', 'Automatisch'], ['on', 'An'], ['off', 'Aus']].map(([v, n]) => `<option value="${v}" ${perfV === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
                    <label class="set-row"><div><b>Bildrate immer anzeigen</b><small>Kleine FPS-Anzeige oben rechts, auch wenn der Task-Manager zu ist.</small></div><input type="checkbox" class="tgl tm2-fo" ${S.tmFps ? 'checked' : ''}></label></div></div></div>`;
            main.querySelector('.tm2-cards').innerHTML = cards;
            main.querySelector('.tm2-bn').textContent = nm; main.querySelector('.tm2-bv').textContent = metric === 'mem' && !performance.memory ? '' : fmt[metric](lastOf(metric));
            main.querySelector('.tm2-graph').innerHTML = spark(a, c, true); main.querySelector('.tm2-bd').textContent = desc + ' Verlauf der letzten 60 Sekunden.';
            main.querySelector('.tm2-stats').innerHTML = (metric === 'mem' && !performance.memory ? '' : `<div><small>Durchschnitt</small><b>${fmt[metric](Math.round(avg))}</b></div><div><small>Minimum</small><b>${fmt[metric](a.length ? Math.min(...a) : 0)}</b></div><div><small>Maximum</small><b>${fmt[metric](a.length ? Math.max(...a) : 0)}</b></div>`)
                + info.map(([k, v]) => `<div><small>${e(k)}</small><b>${e(String(v))}</b></div>`).join('');
        }

        // ----- Speicher -----
        async function loadDisk() {
            const files = window.JMOS_FILES && JMOS_FILES.all ? JMOS_FILES.all() : [];
            let est = null; try { est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; } catch (x) {}
            let ls = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch (x) {}
            let cache = 0; try { cache = window.caches ? (await caches.keys()).length : 0; } catch (x) {}
            disk = { files, est, ls, cache };
        }
        function paintDisk() {
            if (!disk) { main.innerHTML = '<div class="tm2-h"><h2>Speicher</h2></div><div class="tm2-e"><i class="fa-solid fa-spinner fa-spin"></i> Wird berechnet …</div>'; loadDisk().then(() => page === 'disk' && paintDisk()); return; }
            const own = disk.files.filter(f => f.own), used = own.reduce((a, f) => a + (f.size || 0), 0), Q = 100 * 1048576;
            const KINDS = [['img', 'Bilder', '#38bdf8'], ['pdf', 'PDFs', '#f87171'], ['doc', 'Dokumente', '#60a5fa'], ['sheet', 'Tabellen', '#34d399'], ['txt', 'Text', '#94a3b8'], ['zip', 'Archive', '#fbbf24'], ['other', 'Sonstiges', '#a78bfa']];
            const by = KINDS.map(([k, n, c]) => { const l = own.filter(f => f.k === k); return { k, n, c, s: l.reduce((a, f) => a + (f.size || 0), 0), cnt: l.length }; }).filter(x => x.cnt);
            const top = own.slice().sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 8);
            main.innerHTML = `<div class="tm2-h"><h2>Speicher</h2><span class="tm2-fill"></span><button type="button" class="btn" data-pa="rescan"><i class="fa-solid fa-arrows-rotate"></i>Neu berechnen</button></div>
                <div class="tm2-scroll"><div class="tm2-box"><div class="tm2-bh"><b>Dokumente (Cloud)</b><span>${size(used)} von 100 MB · ${own.length} Dateien</span></div>
                    <div class="tm2-bar">${by.map(x => `<i style="width:${(x.s / Q * 100).toFixed(2)}%;background:${x.c}" title="${e(x.n)}: ${size(x.s)}"></i>`).join('')}</div>
                    <div class="tm2-leg">${by.map(x => `<span><i style="background:${x.c}"></i>${e(x.n)} <b>${size(x.s)}</b> <small>(${x.cnt})</small></span>`).join('')}<span><i class="free"></i>Frei <b>${size(Math.max(0, Q - used))}</b></span></div></div>
                <div class="tm2-box"><div class="tm2-bh"><b>Größte Dateien</b></div>${top.map(f => `<div class="tm2-fr"><span class="nm">${e(f.name)}<small> · ${e(f.folder ? ((window.JMOS_FILES.folders().find(x => x.id === f.folder) || {}).name || 'Ordner') : 'Eigene Dateien')}</small></span><small>${size(f.size || 0)}</small><button type="button" class="btn" data-show="${e(f.key)}"><i class="fa-solid fa-folder-open"></i>Zeigen</button></div>`).join('') || '<div class="tm2-e">Keine eigenen Dateien</div>'}</div>
                <div class="tm2-box"><div class="tm2-bh"><b>Speicher in diesem Browser</b>${disk.est ? `<span>${size(disk.est.usage || 0)} belegt</span>` : ''}</div>
                    <div class="tm2-fr"><span class="nm">Einstellungen und Entwürfe (localStorage)</span><small>${size(disk.ls)}</small></div>
                    <div class="tm2-fr"><span class="nm">Zwischengespeicherte Dateien</span><small>${disk.cache} ${disk.cache === 1 ? 'Speicher' : 'Speicher'}</small><button type="button" class="btn" data-pa="cache" ${disk.cache ? '' : 'disabled'}><i class="fa-solid fa-broom"></i>Leeren</button></div></div></div>`;
        }

        // ----- Benutzer -----
        function paintUsers() {
            const now = Date.now();
            if (!dir || now - dirT > 30000) { dirT = now; db.collection('directory').get().then(s => { const ms = v => v && v.toDate ? +v.toDate() : +v || 0; dir = s.docs.map(d => ({ uid: d.id, n: d.data().name || '?', thumb: d.data().thumb || '', c: d.data().color || '#818cf8', t: ms(d.data().lastSeen) })).sort((a, b) => b.t - a.t); if (page === 'users') paintUsers(); }).catch(() => { dir = dir || []; }); }
            if (!dir) { main.innerHTML = '<div class="tm2-h"><h2>Benutzer</h2></div><div class="tm2-e"><i class="fa-solid fa-spinner fa-spin"></i> Wird geladen …</div>'; return; }
            const ago = t => { const m = Math.round((now - t) / 60000); return !t ? 'noch nie' : m < 3 ? 'jetzt' : m < 60 ? 'vor ' + m + ' Min.' : m < 1440 ? 'vor ' + Math.round(m / 60) + ' Std.' : 'vor ' + Math.round(m / 1440) + ' Tagen'; };
            const on = dir.filter(x => x.t && now - x.t < 180000).length;
            main.innerHTML = `<div class="tm2-h"><h2>Benutzer</h2><span class="tm2-fill"></span><span class="tm2-sub">${on} online</span></div><div class="tm2-scroll"><table class="tm2-t"><thead><tr><th>Name</th><th>Status</th><th>Zuletzt aktiv</th></tr></thead><tbody>
                ${dir.map(x => { const live = x.t && now - x.t < 180000, me = x.uid === U.uid; return `<tr><td class="nm"><span class="tm2-av" style="--c:${e(x.c)}">${/^data:image\/(jpeg|png|webp);base64,/.test(x.thumb) ? `<img src="${x.thumb}" alt="">` : e(x.n.slice(0, 1).toUpperCase())}</span><span>${e(x.n)}${me ? ` <small>(du, ${BROWSER})</small>` : ''}</span></td>
                    <td><span class="tm2-dot${live || me ? ' on' : ''}"></span>${live || me ? 'Online' : 'Offline'}</td><td>${me ? 'jetzt' : ago(x.t)}</td></tr>`; }).join('')}</tbody></table></div>`;
        }

        const paint = full => { if (page === 'proc') paintProc(full); else if (page === 'perf') paintPerf(full); else if (page === 'disk') { if (full) paintDisk(); } else if (page === 'users') { if (full) paintUsers(); } };
        const tick = () => { if (page === 'proc' || page === 'perf') paint(false); };
        body.addEventListener('click', ev => {
            const pg = ev.target.closest('[data-pg]'); if (pg) return go(pg.dataset.pg);
            const mt = ev.target.closest('[data-mt]'); if (mt) { metric = mt.dataset.mt; return paintPerf(false); }
            const sh = ev.target.closest('[data-show]'); if (sh) { const it = JMOS_FILES.item(sh.dataset.show); if (it) API.openApp('explorer', { params: { view: it.folder || 'root', select: it.key } }); return; }
            const pa = ev.target.closest('[data-pa]');
            if (pa) return ({ go: () => { if (!selW) return; if (selW.min) API.toggleMin(selW, false); API.focus(selW); },
                reload: () => { if (selW && selW.frame) try { selW.frame.contentWindow.location.reload(); } catch (x) { selW.frame.src = selW.frame.src; } },
                kill: () => { if (selW) { API.closeWin(selW, true); selW = null; setTimeout(() => paint(false), 250); } },
                rescan: () => { disk = null; paintDisk(); },
                cache: async () => { try { for (const k of await caches.keys()) await caches.delete(k); } catch (x) {} disk = null; paintDisk(); } })[pa.dataset.pa]();
            const r = ev.target.closest('tr[data-w]'); if (r) { selW = API.wins.find(w => w.id === r.dataset.w) || null; paintProc(false); }
        });
        body.addEventListener('dblclick', ev => { const r = ev.target.closest('tr[data-w]'); if (r) { const w = API.wins.find(x => x.id === r.dataset.w); if (w) { if (w.min) API.toggleMin(w, false); API.focus(w); } } });
        body.addEventListener('keydown', ev => { if (ev.key === 'Delete' && selW && page === 'proc') { ev.preventDefault(); API.closeWin(selW, true); selW = null; setTimeout(() => paint(false), 250); } });
        body.addEventListener('change', ev => {
            if (ev.target.classList.contains('tm2-pm') && window.JMOS_PERF) { JMOS_PERF.set(ev.target.value); paint(false); }
            if (ev.target.classList.contains('tm2-fo')) { S.tmFps = ev.target.checked; API.save(); fpsOverlay(S.tmFps); }
        });
        views.add(tick); startMeter();
        win.onClose = () => { views.delete(tick); stopMeter(); };
        win.onParams = p => { if (p && p.page) go(p.page); };
        body.tabIndex = 0; go(page);
    }

    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        apps: [{ id: 'taskman', name: 'Task-Manager', icon: 'fa-chart-line', c: '#22d3ee', native: 'taskman', w: 880, h: 600, noRestore: true }],
        ui: { taskman: ui },
        init(api, user) {
            API = api; U = user; e = api.esc; S = api.state();
            api.keys.push(ev => { if ((ev.altKey && ev.key === 'Delete') || (ev.ctrlKey && ev.shiftKey && ev.key === 'Escape')) { API.openApp('taskman'); return true; } return false; });
            const tasks = document.getElementById('tasks');
            if (tasks) tasks.addEventListener('contextmenu', ev => { if (ev.target.closest('.task')) return; ev.preventDefault(); API.ctx(ev.clientX, ev.clientY - 10, [['fa-chart-line', 'Task-Manager', () => API.openApp('taskman')]], true); });
            if (S.tmFps) setTimeout(() => fpsOverlay(true), 1500);
        },
    });
})();
