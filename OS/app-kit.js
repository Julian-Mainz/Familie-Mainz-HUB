// OS/app-kit.js – kleine gemeinsame Helfer für die eigenen OS-Apps (Dialog im Fenster, Hinweis, Formate)
(function () {
    'use strict';
    if (window.OAK) return;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function modal(root, html, o = {}) {
        root.querySelectorAll(':scope > .oa-mod').forEach(m => m.remove());
        const m = document.createElement('div'); m.className = 'oa-mod'; m.innerHTML = `<div class="oa-box"${o.w ? ` style="width:min(${o.w}px,100%)"` : ''}>${html}</div>`;
        const close = () => { m.remove(); root.removeEventListener('keydown', key, true); };
        const key = ev => { if (ev.key === 'Escape' && !o.lock) { ev.stopPropagation(); close(); } };
        if (!o.lock) m.addEventListener('mousedown', ev => { if (ev.target === m) close(); });
        m.addEventListener('click', ev => { if (ev.target.closest('[data-close]')) close(); });
        root.addEventListener('keydown', key, true); root.appendChild(m);
        const f = m.querySelector('[autofocus], input:not([type=checkbox]), select, textarea'); if (f) setTimeout(() => f.focus(), 30);
        return { box: m.firstChild, close };
    }
    function toast(root, msg, bad) { const t = document.createElement('div'); t.className = 'mx-toast' + (bad ? ' bad' : ''); t.textContent = msg; root.appendChild(t); setTimeout(() => t.remove(), 3200); }
    const eur = n => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    const d2 = t => t ? new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–';
    const ms = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : t && t.seconds ? t.seconds * 1000 : typeof t === 'number' ? t : t ? Date.parse(t) || 0 : 0);
    const iso = d => { d = new Date(d); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const errMsg = x => /permission|insufficient/i.test((x && (x.code || x.message)) || '') ? 'Dafür fehlt die Berechtigung (Firestore-Regeln).' : (x && (x.message || x.code)) || 'Unbekannter Fehler';
    window.OAK = { esc, modal, toast, eur, d2, ms, iso, errMsg };
})();
