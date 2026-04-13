<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class TestFcmRegistration extends Command
{
    protected $signature = 'fcm:test-register {user_id}';
    protected $description = 'Test FCM token registration endpoint';

    public function handle()
    {
        $userId = $this->argument('user_id');
        
        $user = User::find($userId);
        if (!$user) {
            $this->error("User with ID {$userId} not found");
            return 1;
        }
        
        // Simulate the token registration request
        $testToken = 'ExponentPushToken[test_' . time() . '_' . rand(1000, 9999) . ']';
        
        $this->info("Testing FCM token registration for user: {$user->username}");
        $this->info("Test token: {$testToken}");
        
        try {
            // Create a test request to simulate mobile app registration
            $response = $this->call('api:test-endpoint', [
                'method' => 'POST',
                'url' => "/api/fcm-tokens/register",
                'data' => json_encode([
                    'token' => $testToken,
                    'device_type' => 'mobile',
                    'device_id' => 'test_device_' . time()
                ]),
                'headers' => json_encode([
                    'Authorization' => 'Bearer test_token',
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json'
                ])
            ]);
            
            $this->info("Response: {$response}");
            
        } catch (\Exception $e) {
            $this->error("Test failed: " . $e->getMessage());
            Log::error("FCM registration test failed: " . $e->getMessage());
            return 1;
        }
        
        return 0;
    }
}
