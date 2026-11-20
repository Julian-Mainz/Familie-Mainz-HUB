// firebase-messaging-sw.js – Service Worker des J.Mainz Dashboards
// 1) Zwischenspeicher: Seiten und Dateien kommen schnell aus dem Speicher und das Dashboard startet auch bei schlechtem Netz.
//    Dateien mit Versionsnummer (?v=...) ändern sich nie -> direkt aus dem Speicher. Alles andere (Seiten, Bilder) wird immer
//    zuerst frisch vom Server geholt (kurze Prüfung, ob es sich geändert hat) und nur ohne Netz aus dem Speicher genommen.
// 2) Push im Hintergrund: Nur wenn Push eingeschaltet ist (Registrierung mit ?push=1), werden die Firebase-Skripte von Google geladen.
const CACHE = 'jm-v1';
const PUSH = new URL(self.location.href).searchParams.get('push') === '1';

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin || url.pathname === '/version.json' || url.pathname.endsWith('firebase-messaging-sw.js')) return;
    if (url.searchParams.has('v')) event.respondWith(cacheFirst(req, url));
    else event.respondWith(networkFirst(req, url));
});
async function cacheFirst(req, url) {
    const cache = await caches.open(CACHE), hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') {
        await cache.put(req, res.clone());
        (await cache.keys()).forEach(k => { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) cache.delete(k); });   // ältere Versionen derselben Datei entfernen
    }
    return res;
}
async function networkFirst(req, url) {
    const cache = await caches.open(CACHE), nav = req.mode === 'navigate';
    try {
        const res = await fetch(nav ? url.href : req, { cache: 'no-cache', credentials: 'same-origin' });
        if (res.ok && res.type === 'basic') cache.put(nav ? url.pathname : req, res.clone());
        return res;
    } catch (e) {
        const hit = await cache.match(nav ? url.pathname : req) || (nav && (url.pathname === '/' && await cache.match('/index.html')));
        if (hit) return hit;
        if (nav) return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#080c14;color:#e2e8f0;font:16px system-ui;text-align:center;padding:20px"><div><h1 style="font-size:22px">Keine Verbindung</h1><p style="color:#94a3b8">Diese Seite war noch nicht gespeichert. Bitte später erneut versuchen.</p></div>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        throw e;
    }
}
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('jm-') && k !== CACHE).map(k => caches.delete(k))))));

if (PUSH) try {
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
const ICON = '/icons/icon-192.png';

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
} catch (e) { /* Google nicht erreichbar: Zwischenspeicher funktioniert trotzdem */ }

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
