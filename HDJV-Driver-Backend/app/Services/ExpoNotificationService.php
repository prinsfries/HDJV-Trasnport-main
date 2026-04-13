<?php

namespace App\Services;

use App\Models\FcmToken;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;

class ExpoNotificationService
{
    private $expoApiUrl = 'https://exp.host/--/api/v2/push/send';

    /**
     * Send notification to specific user using Expo Push Tokens
     */
    public function sendToUser(User $user, string $title, string $message, array $data = []): bool
    {
        try {
            $tokens = FcmToken::where('user_id', $user->id)
                ->active()
                ->pluck('token')
                ->filter()
                ->unique()
                ->values();

            if ($tokens->isEmpty()) {
                return false;
            }

            return $this->sendNotification($tokens->toArray(), $title, $message, $data);
        } catch (\Exception $e) {
            \Log::error('Failed to send Expo notification to user: ' . $e->getMessage());
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
                ->active()
                ->pluck('token')
                ->filter()
                ->unique()
                ->values();

            if ($tokens->isEmpty()) {
                return false;
            }

            return $this->sendNotification($tokens->toArray(), $title, $message, $data);
        } catch (\Exception $e) {
            \Log::error('Failed to send Expo notification to device type: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Send notification to all active tokens
     */
    public function sendToAll(string $title, string $message, array $data = []): bool
    {
        try {
            $tokens = FcmToken::active()
                ->pluck('token')
                ->filter()
                ->unique()
                ->values();

            if ($tokens->isEmpty()) {
                return false;
            }

            return $this->sendNotification($tokens->toArray(), $title, $message, $data);
        } catch (\Exception $e) {
            \Log::error('Failed to send Expo notification to all: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Send notification via Expo Push API
     */
    private function sendNotification(array $tokens, string $title, string $message, array $data = []): bool
    {
        try {
            // Prepare notification payload
            $notifications = [];

            foreach ($tokens as $token) {
                $notifications[] = [
                    'to' => $token,
                    'sound' => 'default',
                    'title' => $title,
                    'body' => $message,
                    'data' => $data,
                    'priority' => 'high',
                ];
            }

            // Send notifications in batches (Expo allows up to 100 messages per request)
            $chunks = array_chunk($notifications, 100);
            $success = false;

            foreach ($chunks as $chunk) {
                $response = Http::post($this->expoApiUrl, [
                    'notifications' => $chunk
                ]);

                if ($response->successful()) {
                    $responseData = $response->json();
                    
                    // Handle failed tokens
                    if (isset($responseData['data'])) {
                        $this->handleFailedTokens($responseData['data'], $tokens);
                    }
                    
                    $success = true;
                } else {
                    \Log::error('Expo Push API error: ' . $response->body());
                }
            }

            return $success;
        } catch (\Exception $e) {
            \Log::error('Failed to send Expo notification: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Remove invalid tokens based on Expo response
     */
    private function handleFailedTokens(array $results, array $tokens): void
    {
        foreach ($results as $index => $result) {
            if (isset($result['status']) && $result['status'] === 'error') {
                $error = $result['message'] ?? '';
                
                // Remove tokens for common errors
                if (in_array($error, [
                    'DeviceNotRegistered',
                    'InvalidRecipient',
                    'InvalidToken'
                ])) {
                    if (isset($tokens[$index])) {
                        FcmToken::where('token', $tokens[$index])->delete();
                        \Log::info('Removed invalid Expo token: ' . $tokens[$index]);
                    }
                }
            }
        }
    }

    /**
     * Send request-related notifications
     */
    public function sendRequestNotification(string $type, User $user, array $requestData): bool
    {
        $notifications = [
            'request_created' => [
                'title' => 'New Request Created',
                'message' => "A new request has been created for {$requestData['departure_place']} to {$requestData['destination']}.",
                'data' => ['type' => 'request_created', 'request_id' => $requestData['id']]
            ],
            'request_accepted' => [
                'title' => 'Request Accepted',
                'message' => 'Your request has been accepted and is being processed.',
                'data' => ['type' => 'request_accepted', 'request_id' => $requestData['id']]
            ],
            'request_assigned' => [
                'title' => 'Driver Assigned',
                'message' => "Driver {$requestData['driver_name']} has been assigned to your request.",
                'data' => ['type' => 'driver_assigned', 'request_id' => $requestData['id']]
            ],
            'request_completed' => [
                'title' => 'Request Completed',
                'message' => 'Your request has been completed successfully.',
                'data' => ['type' => 'request_completed', 'request_id' => $requestData['id']]
            ],
            'request_rejected' => [
                'title' => 'Request Rejected',
                'message' => 'Your request has been rejected.',
                'data' => ['type' => 'request_rejected', 'request_id' => $requestData['id']]
            ],
            'request_rejected_expired' => [
                'title' => 'Request Rejected',
                'message' => 'Your request has been rejected because the scheduled time has passed.',
                'data' => ['type' => 'request_rejected_expired', 'request_id' => $requestData['id']]
            ]
        ];

        if (isset($notifications[$type])) {
            $notification = $notifications[$type];
            return $this->sendToUser($user, $notification['title'], $notification['message'], $notification['data']);
        }

        return false;
    }
}
