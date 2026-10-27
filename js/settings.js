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
        <div id="modal-settings" class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm hidden flex items-center justify-center p-4">
            <div class="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-3xl shadow-2xl w-full max-w-md">
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
            new Notification(title, { body, icon: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f6e1.png' });
        }
    };

    // Service Worker auf jeder Seite registrieren (nötig für Push im Hintergrund)
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(SW_PATH).catch(() => {});
    window.addEventListener('online', refreshPushUI);
    window.addEventListener('offline', refreshPushUI);

    buildModal();
    initMessaging();
})();
