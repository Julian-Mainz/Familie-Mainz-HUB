// js/settings.js - Einstellungen & Push (wird vom Menü automatisch nachgeladen)
(function () {
    const VAPID_KEY = 'BPEpGDjLNQG4JpIwPgr2_WtdKDE5G8GE5S33LKLJmxfNPrAfxBXW6wpeHj0dQOhENsmYbUWOh669HoSJ18w18Lk';
    const SW_PATH = '/firebase-messaging-sw.js';
    let messaging = null, msgTried = false;

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
        if (msgTried) return; msgTried = true;
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
        <div id="modal-settings" class="gs-ov mid hidden" role="dialog" aria-modal="true" aria-labelledby="set-title" style="z-index:60">
            <div class="gs-box dlg">
                <div class="gs-top"><h3 class="gs-t" id="set-title">Einstellungen</h3><button class="gs-x" onclick="closeSettingsModal()" aria-label="Schließen"><i class="fa-solid fa-xmark"></i></button></div>
                <div class="gs-stack">
                    <div class="gs-row"><div><b><i class="fa-solid fa-bell" style="color:#facc15;margin-right:8px"></i>Push-Mitteilungen</b><small id="master-push-subtext">Status: Inaktiv</small></div>
                        <button id="btn-master-push" onclick="toggleMasterPush()" class="gs-btn pri">Aktivieren</button></div>
                    <label class="gs-row"><span>Stempeluhr-Alarm</span><input type="checkbox" id="pref-notify-work" onchange="saveNotificationPref('notifyWork', this.checked)"></label>
                    <label class="gs-row"><span>Termin-Bestätigung</span><input type="checkbox" id="pref-notify-events" onchange="saveNotificationPref('notifyEvents', this.checked)"></label>
                    <div class="gs-stats">
                        <div><span>Internet</span><span id="set-stat-net"></span></div>
                        <div><span>Service Worker</span><span id="set-stat-sw" class="gs-mu">Prüfe...</span></div>
                        <div><span>Push-Alarm</span><span id="set-stat-push" class="gs-mu">Inaktiv</span></div>
                    </div>
                    <button onclick="toggleTheme()" class="gs-row"><span><i data-theme-icon class="fa-solid fa-moon" style="color:#94a3b8;margin-right:8px"></i>Design</span><span data-theme-text class="gs-mu">Dunkel</span></button>
                    <div class="gs-row" style="flex-direction:column;align-items:stretch;gap:10px">
                        <b><i class="fa-solid fa-user-shield" style="color:#818cf8;margin-right:8px"></i>Meine Daten &amp; Konto</b>
                        <button id="btn-export" onclick="exportMyData()" class="gs-btn full"><i class="fa-solid fa-download" style="color:#34d399;margin-right:8px"></i>Alle meine Daten herunterladen (JSON)</button>
                        <button onclick="openDeleteAccount()" class="gs-btn bad full"><i class="fa-solid fa-trash-can" style="margin-right:8px"></i>Konto und Daten löschen</button>
                    </div>
                </div>
                <div class="gs-acts" style="border-top:1px solid rgba(148,163,184,.16);margin-top:14px"><button onclick="closeSettingsModal()" class="gs-btn">Schließen</button></div>
            </div>
        </div>`);
    }

    function setStat(id, text, ok) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerText = text;
        el.className = ok === true ? 'gs-ok' : ok === false ? 'gs-no' : 'gs-mu';
    }

    async function refreshPushUI() {
        if (typeof currentUser === 'undefined' || !currentUser) return;
        const on = !!currentUser.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted';
        const btn = document.getElementById('btn-master-push');
        if (btn) {
            btn.innerText = on ? 'Deaktivieren' : 'Aktivieren';
            btn.className = 'gs-btn pri' + (on ? ' on' : '');
        }
        const sub = document.getElementById('master-push-subtext');
        if (sub) sub.innerText = 'Status: ' + (on ? 'Aktiv' : (messaging || !msgTried ? 'Inaktiv' : 'Nicht unterstützt'));
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
                if (!messaging) await initMessaging();      // das Google-Skript für Push wird erst jetzt geladen
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

    // Der Service Worker (Push im Hintergrund) wird nur registriert, wenn Push an ist. Er lädt zwei Skripte von Google nach, das soll nicht bei jedem Seitenaufruf passieren.
    if ('serviceWorker' in navigator && typeof currentUser !== 'undefined' && currentUser && currentUser.notificationsEnabled) navigator.serviceWorker.register(SW_PATH).catch(() => {});
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
            try { out.daten.dokumente = (await db.collection('documents').where('owner', '==', currentUser.email).get()).docs.map(d => { const x = plain(d.data()); delete x.thumb; return { id: d.id, ...x, hinweis: 'Den Dateiinhalt lädst du im Bereich Dokumente herunter.' }; }); }
            catch (e) { out.daten.dokumente = 'kein Zugriff'; }
            for (const [c, k] of [['active_work', 'laufende_stempelung'], ['finance_settings', 'budgets']]) {
                try { const d = await db.collection(c).doc(currentUser.uid).get(); out.daten[k] = d.exists ? plain(d.data()) : null; } catch (e) { out.daten[k] = 'kein Zugriff'; }
            }
            try { const p = plain((await db.collection('users').doc(currentUser.uid).get()).data() || {}); delete p.fcmToken; out.daten.profil = p; } catch (e) { out.daten.profil = 'kein Zugriff'; }
            if (can(currentUser, 'messenger')) {
                try {
                    const uid = currentUser.uid, chats = await db.collection('chats').where('members', 'array-contains', uid).get(), list = [];
                    for (const c of chats.docs) { const ms = await c.ref.collection('messages').where('from', '==', uid).get(); const x = c.data(); list.push({ chat: c.id, typ: x.type, titel: x.title || null, mitglieder: x.members, eigene_nachrichten: ms.docs.map(m => ({ id: m.id, ...plain(m.data()) })) }); }
                    const dir = await db.collection('directory').doc(uid).get();
                    out.daten.messenger = { verzeichnis: dir.exists ? plain(dir.data()) : null, chats: list };
                } catch (e) { out.daten.messenger = 'kein Zugriff'; }
            }
            const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })), download: `Meine_Daten_${localDate()}.json` });
            document.body.appendChild(a); a.click(); a.remove();
            logSystemEvent('data', 'Datenexport erstellt');
        } catch (err) { alert('Export fehlgeschlagen: ' + err.message); }
        finally { btn.disabled = false; btn.innerHTML = label; }
    };

    function buildDelete() {
        if (document.getElementById('modal-delete-account')) return;
        document.body.insertAdjacentHTML('beforeend', `
        <div id="modal-delete-account" class="gs-ov mid z70 hidden" role="dialog" aria-modal="true" aria-labelledby="del-title">
            <div class="gs-box dlg red">
                <h3 class="gs-t red" id="del-title"><i class="fa-solid fa-triangle-exclamation"></i>Konto endgültig löschen</h3>
                <p class="gs-p">Gelöscht werden dein Profil und alle deine Daten: Arbeitszeiten, Buchungen, Fixkosten, Lohnabrechnungen, Tresor-Einträge, Dokumente sowie deine Termine, Notizen und Aufgaben. Deine Chat-Nachrichten bleiben bei deinen Gesprächspartnern erhalten, dein Name wird dort zu „Gelöschtes Konto“. Das kann nicht rückgängig gemacht werden. Lade vorher am besten deine Daten herunter.</p>
                <div id="del-admin-note" class="gs-note hidden" style="margin-top:12px">Admin-Konten können nicht selbst gelöscht werden. Lass dich zuerst von einem anderen Admin zum normalen Mitglied herabstufen.</div>
                <div class="gs-stack" style="margin-top:16px">
                    <input type="password" id="del-pass" autocomplete="current-password" placeholder="Dein Passwort" class="gs-in" aria-label="Dein Passwort">
                    <input id="del-confirm" autocomplete="off" placeholder="Zur Bestätigung LÖSCHEN eintippen" class="gs-in" aria-label="Bestätigung">
                </div>
                <div class="gs-acts">
                    <button onclick="document.getElementById('modal-delete-account').classList.add('hidden')" class="gs-btn">Abbrechen</button>
                    <button id="del-btn" onclick="deleteAccount()" class="gs-btn dng">Endgültig löschen</button>
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
            try {      // Dokumente: erst die Dateiteile, dann die Kopfdaten
                const ds = await db.collection('documents').where('owner', '==', email).get();
                for (const d of ds.docs) { try { await purge(d.ref.collection('chunks')); } catch (e) {} }
                await purge(db.collection('documents').where('owner', '==', email));
            } catch (e) { /* kein Zugriff = nichts zu löschen */ }
            for (const c of OWNED) { try { await purge(db.collection(c).where('owner', '==', email)); } catch (e) { /* kein Zugriff = nichts zu löschen */ } }
            await Promise.all([db.collection('active_work').doc(uid).delete().catch(() => {}), db.collection('finance_settings').doc(uid).delete().catch(() => {}), db.collection('directory').doc(uid).delete().catch(() => {}), db.collection('users').doc(uid).collection('meta').doc('messenger').delete().catch(() => {})]);
            await db.collection('users').doc(uid).delete();      // zuletzt, danach fehlen die Zugriffsrechte
            await user.delete();
            try { sessionStorage.clear(); } catch (e) {}
            alert('Dein Konto und deine Daten wurden gelöscht.');
            window.location.href = '/';
        } catch (err) { alert('Löschen nicht abgeschlossen: ' + err.message); btn.disabled = false; btn.innerText = 'Endgültig löschen'; }
    };

    buildModal();
    // Das Push-Skript von Google wird nur geladen, wenn Push schon an ist oder gerade eingeschaltet wird. Sonst entfällt auf jeder Seite eine Anfrage an einen fremden Server.
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.notificationsEnabled) initMessaging(); else refreshPushUI();
})();
