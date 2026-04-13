<?php

namespace App\Console\Commands;

use App\Models\FcmToken;
use App\Models\User;
use App\Services\FirebaseNotificationService;
use Illuminate\Console\Command;

class TestNotification extends Command
{
    protected $signature = 'notification:test {user_id}';
    protected $description = 'Send test notification to user';

    public function handle(FirebaseNotificationService $firebaseService)
    {
        $userId = $this->argument('user_id');
        
        $user = User::find($userId);
        if (!$user) {
            $this->error("User with ID {$userId} not found");
            return 1;
        }
        
        $tokens = FcmToken::where('user_id', $userId)->get();
        if ($tokens->isEmpty()) {
            $this->error("No FCM tokens found for user {$user->username}");
            return 1;
        }
        
        $this->info("Sending test notification to {$user->username}...");
        
        try {
            // Use test_notification type which doesn't require request data
            $result = $firebaseService->sendRequestNotification('test_notification', $user, [
                'test' => true,
                'message' => 'This is a test notification from Laravel'
            ]);
            
            $this->info("✅ Notification sent successfully!");
            $this->line("Result: " . ($result ? 'true' : 'false'));
            
        } catch (\Exception $e) {
            $this->error("❌ Failed to send notification: " . $e->getMessage());
            return 1;
        }
        
        return 0;
    }
}
