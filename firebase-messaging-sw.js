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

// Benachrichtigung anzeigen, wenn Tab geschlossen ist
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title || 'Familie Mainz Hub';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
