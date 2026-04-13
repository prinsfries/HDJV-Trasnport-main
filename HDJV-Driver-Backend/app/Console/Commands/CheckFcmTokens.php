<?php

namespace App\Console\Commands;

use App\Models\FcmToken;
use App\Models\User;
use Illuminate\Console\Command;

class CheckFcmTokens extends Command
{
    protected $signature = 'fcm:check {user_id?}';
    protected $description = 'Check FCM tokens in the database';

    public function handle()
    {
        $userId = $this->argument('user_id');
        
        if ($userId) {
            $user = User::find($userId);
            if (!$user) {
                $this->error("User with ID {$userId} not found");
                return 1;
            }
            
            $tokens = FcmToken::where('user_id', $userId)->get();
            $this->info("FCM tokens for user: {$user->username} (ID: {$user->id})");
            
            if ($tokens->isEmpty()) {
                $this->warn("No FCM tokens found for this user");
            } else {
                foreach ($tokens as $token) {
                    $this->line("  - Token: " . substr($token->token, 0, 50) . "...");
                    $this->line("    Device Type: {$token->device_type}");
                    $this->line("    Device ID: {$token->device_id}");
                    $this->line("    Last Used: {$token->last_used_at}");
                    $this->line("    Created: {$token->created_at}");
                    $this->line("");
                }
            }
        } else {
            $tokens = FcmToken::with('user')->get();
            $this->info("All FCM tokens in database:");
            
            if ($tokens->isEmpty()) {
                $this->warn("No FCM tokens found in database");
            } else {
                foreach ($tokens as $token) {
                    $this->line("  User: {$token->user->username} (ID: {$token->user_id})");
                    $this->line("    Token: " . substr($token->token, 0, 50) . "...");
                    $this->line("    Device Type: {$token->device_type}");
                    $this->line("    Device ID: {$token->device_id}");
                    $this->line("    Last Used: {$token->last_used_at}");
                    $this->line("    Created: {$token->created_at}");
                    $this->line("");
                }
            }
        }
        
        return 0;
    }
}
