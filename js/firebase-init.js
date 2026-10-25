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
// perm: 'kalender' | 'zeit' | 'finanzen' | 'tresor'
const can = (u, key) => !!u && (u.role === 'admin' || (u.permissions || {})[key] !== false);
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
                userPrefs: data.userPrefs || {}
            };

            // Seitenrechte prüfen
            if ((opts.admin && !isAdmin(currentUser)) || (opts.perm && !can(currentUser, opts.perm))) {
                alert('Dafür hast du keine Berechtigung.');
                window.location.replace('/');
                return;
            }

            const nameEl = document.getElementById('user-display-name');
            if (nameEl) nameEl.innerText = currentUser.firstName;

            // lastLogin und Seitenbesuch nur einmal pro Sitzung bzw. Seite schreiben
            if (!safeStore(() => sessionStorage.getItem('lastLoginSet'))) {
                safeStore(() => sessionStorage.setItem('lastLoginSet', '1'));
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
