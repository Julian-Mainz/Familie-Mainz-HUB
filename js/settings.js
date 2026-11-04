// js/settings.js - Einstellungen & Push (wird vom Menü automatisch nachgeladen)
(function () {
    const VAPID_KEY = 'BPEpGDjLNQG4JpIwPgr2_WtdKDE5G8GE5S33LKLJmxfNPrAfxBXW6wpeHj0dQOhENsmYbUWOh669HoSJ18w18Lk';
    const SW_PATH = '/firebase-messaging-sw.js';
    let messaging = null;

    function loadMessagingSdk() {
        return new Promise(resolve => {
            if (window.firebase && firebase.messaging) return resolve();
            const s = document.createElement('script');
            s.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js';
            s.onload = resolve;
            s.onerror = resolve;
            document.head.appendChild(s);
        });
    }

    async function initMessaging() {
        await loadMessagingSdk();
        try {
            if (firebase.messaging && firebase.messaging.isSupported()) {
                messaging = firebase.messaging();
                messaging.onMessage(p => window.sendLocalNotification(p.notification?.title || 'Hinweis', p.notification?.body || ''));
            }
        } catch (e) { messaging = null; }
        refreshPushUI();
    }

    function buildModal() {
        if (document.getElementById('modal-settings')) return;
        document.body.insertAdjacentHTML('beforeend', `
        <div id="modal-settings" class="fixed inset-0 z-[60] bg-slate-950/80 hidden flex items-center justify-center p-4">
            <div class="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-3xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
                <div class="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                    <h3 class="text-base font-bold text-slate-100">Einstellungen</h3>
                    <button onclick="closeSettingsModal()" class="text-slate-400 hover:text-slate-200"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="space-y-4">
                    <div class="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                        <div>
                            <div class="text-xs font-semibold text-slate-200 flex items-center gap-2"><i class="fa-solid fa-bell text-yellow-400"></i> Push-Mitteilungen</div>
                            <div class="text-[10px] text-slate-400 mt-0.5" id="master-push-subtext">Status: Inaktiv</div>
                        </div>
                        <button id="btn-master-push" onclick="toggleMasterPush()" class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all bg-indigo-600 hover:bg-indigo-500 text-white">Aktivieren</button>
                    </div>
                    <div class="space-y-2.5">
                        <label class="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl cursor-pointer">
                            <span class="text-xs font-medium text-slate-200">Stempeluhr-Alarm</span>
                            <input type="checkbox" id="pref-notify-work" onchange="saveNotificationPref('notifyWork', this.checked)" class="rounded bg-slate-800 border-slate-700 w-4 h-4 cursor-pointer">
                        </label>
                        <label class="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl cursor-pointer">
                            <span class="text-xs font-medium text-slate-200">Termin-Bestätigung</span>
                            <input type="checkbox" id="pref-notify-events" onchange="saveNotificationPref('notifyEvents', this.checked)" class="rounded bg-slate-800 border-slate-700 w-4 h-4 cursor-pointer">
                        </label>
                    </div>
                    <div class="p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl text-[11px] space-y-1.5">
                        <div class="flex justify-between"><span class="text-slate-400">Internet</span><span id="set-stat-net" class="font-medium"></span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Service Worker</span><span id="set-stat-sw" class="font-medium text-slate-400">Prüfe...</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Push-Alarm</span><span id="set-stat-push" class="font-medium text-slate-400">Inaktiv</span></div>
                    </div>
                    <button onclick="toggleTheme()" class="w-full flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl text-xs font-medium text-slate-200"><span><i data-theme-icon class="fa-solid fa-moon text-slate-400 mr-2"></i>Design</span><span data-theme-text class="text-slate-400">Dunkel</span></button>
                    <div class="p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl space-y-2">
                        <div class="text-xs font-semibold text-slate-200"><i class="fa-solid fa-user-shield text-indigo-400 mr-2"></i>Meine Daten &amp; Konto</div>
                        <button id="btn-export" onclick="exportMyData()" class="w-full py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"><i class="fa-solid fa-download mr-2 text-emerald-400"></i>Alle meine Daten herunterladen (JSON)</button>
                        <button onclick="openDeleteAccount()" class="w-full py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20"><i class="fa-solid fa-trash-can mr-2"></i>Konto und Daten löschen</button>
                    </div>
                    <div class="pt-3 border-t border-slate-800 text-right">
                        <button onclick="closeSettingsModal()" class="px-4 py-2 rounded-xl text-xs bg-slate-800 text-slate-300">Schließen</button>
                    </div>
                </div>
            </div>
        </div>`);
    }

    function setStat(id, text, ok) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerText = text;
        el.className = 'font-medium ' + (ok === true ? 'text-emerald-400' : ok === false ? 'text-rose-400' : 'text-slate-400');
    }

    async function refreshPushUI() {
        if (typeof currentUser === 'undefined' || !currentUser) return;
        const on = !!currentUser.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted';
        const btn = document.getElementById('btn-master-push');
        if (btn) {
            btn.innerText = on ? 'Deaktivieren' : 'Aktivieren';
            btn.className = 'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all text-white ' + (on ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500');
        }
        const sub = document.getElementById('master-push-subtext');
        if (sub) sub.innerText = 'Status: ' + (on ? 'Aktiv' : (messaging ? 'Inaktiv' : 'Nicht unterstützt'));
        const p = currentUser.userPrefs || {};
        const w = document.getElementById('pref-notify-work');
        const e = document.getElementById('pref-notify-events');
        if (w) w.checked = p.notifyWork !== false;
        if (e) e.checked = p.notifyEvents !== false;

        setStat('set-stat-net', navigator.onLine ? 'Online' : 'Offline', navigator.onLine);
        setStat('set-stat-push', on ? 'Aktiv' : 'Inaktiv', on ? true : null);
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration(SW_PATH).catch(() => null);
            setStat('set-stat-sw', reg ? 'Aktiv' : 'Nicht registriert', reg ? true : null);
        } else {
            setStat('set-stat-sw', 'Nicht unterstützt', null);
        }
    }

    window.openSettingsModal = function () {
        buildModal();
        refreshPushUI();
        if (typeof updateThemeButtons === 'function') updateThemeButtons();
        document.getElementById('modal-settings').classList.remove('hidden');
    };
    window.closeSettingsModal = function () {
        document.getElementById('modal-settings')?.classList.add('hidden');
    };

    window.toggleMasterPush = async function () {
        if (!currentUser) return;
        const userRef = db.collection('users').doc(currentUser.uid);
        try {
            if (currentUser.notificationsEnabled) {
                if (messaging) await messaging.deleteToken().catch(() => {});
                currentUser.notificationsEnabled = false;
                await userRef.update({ notificationsEnabled: false, fcmToken: firebase.firestore.FieldValue.delete() });
            } else {
                if (!messaging || !('Notification' in window)) return alert('Push wird von diesem Browser nicht unterstützt.');
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') return alert('Benachrichtigungen wurden nicht erlaubt.');
                const reg = await navigator.serviceWorker.register(SW_PATH);
                const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
                if (!token) throw new Error('Kein Token erhalten');
                currentUser.notificationsEnabled = true;
                await userRef.update({ notificationsEnabled: true, fcmToken: token });
            }
            logSystemEvent('data', currentUser.notificationsEnabled ? 'Push aktiviert' : 'Push deaktiviert');
        } catch (err) {
            alert('Push fehlgeschlagen: ' + err.message);
        }
        refreshPushUI();
    };

    window.saveNotificationPref = async function (key, checked) {
        if (!currentUser) return;
        currentUser.userPrefs = currentUser.userPrefs || {};
        currentUser.userPrefs[key] = checked;
        try {
            await db.collection('users').doc(currentUser.uid).update({ [`userPrefs.${key}`]: checked });
        } catch (err) { alert('Speichern fehlgeschlagen: ' + err.message); }
    };

    window.sendLocalNotification = function (title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/icons/icon-192.png' });
        }
    };

    // Service Worker auf jeder Seite registrieren (nötig für Push im Hintergrund)
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(SW_PATH).catch(() => {});
    window.addEventListener('online', refreshPushUI);
    window.addEventListener('offline', refreshPushUI);

    // ---------- Meine Daten herunterladen / Konto löschen (DSGVO) ----------
    const OWNED = ['worktime', 'finance_transactions', 'payslips', 'fixed_costs', 'vault', 'events', 'notes', 'todos'];
    function plain(v) {
        if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
        if (Array.isArray(v)) return v.map(plain);
        if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = plain(v[k]); return o; }
        return v;
    }
    window.exportMyData = async function () {
        const btn = document.getElementById('btn-export'), label = btn.innerHTML;
        btn.disabled = true; btn.innerText = 'Sammle Daten...';
        try {
            const out = { exportiert_am: new Date().toISOString(), konto: { uid: currentUser.uid, email: currentUser.email },
                hinweise: ['Enthält alle Daten, die unter deiner E-Mail-Adresse gespeichert sind.', 'Tresor-Einträge sind verschlüsselt und nur mit deinem Master-Passwort lesbar.', 'System-Protokolle sind nur für Administratoren einsehbar und nicht enthalten.'], daten: {} };
            for (const c of OWNED) {
                try { out.daten[c] = (await db.collection(c).where('owner', '==', currentUser.email).get()).docs.map(d => ({ id: d.id, ...plain(d.data()) })); }
                catch (e) { out.daten[c] = 'kein Zugriff'; }
            }
            for (const [c, k] of [['active_work', 'laufende_stempelung'], ['finance_settings', 'budgets']]) {
                try { const d = await db.collection(c).doc(currentUser.uid).get(); out.daten[k] = d.exists ? plain(d.data()) : null; } catch (e) { out.daten[k] = 'kein Zugriff'; }
            }
            try { const p = plain((await db.collection('users').doc(currentUser.uid).get()).data() || {}); delete p.fcmToken; out.daten.profil = p; } catch (e) { out.daten.profil = 'kein Zugriff'; }
            const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })), download: `Meine_Daten_${localDate()}.json` });
            document.body.appendChild(a); a.click(); a.remove();
            logSystemEvent('data', 'Datenexport erstellt');
        } catch (err) { alert('Export fehlgeschlagen: ' + err.message); }
        finally { btn.disabled = false; btn.innerHTML = label; }
    };

    function buildDelete() {
        if (document.getElementById('modal-delete-account')) return;
        document.body.insertAdjacentHTML('beforeend', `
        <div id="modal-delete-account" class="fixed inset-0 z-[70] bg-slate-950/85 hidden flex items-center justify-center p-4">
            <div class="bg-slate-900 border border-rose-500/30 p-5 rounded-3xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
                <h3 class="text-base font-bold text-rose-300"><i class="fa-solid fa-triangle-exclamation mr-2"></i>Konto endgültig löschen</h3>
                <p class="text-xs text-slate-400 mt-2 leading-relaxed">Gelöscht werden dein Profil und alle deine Daten: Arbeitszeiten, Buchungen, Fixkosten, Lohnabrechnungen, Tresor-Einträge sowie deine Termine, Notizen und Aufgaben. Das kann nicht rückgängig gemacht werden. Lade vorher am besten deine Daten herunter.</p>
                <div id="del-admin-note" class="hidden mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">Admin-Konten können nicht selbst gelöscht werden. Lass dich zuerst von einem anderen Admin zum normalen Mitglied herabstufen.</div>
                <div class="space-y-3 mt-4">
                    <input type="password" id="del-pass" autocomplete="current-password" placeholder="Dein Passwort" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-rose-500">
                    <input id="del-confirm" autocomplete="off" placeholder="Zur Bestätigung LÖSCHEN eintippen" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-rose-500">
                </div>
                <div class="flex justify-end gap-3 pt-4">
                    <button onclick="document.getElementById('modal-delete-account').classList.add('hidden')" class="px-4 py-2 rounded-xl text-xs bg-slate-800 text-slate-300">Abbrechen</button>
                    <button id="del-btn" onclick="deleteAccount()" class="px-4 py-2 rounded-xl text-xs bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-semibold">Endgültig löschen</button>
                </div>
            </div>
        </div>`);
    }
    window.openDeleteAccount = function () {
        buildDelete();
        const adm = currentUser.role === 'admin';
        document.getElementById('del-admin-note').classList.toggle('hidden', !adm);
        document.getElementById('del-btn').disabled = adm;
        document.getElementById('del-pass').value = document.getElementById('del-confirm').value = '';
        document.getElementById('modal-delete-account').classList.remove('hidden');
    };
    async function purge(q) {
        for (;;) {
            const snap = await q.limit(400).get(); if (snap.empty) break;
            const b = db.batch(); snap.docs.forEach(d => b.delete(d.ref)); await b.commit();
        }
    }
    window.deleteAccount = async function () {
        const pw = document.getElementById('del-pass').value, btn = document.getElementById('del-btn');
        if (document.getElementById('del-confirm').value.trim().toUpperCase() !== 'LÖSCHEN') return alert('Bitte tippe zur Bestätigung LÖSCHEN ein.');
        if (!pw) return alert('Bitte gib dein Passwort ein.');
        btn.disabled = true; btn.innerText = 'Lösche...';
        try {
            const user = auth.currentUser;
            try { await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email, pw)); }
            catch (e) { throw new Error(/password|credential/i.test(e.code + e.message) ? 'Das Passwort ist nicht korrekt.' : e.message); }
            await logSystemEvent('auth', 'Konto selbst gelöscht', { email: currentUser.email });
            const email = currentUser.email, uid = currentUser.uid;
            for (const c of OWNED) { try { await purge(db.collection(c).where('owner', '==', email)); } catch (e) { /* kein Zugriff = nichts zu löschen */ } }
            await Promise.all([db.collection('active_work').doc(uid).delete().catch(() => {}), db.collection('finance_settings').doc(uid).delete().catch(() => {})]);
            await db.collection('users').doc(uid).delete();      // zuletzt, danach fehlen die Zugriffsrechte
            await user.delete();
            try { sessionStorage.clear(); } catch (e) {}
            alert('Dein Konto und deine Daten wurden gelöscht.');
            window.location.href = '/';
        } catch (err) { alert('Löschen nicht abgeschlossen: ' + err.message); btn.disabled = false; btn.innerText = 'Endgültig löschen'; }
    };

    buildModal();
    initMessaging();
})();
