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
const can = (u, key) => !!u && (OPT_IN_PERMS[key] ? (u.permissions || {})[key] === true : (u.role === 'admin' || (u.permissions || {})[key] !== false));
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

// category: 'auth' | 'data' | 'admin' | 'visit'
async function logSystemEvent(category, action, details = {}) {
    try {
        await db.collection('system_logs').add({
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
// Hell wird über einen Farbfilter auf der ganzen Seite erzeugt. So gilt es ohne Umbau auf allen Seiten.
// Seiten, die immer dunkel bleiben sollen (Wandkalender), setzen <html data-theme-lock="dark">.
(function () {
    const css = document.createElement('style');
    css.textContent = 'html.light{filter:invert(.94) hue-rotate(180deg)}html.light img,html.light video,html.light iframe{filter:invert(1) hue-rotate(180deg)}';
    document.head.appendChild(css);
})();
window.applyTheme = function () {
    const lock = document.documentElement.dataset.themeLock;
    const pref = lock || safeStore(() => localStorage.getItem('theme')) || 'dark';
    const light = pref === 'light' || (pref === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
    document.documentElement.classList.toggle('light', light);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = light ? '#f1f5f9' : '#080c14';
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
