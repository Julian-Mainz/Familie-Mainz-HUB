// OS/office.js – Writer, Tabellen und Präsentation werden erst beim ersten Öffnen geladen (das OS startet dadurch schneller).
// Die Dateien stehen in OS/index.html als <link rel="prefetch" data-lazy …>: Der Browser lädt sie in Ruhe vor, führt sie aber erst aus, wenn man die App öffnet.
(function () {
    'use strict';
    const KIT = ['officekit.js', 'chart.js'];             // gemeinsam: Automatisch speichern, Versionen, Vorlagen, Diagramme
    const GROUPS = { writer: [...KIT, 'docx.js', 'writer.js'], tabellen: [...KIT, 'sheetcore.js', 'calc.js'], praesentation: [...KIT, 'pptx.js', 'slides.js'] };
    const APPS = [
        { id: 'writer', name: 'Writer', icon: 'fa-file-word', c: '#2b6cdf', native: 'writer', w: 1120, h: 760 },
        { id: 'tabellen', name: 'Tabellen', icon: 'fa-table-cells', c: '#1e8e4e', native: 'tabellen', w: 1160, h: 760 },
        { id: 'praesentation', name: 'Präsentation', icon: 'fa-person-chalkboard', c: '#d24726', native: 'praesentation', w: 1180, h: 780 },
    ];
    // Eigene OS-Apps statt der Dashboard-Seiten im Fenster (gleiche Daten, eigene Oberfläche) – ebenfalls erst beim Öffnen geladen
    const NATIVE2 = [
        [{ id: 'wand', name: 'Kalender', icon: 'fa-calendar-days', c: '#22d3ee', perm: 'termine', path: '/wand.html', w: 1180, h: 780 }, ['/js/calendar-core.js', 'app-kalender.js']],
        [{ id: 'zeiterfassung', name: 'Zeiterfassung', icon: 'fa-business-time', c: '#34d399', perm: 'zeit', path: '/zeiterfassung.html', w: 1120, h: 760 }, ['/js/timesheet.js', 'app-zeit.js']],
        [{ id: 'finanzen', name: 'Finanzen', icon: 'fa-coins', c: '#facc15', perm: 'finanzen', path: '/finanzen.html', w: 1160, h: 780 }, ['app-finanzen.js']],
        [{ id: 'passwort', name: 'Passwort-Safe', icon: 'fa-shield-halved', c: '#fb923c', perm: 'tresor', path: '/passwort.html', w: 980, h: 680 }, ['app-tresor.js']],
        [{ id: 'spotify', name: 'Spotify', icon: 'fa-headphones', c: '#4ade80', perm: 'spotify', path: '/spotify.html', w: 1080, h: 720 }, ['app-spotify.js']],
        [{ id: 'changelog', name: 'Changelog', icon: 'fa-clock-rotate-left', c: '#a78bfa', path: '/changelog.html', w: 1000, h: 720 }, ['app-changelog.js']],
        [{ id: 'admin', name: 'Admin', icon: 'fa-user-shield', c: '#c084fc', admin: true, path: '/admin.html', w: 1180, h: 780 }, ['app-admin.js']],
    ];
    NATIVE2.forEach(([a, files]) => { a.native = a.id; APPS.push(a); GROUPS[a.id] = ['app-kit.js', ...files]; });
    let API = null, U = null; const mods = {}, loading = {};
    const url = f => { const l = document.querySelector(`link[data-lazy][href^="${f}"]`); return l ? l.getAttribute('href') : f; };
    const script = f => loading[f] || (document.querySelector(`script[src^="${f}"]`) ? (loading[f] = Promise.resolve()) : null) || (loading[f] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = url(f); s.onload = res; s.onerror = () => { delete loading[f]; rej(new Error(`„${f}“ konnte nicht geladen werden. Bist du online?`)); }; document.head.appendChild(s); }));
    const need = id => (mods[id] ? Promise.resolve(mods[id]) : GROUPS[id].reduce((p, f) => p.then(() => script(f)), Promise.resolve()).then(() => { if (!mods[id]) throw new Error('App nicht gefunden'); return mods[id]; }));
    window.JMOS_LAZY = {
        register(id, m) { mods[id] = m; if (API) { if (window.JMOFFICE) JMOFFICE.init(API, U); m.init && m.init(API, U); } },
        need,                                       // z. B. für die Volltextsuche: JMOS_LAZY.need('writer')
        script,
    };
    const stub = id => (body, win) => {
        body.innerHTML = '<div class="lz-load"><i class="fa-solid fa-spinner fa-spin"></i><span>Wird geladen …</span></div>';
        need(id).then(m => { body.innerHTML = ''; m.ui(body, win); }).catch(x => { body.innerHTML = `<div class="lz-load"><i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i><span>${String(x.message).replace(/</g, '&lt;')}</span></div>`; });
    };
    const opener = id => ({ open: key => API.openApp(id, { key: id.slice(0, 2) + ':' + key, params: { open: key } }), create: (folder, tpl) => API.openApp(id, { key: id.slice(0, 2) + ':neu' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), params: { folder: folder || '', tpl: tpl || 'leer' } }) });
    window.JMOS_WRITER = opener('writer'); window.JMOS_CALC = opener('tabellen'); window.JMOS_SLIDES = opener('praesentation');
    // gleiche Fenster-Schlüssel wie in den Apps selbst
    window.JMOS_WRITER.open = key => API.openApp('writer', { key: 'wr:' + key, params: { open: key } });
    window.JMOS_CALC.open = key => API.openApp('tabellen', { key: 'tb:' + key, params: { open: key } });
    window.JMOS_SLIDES.open = key => API.openApp('praesentation', { key: 'px:' + key, params: { open: key } });
    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        apps: APPS, ui: Object.fromEntries(APPS.map(a => [a.id, stub(a.id)])),
        init(api, user) { API = api; U = user; if (window.JMOFFICE) JMOFFICE.init(api, user); Object.values(mods).forEach(m => m.init && m.init(api, user)); },
    });
})();
