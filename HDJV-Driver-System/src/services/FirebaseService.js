import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, deleteToken } from 'firebase/messaging';
import firebaseConfig from '../config/firebase';
import { API_BASE_URL } from '../utils/api/index.js';
import { navigateTo } from '../utils/navigation.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Check if Firebase Messaging is supported
const isMessagingSupported = () => {
  const hasApis = 'serviceWorker' in navigator && 
         'PushManager' in window && 
         'Notification' in window;
  const isSecureContext = location.protocol === 'https:' || 
         location.hostname === 'localhost' ||
         location.hostname === '127.0.0.1';
  return hasApis && isSecureContext;
};

// Initialize Firebase Cloud Messaging only if supported
const messaging = isMessagingSupported() ? getMessaging(app) : null;

class FirebaseService {
  constructor() {
    this.messaging = messaging;
    this.token = null;
    this.messageListeners = new Set();
    this.isMessageHandlerRegistered = false;
    this.isInitialized = false;
    this.pushBlocked = false;
  }

  isBrave() {
    try {
      return Boolean(
        navigator?.brave?.isBrave ||
        navigator?.brave ||
        (navigator.userAgent || '').toLowerCase().includes('brave')
      );
    } catch {
      return false;
    }
  }

  getAuthToken() {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  }

  /**
   * Request notification permission and get FCM token
   */
  async requestPermissionAndGetToken(retry = true) {
    try {
      // Check if messaging is supported
      if (!isMessagingSupported()) {
        console.log('Firebase Messaging is not supported in this browser/environment');
        return null;
      }

      if (!this.messaging) {
        console.log('Firebase Messaging is not initialized');
        return null;
      }

      // Request permission
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('Notification permission granted.');
        return await this.getTokenWithRegistration(retry);
      } else {
        console.log('Unable to get permission to notify.');
        return null;
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  async getTokenIfPermitted() {
    if (!isMessagingSupported() || !this.messaging) {
      return null;
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return null;
    }
    return this.getTokenWithRegistration(false);
  }

  async getTokenWithRegistration(retry = true) {
    let swRegistration = null;
    if ('serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (!swRegistration) {
          swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('Service worker registered successfully');
        } else {
          console.log('Service worker already registered');
        }
        await navigator.serviceWorker.ready;
      } catch (error) {
        console.warn('Service worker registration failed:', error);
      }
    } else {
      console.warn('Service workers are not supported in this browser');
    }

    if (!swRegistration || !swRegistration.pushManager) {
      console.warn('Push messaging is not supported (missing service worker pushManager)');
      return null;
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('FirebaseService: missing VITE_FIREBASE_VAPID_KEY');
      return null;
    }

    let token = null;
    try {
      token = await getToken(this.messaging, {
        vapidKey,
        serviceWorkerRegistration: swRegistration,
      });
    } catch (error) {
      console.error('Error getting FCM token:', error);
      if (
        error?.name === 'AbortError' &&
        this.isBrave() &&
        Notification.permission === 'granted'
      ) {
        this.pushBlocked = true;
        console.warn('Brave is blocking web push. Enable "Use Google services for push messaging" to receive notifications.');
        return null;
      }
      if (retry) {
        try {
          if (this.messaging) {
            await deleteToken(this.messaging);
          }
          if (swRegistration) {
            await swRegistration.unregister();
          }
        } catch (cleanupError) {
          console.warn('FCM cleanup after token error failed:', cleanupError);
        }
        return this.getTokenWithRegistration(false);
      }
      return null;
    }
    
    if (token) {
      this.token = token;
      console.log('FCM Token:', token);
      await this.sendTokenToBackend(token);
      return token;
    }

    console.log('No registration token available.');
    return null;
  }

  /**
   * Send FCM token to backend
   */
  async sendTokenToBackend(token) {
    try {
      const authToken = this.getAuthToken();
      if (!authToken) {
        console.log('User not authenticated, skipping token registration');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/fcm-tokens/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token: token,
          device_type: 'web',
          device_id: this.getDeviceId()
        })
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => '');

      if (!response.ok) {
        console.error('Failed to register FCM token:', response.status, payload);
        return;
      }

      if (payload && payload.success) {
        console.log('FCM token registered successfully');
      } else {
        console.log('FCM token registered');
      }
    } catch (error) {
      console.error('Error sending token to backend:', error);
    }
  }

  /**
   * Remove FCM token from backend
   */
  async removeToken() {
    if (!this.token) {
      console.log('No token to remove');
      return;
    }

    try {
      const authToken = this.getAuthToken();
      if (!authToken) {
        console.log('User not authenticated, skipping token removal');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/fcm-tokens/remove`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token: this.token
        })
      });

      const result = await response.json();
      if (result.success) {
        console.log('FCM token removed successfully');
        this.token = null;
      } else {
        console.error('Failed to remove FCM token:', result.message);
      }
    } catch (error) {
      console.error('Error removing token:', error);
    }
  }

  async disableNotifications() {
    try {
      if (this.messaging && this.token) {
        try {
          await deleteToken(this.messaging);
        } catch (error) {
          console.warn('Failed to delete FCM token from Firebase:', error);
        }
      }
      await this.removeToken();
    } catch (error) {
      console.error('Error disabling notifications:', error);
    }
  }

  /**
   * Get unique device ID
   */
  getDeviceId() {
    let deviceId = localStorage.getItem('firebase_device_id');
    if (!deviceId) {
      deviceId = 'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('firebase_device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Setup foreground message handler
   */
  onMessage(callback) {
    // Check if messaging is supported
    if (!isMessagingSupported() || !this.messaging) {
      console.log('Firebase Messaging is not supported, message handler not set up');
      return () => {}; // Return empty unsubscribe function
    }

    if (callback) {
      this.messageListeners.add(callback);
    }

    if (!this.isMessageHandlerRegistered) {
      this.isMessageHandlerRegistered = true;
      onMessage(this.messaging, (payload) => {
        console.log('Foreground message received:', payload);

        // Show notification in foreground
        if (payload.notification) {
          this.showNotification(payload.notification);
        }

        // Notify subscribers
        this.messageListeners.forEach((listener) => {
          try {
            listener(payload);
          } catch (error) {
            console.error('Firebase message listener error:', error);
          }
        });
      });
    }

    // Return unsubscribe
    return () => {
      if (callback) {
        this.messageListeners.delete(callback);
      }
    };
  }

  /**
   * Show browser notification
   */
  showNotification(notification) {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return;
    }

    // Check if permission is granted
    if (Notification.permission === 'granted') {
      const notificationInstance = new Notification(notification.title, {
        body: notification.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'hdjv-notification',
        requireInteraction: true,
        data: notification.data || {}
      });

      // Handle notification click
      notificationInstance.onclick = (event) => {
        event.preventDefault();
        window.focus();
        
        // Handle navigation based on notification data
        if (notification.data && notification.data.type) {
          this.handleNotificationClick(notification.data);
        }
        
        notificationInstance.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => {
        notificationInstance.close();
      }, 5000);
    }
  }

  /**
   * Handle notification click for navigation
   */
  handleNotificationClick(data) {
    switch (data.type) {
      case 'request_created':
        navigateTo('/requests');
        break;
      case 'request_accepted':
      case 'request_assigned':
        navigateTo(`/requests?id=${data.request_id}`);
        break;
      case 'request_rejected':
        navigateTo(`/requests?id=${data.request_id}`);
        break;
      case 'request_completed':
        navigateTo(`/requests?id=${data.request_id}`);
        break;
      default:
        navigateTo('/requests');
    }
  }

  /**
   * Initialize Firebase service
   */
  async initialize() {
    try {
      if (this.isInitialized) return;
      
      // Check if messaging is supported
      if (!isMessagingSupported()) {
        console.log('Firebase Messaging is not supported in this environment. Notifications will not work.');
        this.isInitialized = true;
        return;
      }

      this.isInitialized = true;

      // Request permission and get token
      await this.requestPermissionAndGetToken();
      
      // Setup message handler
      this.onMessage();
      
      console.log('Firebase service initialized');
    } catch (error) {
      this.isInitialized = false;
      console.error('Error initializing Firebase service:', error);
    }
  }

  async registerTokenWithBackend() {
    try {
      if (!this.token) return;
      await this.sendTokenToBackend(this.token);
    } catch (error) {
      console.error('Error registering token after login:', error);
    }
  }
}

// Create singleton instance
const firebaseService = new FirebaseService();

export default firebaseService;


