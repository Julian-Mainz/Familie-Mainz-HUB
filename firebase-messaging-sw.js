// firebase-messaging-sw.js – Hintergrund-Push für das J.Mainz Dashboard
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCfKWWHQ17-ujYGJcHw6efFBESArA8uY0Q",
    authDomain: "familie-mainz-netzwerk.firebaseapp.com",
    projectId: "familie-mainz-netzwerk",
    storageBucket: "familie-mainz-netzwerk.firebasestorage.app",
    messagingSenderId: "361922663455",
    appId: "1:361922663455:web:ed3eb8d34103ce89be312a"
});

const messaging = firebase.messaging();
const ICON = 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f6e1.png';

// Nachrichten mit "notification"-Feld zeigt der Browser selbst an.
// Reine Daten-Nachrichten (title/body/url im Feld "data") zeigen wir hier an.
messaging.onBackgroundMessage(payload => {
    if (payload.notification) return;
    const d = payload.data || {};
    self.registration.showNotification(d.title || 'J.Mainz Dashboard', {
        body: d.body || '',
        icon: ICON,
        data: { url: d.url || '/menu.html' }
    });
});

// Klick auf die Benachrichtigung öffnet bzw. fokussiert das Dashboard
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/menu.html';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const c of list) {
                if ('focus' in c) { if (c.navigate) c.navigate(url); return c.focus(); }
            }
            return clients.openWindow(url);
        })
    );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));
