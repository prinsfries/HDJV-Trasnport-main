# Firebase Real-Time Notification System Setup Guide

## Overview
This guide will help you set up a complete real-time notification system using Firebase Cloud Messaging (FCM) for your HDJV Transportation System.

## Backend Setup (Laravel)

### 1. Install Firebase Admin SDK
```bash
composer require google/firebase
```

### 2. Create Firebase Service Account
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Save it as `storage/app/firebase-service-account.json`

### 3. Run Migration
```bash
php artisan migrate
```

### 4. Install Required Packages
Add these to your `composer.json` if not already present:
```json
{
    "require": {
        "google/firebase": "^6.0",
        "google/apiclient": "^2.0"
    }
}
```

## Frontend Setup (React Web)

### 1. Install Firebase SDK
```bash
npm install firebase
```

### 2. Update Firebase Configuration
Edit `src/config/firebase.js` and replace with your actual Firebase config:
- Get these values from Firebase Console → Project Settings → General
- Replace placeholder values with actual values

### 3. Generate VAPID Key
1. Go to Firebase Console → Project Settings → Cloud Messaging
2. Under "Web configuration", click "Generate key pair"
3. Copy the VAPID key and update `FirebaseService.js`

### 4. Initialize Firebase Service
Add to your main App component:
```jsx
import { useEffect } from 'react';
import firebaseService from './services/FirebaseService';

function App() {
  useEffect(() => {
    firebaseService.initialize();
  }, []);

  return (
    // Your app components
  );
}
```

## Mobile Setup (React Native)

### 1. Install Firebase Packages
```bash
npm install @react-native-firebase/app @react-native-firebase/messaging @react-native-firebase/auth
```

### 2. iOS Configuration
Add to `ios/YourApp/Info.plist`:
```xml
<key>UIBackgroundModes</key>
<array>
    <string>background-fetch</string>
    <string>background-processing</string>
    <string>remote-notification</string>
</array>
```

### 3. Android Configuration
Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<service android:name="io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

## Notification Types Implemented

### Request Notifications
- **request_created**: New request submitted (to KR admins)
- **request_accepted**: Request accepted (to GA admins + requester)
- **request_assigned**: Driver assigned (to requester + driver)
- **request_rejected**: Request rejected (to requester)
- **request_completed**: Request completed (to requester)

### Notification Data Structure
```javascript
{
  title: "Notification Title",
  body: "Notification message",
  data: {
    type: "request_created|request_accepted|request_assigned|request_rejected|request_completed",
    request_id: 123,
    requester_name: "John Doe",
    driver_name: "Jane Smith",
    departure_place: "Location A",
    destination: "Location B"
  }
}
```

## API Endpoints

### FCM Token Management
- `GET /api/fcm-tokens` - Get user's tokens
- `POST /api/fcm-tokens/register` - Register new token
- `DELETE /api/fcm-tokens/remove` - Remove token

### Request Body (Register)
```json
{
  "token": "fcm_token_here",
  "device_type": "web|mobile",
  "device_id": "unique_device_identifier"
}
```

## Features Implemented

### Backend Features
✅ Token storage and management
✅ Automatic token cleanup for invalid tokens
✅ Multi-device support per user
✅ Role-based notification routing
✅ Request lifecycle notifications
✅ Error handling and logging

### Frontend Features
✅ Permission request handling
✅ Token registration and refresh
✅ Foreground message handling
✅ Background message handling (mobile)
✅ Browser notification display
✅ Click navigation handling
✅ Cross-platform support

## Testing

### 1. Test Notification Sending
```php
use App\Services\FirebaseNotificationService;

$firebaseService = app(FirebaseNotificationService::class);
$firebaseService->sendToUser($user, 'Test Title', 'Test Message');
```

### 2. Test Frontend
1. Open browser DevTools → Application
2. Check for FCM token in console
3. Send test notification from Firebase Console

## Security Considerations

### Backend
- Firebase service account file should be secured
- Token validation and cleanup
- Rate limiting for API endpoints

### Frontend
- HTTPS required for service workers
- VAPID key protection
- Permission handling best practices

## Troubleshooting

### Common Issues
1. **Permission Denied**: Check browser/notification settings
2. **Token Not Generated**: Check Firebase configuration
3. **Notifications Not Received**: Check service worker status
4. **Background Not Working**: Check platform-specific setup

### Debug Logging
All Firebase operations include comprehensive logging:
- Token registration success/failure
- Message delivery status
- Permission request results
- Navigation handling

## Next Steps

1. **Complete Firebase Configuration**: Replace placeholder values
2. **Install Dependencies**: Run composer and npm installs
3. **Test Integration**: Verify token registration and notifications
4. **Deploy**: Update production configurations
5. **Monitor**: Check Firebase Console for delivery metrics

## Support

For issues or questions:
1. Check Firebase Console for errors
2. Review browser console logs
3. Verify API endpoint responses
4. Check network connectivity

This system provides a robust foundation for real-time notifications across your HDJV Transportation platform.
