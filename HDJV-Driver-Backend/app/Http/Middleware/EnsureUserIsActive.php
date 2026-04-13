<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        
        if ($user && !$user->is_approved) {
            $user->tokens()->delete();

            return response()->json([
                'message' => 'Your account is pending approval by an administrator.'
            ], 403);
        }

        if ($user && !$user->is_active) {
            // Revoke all tokens if the user is inactive
            $user->tokens()->delete();

            return response()->json([
                'message' => 'Your account is inactive. Please contact your administrator.'
            ], 403);
        }

        return $next($request);
    }
}
