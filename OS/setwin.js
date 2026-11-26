/* J.Mainz OS – Einstellungen wie bei Windows 11: links Konto, Suche und Kategorien, rechts die Seite mit gruppierten Einträgen.
   Die anderen Module hängen ihre Bereiche wie bisher an .app-set an; dieses Modul läuft zuletzt und sortiert die Zeilen in Seiten ein. */
(function () {
    'use strict';
    let API, U, S, e;
    let lastPage = 'home';

    const PAGES = [
        { id: 'home', name: 'Startseite', icon: 'fa-house', c: '#60a5fa' },
        { id: 'system', name: 'System', icon: 'fa-display', c: '#38bdf8', groups: [['Benachrichtigungen', ['Chat-Blasen']], ['Ton', ['Systemklänge', 'Lautstärke der Klänge']], ['Bildschirm', ['Bildschirmschoner', 'Leistungsmodus']], ['Fenster', ['Links als neues Fenster öffnen']], ['Desktop', ['Symbole neu anordnen', 'Ausgeblendete Desktop-Symbole', 'Alle Fenster schließen']]] },
        { id: 'pers', name: 'Personalisierung', icon: 'fa-paintbrush', c: '#f472b6', hero: 'pers', groups: [['Hintergrund', ['walls', 'Eigenes Hintergrundbild']], ['Farben', ['Akzentfarbe']], ['Lebendiger Hintergrund', ['Sternschnuppen', 'Tageszeit', 'Wetter']], ['Jahreszeiten', ['Jahreszeiten-Themen']], ['Desktop-Symbole', ['Symbolgröße']]] },
        { id: 'task', name: 'Taskleiste & Start', icon: 'fa-border-all', c: '#818cf8', groups: [['Taskleiste', ['Taskleiste', 'Musik in der Taskleiste']], ['Start', ['Desktop-Modus als Start']], ['Widgets', ['Widgets']]] },
        { id: 'astro', name: 'Astro', icon: 'fa-user-astronaut', c: '#a78bfa', hero: 'astro', groups: [['Astro', ['Astro, der kleine Astronaut', 'Outfit für Astro', 'Astro sagt Bescheid']], ['Spielen', ['Minispiel „Sterne sammeln“']]] },
        { id: 'konto', name: 'Konto', icon: 'fa-user', c: '#34d399', hero: 'konto', groups: [['Anmeldeoptionen', ['PIN zum Entsperren', 'Automatisch sperren', 'Jetzt sperren']], ['Konto', ['Profil bearbeiten', 'Abmelden']]] },
        { id: 'privacy', name: 'Datenschutz & Sicherheit', icon: 'fa-shield-halved', c: '#fbbf24', groups: [['Zwischenablage', ['Zwischenablage-Verlauf', 'Zwischenablage leeren']], ['Verlauf', ['Zuletzt geöffnet leeren']], ['Erinnerungen', ['Geplante Erinnerungen']]] },
        { id: 'info', name: 'Info', icon: 'fa-circle-info', c: '#94a3b8', hero: 'info', groups: [['Hilfe', ['Tastenkürzel anzeigen', 'Was ist neu?']], ['App', ['Als App installieren', 'Normales Dashboard', 'Neu laden']]] },
    ];
    const HIDE = ['Tastenkürzel'];          // alte Textzeile, ersetzt durch „Tastenkürzel anzeigen“
    const ICONS = {
        'walls': ['fa-image', '#f472b6'], 'Eigenes Hintergrundbild': ['fa-image', '#f472b6'], 'Akzentfarbe': ['fa-palette', '#a78bfa'], 'Symbolgröße': ['fa-table-cells-large', '#60a5fa'], 'Taskleiste': ['fa-border-all', '#818cf8'],
        'Sternschnuppen': ['fa-wand-magic-sparkles', '#fde68a'], 'Tageszeit': ['fa-sun', '#fbbf24'], 'Wetter': ['fa-cloud-sun', '#38bdf8'], 'Astro, der kleine Astronaut': ['fa-user-astronaut', '#a78bfa'],
        'Bildschirmschoner': ['fa-moon', '#818cf8'], 'Systemklänge': ['fa-volume-high', '#f472b6'], 'Lautstärke der Klänge': ['fa-sliders', '#f472b6'], 'Leistungsmodus': ['fa-gauge-high', '#4ade80'], 'Als App installieren': ['fa-download', '#34d399'], 'Jahreszeiten-Themen': ['fa-snowflake', '#7dd3fc'], 'Outfit für Astro': ['fa-shirt', '#f472b6'],
        'Astro sagt Bescheid': ['fa-comment', '#a78bfa'], 'Minispiel „Sterne sammeln“': ['fa-star', '#facc15'], 'Desktop-Modus als Start': ['fa-desktop', '#38bdf8'], 'Widgets': ['fa-table-cells-large', '#34d399'],
        'Chat-Blasen': ['fa-comments', '#f472b6'], 'Musik in der Taskleiste': ['fa-music', '#4ade80'], 'Automatisch sperren': ['fa-clock', '#94a3b8'], 'PIN zum Entsperren': ['fa-lock', '#fbbf24'],
        'Jetzt sperren': ['fa-lock', '#94a3b8'], 'Links als neues Fenster öffnen': ['fa-window-restore', '#60a5fa'], 'Symbole neu anordnen': ['fa-table-cells-large', '#94a3b8'], 'Ausgeblendete Desktop-Symbole': ['fa-eye-slash', '#94a3b8'], 'Alle Fenster schließen': ['fa-xmark', '#f87171'],
        'Normales Dashboard': ['fa-border-all', '#818cf8'], 'Profil bearbeiten': ['fa-user-pen', '#34d399'], 'Abmelden': ['fa-arrow-right-from-bracket', '#f87171'], 'Zwischenablage-Verlauf': ['fa-clipboard', '#fbbf24'],
        'Zwischenablage leeren': ['fa-broom', '#fbbf24'], 'Zuletzt geöffnet leeren': ['fa-clock-rotate-left', '#94a3b8'], 'Geplante Erinnerungen': ['fa-bell', '#f472b6'], 'Tastenkürzel anzeigen': ['fa-keyboard', '#a5b4fc'],
        'Was ist neu?': ['fa-wand-magic-sparkles', '#f472b6'], 'Neu laden': ['fa-arrows-rotate', '#94a3b8'],
    };
    const TILES = [['pers', 'Hintergrund', 'fa-image', '#f472b6', 'Weltall, Planet, Nebel oder eigenes Foto'], ['pers', 'Akzentfarbe', 'fa-palette', '#a78bfa', 'Farbe für Knöpfe und Fenster'],
        ['astro', 'Astro', 'fa-user-astronaut', '#a78bfa', 'Outfit, Ansagen und Minispiel'], ['konto', 'Sperrbildschirm', 'fa-lock', '#fbbf24', 'PIN und automatisch sperren'],
        ['task', 'Widgets', 'fa-table-cells-large', '#34d399', 'Uhr, Wetter, Mein Tag und mehr'], ['system', 'Bildschirmschoner', 'fa-moon', '#818cf8', 'Flug durch die Sterne']];

    const clipKey = () => 'jmos-clip-' + U.uid;
    // Eigene Zeilen (Konto, Datenschutz, Info)
    function ownRows() {
        const rems = (S.reminders || []).length;
        return `<section data-h="__own">
            <div class="set-row" data-own="profil"><div><b>Profil bearbeiten</b><small>Name, Profilbild und Farbe ändern.</small></div><button type="button" class="btn" data-ow="profil"><i class="fa-solid fa-user-pen"></i>Öffnen</button></div>
            <div class="set-row"><div><b>Abmelden</b><small>Vom J.Mainz Dashboard auf diesem Gerät abmelden.</small></div><button type="button" class="btn" data-ow="logout"><i class="fa-solid fa-arrow-right-from-bracket"></i>Abmelden</button></div>
            <label class="set-row"><div><b>Zwischenablage-Verlauf</b><small>Merkt sich, was du im OS kopierst (Alt+V). Nur in diesem Browser, nie aus dem Passwort-Safe.</small></div><input type="checkbox" class="tgl" data-ow="clip" ${S.clipOff ? '' : 'checked'}></label>
            <div class="set-row"><div><b>Zwischenablage leeren</b><small>Löscht alle gemerkten Einträge.</small></div><button type="button" class="btn" data-ow="clipclear"><i class="fa-solid fa-broom"></i>Leeren</button></div>
            <div class="set-row"><div><b>Zuletzt geöffnet leeren</b><small>Leert die Liste im Startmenü (Apps und Dateien).</small></div><button type="button" class="btn" data-ow="recent"><i class="fa-solid fa-broom"></i>Leeren</button></div>
            <div class="set-row"><div><b>Geplante Erinnerungen</b><small>${rems ? rems + (rems === 1 ? ' Erinnerung ist' : ' Erinnerungen sind') + ' geplant.' : 'Keine Erinnerungen geplant. Neue über die Suche („erinnere mich in 20 min an …“) oder Alt+A.'}</small></div>${rems ? '<button type="button" class="btn" data-ow="rems"><i class="fa-solid fa-trash-can"></i>Alle löschen</button>' : ''}</div>
            <div class="set-row"><div><b>Tastenkürzel anzeigen</b><small>Alle Kürzel auf einen Blick (auch mit Alt+? oder F1).</small></div><button type="button" class="btn" data-ow="keys"><i class="fa-solid fa-keyboard"></i>Anzeigen</button></div>
            <div class="set-row"><div><b>Was ist neu?</b><small>Alle Änderungen am Dashboard und am OS im Changelog.</small></div><button type="button" class="btn" data-ow="news"><i class="fa-solid fa-wand-magic-sparkles"></i>Changelog</button></div>
            <div class="set-row"><div><b>Neu laden</b><small>Lädt das OS neu, z. B. nach einem Update. Offene Fenster kommen wieder.</small></div><button type="button" class="btn" data-ow="reload"><i class="fa-solid fa-arrows-rotate"></i>Neu laden</button></div>
        </section>`;
    }
    const titleOf = r => r.classList.contains('walls') ? 'walls' : ((r.querySelector('b') || {}).textContent || '').trim();

    function hero(kind) {
        const name = [U.firstName, U.lastName].filter(Boolean).join(' ') || U.email;
        if (kind === 'pers') return `<div class="ws-hero ws-pv"><div class="pv-scr"><div class="pv-wall"></div><div class="pv-win"><i></i><i></i><i></i></div><div class="pv-bar"><span></span><i></i><i></i><i></i></div></div><div class="ws-hero-t"><b>Dein Desktop</b><small>Hintergrund, Farben und lebendige Effekte</small></div></div>`;
        if (kind === 'konto') return `<div class="ws-hero"><span class="ws-av big">${typeof avatarInner === 'function' ? avatarInner({ ...U, name }) : e(name[0])}</span><div class="ws-hero-t"><b>${e(name)}</b><small>${e(U.email || '')}</small><em>${isAdmin(U) ? 'Administrator' : 'Familienmitglied'}</em></div></div>`;
        if (kind === 'astro') return `<div class="ws-hero ws-astro"><div class="ws-astro-a" id="ws-astro-a"></div><div class="ws-hero-t"><b>Astro</b><small>Dein kleiner Begleiter auf dem Desktop. Bestwert im Minispiel: ${+S.astroBest || 0} Punkte.</small></div></div>`;
        if (kind === 'info') return `<div class="ws-hero"><div class="boot-logo ws-logo"><span></span><span></span><span></span><span></span></div><div class="ws-hero-t"><b>J.Mainz <span class="ws-grad">OS</span></b><small class="ws-ver">Stand wird geladen …</small><em>Desktop-Modus des J.Mainz Dashboards</em></div></div>`;
        return '';
    }
    function home() {
        const name = U.firstName || '';
        return `<div class="ws-hero ws-pv"><div class="pv-scr"><div class="pv-wall"></div><div class="pv-win"><i></i><i></i><i></i></div><div class="pv-bar"><span></span><i></i><i></i><i></i></div></div><div class="ws-hero-t"><b>Hallo${name ? ', ' + e(name) : ''}</b><small>Hier stellst du dein J.Mainz OS ein.</small></div></div>
            <h3 class="ws-gt">Empfohlen</h3><div class="ws-tiles">${TILES.map(([pg, t, ic, c, d]) => `<button type="button" class="ws-tile" data-go="${pg}" data-hl="${e(t)}"><span class="ws-ri" style="--c:${c}"><i class="fa-solid ${ic}"></i></span><span><b>${e(t)}</b><small>${e(d)}</small></span><i class="fa-solid fa-chevron-right"></i></button>`).join('')}</div>`;
    }
    function paintPreview(root) {
        root.querySelectorAll('.pv-wall').forEach(pv => {
            const w = document.getElementById('wall'), img = document.querySelector('#wall .wall-img'), bi = img ? getComputedStyle(img) : null;
            pv.style.background = getComputedStyle(w).background;
            if (bi && bi.backgroundImage !== 'none' && +bi.opacity > 0) { pv.style.backgroundImage = bi.backgroundImage; pv.style.backgroundSize = 'cover'; pv.style.backgroundPosition = 'center'; pv.style.filter = bi.filter; } else pv.style.filter = '';
        });
    }

    function build(body) {
        const set = body.querySelector('.app-set'); if (!set || set.dataset.ws) return; set.dataset.ws = '1';
        set.insertAdjacentHTML('beforeend', ownRows());
        // alle Zeilen einsammeln, mit Symbol versehen und im Lager parken
        const store = document.createElement('div'); store.className = 'ws-store'; store.hidden = true;
        const rows = {};
        set.querySelectorAll(':scope > section').forEach(sec => {
            sec.querySelectorAll(':scope > .set-row, :scope > .walls').forEach(r => {
                const t = titleOf(r); if (!t) return; r.dataset.t = t;
                if (r.classList.contains('set-row') && !r.querySelector('.ws-ri')) { const ic = ICONS[t] || ['fa-sliders', '#94a3b8']; r.insertAdjacentHTML('afterbegin', `<span class="ws-ri" style="--c:${ic[1]}"><i class="fa-solid ${ic[0]}"></i></span>`); }
                rows[t] = r; store.appendChild(r);
            });
            sec.remove();
        });
        HIDE.forEach(t => { if (rows[t]) { rows[t].remove(); delete rows[t]; } });
        const used = new Set(PAGES.flatMap(p => (p.groups || []).flatMap(g => g[1])));
        const extra = Object.keys(rows).filter(t => !used.has(t));
        const pages = PAGES.slice(); if (extra.length) pages.push({ id: 'more', name: 'Weitere', icon: 'fa-sliders', c: '#94a3b8', groups: [['Weitere Einstellungen', extra]] });

        // Grundgerüst
        const name = [U.firstName, U.lastName].filter(Boolean).join(' ') || U.email;
        const ws = document.createElement('div'); ws.className = 'ws';
        ws.innerHTML = `<nav class="ws-nav" aria-label="Einstellungen"><button type="button" class="ws-me" data-go="konto"><span class="ws-av">${typeof avatarInner === 'function' ? avatarInner({ ...U, name }) : e(name[0])}</span><span><b>${e(name)}</b><small>${e(U.email || '')}</small></span></button>
            <label class="ws-q"><input type="search" placeholder="Einstellung suchen" aria-label="Einstellung suchen" autocomplete="off"><i class="fa-solid fa-magnifying-glass"></i></label>
            <div class="ws-list">${pages.map(p => `<button type="button" class="ws-nb" data-go="${p.id}"><span class="ws-ni" style="--c:${p.c}"><i class="fa-solid ${p.icon}"></i></span><span>${e(p.name)}</span></button>`).join('')}</div></nav>
            <div class="ws-main"><div class="ws-head"><h2></h2></div></div>`;
        body.insertBefore(ws, set); ws.querySelector('.ws-main').appendChild(set); set.appendChild(store);
        const head = ws.querySelector('.ws-head h2'), q = ws.querySelector('.ws-q input');

        const clear = () => { set.querySelectorAll('.ws-g, .ws-page').forEach(g => { g.querySelectorAll('[data-t]').forEach(r => store.appendChild(r)); g.remove(); }); };
        const groupEl = (title, list) => { const g = document.createElement('section'); g.className = 'ws-g'; g.innerHTML = `<h3 class="ws-gt">${e(title)}</h3>`; list.forEach(r => g.appendChild(r)); return g; };
        function show(id, hl) {
            const p = pages.find(x => x.id === id) || pages[0]; lastPage = p.id; clear();
            ws.querySelectorAll('.ws-nb').forEach(b => b.classList.toggle('on', b.dataset.go === p.id));
            head.innerHTML = p.id === 'home' ? 'Startseite' : `<span class="ws-crumb">Einstellungen</span><i class="fa-solid fa-chevron-right"></i>${e(p.name)}`;
            const top = document.createElement('div'); top.className = 'ws-page';
            top.innerHTML = p.id === 'home' ? home() : hero(p.hero || '');
            set.insertBefore(top, store);
            (p.groups || []).forEach(([t, list]) => { const rs = list.map(x => rows[x]).filter(Boolean); if (rs.length) set.insertBefore(groupEl(t, rs), store); });
            if (p.id === 'astro') { const a = ws.querySelector('#ws-astro-a'); if (a && window.JMOS_ASTRO) { a.innerHTML = JMOS_ASTRO.svg; if (window.JMOS_ASTRO_DRESS) JMOS_ASTRO_DRESS({ querySelector: s => a.querySelector(s), classList: a.classList }); } }
            if (p.id === 'info') fetch('/CHANGELOG.md', { cache: 'no-store' }).then(r => r.text()).then(t => { const m = t.match(/^## (.+)$/m), v = ws.querySelector('.ws-ver'); if (v) v.textContent = m ? 'Letztes Update: ' + m[1] : ''; }).catch(() => {});
            paintPreview(set); set.scrollTop = 0;
            if (hl) { const r = rows[hl] || (hl === 'Hintergrund' ? rows.walls : hl === 'Sperrbildschirm' ? rows['PIN zum Entsperren'] : null); if (r) { r.classList.add('ws-hl'); setTimeout(() => r.scrollIntoView({ block: 'center', behavior: 'smooth' }), 30); setTimeout(() => r.classList.remove('ws-hl'), 1800); } }
        }
        function search(v) {
            v = v.trim().toLowerCase(); if (!v) return show(lastPage === 'search' ? 'home' : lastPage);
            clear(); ws.querySelectorAll('.ws-nb').forEach(b => b.classList.remove('on'));
            head.innerHTML = `Suchergebnisse für „${e(v)}“`;
            let n = 0;
            pages.forEach(p => { const rs = (p.groups || []).flatMap(g => g[1]).map(x => rows[x]).filter(r => r && r.textContent.toLowerCase().includes(v)); if (rs.length) { n += rs.length; set.insertBefore(groupEl(p.name, rs), store); } });
            if (!n) { const d = document.createElement('div'); d.className = 'ws-page'; d.innerHTML = `<div class="ws-none"><i class="fa-solid fa-magnifying-glass"></i><b>Nichts gefunden</b><span>Versuch es mit einem anderen Begriff, z. B. „Hintergrund“, „PIN“ oder „Astro“.</span></div>`; set.insertBefore(d, store); }
            lastPage = lastPage === 'search' ? 'home' : lastPage;
        }
        ws.addEventListener('click', ev => {
            const g = ev.target.closest('[data-go]'); if (g) { q.value = ''; show(g.dataset.go, g.dataset.hl); return; }
            const o = ev.target.closest('[data-ow]'); if (!o || o.type === 'checkbox') return;
            ({
                profil: () => { if (!API.hasApp('profil')) API.registerApp({ id: 'profil', name: 'Profil', icon: 'fa-user', c: '#34d399', url: '/profil.html', hidden: true }); API.openApp('profil'); },
                logout: () => handleLogout(),
                clipclear: () => { try { localStorage.removeItem(clipKey()); } catch (x) { } o.innerHTML = '<i class="fa-solid fa-check"></i>Geleert'; },
                recent: () => { S.recent = []; S.recentFiles = []; API.save(); o.innerHTML = '<i class="fa-solid fa-check"></i>Geleert'; },
                rems: async () => { if (!(await uiConfirm('Alle geplanten Erinnerungen löschen?', { danger: true, ok: 'Löschen' }))) return; S.reminders = []; API.save(); o.closest('.set-row').querySelector('small').textContent = 'Keine Erinnerungen geplant.'; o.remove(); },
                keys: () => window.JMOS_KEYS_HELP && JMOS_KEYS_HELP(),
                news: () => API.openApp('changelog'),
                reload: () => location.reload(),
            })[o.dataset.ow]?.();
        });
        ws.addEventListener('change', ev => { if (ev.target.dataset.ow === 'clip') { S.clipOff = !ev.target.checked; API.save(); } });
        set.addEventListener('click', () => setTimeout(() => paintPreview(set), 80));
        let qt = 0; q.addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => search(q.value), 120); });
        q.addEventListener('keydown', ev => { if (ev.key === 'Escape' && q.value) { ev.stopPropagation(); q.value = ''; search(''); } });
        body._wsShow = show;
        show(body._wsPage || lastPage);
    }

    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        init(api, user) {
            API = api; U = user; e = api.esc; S = api.state();
            const base0 = window.JMOS_NATIVE_UI.set;
            window.JMOS_NATIVE_UI.set = (b, w) => {
                base0(b, w); build(b);
                if (w) w.onParams = p => { if (p && p.page && b._wsShow) b._wsShow(p.page, p.hl); };
                if (w && w.params && w.params.page) b._wsShow(w.params.page, w.params.hl);
            };
        },
    });
})();
