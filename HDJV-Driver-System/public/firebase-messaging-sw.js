/* eslint-disable no-undef */
// Firebase App configuration
const firebaseConfig = {
  apiKey: 'AIzaSyDq4OLuSOW-tMuFQwoMQzLlS8BIQOlvSvM',
  authDomain: 'hdjv-transpo.firebaseapp.com',
  projectId: 'hdjv-transpo',
  storageBucket: 'hdjv-transpo.firebasestorage.app',
  messagingSenderId: '484818955540',
  appId: '1:484818955540:web:4cf69128b530b6e2b22601'
};

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  const notificationTitle = payload?.notification?.title || 'New notification';
  const notificationOptions = {
    body: payload?.notification?.body || '',
    icon: '/icons/HDJV_TRANSPO_ICON_1.png',
    data: payload?.data || {},
    tag: 'hdjv-notification',
    requireInteraction: true
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle foreground messages
messaging.onMessage((payload) => {
  console.log('Foreground message received:', payload);
});

// Service worker installation and activation
self.addEventListener('install', () => {
  console.log('Service worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.log('Service worker activated');
});
