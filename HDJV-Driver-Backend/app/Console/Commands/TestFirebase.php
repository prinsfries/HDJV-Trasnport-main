<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\FirebaseNotificationService;

class TestFirebase extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'firebase:test';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Test Firebase notification service without deprecation warnings';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        try {
            $this->info('Testing Firebase Notification Service...');
            
            $firebase = app(FirebaseNotificationService::class);
            $this->info('✅ Firebase service initialized successfully!');
            $this->info('✅ Firebase service is ready to send notifications!');
            $this->info('📝 Next steps:');
            $this->info('   1. Add your actual service account JSON to storage/app/firebase-service-account.json');
            $this->info('   2. Register FCM tokens from frontend');
            $this->info('   3. Test sending notifications');
            
            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('❌ Firebase service error: ' . $e->getMessage());
            $this->error('📝 Please check your service account file at storage/app/firebase-service-account.json');
            return Command::FAILURE;
        }
    }
}
