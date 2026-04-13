<?php

namespace App\Http\Controllers;

use App\Models\Trip;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class TripController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $page = (int) $request->get('page', 1);
        $limit = (int) $request->get('limit', 10);
        $search = trim((string) $request->get('search', ''));
        $sortBy = (string) $request->get('sort_by', 'id');
        $sortDir = strtolower((string) $request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';
        $vehicleType = $request->get('vehicle_type');
        $passengerStatus = $request->get('passenger_status');
        $dateFrom = $request->get('date_from');
        $dateTo = $request->get('date_to');

        $query = Trip::with(['proofPhotos' => function ($query) {
            $query->orderBy('captured_at');
        }]);

        if ($user && $user->role === 'driver') {
            $query->where('driver_name', $user->full_name);
        }

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('trip_id', 'like', $like)
                    ->orWhere('start_location', 'like', $like)
                    ->orWhere('end_location', 'like', $like)
                    ->orWhere('driver_name', 'like', $like)
                    ->orWhere('vehicle_type', 'like', $like)
                    ->orWhere('plate_number', 'like', $like);
            });
        }

        if ($vehicleType && $vehicleType !== 'all') {
            $query->where('vehicle_type', $vehicleType);
        }
        if ($passengerStatus === 'with') {
            $query->whereRaw('JSON_LENGTH(passengers) > 0');
        } elseif ($passengerStatus === 'none') {
            $query->whereRaw('JSON_LENGTH(passengers) = 0');
        }
        if ($dateFrom) {
            $query->whereRaw(
                'DATE(COALESCE(started_at, completed_at, created_at)) >= ?',
                [$dateFrom]
            );
        }
        if ($dateTo) {
            $query->whereRaw(
                'DATE(COALESCE(started_at, completed_at, created_at)) <= ?',
                [$dateTo]
            );
        }

        switch ($sortBy) {
            case 'trip_id':
            case 'start_location':
            case 'end_location':
            case 'driver_name':
            case 'vehicle_type':
            case 'plate_number':
            case 'status':
            case 'started_at':
            case 'completed_at':
            case 'created_at':
            case 'id':
                $query->orderBy($sortBy, $sortDir)->orderBy('id', $sortDir);
                break;
            case 'distance':
                $query->orderByRaw(
                    "(COALESCE(CAST(odometer_end AS DECIMAL(10,2)), 0) - COALESCE(CAST(odometer_start AS DECIMAL(10,2)), 0)) {$sortDir}"
                );
                $query->orderBy('id', $sortDir);
                break;
            case 'passengers':
                $query->orderByRaw("JSON_LENGTH(passengers) {$sortDir}");
                $query->orderBy('id', $sortDir);
                break;
            default:
                $query->orderByDesc('id');
                break;
        }

        $total = (clone $query)->count();
        $trips = $query
            ->offset(($page - 1) * $limit)
            ->limit($limit)
            ->get();

        return response()->json([
            'data' => $trips,
            'total' => $total,
        ]);
    }

    public function show(string $tripId)
    {
        $user = request()->user();
        $query = Trip::with(['proofPhotos' => function ($query) {
            $query->orderBy('captured_at');
        }])
            ->where('trip_id', $tripId)
            ->orWhere('id', $tripId)
            ->orderByDesc('id')
            ->orderByDesc('created_at')
            ->orderByDesc('started_at');

        if ($user && $user->role === 'driver') {
            $query->where('driver_name', $user->full_name);
        }

        $trip = $query->firstOrFail();

        return response()->json($trip);
    }

    public function upsert(Request $request)
    {
        $data = $request->validate([
            'trip_id' => ['nullable', 'string'],
            'driver_name' => ['nullable', 'string'],
            'vehicle_type' => ['nullable', 'string', 'required_unless:status,not_started'],
            'plate_number' => ['nullable', 'string', 'required_unless:status,not_started'],
            'start_location' => ['nullable', 'string'],
            'end_location' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'in:not_started,started,completed'],
            'started_at' => ['nullable', 'date'],
            'completed_at' => ['nullable', 'date'],
            'odometer_start' => ['nullable', 'numeric'],
            'odometer_end' => ['nullable', 'numeric'],
            'passengers' => ['nullable', 'array'],
            'passengers.*' => ['string'],
        ]);

        $hasValue = function ($value) {
            if (is_array($value)) {
                return count($value) > 0;
            }
            return !is_null($value) && $value !== '';
        };

        // Ensure driver_name is set to the authenticated driver's full name when coming from the app
        $user = $request->user();
        if ($user && $user->role === 'driver') {
            $data['driver_name'] = $user->full_name;
        } else {
            $data['driver_name'] = $data['driver_name'] ?? null;
        }

        // Derive status based on timestamps and required details when not explicitly provided
        if (!isset($data['status'])) {
            $hasStart = $hasValue($data['started_at'] ?? null);
            $hasComplete = $hasValue($data['completed_at'] ?? null);
            $hasCompletionDetails = $hasValue($data['start_location'] ?? null)
                && $hasValue($data['end_location'] ?? null)
                && $hasValue($data['odometer_start'] ?? null)
                && $hasValue($data['odometer_end'] ?? null);

            if ($hasStart && $hasComplete && $hasCompletionDetails) {
                $data['status'] = 'completed';
            } elseif ($hasStart) {
                $data['status'] = 'started';
            } else {
                $data['status'] = 'not_started';
            }
        }

        $tripId = $data['trip_id'] ?? null;
        if (!$tripId) {
            do {
                $tripId = Str::upper(Str::random(10));
            } while (Trip::where('trip_id', $tripId)->exists());
            $data['trip_id'] = $tripId;
        }

        $trip = Trip::updateOrCreate(
            ['trip_id' => $tripId],
            Arr::except($data, ['trip_id'])
        );

        return response()->json($trip->load('proofPhotos'));
    }

    public function destroy(string $id)
    {
        $trip = Trip::where('trip_id', $id)->orWhere('id', $id)->firstOrFail();
        $trip->delete();
        return response()->json(null, 204);
    }
}
