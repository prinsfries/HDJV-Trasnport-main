<?php

namespace App\Services;

use App\Models\FcmToken;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification as FirebaseNotification;

class FirebaseNotificationService
{
    private $messaging;

    public function __construct()
    {
        $firebase = (new Factory)
            ->withServiceAccount(storage_path('app/firebase-service-account.json'));
        
        $this->messaging = $firebase->createMessaging();
    }

    /**
     * Send notification to specific user
     */
    public function sendToUser(User $user, string $title, string $message, array $data = []): bool
    {
        try {
            $tokens = FcmToken::where('user_id', $user->id)
                ->pluck('token')
                ->filter()
                ->filter(function ($token) {
                    // Filter out Expo tokens or local fallback tokens when using FCM
                    if (str_starts_with($token, 'ExponentPushToken')) return false;
                    if (str_starts_with($token, 'expo_fallback_token_')) return false;
                    return true;
                })
                ->unique()
                ->values();

            if ($tokens->isEmpty()) {
                Log::warning("No FCM tokens found for user: {$user->username}");
                return false;
            }

            Log::info('FCM tokens selected for user', [
                'user_id' => $user->id,
                'username' => $user->username,
                'token_count' => $tokens->count(),
                'tokens' => $tokens->map(fn($t) => substr($t, 0, 40) . '...')->values()->all(),
            ]);

            return $this->sendNotification($tokens->toArray(), $title, $message, $data);
        } catch (\Exception $e) {
            Log::error('Failed to send notification to user: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Send notification to multiple users
     */
    public function sendToUsers(Collection $users, string $title, string $message, array $data = []): bool
    {
        try {
            $tokens = FcmToken::whereIn('user_id', $users->pluck('id'))
                ->pluck('token')
                ->filter()
                ->filter(function ($token) {
                    if (str_starts_with($token, 'ExponentPushToken')) return false;
                    if (str_starts_with($token, 'expo_fallback_token_')) return false;
                    return true;
                })
                ->unique()
                ->values();

            if ($tokens->isEmpty()) {
                Log::warning("No FCM tokens found for users");
                return false;
            }

            return $this->sendNotification($tokens->toArray(), $title, $message, $data);
        } catch (\Exception $e) {
            Log::error('Failed to send notification to users: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Send notification to specific device type
     */
    public function sendToDeviceType(string $deviceType, string $title, string $message, array $data = []): bool
    {
        try {
            $tokens = FcmToken::where('device_type', $deviceType)
                ->pluck('token')
                ->filter()
                ->filter(function ($token) {
                    if (str_starts_with($token, 'ExponentPushToken')) return false;
                    if (str_starts_with($token, 'expo_fallback_token_')) return false;
                    return true;
                })
                ->unique()
                ->values();

            if ($tokens->isEmpty()) {
                Log::warning("No FCM tokens found for device type: {$deviceType}");
                return false;
            }

            return $this->sendNotification($tokens->toArray(), $title, $message, $data);
        } catch (\Exception $e) {
            Log::error('Failed to send notification to device type: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Send notification to all active tokens
     */
    public function sendToAll(string $title, string $message, array $data = []): bool
    {
        try {
            $tokens = FcmToken::pluck('token')
                ->filter()
                ->filter(function ($token) {
                    if (str_starts_with($token, 'ExponentPushToken')) return false;
                    if (str_starts_with($token, 'expo_fallback_token_')) return false;
                    return true;
                })
                ->unique()
                ->values();

            if ($tokens->isEmpty()) {
                Log::warning("No FCM tokens found");
                return false;
            }

            return $this->sendNotification($tokens->toArray(), $title, $message, $data);
        } catch (\Exception $e) {
            Log::error('Failed to send notification to all: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Send notification via FCM - Updated for Firebase SDK v8.x
     */
    private function sendNotification(array $tokens, string $title, string $message, array $data = []): bool
    {
        try {
            $notification = FirebaseNotification::create($title, $message);

            // Convert all data values to strings to avoid Firebase SDK errors
            $stringData = array_map(function($value) {
                return is_string($value) ? $value : (string)$value;
            }, $data);

            $message = CloudMessage::new()
                ->withNotification($notification)
                ->withData($stringData);

            // Send to multiple tokens
            $report = $this->messaging->sendMulticast($message, $tokens);

            // Handle failed tokens - Updated for Firebase SDK v8.x
            if ($report->hasFailures()) {
                Log::warning('FCM send failures detected', [
                    'failure_count' => $report->failures()->count(),
                ]);
            }

            // Log per-token report for debugging
            $reportDetails = [];
            foreach ($report->getItems() as $singleReport) {
                $target = $singleReport->target();
                $error = $singleReport->error();
                $token = $target ? $target->value() : null;
                $reportDetails[] = [
                    'token' => $token ? substr($token, 0, 40) . '...' : null,
                    'success' => $singleReport->isSuccess(),
                    'error' => $error ? $error->getMessage() : null,
                    'error_class' => $error ? get_class($error) : null,
                    'report_class' => get_class($singleReport),
                ];
                if ($singleReport->isFailure() && $token) {
                    if ($singleReport->messageTargetWasInvalid() || $singleReport->messageWasSentToUnknownToken()) {
                        $this->handleInvalidToken($token);
                    }
                }
            }
            Log::warning('FCM report detail', [
                'reports' => $reportDetails,
            ]);

            // Get success count - Updated for Firebase SDK v8.x
            $successCount = $report->successes()->count();
            $totalTokens = count($tokens);

            Log::info('FCM send report', [
                'success' => $successCount,
                'total' => $totalTokens,
            ]);
            return $successCount > 0;

        } catch (\Exception $e) {
            Log::error('Failed to send FCM notification: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Handle invalid/expired tokens
     */
    private function handleInvalidToken(string $token): void
    {
        try {
            FcmToken::where('token', $token)->delete();
            Log::info('Removed invalid FCM token: ' . substr($token, 0, 20) . '...');
        } catch (\Exception $e) {
            Log::error('Failed to remove invalid token: ' . $e->getMessage());
        }
    }

    /**
     * Send request-related notifications
     */
    public function sendRequestNotification(string $type, User $user, array $requestData): bool
    {
        $notifications = [
            'test_notification' => [
                'title' => 'Test Notification',
                'message' => 'This is a test notification from the backend.',
                'data' => ['type' => 'test', 'test' => 'true']
            ],
            'request_created' => [
                'title' => 'New Request Created',
                'message' => "A new request has been created for {$requestData['departure_place']} to {$requestData['destination']}.",
                'data' => ['type' => 'request_created', 'request_id' => (string)($requestData['id'] ?? '')]
            ],
            'request_accepted' => [
                'title' => 'Request Accepted',
                'message' => 'Your request has been accepted and is being processed.',
                'data' => ['type' => 'request_accepted', 'request_id' => (string)($requestData['id'] ?? '')]
            ],
            'request_assigned' => [
                'title' => 'Driver Assigned',
                'message' => "Driver {$requestData['driver_name']} has been assigned to your request.",
                'data' => ['type' => 'request_assigned', 'request_id' => (string)($requestData['id'] ?? '')]
            ],
            'request_assigned_driver' => [
                'title' => 'New Assigned Request',
                'message' => "You have been assigned to request #{$requestData['id']}: {$requestData['departure_place']} to {$requestData['destination']}.",
                'data' => ['type' => 'request_assigned_driver', 'request_id' => (string)($requestData['id'] ?? '')]
            ],
            'request_completed' => [
                'title' => 'Request Completed',
                'message' => 'Your request has been completed successfully.',
                'data' => ['type' => 'request_completed', 'request_id' => (string)($requestData['id'] ?? '')]
            ],
            'request_rejected' => [
                'title' => 'Request Rejected',
                'message' => 'Your request has been rejected.',
                'data' => ['type' => 'request_rejected', 'request_id' => (string)($requestData['id'] ?? '')]
            ],
            'request_rejected_expired' => [
                'title' => 'Request Rejected',
                'message' => 'Your request has been rejected because the scheduled time has passed.',
                'data' => ['type' => 'request_rejected_expired', 'request_id' => (string)($requestData['id'] ?? '')]
            ],
        ];

        if (!isset($notifications[$type])) {
            Log::warning("Unknown notification type: {$type}");
            return false;
        }

        $notification = $notifications[$type];
        return $this->sendToUser($user, $notification['title'], $notification['message'], $notification['data']);
    }
}
