// js/firebase-init.js - Zentrales Firebase Setup, Auth-Guard, Rechte & Logging
window.esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

window.localDate = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const firebaseConfig = {
    apiKey: "AIzaSyCfKWWHQ17-ujYGJcHw6efFBESArA8uY0Q",
    authDomain: "familie-mainz-netzwerk.firebaseapp.com",
    projectId: "familie-mainz-netzwerk",
    storageBucket: "familie-mainz-netzwerk.firebasestorage.app",
    messagingSenderId: "361922663455",
    appId: "1:361922663455:web:ed3eb8d34103ce89be312a"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;

// ---------- Rechte ----------
// perm: 'termine' | 'pinnwand' | 'aufgaben' | 'zeit' | 'finanzen' | 'tresor' | 'wand' | 'spotify'  (nicht vergebene Rechte gelten als erlaubt, außer sie sind ausdrücklich false)
// Opt-in-Rechte gelten nur, wenn sie ausdrücklich true sind (auch für Admins). Alle anderen: erlaubt, außer ausdrücklich false.
const OPT_IN_PERMS = { messenger: 1, gruppen: 1, dokumente: 1 };
const can = (u, key) => !!u && (OPT_IN_PERMS[key] ? ((key === 'dokumente' && u.role === 'admin') || (u.permissions || {})[key] === true) : (u.role === 'admin' || (u.permissions || {})[key] !== false));   // Opt-in: nur ausdrücklich erteilt. Ausnahme: Admins haben "dokumente" automatisch
const isAdmin = u => !!u && (u.role === 'admin' || (u.permissions || {}).admin === true);

// ---------- Hilfen ----------
function isRootPage() {
    const p = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
    return p === '';
}

function safeStore(fn) { try { return fn(); } catch (e) { return null; } }

// Meldung, die auch einen Seitenwechsel zur Login-Seite überlebt
function setFlash(msg) { safeStore(() => sessionStorage.setItem('authMsg', msg)); }

function showFlash() {
    const msg = safeStore(() => sessionStorage.getItem('authMsg'));
    if (!msg) return;
    safeStore(() => sessionStorage.removeItem('authMsg'));
    const box = document.getElementById('auth-alert');
    const txt = document.getElementById('auth-alert-text');
    if (box && txt) { txt.innerText = msg; box.classList.remove('hidden'); }
}

function getDeviceType() {
    const ua = navigator.userAgent;
    if (/tablet|ipad/i.test(ua)) return 'Tablet';
    if (/mobile/i.test(ua)) return 'Smartphone';
    return 'Desktop / PC';
}

// Tagesgrenze für die zwei offenen Schreibstellen (Protokoll und Kontaktformular). Die Datenbank-Regeln erlauben je Name nur eine feste Zahl Einträge in 24 Stunden
// (Protokoll 2000, Kontakt 30) und zählen dazu in limits/<name> mit. Eintrag und Zähler werden in einem Schritt geschrieben.
// Rückgabe: true = gespeichert, false = Tagesgrenze erreicht (oder gerade gesperrt). Andere Fehler (z. B. offline) werden weitergegeben.
async function limitedAdd(name, collection, data) {
    const blockKey = 'limit_blocked_' + name;
    try { if (Date.now() - (+sessionStorage.getItem(blockKey) || 0) < 600000) return false; } catch (e) {}     // nach einer Ablehnung 10 Minuten nicht erneut versuchen
    const F = firebase.firestore.FieldValue, cref = db.collection('limits').doc(name), dref = db.collection(collection).doc();
    let reset = null;
    for (let i = 0; i < 3; i++) {
        const b = db.batch(); b.set(dref, data);
        if (i === 0) b.set(cref, { n: F.increment(1), last: dref.id }, { merge: true });                           // Normalfall: im laufenden Fenster einfach hochzählen
        else {
            if (reset === null) { const s = await cref.get().catch(() => null), d = s && s.exists ? s.data() : null; reset = !(d && d.windowStart && Date.now() - d.windowStart.toMillis() < 864e5); }
            else reset = !reset;                                                                                   // dritter Versuch: die andere Möglichkeit, falls Geräteuhr und Server abweichen
            if (reset) b.set(cref, { n: 1, windowStart: F.serverTimestamp(), last: dref.id }); else b.set(cref, { n: F.increment(1), last: dref.id }, { merge: true });
        }
        try { await b.commit(); return true; } catch (e) { if (e.code !== 'permission-denied') throw e; }
    }
    try { sessionStorage.setItem(blockKey, String(Date.now())); } catch (e) {}
    return false;
}

// category: 'auth' | 'data' | 'admin' | 'visit'
async function logSystemEvent(category, action, details = {}) {
    try {
        await limitedAdd('logs', 'system_logs', {
            category, action,
            userEmail: currentUser ? currentUser.email : (details.attemptedEmail || 'Gast / Anonym'),
            userName: currentUser ? currentUser.name : (details.name || 'Nicht eingeloggt'),
            device: getDeviceType(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            details,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) { /* Logging darf nie die Seite stören */ }
}

async function denyAccess(msg) {
    setFlash(msg);
    await auth.signOut();                       // löst den "kein Benutzer"-Zweig aus
    if (!isRootPage()) window.location.href = '/';
}

// ---------- Wartungsmodus ----------
// Admins schalten im Admin-Bereich einzelne Seiten oder das ganze System ("/") in Wartung.
// Dokument maintenance/status: { pages: { '/finanzen': true, ... }, msg, until, updatedBy, updatedAt }. Lesbar für alle (auch die Anmeldeseite).
// Admins sehen die Seiten trotzdem (mit Hinweisleiste), alle anderen eine Wartungsseite. Änderungen wirken sofort (Live-Abo).
const MAINT_PAGES = [
    { key: '/',               label: 'Anmeldung & ganzes System', icon: 'fa-lock',            c: '#f87171' },
    { key: '/menu',           label: 'Start',          icon: 'fa-border-all',        c: '#818cf8' },
    { key: '/messenger',      label: 'Messenger',      icon: 'fa-comments',          c: '#f472b6' },
    { key: '/wand',           label: 'Wandkalender',   icon: 'fa-display',           c: '#22d3ee' },
    { key: '/zeiterfassung',  label: 'Zeiterfassung',  icon: 'fa-business-time',     c: '#34d399' },
    { key: '/finanzen',       label: 'Finanzen',       icon: 'fa-coins',             c: '#facc15' },
    { key: '/dokumente',      label: 'Dokumente',      icon: 'fa-folder-open',       c: '#38bdf8' },
    { key: '/passwort',       label: 'Passwort-Safe',  icon: 'fa-shield-halved',     c: '#fb923c' },
    { key: '/spotify',        label: 'Spotify',        icon: 'fa-headphones',        c: '#4ade80' },
    { key: '/changelog',      label: 'Changelog',      icon: 'fa-clock-rotate-left', c: '#a78bfa' },
    { key: '/profil',         label: 'Profil',         icon: 'fa-user',              c: '#94a3b8' },
];
const MAINT_DEFAULT_MSG = 'Hier wird gerade gebaut und verbessert. Schau bitte etwas später wieder vorbei.';
const maintKey = (p = location.pathname) => p.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/(.)\/$/, '$1') || '/';
const maintRef = () => db.collection('maintenance').doc('status');
window.MAINT = { pages: {} };
const maintOn = (key, m = window.MAINT) => !!(m && m.pages && m.pages[key] === true);
// Gilt für diese Seite eine Wartung? Ganzes System zählt überall.
const maintActive = (key, m = window.MAINT) => maintOn(key, m) || maintOn('/', m);
function maintUntilText(m) {
    if (!m || !m.until) return '';
    const d = new Date(m.until); if (isNaN(d)) return '';
    return 'Voraussichtlich wieder da: ' + d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}
// Erstes Laden als Promise, danach live: ändert sich der Zustand für diese Seite, wird neu geladen
let maintPromise = null;
function watchMaint() {
    if (maintPromise) return maintPromise;
    maintPromise = new Promise(res => {
        let first = true, sig = '';
        const key = maintKey();
        const signature = m => (maintActive(key, m) ? '1' : '0') + '|' + (m.msg || '') + '|' + (m.until || '');
        maintRef().onSnapshot(d => {
            const m = d.exists ? d.data() : {}; if (!m.pages) m.pages = {};
            window.MAINT = m;
            if (first) { first = false; sig = signature(m); return res(m); }
            const now = signature(m), was = sig; sig = now;
            document.dispatchEvent(new CustomEvent('maint-change', { detail: m }));
            if (now === was || !currentUser) return;
            if (!isAdmin(currentUser)) return location.reload();                            // Nicht-Admins: Wartungsseite ein- bzw. ausblenden
            if (key === '/admin') return;
            document.getElementById('maint-bar')?.remove(); if (maintActive(key, m)) showMaintBar(key);
        }, () => { if (first) { first = false; res(window.MAINT); } });     // ohne Leserecht oder offline: Seite normal öffnen
    });
    return maintPromise;
}
function maintStyle() {
    if (document.getElementById('maint-css')) return;
    const st = document.createElement('style'); st.id = 'maint-css';
    st.textContent = `html.maint body > *:not(#maint-screen):not(#space-bg) { display: none !important; }
#maint-screen { position: fixed; inset: 0; z-index: 9000; display: grid; place-items: center; padding: 24px 16px; overflow: auto; color: #e2e8f0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: radial-gradient(ellipse at 50% 30%, rgba(99, 102, 241, .18), transparent 60%); }
#maint-screen .mt-card { width: 100%; max-width: 460px; text-align: center; padding: 34px 28px 28px; border-radius: 30px; background: rgba(12, 17, 32, .86); border: 1px solid rgba(148, 163, 184, .18); box-shadow: 0 40px 90px -30px rgba(0, 0, 0, .7); }
#maint-screen .mt-ico { width: 74px; height: 74px; margin: 0 auto 18px; border-radius: 24px; display: grid; place-items: center; font-size: 30px; color: #fff; background: linear-gradient(135deg, #f59e0b, #ef4444); box-shadow: 0 16px 34px -10px rgba(239, 68, 68, .6); animation: mtWobble 3.2s ease-in-out infinite; }
@keyframes mtWobble { 0%, 70%, 100% { transform: rotate(0); } 78% { transform: rotate(-12deg); } 86% { transform: rotate(10deg); } 93% { transform: rotate(-4deg); } }
#maint-screen .mt-pill { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; border-radius: 99px; font-size: 11.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #fcd34d; background: rgba(251, 191, 36, .12); border: 1px solid rgba(251, 191, 36, .3); }
#maint-screen h1 { margin: 14px 0 8px; font-size: 1.6rem; letter-spacing: -.02em; }
#maint-screen p { margin: 0; color: #94a3b8; font-size: 14.5px; line-height: 1.6; white-space: pre-wrap; }
#maint-screen .mt-until { margin-top: 16px; display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 14px; font-size: 13px; font-weight: 600; color: #c7d2fe; background: rgba(99, 102, 241, .12); }
#maint-screen .mt-act { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 24px; }
#maint-screen .mt-btn { display: inline-flex; align-items: center; gap: 8px; padding: 11px 18px; border-radius: 14px; font: 600 14px system-ui, sans-serif; color: #e2e8f0; text-decoration: none; cursor: pointer; border: 1px solid rgba(148, 163, 184, .25); background: rgba(255, 255, 255, .05); }
#maint-screen .mt-btn.pri { color: #fff; border-color: transparent; background: linear-gradient(135deg, #6366f1, #8b5cf6); }
#maint-screen small { display: block; margin-top: 18px; font-size: 11.5px; color: #64748b; }
html.hell #maint-screen { color: #0f172a; background: radial-gradient(ellipse at 50% 30%, rgba(99, 102, 241, .12), transparent 60%); }
html.hell #maint-screen .mt-card { background: rgba(255, 255, 255, .9); border-color: #e2e8f0; box-shadow: 0 30px 70px -30px rgba(15, 23, 42, .3); }
html.hell #maint-screen p { color: #475569; } html.hell #maint-screen .mt-pill { color: #b45309; background: #fef3c7; border-color: #fcd34d; }
html.hell #maint-screen .mt-until { color: #4338ca; background: #eef2ff; } html.hell #maint-screen .mt-btn { color: #334155; background: #fff; border-color: #cbd5e1; } html.hell #maint-screen .mt-btn.pri { color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6); }
#maint-bar { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 8000; display: flex; align-items: center; gap: 9px; max-width: calc(100% - 24px); padding: 8px 8px 8px 14px; border-radius: 99px; font: 600 12.5px system-ui, sans-serif; color: #451a03; background: linear-gradient(135deg, #fcd34d, #fb923c); box-shadow: 0 10px 30px -8px rgba(251, 146, 60, .6); }
#maint-bar span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#maint-bar a { flex: none; padding: 5px 11px; border-radius: 99px; color: #fff; text-decoration: none; background: rgba(69, 26, 3, .78); font-size: 11.5px; }`;
    document.head.appendChild(st);
}
// Wartungsseite für Nicht-Admins
function showMaintScreen(key) {
    maintStyle();
    const m = window.MAINT, all = maintOn('/', m), page = MAINT_PAGES.find(p => p.key === key);
    const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const until = maintUntilText(m), canStart = !all && key !== '/menu' && !maintOn('/menu', m);
    document.documentElement.classList.add('maint');
    const el = document.createElement('div'); el.id = 'maint-screen'; el.setAttribute('role', 'main');
    el.innerHTML = `<div class="mt-card"><div class="mt-ico"><i class="fa-solid fa-screwdriver-wrench"></i></div>
        <span class="mt-pill"><i class="fa-solid fa-person-digging"></i>${all ? 'Ganzes System' : e(page ? page.label : 'Diese Seite')}</span>
        <h1>Wartungsarbeiten</h1><p>${e(m.msg || MAINT_DEFAULT_MSG)}</p>
        ${until ? `<div class="mt-until"><i class="fa-regular fa-clock"></i>${e(until)}</div>` : ''}
        <div class="mt-act">${canStart ? '<a class="mt-btn pri" href="/menu.html"><i class="fa-solid fa-border-all"></i>Zum Start</a>' : ''}<button class="mt-btn" onclick="handleLogout()"><i class="fa-solid fa-arrow-right-from-bracket"></i>Abmelden</button></div>
        <small>Die Seite lädt automatisch neu, sobald die Wartung vorbei ist.</small></div>`;
    document.body.appendChild(el);
    document.title = 'Wartungsarbeiten – J.Mainz Dashboard';
}
// Hinweisleiste für Admins auf einer Seite in Wartung
function showMaintBar(key) {
    maintStyle(); if (document.getElementById('maint-bar')) return;
    const all = maintOn('/'), el = document.createElement('div'); el.id = 'maint-bar'; el.setAttribute('role', 'status');
    el.innerHTML = `<i class="fa-solid fa-screwdriver-wrench"></i><span>Wartung aktiv${all ? ' (ganzes System)' : ''} – nur Admins sehen diese Seite</span><a href="/admin.html#wartung">Verwalten</a>`;
    document.body.appendChild(el);
}

// ---------- Auth-Guard ----------
// opts: { perm: 'zeit' }  oder  { admin: true }
function initAuthGuard(onReadyCallback, opts = {}) {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            currentUser = null;
            if (!isRootPage()) { window.location.href = '/'; return; }
            showFlash();
            if (onReadyCallback) onReadyCallback(null);
            return;
        }

        try {
            const ref = db.collection('users').doc(user.uid);
            const doc = await ref.get();

            if (!doc.exists) {
                if (window.signingUp) return;   // Registrierung schreibt das Profil gerade
                return denyAccess('Für dieses Konto existiert kein Profil. Bitte wende dich an einen Admin.');
            }
            const data = doc.data();
            const status = data.status || 'active';
            if (status !== 'active') {
                return denyAccess(status === 'pending'
                    ? 'Dein Konto wartet noch auf Freigabe durch einen Admin.'
                    : 'Dein Konto wurde gesperrt.');
            }

            currentUser = {
                uid: user.uid,
                email: user.email,
                name: data.firstName ? `${data.firstName} ${data.lastName || ''}`.trim() : user.email.split('@')[0],
                firstName: data.firstName || user.email.split('@')[0],
                role: data.role || 'user',
                status,
                permissions: data.permissions || {},
                userPrefs: data.userPrefs || {},
                notificationsEnabled: !!data.notificationsEnabled,
                lastName: data.lastName || '',
                photo: data.photo || '',
                avatarColor: data.avatarColor || 0,
                createdAt: data.createdAt || null,
                lastLogin: data.lastLogin || null
            };

            // Seitenrechte prüfen
            if ((opts.admin && !isAdmin(currentUser)) || (opts.perm && !can(currentUser, opts.perm))) {
                alert('Dafür hast du keine Berechtigung.');
                window.location.replace('/menu.html');
                return;
            }

            // Wartungsmodus: Nicht-Admins sehen nur die Wartungsseite, Admins eine Hinweisleiste
            const mKey = maintKey(), mData = await watchMaint();
            if (maintActive(mKey, mData)) {
                if (!isAdmin(currentUser)) { showMaintScreen(mKey); return; }
                if (mKey !== '/admin') showMaintBar(mKey);
            }

            const nameEl = document.getElementById('user-display-name');
            if (nameEl) nameEl.innerText = currentUser.firstName;

            // lastLogin und Seitenbesuch nur einmal pro Sitzung bzw. Seite schreiben
            if (!safeStore(() => sessionStorage.getItem('lastLoginSet'))) {
                safeStore(() => sessionStorage.setItem('lastLoginSet', '1'));
                logSystemEvent('auth', 'Sitzung gestartet');
                ref.update({ lastLogin: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
            }
            const visitKey = 'visit:' + window.location.pathname;
            if (!safeStore(() => sessionStorage.getItem(visitKey))) {
                safeStore(() => sessionStorage.setItem(visitKey, '1'));
                logSystemEvent('visit', 'Seite geöffnet', { seite: window.location.pathname });
            }

            if (onReadyCallback) onReadyCallback(currentUser);
        } catch (e) {
            console.error('Auth-Fehler:', e);
            denyAccess('Fehler beim Laden der Benutzerdaten: ' + e.message);
        }
    });
}

async function handleLogout() {
    await logSystemEvent('auth', 'Benutzer abgemeldet', { email: currentUser ? currentUser.email : '' });
    safeStore(() => sessionStorage.clear());
    await auth.signOut();
    window.location.href = '/';
}


// ---------- Design: Hell / Dunkel ----------
// Seiten mit /assets/light.css bekommen ein echtes helles Design (Klasse "hell" an <html>).
// Seiten ohne light.css nutzen weiter den Farbfilter als Notlösung.
// Seiten, die immer dunkel bleiben sollen (Wandkalender), setzen <html data-theme-lock="dark">.
(function () {
    const css = document.createElement('style');
    css.textContent = 'html.light:not(.hell){filter:invert(.94) hue-rotate(180deg)}html.light:not(.hell) img,html.light:not(.hell) video,html.light:not(.hell) iframe{filter:invert(1) hue-rotate(180deg)}';
    document.head.appendChild(css);
})();
window.applyTheme = function () {
    const lock = document.documentElement.dataset.themeLock;
    const pref = lock || safeStore(() => localStorage.getItem('theme')) || 'dark';
    const light = pref === 'light' || (pref === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
    const own = !!document.querySelector('link[href*="/assets/light.css"]');       // Seite hat ein echtes helles Design
    document.documentElement.classList.toggle('light', light);
    document.documentElement.classList.toggle('hell', light && own);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = light ? (own ? '#eef1f6' : '#f1f5f9') : '#080c14';
    window.updateThemeButtons();
};
window.updateThemeButtons = function () {
    const light = document.documentElement.classList.contains('light');
    document.querySelectorAll('[data-theme-icon]').forEach(el => { el.classList.toggle('fa-sun', light); el.classList.toggle('fa-moon', !light); });
    document.querySelectorAll('[data-theme-text]').forEach(el => { el.textContent = light ? 'Hell' : 'Dunkel'; });
};
window.toggleTheme = function () {
    safeStore(() => localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'dark' : 'light'));
    applyTheme();
};
applyTheme();
document.addEventListener('DOMContentLoaded', () => updateThemeButtons());

// ---------- Fehlerprotokoll ----------
// Unbehandelte Browser-Fehler landen als Kategorie "error" im Log (höchstens 5 pro Seitenaufruf, ohne Wiederholungen).
(function () {
    let count = 0; const seen = new Set();
    function report(msg, details) {
        const key = String(msg).slice(0, 120) + '|' + (details.zeile || '');
        if (count >= 5 || seen.has(key)) return;
        seen.add(key); count++;
        details.seite = location.pathname;
        logSystemEvent('error', String(msg).slice(0, 190), details);
    }
    window.addEventListener('error', e => {
        if (!e.message || /^Script error\.?$/.test(e.message) || /ResizeObserver loop/.test(e.message)) return;
        report(e.message, { datei: String(e.filename || '').split('/').pop(), zeile: e.lineno || 0, spalte: e.colno || 0 });
    });
    window.addEventListener('unhandledrejection', e => {
        const r = e.reason || {};
        report('Promise: ' + String(r.message || r.code || r).slice(0, 170), { code: r.code || '' });
    });
})();

// ---------- Hinweis auf neue Versionen (siehe js/update.js) ----------
(function () { const s = document.createElement('script'); s.src = '/js/update.js'; s.defer = true; document.head.appendChild(s); })();
