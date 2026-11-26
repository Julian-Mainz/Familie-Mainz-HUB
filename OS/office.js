// OS/office.js – Writer, Tabellen und Präsentation werden erst beim ersten Öffnen geladen (das OS startet dadurch schneller).
// Die Dateien stehen in OS/index.html als <link rel="prefetch" data-lazy …>: Der Browser lädt sie in Ruhe vor, führt sie aber erst aus, wenn man die App öffnet.
(function () {
    'use strict';
    const GROUPS = { writer: ['docx.js', 'writer.js'], tabellen: ['sheetcore.js', 'calc.js'], praesentation: ['pptx.js', 'slides.js'] };
    const APPS = [
        { id: 'writer', name: 'Writer', icon: 'fa-file-word', c: '#2b6cdf', native: 'writer', w: 1120, h: 760 },
        { id: 'tabellen', name: 'Tabellen', icon: 'fa-table-cells', c: '#1e8e4e', native: 'tabellen', w: 1160, h: 760 },
        { id: 'praesentation', name: 'Präsentation', icon: 'fa-person-chalkboard', c: '#d24726', native: 'praesentation', w: 1180, h: 780 },
    ];
    let API = null, U = null; const mods = {}, loading = {};
    const url = f => { const l = document.querySelector(`link[data-lazy][href^="${f}"]`); return l ? l.getAttribute('href') : f; };
    const script = f => loading[f] || (loading[f] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = url(f); s.onload = res; s.onerror = () => { delete loading[f]; rej(new Error(`„${f}“ konnte nicht geladen werden. Bist du online?`)); }; document.head.appendChild(s); }));
    const need = id => (mods[id] ? Promise.resolve(mods[id]) : GROUPS[id].reduce((p, f) => p.then(() => script(f)), Promise.resolve()).then(() => { if (!mods[id]) throw new Error('App nicht gefunden'); return mods[id]; }));
    window.JMOS_LAZY = {
        register(id, m) { mods[id] = m; if (API) m.init(API, U); },
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
        apps: APPS, ui: { writer: stub('writer'), tabellen: stub('tabellen'), praesentation: stub('praesentation') },
        init(api, user) { API = api; U = user; Object.values(mods).forEach(m => m.init(api, user)); },
    });
})();
