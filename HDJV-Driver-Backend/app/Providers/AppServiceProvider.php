<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            // Allow local load testing to bypass limits when explicitly enabled.
            if (config('app.rate_limit_bypass', false) === true) {
                return Limit::none();
            }
            $userId = $request->user()?->id;
            $key = $userId ? "user:{$userId}" : $request->ip();
            return Limit::perMinute(120)->by($key);
        });

        RateLimiter::for('auth', function (Request $request) {
            if (config('app.rate_limit_bypass', false) === true) {
                return Limit::none();
            }
            return Limit::perMinute(20)->by($request->ip());
        });
    }
}
