<?php

namespace App\Http\Controllers;

use App\Models\FcmToken;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class FcmTokenController extends Controller
{
    /**
     * Register or update FCM token for authenticated user
     */
    public function register(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'token' => 'required|string|max:500',
            'device_type' => 'string|in:web,mobile',
            'device_id' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not authenticated'
            ], 401);
        }

        try {
            // Delete existing token for this specific device if it exists
            // This allows multiple devices per user but prevents token conflicts
            $query = FcmToken::where('user_id', $user->id)
                ->where('device_type', $request->device_type ?? 'web');
            
            // Only filter by device_id if it's provided
            if ($request->device_id) {
                $query->where('device_id', $request->device_id);
            }
            
            $query->delete();

            // Create new token
            $fcmToken = FcmToken::create([
                'user_id' => $user->id,
                'token' => $request->token,
                'device_type' => $request->device_type ?? 'web',
                'device_id' => $request->device_id,
                'last_used_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'FCM token registered successfully',
                'data' => $fcmToken
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to register FCM token: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove FCM token for authenticated user
     */
    public function remove(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'token' => 'required|string',
            'device_id' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not authenticated'
            ], 401);
        }

        try {
            // Only remove tokens for this specific device
            // This allows other devices to keep receiving notifications
            $query = FcmToken::where('user_id', $user->id);
            
            // If specific token provided, remove only that token
            if ($request->token) {
                $query->where('token', $request->token);
            }
            
            // If device_id provided, remove all tokens for that device
            if ($request->device_id) {
                $query->where('device_id', $request->device_id);
            }
            
            $deleted = $query->delete();

            return response()->json([
                'success' => true,
                'message' => $deleted ? 'FCM tokens removed successfully' : 'No FCM tokens found'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to remove FCM token: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all tokens for authenticated user
     */
    public function index(): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not authenticated'
            ], 401);
        }

        try {
            $tokens = FcmToken::where('user_id', $user->id)
                ->with('user')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $tokens
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve FCM tokens: ' . $e->getMessage()
            ], 500);
        }
    }
}
