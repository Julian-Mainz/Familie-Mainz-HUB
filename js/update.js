// js/update.js - Hinweis auf neue Versionen.
// Die GitHub-Action schreibt bei jedem Hochladen eine neue Nummer in /version.json. Dieses Skript fragt die Datei im Hintergrund ab
// (beim Öffnen, alle 5 Minuten, wenn der Tab wieder sichtbar wird und wenn die Verbindung zurückkommt). Ändert sich die Nummer,
// erscheint "Neue Version verfügbar". Seiten mit <html data-autoupdate> (Wandkalender) laden sich von selbst neu.
(function () {
    'use strict';
    if (window.__updateWatch) return; window.__updateWatch = true;
    const EVERY = 5 * 60 * 1000, SNOOZE = 20 * 60 * 1000;
    let known = null, shownFor = null, snoozedAt = 0, busy = false;

    async function fetchBuild() {
        const r = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) throw new Error('keine Versionsdatei');
        return String((await r.json()).build || '');
    }
    async function check() {
        if (busy) return; busy = true;
        try {
            const v = await fetchBuild(); if (!v) return;
            if (known === null) { known = v; return; }                   // erster Abruf: das ist die Version dieser Seite
            if (v === known) return;
            if (document.documentElement.hasAttribute('data-autoupdate')) return applyUpdate();
            if (shownFor === v && Date.now() - snoozedAt < SNOOZE) return;   // "Später" gedrückt
            showBanner(v);
        } catch (e) { /* offline oder noch keine Datei: beim nächsten Mal wieder */ } finally { busy = false; }
    }

    // Aktualisieren: erst die zwischengespeicherten Dateien dieser Seite neu laden, dann die Seite. Sonst könnte der Browser
    // (GitHub speichert Dateien bis zu 10 Minuten) nach dem Neuladen noch die alte Version zeigen.
    async function applyUpdate() {
        const urls = new Set([location.pathname + location.search]);
        ['/js/drawer.js', '/js/ux.js', '/js/search.js', '/js/settings.js', '/js/calendar-core.js', '/js/messenger-core.js', '/js/firebase-init.js', '/js/update.js', '/assets/ui.css', '/assets/ux.css', '/assets/icons.css'].forEach(u => urls.add(u));
        document.querySelectorAll('script[src],link[rel="stylesheet"]').forEach(el => { try { const u = new URL(el.src || el.href, location.href); if (u.origin === location.origin) urls.add(u.pathname + u.search); } catch (e) {} });
        await Promise.all([...urls].map(u => fetch(u, { cache: 'reload' }).catch(() => {})));
        location.reload();
    }

    function showBanner(v) {
        shownFor = v; if (document.getElementById('upd-banner')) return;
        if (!document.getElementById('upd-style')) {
            const st = document.createElement('style'); st.id = 'upd-style';
            st.textContent = `#upd-banner{position:fixed;z-index:120;left:50%;bottom:24px;transform:translateX(-50%);display:flex;align-items:center;gap:14px;max-width:min(94vw,560px);padding:12px 14px 12px 16px;border-radius:20px;
                background:linear-gradient(180deg,#1b2440,#0f172a);border:1px solid rgba(129,140,248,.45);box-shadow:0 20px 50px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.04) inset;color:#f1f5f9;font:14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;animation:updIn .45s cubic-bezier(.2,.9,.3,1.15)}
                #upd-banner .ic{flex:none;width:38px;height:38px;border-radius:13px;display:grid;place-items:center;font-size:19px;color:#fff;background:linear-gradient(135deg,#6366f1,#ec4899);animation:updSpin 3s ease-in-out infinite}
                #upd-banner b{display:block;font-size:14.5px}#upd-banner small{display:block;color:#94a3b8;font-size:12px;margin-top:2px}
                #upd-banner button{font:inherit;font-weight:600;font-size:13px;border:0;border-radius:13px;padding:10px 14px;cursor:pointer;white-space:nowrap;transition:transform .15s,filter .2s}
                #upd-banner .go{color:#fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);box-shadow:0 8px 20px -6px rgba(99,102,241,.8)}#upd-banner .go:hover{filter:brightness(1.12)}#upd-banner .go:active,#upd-banner .later:active{transform:scale(.96)}
                #upd-banner .later{color:#94a3b8;background:rgba(148,163,184,.12)}#upd-banner .later:hover{color:#fff}
                @keyframes updIn{from{opacity:0;transform:translate(-50%,18px) scale(.94)}}@keyframes updSpin{50%{transform:rotate(180deg)}}
                @media (max-width:1023.98px){#upd-banner{bottom:calc(96px + env(safe-area-inset-bottom));flex-wrap:wrap;justify-content:flex-end}#upd-banner div{flex:1 1 180px}}
                @media (prefers-reduced-motion:reduce){#upd-banner,#upd-banner .ic{animation:none}}`;
            document.head.appendChild(st);
        }
        const b = document.createElement('div'); b.id = 'upd-banner'; b.setAttribute('role', 'status'); b.setAttribute('aria-live', 'polite');
        b.innerHTML = '<span class="ic" aria-hidden="true">\u21bb</span><div><b>Neue Version verfügbar</b><small>Bitte die Seite aktualisieren, damit alles richtig funktioniert.</small></div><button type="button" class="go">Jetzt aktualisieren</button><button type="button" class="later">Später</button>';
        b.querySelector('.go').onclick = e => { e.target.disabled = true; e.target.textContent = 'Wird aktualisiert…'; applyUpdate(); };
        b.querySelector('.later').onclick = () => { snoozedAt = Date.now(); b.remove(); };
        document.body.appendChild(b);
    }

    check();
    setInterval(() => { if (!document.hidden) check(); }, EVERY);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    window.addEventListener('online', check);
    window.checkForUpdate = check;                  // auch zum Testen
})();
