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
// Für alle Seiten: Element per id holen und Server-Zeitstempel
const $ = id => document.getElementById(id);
const TS = () => firebase.firestore.FieldValue.serverTimestamp();
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

// ---------- Eigene Dialoge statt der grauen Browser-Fenster ----------
// uiConfirm('Wirklich löschen?', { ok: 'Löschen', danger: true }) -> Promise<true|false>
// uiAlert('Gespeichert.') -> Promise (alert() zeigt ab jetzt ebenfalls diesen Dialog, blockiert aber nicht mehr)
(function () {
    const nativeAlert = window.alert.bind(window);
    let queue = Promise.resolve();
    function css() {
        if (document.getElementById('uidlg-css')) return;
        const st = document.createElement('style'); st.id = 'uidlg-css';
        st.textContent = `.uidlg-bg { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 16px; background: rgba(2, 6, 16, .62); animation: dlgFade .16s ease-out; }
.uidlg { width: 100%; max-width: 420px; padding: 22px; border-radius: 24px; color: #e2e8f0; font: 14px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; background: linear-gradient(180deg, #151d33, #0d1324); border: 1px solid rgba(148, 163, 184, .2); box-shadow: 0 30px 80px -20px rgba(0, 0, 0, .8); animation: dlgPop .22s cubic-bezier(.2, .9, .3, 1.15); }
.uidlg-h { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; font-size: 16px; font-weight: 700; }
.uidlg-i { flex: none; width: 38px; height: 38px; border-radius: 13px; display: grid; place-items: center; font-size: 16px; color: #a5b4fc; background: rgba(99, 102, 241, .16); }
.uidlg.bad .uidlg-i { color: #fda4af; background: rgba(244, 63, 94, .16); }
.uidlg p { margin: 0; color: #cbd5e1; white-space: pre-wrap; word-break: break-word; }
.uidlg-a { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
.uidlg-a button { min-width: 96px; padding: 10px 16px; border-radius: 13px; font: 600 14px system-ui, sans-serif; cursor: pointer; color: #e2e8f0; border: 1px solid rgba(148, 163, 184, .25); background: rgba(255, 255, 255, .05); }
.uidlg-a button:hover { background: rgba(255, 255, 255, .1); }
.uidlg-a .ok { color: #fff; border-color: transparent; background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.uidlg.bad .uidlg-a .ok { background: linear-gradient(135deg, #e11d48, #f43f5e); }
.uidlg-a button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
@keyframes dlgFade { from { opacity: 0; } } @keyframes dlgPop { from { opacity: 0; transform: translateY(10px) scale(.97); } }
html.hell .uidlg-bg { background: rgba(15, 23, 42, .35); }
html.hell .uidlg { color: #0f172a; background: #fff; border-color: #e2e8f0; box-shadow: 0 30px 70px -25px rgba(15, 23, 42, .35); }
html.hell .uidlg p { color: #475569; } html.hell .uidlg-a button { color: #334155; background: #f8fafc; border-color: #cbd5e1; } html.hell .uidlg-a .ok { color: #fff; border-color: transparent; background: linear-gradient(135deg, #6366f1, #8b5cf6); } html.hell .uidlg.bad .uidlg-a .ok { background: linear-gradient(135deg, #e11d48, #f43f5e); }
@media (prefers-reduced-motion: reduce) { .uidlg-bg, .uidlg { animation: none; } }`;
        document.head.appendChild(st);
    }
    function open(text, o, confirmMode) {
        if (!document.body) { nativeAlert(text); return Promise.resolve(true); }
        css();
        return new Promise(res => {
            const last = document.activeElement, bad = !!o.danger;
            const bg = document.createElement('div'); bg.className = 'uidlg-bg';
            const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
            const title = o.title || (confirmMode ? (bad ? 'Bist du sicher?' : 'Bitte bestätigen') : 'Hinweis');
            const icon = o.icon || (bad ? 'fa-trash-can' : confirmMode ? 'fa-circle-question' : 'fa-circle-info');
            bg.innerHTML = `<div class="uidlg${bad ? ' bad' : ''}" role="${confirmMode ? 'alertdialog' : 'dialog'}" aria-modal="true" aria-labelledby="uidlg-t">
                <div class="uidlg-h"><span class="uidlg-i"><i class="fa-solid ${icon}"></i></span><span id="uidlg-t">${e(title)}</span></div><p>${e(text)}</p>
                <div class="uidlg-a">${confirmMode ? `<button type="button" data-r="0">${e(o.cancel || 'Abbrechen')}</button>` : ''}<button type="button" class="ok" data-r="1">${e(o.ok || 'OK')}</button></div></div>`;
            const done = r => { bg.remove(); document.removeEventListener('keydown', key, true); try { last && last.focus && last.focus({ preventScroll: true }); } catch (x) {} res(r); };
            const key = ev => {
                if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); done(!confirmMode); }
                else if (ev.key === 'Tab') { const b = [...bg.querySelectorAll('button')], i = b.indexOf(document.activeElement); ev.preventDefault(); b[(i + (ev.shiftKey ? -1 : 1) + b.length) % b.length].focus(); }
            };
            bg.addEventListener('click', ev => { const b = ev.target.closest('[data-r]'); if (b) done(b.dataset.r === '1'); else if (ev.target === bg) done(!confirmMode); });
            document.addEventListener('keydown', key, true);
            document.body.appendChild(bg);
            (bad && confirmMode ? bg.querySelector('[data-r="0"]') : bg.querySelector('.ok')).focus();      // bei Löschen steht der Fokus auf "Abbrechen"
        });
    }
    // Nacheinander anzeigen, falls mehrere gleichzeitig kommen
    const enqueue = (t, o, c) => { const p = queue.then(() => open(String(t ?? ''), o || {}, c)); queue = p.catch(() => {}); return p; };
    window.uiConfirm = (text, o) => enqueue(text, o, true);
    window.uiAlert = (text, o) => enqueue(text, o, false).then(() => {});
    window.alert = text => { uiAlert(text); };
})();

// ---------- Service Worker: Zwischenspeicher (und Push, wenn eingeschaltet) ----------
// Wird erst nach der Anmeldung angemeldet. Die Google-Skripte für Push lädt er nur mit ?push=1, also nur bei eingeschaltetem Push.
function registerSW(push) {
    if (!('serviceWorker' in navigator) || location.protocol !== 'https:' && location.hostname !== 'localhost') return;
    const want = '/firebase-messaging-sw.js' + (push ? '?push=1' : '');
    navigator.serviceWorker.getRegistration('/').then(reg => {
        const cur = reg && (reg.active || reg.waiting || reg.installing);
        if (!cur || new URL(cur.scriptURL).search !== new URL(want, location.href).search) navigator.serviceWorker.register(want).catch(() => {});
    }).catch(() => {});
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
                await uiAlert('Dafür hast du keine Berechtigung.', { title: 'Kein Zugriff', icon: 'fa-lock' });
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

            registerSW(!!currentUser.notificationsEnabled);
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
// steht in js/theme.js (wird ohne Verzögerung im <head> geladen, damit das richtige Design sofort erscheint)


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
(function () { const s = document.createElement('script'); s.src = (window.assetUrl || (p => p))('/js/update.js'); s.defer = true; document.head.appendChild(s); })();
