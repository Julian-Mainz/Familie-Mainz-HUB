// js/pages/login.js - Seiten-Code von /index.html (ausgelagert, damit der Browser ihn zwischenspeichern kann)
window.signingUp = false;

// Meldungen wie "Konto gesperrt" oder "wartet auf Freigabe" nach einer Weiterleitung anzeigen
showFlash();

// Wartungsmodus (Admin-Bereich): Anmeldung nur für Admins, Formulare ausgeblendet
let loginMaint = false;
function renderLoginMaint(m) {
    loginMaint = maintOn('/', m);
    $('lg-card').classList.toggle('maint', loginMaint);
    $('lg-maint-msg').innerText = (m && m.msg) || MAINT_DEFAULT_MSG;
    const u = maintUntilText(m); $('lg-maint-until').classList.toggle('hidden', !u); $('lg-maint-until').querySelector('span').innerText = u;
    if (!loginMaint) $('lg-card').classList.remove('adm');
}
function maintAdminLogin(on) { $('lg-card').classList.toggle('adm', on); $('auth-alert').classList.add('hidden'); if (on) setTimeout(() => $('login-email').focus(), 50); }
const maintReady = watchMaint().then(renderLoginMaint);
document.addEventListener('maint-change', e => renderLoginMaint(e.detail));

// Eingeloggt: weiter ins Menü. Während der Registrierung nicht, sonst fehlt das Profil noch.
// In der Wartung kommen nur Admins weiter, alle anderen werden gleich wieder abgemeldet.
auth.onAuthStateChanged(async user => {
    if (!user || window.signingUp) return;
    await maintReady;
    if (loginMaint) {
        let ok = false;
        try { const d = await db.collection('users').doc(user.uid).get(); ok = d.exists && isAdmin(d.data()) && (d.data().status || 'active') === 'active'; } catch (e) {}
        if (!ok) {
            await auth.signOut();
            $('lg-card').classList.add('adm');
            showAuthAlert('Wegen Wartungsarbeiten können sich gerade nur Admins anmelden.');
            const b = $('btn-login'); b.disabled = false; b.innerText = 'Anmelden';
            return;
        }
    }
    window.location.href = '/menu.html';
});

function setNet() {
    $('net-dot').className = 'lg-dot ' + (navigator.onLine ? 'on' : 'off');
    $('net-text').innerText = navigator.onLine ? 'System Online' : 'Offline';
}
window.addEventListener('online', setNet); window.addEventListener('offline', setNet); setNet();

function showAuthAlert(msg, ok = false) {
    $('auth-alert-text').innerText = msg;
    $('auth-alert').className = 'lg-alert ' + (ok ? 'ok' : 'bad');
    $('auth-alert').querySelector('i').className = 'fa-solid ' + (ok ? 'fa-circle-check' : 'fa-circle-exclamation');
}

function showView(v) {
    $('auth-alert').classList.add('hidden');
    ['login', 'register', 'reset'].forEach(k => $('form-' + k).classList.toggle('hidden', k !== v));
    $('lg-tabs').dataset.v = v;
    if (v === 'reset' && !$('reset-email').value) $('reset-email').value = $('login-email').value;
    const f = $('form-' + v); f.classList.remove('lg-enter'); void f.offsetWidth; f.classList.add('lg-enter');   // Formular gleitet beim Wechsel ein
}
function showRegisterView(show) { showView(show ? 'register' : 'login'); }

async function sendReset(e) {
    e.preventDefault();
    const email = $('reset-email').value.trim(), btn = $('btn-reset');
    btn.disabled = true; btn.innerText = 'Wird gesendet...';
    try {
        await auth.sendPasswordResetEmail(email);
    } catch (err) {
        const hint = { 'auth/invalid-email': 'Bitte eine gültige E-Mail-Adresse eingeben.', 'auth/too-many-requests': 'Zu viele Versuche. Bitte später erneut versuchen.', 'auth/network-request-failed': 'Netzwerkfehler. Bitte später erneut versuchen.' }[err.code];
        if (hint) { showAuthAlert(hint); btn.disabled = false; btn.innerText = 'Link senden'; return; }
        // Alle anderen Fälle (z. B. unbekannte Adresse) bewusst neutral beantworten, damit niemand Adressen ausprobieren kann
    }
    logSystemEvent('auth', 'Passwort-Reset angefordert', { attemptedEmail: email });
    btn.disabled = false; btn.innerText = 'Link senden';
    showView('login');
    showAuthAlert('Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine E-Mail zum Zurücksetzen des Passworts gesendet. Bitte auch den Spam-Ordner prüfen.', true);
}

async function handleSignIn(e) {
    e.preventDefault();
    $('auth-alert').classList.add('hidden');
    const email = $('login-email').value.trim(), password = $('login-password').value;
    const btn = $('btn-login');
    btn.disabled = true; btn.innerText = 'Wird angemeldet...';
    try {
        await auth.signInWithEmailAndPassword(email, password);   // Weiterleitung übernimmt onAuthStateChanged
    } catch (err) {
        logSystemEvent('auth', 'Fehlgeschlagener Login-Versuch', { attemptedEmail: email, reason: err.code || err.message });
        showAuthAlert('Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.');
        btn.disabled = false; btn.innerText = 'Anmelden';
    }
}

const normCode = v => (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
async function handleSignUp(e) {
    e.preventDefault();
    $('auth-alert').classList.add('hidden');
    const firstName = $('reg-firstname').value.trim(), lastName = $('reg-lastname').value.trim();
    const email = $('reg-email').value.trim(), password = $('reg-password').value, code = normCode($('reg-code').value);
    const btn = $('btn-register');
    if (code.length < 8) return showAuthAlert('Bitte den Einladungscode eingeben.');
    btn.disabled = true; btn.innerText = 'Prüfe Code...';
    window.signingUp = true;
    let cred = null;
    try {
        // 1) Code prüfen, bevor ein Konto angelegt wird
        let inv; try { inv = await db.collection('invites').doc(code).get(); } catch (x) { throw Object.assign(new Error('Der Einladungscode konnte nicht geprüft werden. Bitte später erneut versuchen.'), { friendly: true }); }
        const d = inv.exists ? inv.data() : null, exp = d && d.expiresAt && d.expiresAt.toDate ? d.expiresAt.toDate() : null;
        if (!d) throw Object.assign(new Error('Dieser Einladungscode ist nicht gültig.'), { friendly: true });
        if (d.used) throw Object.assign(new Error('Dieser Einladungscode wurde bereits verwendet.'), { friendly: true });
        if (exp && exp < new Date()) throw Object.assign(new Error('Dieser Einladungscode ist abgelaufen.'), { friendly: true });
        btn.innerText = 'Erstelle Konto...';
        cred = await auth.createUserWithEmailAndPassword(email, password);
        // 2) Profil anlegen und Code einlösen in EINEM Schreibvorgang. Die Datenbank-Regeln prüfen beides gemeinsam.
        const batch = db.batch();
        batch.set(db.collection('users').doc(cred.user.uid), {
            firstName, lastName, displayName: `${firstName} ${lastName}`, email, inviteCode: code,
            role: 'user', status: 'pending',
            permissions: { termine: true, pinnwand: true, aufgaben: true, zeit: false, finanzen: false, tresor: false, wand: false, spotify: false, webapps: false, messenger: false, gruppen: false, admin: false },   // Standard für neue Konten: nur Startseite; mehr vergibt der Admin
            userPrefs: { notifyWork: true, notifyEvents: true },
            createdAt: TS()
        });
        batch.update(db.collection('invites').doc(code), { used: true, usedBy: cred.user.uid, usedAt: TS() });
        await batch.commit();
        logSystemEvent('auth', 'Registrierung per Einladung', { email, code: code.slice(0, 4) + '…' });
        await auth.signOut();
        $('form-register').reset();
        showRegisterView(false);
        showAuthAlert('Registrierung erfolgreich! Ein Administrator muss Ihr Konto noch freigeben.', true);
    } catch (err) {
        if (cred?.user) await cred.user.delete().catch(() => {});
        showAuthAlert(err.friendly ? err.message
            : err.code === 'auth/email-already-in-use' ? 'Diese E-Mail ist bereits registriert.'
            : err.code === 'auth/weak-password' ? 'Passwort zu schwach (mindestens 8 Zeichen).'
            : err.code === 'permission-denied' ? 'Der Einladungscode konnte nicht eingelöst werden (bereits verwendet oder abgelaufen).'
            : 'Registrierung fehlgeschlagen: ' + err.message);
    } finally {
        window.signingUp = false;
        btn.disabled = false; btn.innerText = 'Konto anlegen';
    }
}

// ---------- Kontaktformular ----------
function openContact() { $('c-sent').classList.add('hidden'); $('c-form').classList.remove('hidden'); $('c-error').classList.add('hidden'); $('modal-contact').classList.remove('hidden'); }
function closeContact() { $('modal-contact').classList.add('hidden'); }
async function sendContact(e) {
    e.preventDefault();
    const done = () => { $('c-form').reset(); $('c-count').innerText = '0 / 1500'; $('c-form').classList.add('hidden'); $('c-sent').classList.remove('hidden'); };
    if ($('c-web').value) return done();                                  // Lockfeld: Bots bekommen scheinbar Erfolg
    const err = m => { $('c-error').innerText = m; $('c-error').classList.remove('hidden'); };
    let last = 0; try { last = +localStorage.getItem('contact_last') || 0; } catch (x) {}
    if (Date.now() - last < 60000) return err('Bitte warte kurz, bevor du eine weitere Nachricht sendest.');
    const name = $('c-name').value.trim(), email = $('c-email').value.trim(), message = $('c-msg').value.trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err('Bitte eine gültige E-Mail-Adresse eingeben oder das Feld leer lassen.');
    const btn = $('c-btn'); btn.disabled = true; btn.innerText = 'Wird gesendet...';
    try {
        const sent = await limitedAdd('contact', 'contact_messages', { name, email, message, read: false, createdAt: TS() });
        if (!sent) return err('Heute können leider keine weiteren Nachrichten angenommen werden. Bitte versuche es morgen noch einmal.');
        try { localStorage.setItem('contact_last', String(Date.now())); } catch (x) {}
        done();
    } catch (ex) { console.error('Kontakt senden:', ex); err('Senden fehlgeschlagen (' + (ex.code || ex.message) + '). Bitte später erneut versuchen.'); }
    finally { btn.disabled = false; btn.innerText = 'Senden'; }
}

// Einladungslink: /?code=ABCDE12345 öffnet direkt die Registrierung mit eingetragenem Code
(function () {
    const c = normCode(new URLSearchParams(location.search).get('code'));
    if (c) { showView('register'); $('reg-code').value = c; history.replaceState(null, '', location.pathname); }
})();

// ---------- Bedienkomfort ----------
function togglePw(id, btn) {
    const i = $(id), show = i.type === 'password'; i.type = show ? 'text' : 'password';
    btn.querySelector('i').className = 'fa-solid ' + (show ? 'fa-eye-slash' : 'fa-eye'); btn.setAttribute('aria-label', show ? 'Passwort verbergen' : 'Passwort anzeigen'); i.focus();
}
// Hinweis, wenn die Feststelltaste aktiv ist
[['login-password', 'caps-login'], ['reg-password', 'caps-reg']].forEach(([inp, hint]) => {
    const f = e => { if (e.getModifierState) $(hint).classList.toggle('hidden', !e.getModifierState('CapsLock')); };
    $(inp).addEventListener('keydown', f); $(inp).addEventListener('keyup', f); $(inp).addEventListener('blur', () => $(hint).classList.add('hidden'));
});
function regMeter() {
    const p = $('reg-password').value; let s = 0;
    if (p.length >= 8) s++; if (p.length >= 12) s++; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++;
    s = p ? Math.max(1, Math.min(4, s)) : 0;
    const L = [['', '#475569'], ['Schwach', '#ef4444'], ['Geht so', '#f59e0b'], ['Gut', '#84cc16'], ['Stark', '#22c55e']][s];
    $('reg-bar').style.width = (p ? Math.max(12, s * 25) : 0) + '%'; $('reg-bar').style.background = L[1]; $('reg-meter-txt').textContent = L[0];
}
// Begrüßung mit Uhrzeit (nur die Uhr des Geräts, keine Anfrage)
function tickLive() {
    const d = new Date(), h = d.getHours();
    $('lg-greet').textContent = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : h < 22 ? 'Guten Abend' : 'Gute Nacht';
    $('lg-clock').textContent = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    $('lg-date').textContent = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}
tickLive(); setInterval(tickLive, 20000);
// Leuchtfleck folgt der Maus (nur mit Maus und ohne "Bewegung reduzieren")
if (matchMedia('(pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let raf = 0; addEventListener('pointermove', e => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const s = $('lg-spot'); s.style.setProperty('--mx', e.clientX + 'px'); s.style.setProperty('--my', e.clientY + 'px'); }); }, { passive: true });
}
