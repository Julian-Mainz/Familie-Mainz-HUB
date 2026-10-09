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

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'Familie Mainz Hub';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: 'https://cdn-icons-png.flaticon.com/512/1160/1160358.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// PWA-Voraussetzung für Android Chrome:
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Leitet Anfragen normal ans Netz weiter
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
