// js/firebase-init.js - Zentrales Firebase Setup & Auth-Guard
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

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;

// Auth Guard: Überprüft auf jeder Unterseite den Login-Status
function initAuthGuard(onReadyCallback) {
    auth.onAuthStateChanged(async (user) => {
        const isLoginPage = window.location.pathname === '/' || window.location.pathname.endsWith('/index.html');
        
        if (user) {
            try {
                const doc = await db.collection('users').doc(user.uid).get();
                if (!doc.exists || (doc.data().status && doc.data().status !== 'active')) {
                    await auth.signOut();
                    if (!isLoginPage) window.location.href = '/';
                    return;
                }
                const data = doc.data();
                currentUser = {
                    uid: user.uid,
                    email: user.email,
                    name: data.firstName ? `${data.firstName} ${data.lastName}` : user.email.split('@')[0],
                    role: data.role || 'user',
                    permissions: data.permissions || {}
                };

                // Name im Header aktualisieren (falls Element vorhanden)
                const nameEl = document.getElementById('user-display-name');
                if (nameEl) nameEl.innerText = data.firstName || currentUser.name;

                if (onReadyCallback) onReadyCallback(currentUser);
            } catch (e) {
                console.error("Auth-Error:", e);
                if (!isLoginPage) window.location.href = '/';
            }
        } else {
            currentUser = null;
            // Wenn nicht eingeloggt und nicht auf der Startseite: Zurück zum Login
            if (!isLoginPage) {
                window.location.href = '/';
            } else if (onReadyCallback) {
                onReadyCallback(null);
            }
        }
    });
}

async function handleLogout() {
    await auth.signOut();
    window.location.href = '/';
}
