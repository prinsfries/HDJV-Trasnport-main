<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class FirebaseServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        // Suppress specific Guzzle deprecation warnings for Firebase SDK compatibility
        $oldErrorLevel = error_reporting();
        
        // Temporarily suppress deprecation warnings during Firebase initialization
        error_reporting($oldErrorLevel & ~E_DEPRECATED);
        
        $this->app->singleton(\App\Services\FirebaseNotificationService::class, function ($app) {
            return new \App\Services\FirebaseNotificationService();
        });
        
        // Restore error reporting
        error_reporting($oldErrorLevel);
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // Custom error handler to filter specific deprecation warnings
        set_error_handler(function ($severity, $message, $file, $line) {
            // Filter out specific Guzzle deprecation warnings
            if ($severity === E_DEPRECATED && 
                (strpos($message, 'GuzzleHttp\Promise') !== false || 
                 strpos($message, 'Kreait\Clock\SystemClock') !== false)) {
                // Don't log these specific deprecation warnings
                return true;
            }
            
            // Handle other errors normally
            return false;
        }, E_DEPRECATED);
    }
}
