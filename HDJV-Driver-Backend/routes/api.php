<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FcmTokenController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\RequestController;
use App\Http\Controllers\TripController;
use App\Http\Controllers\TripProofPhotoController;
use App\Http\Controllers\TimeRecordController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:auth');
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:auth');

Route::middleware(['auth:sanctum', 'active', 'throttle:api'])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
    Route::get('/trips', [TripController::class, 'index']);
    Route::get('/trips/{tripId}', [TripController::class, 'show']);
    Route::post('/trips', [TripController::class, 'upsert']);
    Route::delete('/trips/{tripId}', [TripController::class, 'destroy']);
    Route::get('/trips/{tripId}/proof-photos', [TripProofPhotoController::class, 'index']);
    Route::post('/trips/{tripId}/proof-photos', [TripProofPhotoController::class, 'store']);

    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
    Route::get('/dashboard/approval-sla', [DashboardController::class, 'approvalSla']);
    Route::get('/routes/summary', [DashboardController::class, 'routesSummary']);

    Route::get('/requests', [RequestController::class, 'index']);
    Route::get('/requests/{id}', [RequestController::class, 'show']);
    Route::post('/requests', [RequestController::class, 'store']);
    Route::patch('/requests/{id}/decision', [RequestController::class, 'decide']);
    Route::patch('/requests/{id}/assign', [RequestController::class, 'assign']);
    Route::patch('/requests/{id}/status', [RequestController::class, 'updateStatus']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);

    Route::get('/time-records', [TimeRecordController::class, 'index']);
    Route::get('/time-records/today', [TimeRecordController::class, 'today']);
    Route::post('/time-records', [TimeRecordController::class, 'store']);
    Route::delete('/time-records/{id}', [TimeRecordController::class, 'destroy']);

    // FCM Token Management
    Route::get('/fcm-tokens', [FcmTokenController::class, 'index']);
    Route::post('/fcm-tokens/register', [FcmTokenController::class, 'register']);
    Route::delete('/fcm-tokens/remove', [FcmTokenController::class, 'remove']);

    Route::apiResource('users', App\Http\Controllers\UserController::class);
    Route::apiResource('vehicles', App\Http\Controllers\VehicleController::class);
});
