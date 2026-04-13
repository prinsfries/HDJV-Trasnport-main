<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Carbon;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        try {
            $validated = $request->validate([
                'first_name' => 'required|string|max:255',
                'middle_name' => 'nullable|string|max:255',
                'last_name' => 'required|string|max:255',
                'suffix' => 'nullable|string|max:255',
                'email' => 'required|email|unique:users,email',
                'username' => 'nullable|string|max:255|unique:users,username',
                'password' => 'required|string|min:6|max:64',
                'contact' => 'nullable|string|max:255',
                'role' => 'required|in:driver,passenger',
            ]);

            if (empty($validated['username'])) {
                $validated['username'] = $validated['email'];
            }

            $user = User::create([
                'first_name' => $validated['first_name'],
                'middle_name' => $validated['middle_name'] ?? null,
                'last_name' => $validated['last_name'],
                'suffix' => $validated['suffix'] ?? null,
                'email' => $validated['email'],
                'username' => $validated['username'],
                'password' => Hash::make($validated['password']),
                'default_password' => null,
                'password_changed' => true,
                'is_active' => false,
                'is_approved' => false,
                'approved_at' => null,
                'role' => $validated['role'],
                'contact' => $validated['contact'] ?? null,
            ]);

            $expiresAt = Carbon::now()->addHours(8);
            $tokenResult = $user->createToken('auth-token');
            $accessToken = $tokenResult->accessToken;
            $accessToken->expires_at = $expiresAt;
            $accessToken->save();

            return response()->json([
                'token' => $tokenResult->plainTextToken,
                'user' => $user,
                'expires_at' => $expiresAt->toISOString(),
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('Register error: ' . $e->getMessage());
            return response()->json([
                'message' => 'An internal server error occurred. Please try again later.',
            ], 500);
        }
    }

    public function login(Request $request)
    {
        try {
            $request->validate([
                'email' => 'required', // Can be email or username
                'password' => 'required',
            ]);

            $user = User::where('email', $request->email)
                ->orWhere('username', $request->email)
                ->first();

            if (! $user || ! Hash::check($request->password, $user->password)) {
                return response()->json([
                    'message' => 'The provided credentials are incorrect.'
                ], 422);
            }

            if (!$user->is_approved) {
                return response()->json([
                    'message' => 'Your account is pending approval by an administrator.'
                ], 403);
            }

            if (!$user->is_active) {
                return response()->json([
                    'message' => 'Your account is inactive. Please contact your administrator.'
                ], 403);
            }

            // Check role based on optional request parameter 'source' or just check it in the app
            $source = $request->input('source'); // 'admin' or 'app'
            if ($source === 'admin' && !in_array($user->role, ['admin', 'kradmin', 'gaadmin'], true)) {
                return response()->json([
                    'message' => 'Access denied. Only administrators can access this system.'
                ], 403);
            }

            if ($source === 'app' && !in_array($user->role, ['driver', 'passenger', 'krpassenger'], true)) {
                return response()->json([
                    'message' => 'Access denied. Only drivers can access this app.'
                ], 403);
            }

            $remember = filter_var($request->input('remember', false), FILTER_VALIDATE_BOOLEAN);
            $expiresAt = $remember ? Carbon::now()->addDays(30) : Carbon::now()->addHours(8);

            $tokenResult = $user->createToken('auth-token');
            $accessToken = $tokenResult->accessToken;
            $accessToken->expires_at = $expiresAt;
            $accessToken->save();

            return response()->json([
                'token' => $tokenResult->plainTextToken,
                'user' => $user,
                'expires_at' => $expiresAt->toISOString()
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            // Log the actual error for the developer
            Log::error('Login error: ' . $e->getMessage());

            // Generic message for technical errors (database down, etc.)
            return response()->json([
                'message' => 'An internal server error occurred. Please try again later.'
            ], 500);
        }
    }
}
