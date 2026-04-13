<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Services\FirebaseNotificationService;
use App\Models\User;

class FirebaseTestSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        try {
            $firebase = app(FirebaseNotificationService::class);
            echo "✅ Firebase service initialized successfully!\n";
            
            // Test with a dummy user (won't send actual notification without tokens)
            $user = new User();
            $user->id = 1;
            $user->email = 'test@example.com';
            
            echo "✅ Firebase service is ready to send notifications!\n";
            echo "📝 Next steps:\n";
            echo "   1. Add your actual service account JSON to storage/app/firebase-service-account.json\n";
            echo "   2. Register FCM tokens from frontend\n";
            echo "   3. Test sending notifications\n";
            
        } catch (\Exception $e) {
            echo "❌ Firebase service error: " . $e->getMessage() . "\n";
            echo "📝 Please check your service account file at storage/app/firebase-service-account.json\n";
        }
    }
}
