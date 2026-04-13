<?php

namespace App\Http\Controllers;

use App\Models\Request as TripRequest;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Support\Carbon;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function summary(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'kradmin', 'gaadmin'], true)) {
            return response()->json([
                'message' => 'Access denied. Only administrators can access this resource.',
            ], 403);
        }

        $totalPassengers = User::whereIn('role', ['passenger', 'krpassenger'])->count();
        $totalDrivers = User::where('role', 'driver')->count();
        $totalUsers = User::count();
        $totalVehicles = Vehicle::count();
        $totalTrips = Trip::count();
        $totalRoutes = TripRequest::count();
        $pendingKrApproval = TripRequest::where('status', 'pending')->count();
        $approvedForGa = TripRequest::where('status', 'accepted')->count();

        return response()->json([
            'total_passengers' => $totalPassengers,
            'total_routes' => $totalRoutes,
            'total_drivers' => $totalDrivers,
            'total_vehicles' => $totalVehicles,
            'total_trips' => $totalTrips,
            'total_users' => $totalUsers,
            'pending_kr_approval' => $pendingKrApproval,
            'approved_for_ga' => $approvedForGa,
            'total' => $totalTrips,
        ]);
    }

    public function routesSummary(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'kradmin', 'gaadmin'], true)) {
            return response()->json([
                'message' => 'Access denied. Only administrators can access this resource.',
            ], 403);
        }

        $totalHours = 0.0;
        $totalPassengers = 0;
        $activeDriverSet = [];
        $completedTrips = 0;

        Trip::select(['driver_name', 'status', 'started_at', 'completed_at', 'passengers'])
            ->chunk(500, function ($trips) use (&$totalHours, &$totalPassengers, &$activeDriverSet, &$completedTrips) {
                foreach ($trips as $trip) {
                    if ($trip->status === 'completed') {
                        $completedTrips += 1;
                    }

                    $driverName = trim((string) $trip->driver_name);
                    if ($driverName !== '') {
                        $activeDriverSet[$driverName] = true;
                    }

                    $passengers = $trip->passengers;
                    if (is_array($passengers)) {
                        $totalPassengers += count($passengers);
                    }

                    if ($trip->started_at && $trip->completed_at) {
                        $diffSeconds = $trip->completed_at->getTimestamp() - $trip->started_at->getTimestamp();
                        if ($diffSeconds > 0) {
                            $totalHours += $diffSeconds / 3600;
                        }
                    }
                }
            });

        return response()->json([
            'total_hours' => round($totalHours, 1),
            'total_passengers' => $totalPassengers,
            'active_drivers' => count($activeDriverSet),
            'completed_trips' => $completedTrips,
        ]);
    }

    public function approvalSla(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'kradmin', 'gaadmin'], true)) {
            return response()->json([
                'message' => 'Access denied. Only administrators can access this resource.',
            ], 403);
        }

        $days = (int) $request->query('days', 30);
        $days = $days > 0 ? $days : 30;
        $slaMinutes = (int) $request->query('sla_minutes', 1440);
        $slaMinutes = $slaMinutes > 0 ? $slaMinutes : 1440;

        $from = Carbon::now()->subDays($days);

        $query = TripRequest::whereNotNull('accepted_at')
            ->where('created_at', '>=', $from);

        $total = (clone $query)->count();
        if ($total === 0) {
            return response()->json([
                'days' => $days,
                'sla_minutes' => $slaMinutes,
                'total_requests' => 0,
                'avg_approval_minutes' => 0,
                'late_approvals' => 0,
                'late_rate' => 0,
            ]);
        }

        $totalMinutes = 0;
        $lateCount = 0;

        $query->select(['created_at', 'accepted_at'])
            ->chunk(500, function ($requests) use (&$totalMinutes, &$lateCount, $slaMinutes) {
                foreach ($requests as $req) {
                    if (!$req->created_at || !$req->accepted_at) {
                        continue;
                    }
                    $diffSeconds = $req->accepted_at->getTimestamp() - $req->created_at->getTimestamp();
                    if ($diffSeconds < 0) {
                        $diffSeconds = 0;
                    }
                    $minutes = (int) round($diffSeconds / 60);
                    $totalMinutes += $minutes;
                    if ($minutes > $slaMinutes) {
                        $lateCount += 1;
                    }
                }
            });

        $avgMinutes = $total > 0 ? round($totalMinutes / $total, 1) : 0;
        $lateRate = $total > 0 ? round(($lateCount / $total) * 100, 1) : 0;

        return response()->json([
            'days' => $days,
            'sla_minutes' => $slaMinutes,
            'total_requests' => $total,
            'avg_approval_minutes' => $avgMinutes,
            'late_approvals' => $lateCount,
            'late_rate' => $lateRate,
        ]);
    }
}
