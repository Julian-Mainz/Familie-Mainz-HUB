// js/drawer.js - Navigation: Seitenleiste (Desktop, einklappbar), Tab-Leiste und ausfahrende Leiste (Handy).
// Blendet Punkte ohne Berechtigung aus, markiert die aktuelle Seite und zeigt einen Hinweis-Zähler für Admins.
// Bedienung für die Seiten bleibt gleich: renderDrawer() beim Start, toggleSideMenu(true|false) für das Menü am Handy.
const DRAWER_LINKS = [
    { href: '/menu.html',           label: 'Start',          icon: 'fa-border-all',    c: '#818cf8', group: 'Übersicht' },
    { href: '/messenger.html',      label: 'Messenger',      icon: 'fa-comments',      c: '#f472b6', group: 'Übersicht', perm: 'messenger', badgeId: 'sb-msg-badge' },
    { href: '/wand.html',           label: 'Wandkalender',   icon: 'fa-display',       c: '#22d3ee', group: 'Übersicht', perm: 'wand' },
    { href: '/zeiterfassung.html',  label: 'Zeiterfassung',  icon: 'fa-business-time', c: '#34d399', group: 'Bereiche',  perm: 'zeit' },
    { href: '/finanzen.html',       label: 'Finanzen',       icon: 'fa-coins',         c: '#facc15', group: 'Bereiche',  perm: 'finanzen' },
    { href: '/dokumente.html',      label: 'Dokumente',      icon: 'fa-folder-open',   c: '#38bdf8', group: 'Bereiche',  perm: 'dokumente' },
    { href: '/passwort.html',       label: 'Passwort-Safe',  icon: 'fa-shield-halved', c: '#fb923c', group: 'Bereiche',  perm: 'tresor' },
    { href: '/spotify.html',        label: 'Spotify',        icon: 'fa-headphones',    c: '#4ade80', group: 'Bereiche',  perm: 'spotify' },
    { href: '/admin.html',          label: 'Admin',          icon: 'fa-user-shield',   c: '#c084fc', group: 'System',    admin: true, badge: true },
];

// Web-Apps: eigenständige Seiten, die in einem neuen Tab geöffnet werden. Weitere einfach hier ergänzen.
const WEB_APPS = [
    { href: '/Uhr/', label: 'Uhr', desc: 'Große Uhr mit Feierabend-Timer', icon: 'fa-clock', c: '#38bdf8' },
    { href: '/Keks/', label: 'Keks-Fabrik', desc: 'Idle-Spiel gegen die Langeweile', icon: 'fa-cookie-bite', c: '#fbbf24' },
    { href: '/Ballon/', label: 'Ballon-Alarm', desc: 'Tower Defense ohne Ende', icon: 'fa-bullseye', c: '#34d399' },
    { href: '/Buero/', label: 'Büro-Imperium', desc: 'Idle-Spiel: Vom Praktikanten zum Vorstand', icon: 'fa-building', c: '#38bdf8' },
];

// Avatar: Profilbild (nur geprüfte Bild-Daten) oder Initialen auf farbigem Verlauf. Wird auch von Profil- und Admin-Seite genutzt.
const AVATAR_COLORS = [['#6366f1', '#06b6d4'], ['#ec4899', '#f97316'], ['#10b981', '#06b6d4'], ['#f59e0b', '#ef4444'], ['#8b5cf6', '#ec4899'], ['#0ea5e9', '#6366f1']];
function avatarGradient(i) { const g = AVATAR_COLORS[Math.abs(parseInt(i, 10) || 0) % AVATAR_COLORS.length]; return `linear-gradient(135deg, ${g[0]}, ${g[1]})`; }
function initialsOf(name) { return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'; }
const PHOTO_OK = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/;      // nichts anderes wird als Bild eingesetzt (Schutz vor eingeschleustem HTML)
function avatarInner(u) {
    const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    return u && PHOTO_OK.test(u.photo || '') ? `<img src="${u.photo}" alt="">` : e(initialsOf(u && (u.name || u.displayName || (u.email || '').split('@')[0])));
}
function roleLabel(u) { return !u ? '' : (typeof isAdmin === 'function' && isAdmin(u)) ? 'Administrator' : u.role === 'guest' ? 'Gast' : 'Mitglied'; }

function normPath(p) {
    return p.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/(.)\/$/, '$1') || '/';
}

function renderDrawer() {
    if (document.getElementById('sb')) return;

    const here = normPath(window.location.pathname);
    const user = (typeof currentUser !== 'undefined') ? currentUser : null;
    const esc2 = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const allowed = DRAWER_LINKS
        .filter(l => !l.perm || (typeof can === 'function' && can(user, l.perm)))
        .filter(l => !l.admin || (typeof isAdmin === 'function' && isAdmin(user)));

    // Seitenleiste: Einträge nach Gruppen. Der Punkt "Web-Apps" (mit Untermenü) steht am Ende der Gruppe "Bereiche".
    let idx = 0, lastGroup = '', webDone = false;
    const webOk = WEB_APPS.length > 0 && typeof can === 'function' && can(user, 'webapps');
    const webGroup = () => {
        webDone = true;
        const subs = WEB_APPS.map(a => `<a class="sb-subitem" href="${a.href}" target="_blank" rel="noopener" style="--c:${a.c}"><span class="sb-subico"><i class="fa-solid ${a.icon}"></i></span>
            <span class="sb-subtxt"><b>${a.label}</b><small>${a.desc || ''}</small></span><i class="fa-solid fa-arrow-up-right-from-square sb-ext"></i></a>`).join('');
        return `<div class="sb-group" id="sb-webapps">
            <button type="button" class="sb-item sb-toggle" style="--c:#38bdf8;--i:${idx++}" data-tip="Web-Apps" aria-expanded="false" aria-controls="sb-sub-web">
                <span class="sb-ico"><i class="fa-solid fa-table-cells-large"></i></span><span class="sb-label">Web-Apps</span><i class="fa-solid fa-chevron-down sb-chev"></i></button>
            <div class="sb-subwrap" id="sb-sub-web"><div class="sb-sub"><div class="sb-subhead">Web-Apps</div>${subs}</div></div></div>`;
    };
    const parts = [];
    allowed.forEach(l => {
        if (l.group === 'System' && webOk && !webDone) parts.push(webGroup());
        const head = l.group !== lastGroup ? `<div class="sb-sec">${l.group}</div>` : ''; lastGroup = l.group;
        const on = normPath(l.href) === here;
        parts.push(`${head}<a class="sb-item${on ? ' on' : ''}" href="${l.href}" style="--c:${l.c};--i:${idx++}" data-tip="${l.label}"${on ? ' aria-current="page"' : ''}>
            <span class="sb-ico"><i class="fa-solid ${l.icon}"></i></span><span class="sb-label">${l.label}</span>${l.badgeId ? `<em class="sb-badge" id="${l.badgeId}"></em>` : l.badge ? '<em class="sb-badge" id="sb-badge"></em>' : ''}</a>`);
    });
    if (webOk && !webDone) parts.push(webGroup());
    const items = parts.join('');

    // Tab-Leiste am Handy: Start + die zwei wichtigsten freigegebenen Bereiche + Suche + Menü
    const prio = ['/messenger.html', '/zeiterfassung.html', '/finanzen.html', '/dokumente.html', '/spotify.html', '/passwort.html', '/wand.html', '/admin.html'];
    const picks = [allowed.find(l => l.href === '/menu.html'), ...prio.map(h => allowed.find(l => l.href === h)).filter(Boolean).slice(0, 2)].filter(Boolean);
    const tab = l => `<a class="tb-item${normPath(l.href) === here ? ' on' : ''}" href="${l.href}" style="--c:${l.c}"><span class="tb-ico"><i class="fa-solid ${l.icon}"></i>${l.badgeId ? '<em class="tb-badge" id="tb-msg-badge"></em>' : ''}</span><span>${l.label.replace('Passwort-Safe', 'Safe').replace('Zeiterfassung', 'Zeit')}</span></a>`;
    const tabbar = `<nav id="tabbar" aria-label="Schnellzugriff">${picks.map(tab).join('')}
        <button class="tb-item" onclick="if (typeof openSearch === 'function') openSearch();"><span class="tb-ico"><i class="fa-solid fa-magnifying-glass"></i></span><span>Suche</span></button>
        <button class="tb-item" onclick="toggleSideMenu(true)"><span class="tb-ico"><i class="fa-solid fa-bars"></i></span><span>Mehr</span></button></nav>`;

    const name = (user && (user.name || user.displayName)) || (user && user.email ? user.email.split('@')[0] : 'Gast');

    const html = `
    <div id="sb-backdrop" onclick="toggleSideMenu(false)"></div>
    <aside id="sb" aria-label="Navigation">
        <div class="sb-brand">
            <img class="sb-logo" src="/icons/icon-192.png" alt="">
            <div class="sb-brandtxt"><b>J.Mainz</b><small>Dashboard</small></div>
            <button class="sb-collapse" onclick="toggleSidebarWidth()" title="Seitenleiste ein-/ausklappen" aria-label="Seitenleiste ein-/ausklappen"><i class="fa-solid fa-angles-left"></i></button>
            <button class="sb-close" onclick="toggleSideMenu(false)" aria-label="Menü schließen"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <nav class="sb-nav">${items}</nav>
        <div class="sb-foot">
            <div class="sb-tools">
                <button class="sb-tool" data-tip="Suche (Strg+K)" title="Suche (Strg+K)" onclick="toggleSideMenu(false); if (typeof openSearch === 'function') openSearch();"><i class="fa-solid fa-magnifying-glass"></i></button>
                <button class="sb-tool" data-tip="Einstellungen" title="Einstellungen &amp; Alarm" onclick="toggleSideMenu(false); if (typeof openSettingsModal === 'function') openSettingsModal();"><i class="fa-solid fa-gear"></i></button>
                <button class="sb-tool" data-tip="Hell / Dunkel" title="Hell / Dunkel" onclick="toggleTheme()"><i data-theme-icon class="fa-solid fa-moon"></i></button>
                <button class="sb-tool danger" data-tip="Abmelden" title="Abmelden" onclick="handleLogout()"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>
            </div>
            <a class="sb-user${here === '/profil' ? ' on' : ''}" href="/profil.html" title="Mein Profil bearbeiten" data-tip="Mein Profil">${userCard(user, name)}</a>
            <div class="sb-legal"><a href="/impressum.html">Impressum</a> &bull; <a href="/datenschutz.html">Datenschutz</a></div>
        </div>
    </aside>
    ${tabbar}`;

    document.body.classList.add('has-sb');
    document.body.insertAdjacentHTML('afterbegin', html);
    try { if (localStorage.getItem('sb_collapsed') === '1') document.documentElement.classList.add('sb-collapsed'); } catch (e) { /* ohne Speicher: immer ausgeklappt */ }

    // Auf dem Handy: nach einem Klick auf einen Eintrag schließt sich die Leiste
    const sb = document.getElementById('sb');
    sb.addEventListener('click', e => {
        if (e.target.closest('a.sb-item, a.sb-subitem')) { toggleSideMenu(false); return; }
        const tg = e.target.closest('.sb-toggle'); if (!tg) return;
        const g = document.getElementById('sb-webapps'), open = !g.classList.contains('open');
        g.classList.toggle('open', open); tg.setAttribute('aria-expanded', String(open));
        if (open && !document.documentElement.classList.contains('sb-collapsed')) setTimeout(() => g.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 360);      // aufgeklappt: Untermenü in Sicht scrollen
        if (!document.documentElement.classList.contains('sb-collapsed')) { try { localStorage.setItem('sb_web_open', open ? '1' : '0'); } catch (x) {} }
    });
    document.addEventListener('click', e => { const g = document.getElementById('sb-webapps'); if (g && !g.contains(e.target) && document.documentElement.classList.contains('sb-collapsed')) g.classList.remove('open'); });
    restoreWebApps();

    // Einstellungen, Termin-Logik & Suche nachladen, damit auf den Seiten nichts ergänzt werden muss
    if (!document.getElementById('settings-js')) {
        const s = document.createElement('script');
        s.id = 'settings-js';
        s.src = '/js/settings.js';
        document.head.appendChild(s);
    }
    if (!window.CAL && !document.getElementById('cal-core-js')) {
        const c = document.createElement('script');
        c.id = 'cal-core-js'; c.src = '/js/calendar-core.js';
        document.head.appendChild(c);
    }
    if (!document.getElementById('search-js')) {
        const q = document.createElement('script');
        q.id = 'search-js'; q.src = '/js/search.js';
        document.head.appendChild(q);
    }
    if (typeof updateThemeButtons === 'function') updateThemeButtons();
    document.addEventListener('keydown', e => { if (e.key === 'Escape') toggleSideMenu(false); });
    if (typeof isAdmin === 'function' && isAdmin(user)) loadAdminBadge();
    if (typeof can === 'function' && can(user, 'messenger')) loadMessengerCore();
}

// Messenger im Hintergrund: Ungelesen-Zähler im Menü, Ton, Tab-Titel und Hinweise (nur für freigegebene Konten)
function loadMessengerCore() {
    if (window.MSG) return window.MSG.start();
    if (document.getElementById('msg-core-js')) return;
    const c = document.createElement('script');
    c.id = 'msg-core-js'; c.src = '/js/messenger-core.js'; c.onload = () => window.MSG && window.MSG.start();
    document.head.appendChild(c);
}

// Inhalt der Profilkarte unten in der Leiste (wird nach Änderungen im Profil neu gezeichnet)
function userCard(user, name) {
    const nm = name || (user && (user.name || user.displayName)) || (user && user.email ? user.email.split('@')[0] : 'Gast');
    const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    return `<span class="sb-avatar" style="background:${avatarGradient(user && user.avatarColor)}">${avatarInner(user)}<i></i></span><div class="sb-usertxt"><b>${e(nm)}</b><small>${roleLabel(user)}</small></div><i class="fa-solid fa-pen sb-edit"></i>`;
}
function refreshSidebarUser() { const el = document.querySelector('#sb .sb-user'); if (el && typeof currentUser !== 'undefined' && currentUser) el.innerHTML = userCard(currentUser); }

// Zähler am Admin-Eintrag: wartende Konten + ungelesene Nachrichten (für 2 Minuten zwischengespeichert, spart Abfragen)
async function loadAdminBadge() {
    const el = document.getElementById('sb-badge'); if (!el || typeof db === 'undefined') return;
    const show = n => { el.textContent = n > 99 ? '99+' : n; el.classList.toggle('show', n > 0); };
    try { const c = JSON.parse(sessionStorage.getItem('sb_badge') || 'null'); if (c && Date.now() - c.t < 120000) return show(c.n); } catch (e) {}
    const count = async q => { try { return (await q.count().get()).data().count; } catch (e) { try { return (await q.get()).size; } catch (e2) { return 0; } } };
    const n = (await count(db.collection('users').where('status', '==', 'pending'))) + (await count(db.collection('contact_messages').where('read', '==', false)));
    try { sessionStorage.setItem('sb_badge', JSON.stringify({ t: Date.now(), n })); } catch (e) {}
    show(n);
}

// Desktop: Leiste schmal (nur Symbole) oder breit. Wird erst nach einem Klick im Browser gemerkt.
function toggleSidebarWidth() {
    const on = document.documentElement.classList.toggle('sb-collapsed');
    try { localStorage.setItem('sb_collapsed', on ? '1' : '0'); } catch (e) {}
    restoreWebApps();
}
// Untermenü "Web-Apps": breit = aufgeklappt, wenn zuletzt so gewählt. Schmal = Auswahlfenster nur beim Darüberfahren oder Tippen.
function restoreWebApps() {
    const g = document.getElementById('sb-webapps'); if (!g) return;
    let open = false; try { open = localStorage.getItem('sb_web_open') === '1'; } catch (e) {}
    open = open && !document.documentElement.classList.contains('sb-collapsed');
    g.classList.toggle('open', open); g.querySelector('.sb-toggle').setAttribute('aria-expanded', String(open));
}

// Handy: Leiste ein- oder ausfahren
function toggleSideMenu(open) {
    const sb = document.getElementById('sb'), bd = document.getElementById('sb-backdrop');
    if (!sb || !bd) return;
    sb.classList.toggle('open', !!open); bd.classList.toggle('show', !!open); document.body.classList.toggle('sb-lock', !!open);
}
