<?php

namespace App\Http\Controllers;

use App\Models\Request as RideRequest;
use App\Models\RequestStatusHistory;
use App\Models\Notification;
use App\Models\User;
use App\Services\FirebaseNotificationService;
use App\Services\RequestAutoRejectService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RequestController extends Controller
{
    protected $firebaseService;
    protected $autoRejectService;

    private function isAdmin(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        return in_array($user->role, ['admin', 'kradmin', 'gaadmin'], true);
    }

    private function formatDriver(?User $driver): ?array
    {
        if (!$driver) {
            return null;
        }

        return [
            'id' => $driver->id,
            'full_name' => $driver->full_name,
            'contact' => $driver->contact,
            'role' => $driver->role,
        ];
    }

    private function formatVehicle($vehicle): ?array
    {
        if (!$vehicle) {
            return null;
        }

        return [
            'id' => $vehicle->id,
            'vehicle_id' => $vehicle->vehicle_id,
            'vehicle_type' => $vehicle->vehicle_type,
            'vehicle_brand' => $vehicle->vehicle_brand,
            'vehicle_model' => $vehicle->vehicle_model,
            'plate_number' => $vehicle->plate_number,
            'status' => $vehicle->status,
        ];
    }

    private function formatTrip($trip): ?array
    {
        if (!$trip) {
            return null;
        }

        return [
            'id' => $trip->id,
            'request_id' => $trip->request_id,
            'trip_id' => $trip->trip_id,
            'driver_name' => $trip->driver_name,
            'vehicle_type' => $trip->vehicle_type,
            'plate_number' => $trip->plate_number,
            'start_location' => $trip->start_location,
            'end_location' => $trip->end_location,
            'status' => $trip->status,
            'started_at' => $trip->started_at,
            'completed_at' => $trip->completed_at,
            'odometer_start' => $trip->odometer_start,
            'odometer_end' => $trip->odometer_end,
            'passengers' => $trip->passengers,
        ];
    }

    private function formatRequest(RideRequest $req, ?User $actor, bool $includeStatusHistory = false): array
    {
        $isAdmin = $this->isAdmin($actor);

        $base = [
            'id' => $req->id,
            'requester_id' => $req->requester_id,
            'requester_name' => $req->requester_name,
            'requester_contact' => $req->requester_contact,
            'departure_place' => $req->departure_place,
            'destination' => $req->destination,
            'requested_at' => $req->requested_at,
            'purpose' => $req->purpose,
            'persons' => $req->persons,
            'passenger_names' => $req->passenger_names,
            'used_coupon' => $req->used_coupon,
            'status' => $req->status,
            'started_at' => $req->started_at,
            'completed_at' => $req->completed_at,
            'trip_id' => $req->trip_id,
            'created_at' => $req->created_at,
            'updated_at' => $req->updated_at,
            'trip' => $this->formatTrip($req->trip),
            'assigned_driver' => $this->formatDriver($req->assignedDriver),
            'assigned_vehicle' => $this->formatVehicle($req->assignedVehicle),
        ];

        if ($includeStatusHistory && $req->relationLoaded('statusHistories')) {
            $base['status_histories'] = $req->statusHistories
                ->map(fn ($item) => [
                    'id' => $item->id,
                    'status' => $item->status,
                    'created_at' => $item->created_at,
                ])
                ->values();
        }

        if ($isAdmin) {
            $base['accepted_by'] = $req->accepted_by;
            $base['accepted_at'] = $req->accepted_at;
            $base['assigned_by'] = $req->assigned_by;
            $base['assigned_driver_id'] = $req->assigned_driver_id;
            $base['assigned_vehicle_id'] = $req->assigned_vehicle_id;
            $base['assigned_at'] = $req->assigned_at;
        }

        return $base;
    }

    public function __construct(FirebaseNotificationService $firebaseService, RequestAutoRejectService $autoRejectService)
    {
        $this->firebaseService = $firebaseService;
        $this->autoRejectService = $autoRejectService;
    }
    public function index(Request $request)
    {
        $user = $request->user();
        if (in_array($user->role, ['kradmin', 'gaadmin'], true)) {
            $this->autoRejectService->run();
        }
        $page = (int) $request->get('page', 1);
        $limit = (int) $request->get('limit', 10);
        $search = trim((string) $request->get('search', ''));
        $sortBy = (string) $request->get('sort_by', 'id');
        $sortDir = strtolower((string) $request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';
        $status = $request->get('status');
        $coupon = $request->get('coupon');
        $requestedFrom = $request->get('requested_from');
        $requestedTo = $request->get('requested_to');
        
        $query = RideRequest::with(['trip', 'assignedDriver', 'assignedVehicle'])
            ->select('requests.*');

        if ($user->role === 'driver') {
            $query->where('assigned_driver_id', $user->id);
        } elseif (in_array($user->role, ['passenger', 'krpassenger'], true)) {
            $query->where('requester_id', $user->id);
        }

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('requester_name', 'like', $like)
                    ->orWhere('departure_place', 'like', $like)
                    ->orWhere('destination', 'like', $like)
                    ->orWhere('purpose', 'like', $like);
            });
        }

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }
        if ($coupon === 'with') {
            $query->where('used_coupon', true);
        } elseif ($coupon === 'without') {
            $query->where('used_coupon', false);
        }
        if ($requestedFrom) {
            try {
                $from = Carbon::parse($requestedFrom);
                if (!str_contains($requestedFrom, 'T') && !str_contains($requestedFrom, ':')) {
                    $from = $from->startOfDay();
                }
                $query->where('requested_at', '>=', $from);
            } catch (\Throwable $e) {
                // Ignore invalid date
            }
        }
        if ($requestedTo) {
            try {
                $to = Carbon::parse($requestedTo);
                if (!str_contains($requestedTo, 'T') && !str_contains($requestedTo, ':')) {
                    $to = $to->endOfDay();
                }
                $query->where('requested_at', '<=', $to);
            } catch (\Throwable $e) {
                // Ignore invalid date
            }
        }

        switch ($sortBy) {
            case 'requester_name':
            case 'departure_place':
            case 'destination':
            case 'purpose':
            case 'requested_at':
            case 'created_at':
            case 'id':
                $query->orderBy($sortBy, $sortDir)->orderBy('id', $sortDir);
                break;
            default:
                $query->orderByDesc('id');
                break;
        }

        $total = (clone $query)->count();
        $requests = $query
            ->offset(($page - 1) * $limit)
            ->limit($limit)
            ->get();

        return response()->json([
            'data' => $requests->map(fn ($req) => $this->formatRequest($req, $user)),
            'total' => $total,
        ]);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        $req = RideRequest::with([
            'trip',
            'assignedDriver',
            'assignedVehicle',
            'statusHistories' => function ($q) {
                $q->orderBy('created_at');
            },
        ])->findOrFail($id);

        if ($user->role === 'driver' && $req->assigned_driver_id !== $user->id) {
            return response()->json(['message' => 'Not assigned to this driver.'], 403);
        }
        if (in_array($user->role, ['passenger', 'krpassenger'], true) && $req->requester_id !== $user->id) {
            return response()->json(['message' => 'Not your request.'], 403);
        }

        return response()->json($this->formatRequest($req, $user, true));
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!in_array($user->role, ['passenger', 'krpassenger'], true)) {
            return response()->json(['message' => 'Only passengers can create requests.'], 403);
        }

        $validated = $request->validate([
            'departure_place' => 'required|string',
            'destination' => 'required|string',
            'requested_at' => 'nullable|date',
            'purpose' => 'nullable|string',
            'persons' => 'required|integer|min:1',
            'passenger_names' => 'nullable|array',
            'passenger_names.*' => 'nullable|string',
            'use_coupon' => 'nullable|boolean',
        ], [
            'departure_place.required' => 'Please enter a departure place.',
            'destination.required' => 'Please enter a destination.',
            'persons.required' => 'Please enter the number of persons.',
            'persons.min' => 'Persons must be at least 1.',
            'passenger_names.*.string' => 'Each passenger name must be a string.',
            'requested_at.date' => 'Requested date/time is invalid. Please pick a valid date and time.',
        ]);

        $useCoupon = filter_var($validated['use_coupon'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($useCoupon && $user->role !== 'krpassenger') {
            return response()->json(['message' => 'Coupons are only available for Krpassenger.'], 422);
        }

        if ($useCoupon && $user->role === 'krpassenger') {
            $startOfMonth = Carbon::now()->startOfMonth();
            $endOfMonth = Carbon::now()->endOfMonth();
            $usedCount = RideRequest::where('requester_id', $user->id)
                ->where('used_coupon', true)
                ->whereBetween('created_at', [$startOfMonth, $endOfMonth])
                ->count();
            if ($usedCount >= 4) {
                return response()->json(['message' => 'Monthly coupon limit reached.'], 422);
            }
        }

        $requestedAt = null;
        if (!empty($validated['requested_at'])) {
            try {
                $requestedAt = Carbon::parse($validated['requested_at']);
            } catch (\Throwable $e) {
                return response()->json([
                    'message' => 'Requested date/time is invalid. Please pick a valid date and time.',
                ], 422);
            }
        }

        $requesterName = $user->full_name ?? $user->name ?? $user->username ?? 'Passenger';
        $passengerNames = array_values(array_filter(
            array_map('trim', $validated['passenger_names'] ?? []),
            fn($name) => $name !== ''
        ));
        if (!in_array($requesterName, $passengerNames, true)) {
            $passengerNames[] = $requesterName;
        }

        $data = [
            'requester_id' => $user->id,
            'requester_name' => $requesterName,
            'requester_contact' => $user->contact ?? null,
            'departure_place' => $validated['departure_place'],
            'destination' => $validated['destination'],
            'requested_at' => $requestedAt,
            'purpose' => $validated['purpose'] ?? null,
            'persons' => max(count($passengerNames), (int) $validated['persons']),
            'passenger_names' => $passengerNames,
            'used_coupon' => $useCoupon,
            'status' => 'pending',
        ];

        $req = RideRequest::create($data);
        $this->logStatusHistory($req, 'pending', $user->id);

        // Send Firebase notifications to KR admins
        $kradmins = User::where('role', 'kradmin')->get();
        foreach ($kradmins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'type' => 'request_created',
                'title' => 'New request submitted',
                'body' => "{$req->requester_name} requested {$req->departure_place} to {$req->destination}.",
                'data' => ['request_id' => $req->id],
            ]);
            
            // Send Firebase notification
            $this->firebaseService->sendRequestNotification('request_created', $admin, [
                'id' => $req->id,
                'requester_name' => $req->requester_name,
                'departure_place' => $req->departure_place,
                'destination' => $req->destination,
            ]);
        }
        return response()->json($req, 201);
    }

    public function decide(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'kradmin') {
            return response()->json(['message' => 'Only Kradmin can accept or reject requests.'], 403);
        }

        $validated = $request->validate([
            'decision' => 'required|in:accept,reject',
        ]);

        $req = RideRequest::findOrFail($id);
        if ($req->status !== 'pending') {
            return response()->json(['message' => 'Only pending requests can be updated.'], 422);
        }

        $req->status = $validated['decision'] === 'accept' ? 'accepted' : 'rejected';
        $req->accepted_by = $user->id;
        $req->accepted_at = Carbon::now();
        $req->save();
        $this->logStatusHistory($req, $req->status, $user->id);

        if ($validated['decision'] === 'accept') {
            $gaadmins = User::where('role', 'gaadmin')->get();
            foreach ($gaadmins as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'type' => 'request_accepted',
                    'title' => 'Request accepted',
                    'body' => "Request #{$req->id} is ready for driver assignment.",
                    'data' => ['request_id' => $req->id],
                ]);
                
                // Send Firebase notification
                $this->firebaseService->sendRequestNotification('request_accepted', $admin, [
                    'id' => $req->id,
                    'requester_name' => $req->requester_name,
                ]);
            }
            
            // Also notify the requester
            $requester = User::find($req->requester_id);
            if ($requester) {
                $this->firebaseService->sendRequestNotification('request_accepted', $requester, [
                    'id' => $req->id,
                    'departure_place' => $req->departure_place,
                    'destination' => $req->destination,
                ]);
            }
        } else {
            // Notify requester about rejection
            $requester = User::find($req->requester_id);
            if ($requester) {
                $this->firebaseService->sendRequestNotification('request_rejected', $requester, [
                    'id' => $req->id,
                    'departure_place' => $req->departure_place,
                    'destination' => $req->destination,
                ]);
            }
        }

        return response()->json($req);
    }

    public function assign(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'gaadmin') {
            return response()->json(['message' => 'Only Gaadmin can assign drivers.'], 403);
        }

        $validated = $request->validate([
            'driver_id' => 'required|integer|exists:users,id',
            'vehicle_id' => 'required|integer|exists:vehicles,id',
        ]);

        $driver = User::findOrFail($validated['driver_id']);
        if ($driver->role !== 'driver') {
            return response()->json(['message' => 'Assigned user must be a driver.'], 422);
        }

        $req = RideRequest::findOrFail($id);
        if (!in_array($req->status, ['accepted', 'assigned'], true)) {
            return response()->json(['message' => 'Only accepted requests can be assigned.'], 422);
        }

        $req->status = 'assigned';
        $req->assigned_by = $user->id;
        $req->assigned_driver_id = $driver->id;
        $req->assigned_vehicle_id = $validated['vehicle_id'];
        $req->assigned_at = Carbon::now();
        $req->save();
        $this->logStatusHistory($req, 'assigned', $user->id);

        if (!$req->trip_id) {
            $tripId = null;
            do {
                $tripId = Str::upper(Str::random(10));
            } while (\App\Models\Trip::where('trip_id', $tripId)->exists());

            $assignedVehicle = $req->assigned_vehicle_id
                ? \App\Models\Vehicle::find($req->assigned_vehicle_id)
                : null;

            $trip = \App\Models\Trip::create([
                'trip_id' => $tripId,
                'request_id' => $req->id,
                'driver_name' => $driver->full_name ?? $driver->name ?? $driver->username,
                'start_location' => $req->departure_place,
                'end_location' => $req->destination,
                'vehicle_type' => $assignedVehicle?->vehicle_type,
                'plate_number' => $assignedVehicle?->plate_number,
                'status' => 'not_started',
                'passengers' => $req->passenger_names ?? [$req->requester_name],
            ]);

            $req->trip_id = $trip->id;
            $req->save();
        }

        // Notify passenger
        Notification::create([
            'user_id' => $req->requester_id,
            'type' => 'request_assigned',
            'title' => 'Driver assigned',
            'body' => "Your request #{$req->id} has been assigned to a driver.",
            'data' => ['request_id' => $req->id],
        ]);

        // Notify driver
        Notification::create([
            'user_id' => $driver->id,
            'type' => 'request_assigned_driver',
            'title' => 'New assigned request',
            'body' => "You have been assigned to request #{$req->id}.",
            'data' => ['request_id' => $req->id],
        ]);

        // Send Firebase notifications
        $requester = User::find($req->requester_id);
        if ($requester) {
            $requesterSent = $this->firebaseService->sendRequestNotification('request_assigned', $requester, [
                'id' => $req->id,
                'driver_name' => $driver->full_name ?? $driver->username,
            ]);
            \Log::info('Request assigned notification (requester)', [
                'request_id' => $req->id,
                'user_id' => $requester->id,
                'username' => $requester->username,
                'sent' => $requesterSent,
            ]);
        }
        
        $driverSent = $this->firebaseService->sendRequestNotification('request_assigned_driver', $driver, [
            'id' => $req->id,
            'requester_name' => $req->requester_name,
            'departure_place' => $req->departure_place,
            'destination' => $req->destination,
        ]);
        \Log::info('Request assigned notification (driver)', [
            'request_id' => $req->id,
            'user_id' => $driver->id,
            'username' => $driver->username,
            'sent' => $driverSent,
        ]);

        return response()->json($req->load(['trip', 'assignedDriver', 'assignedVehicle']));
    }

    public function updateStatus(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'driver') {
            return response()->json(['message' => 'Only drivers can update status.'], 403);
        }

        $validated = $request->validate([
            'status' => 'required|in:in_progress,completed',
        ]);

        $req = RideRequest::findOrFail($id);
        if ($req->assigned_driver_id !== $user->id) {
            return response()->json(['message' => 'Not assigned to this driver.'], 403);
        }

        if ($validated['status'] === 'in_progress') {
            $req->status = 'in_progress';
            $req->started_at = $req->started_at ?? Carbon::now();

            if (!$req->trip_id) {
                $tripId = null;
                do {
                    $tripId = \Illuminate\Support\Str::upper(\Illuminate\Support\Str::random(10));
                } while (\App\Models\Trip::where('trip_id', $tripId)->exists());

                $assignedVehicle = $req->assigned_vehicle_id
                    ? \App\Models\Vehicle::find($req->assigned_vehicle_id)
                    : null;

                $trip = \App\Models\Trip::create([
                    'trip_id' => $tripId,
                    'request_id' => $req->id,
                    'driver_name' => $user->full_name ?? $user->name ?? $user->username,
                    'start_location' => $req->departure_place,
                    'end_location' => $req->destination,
                    'vehicle_type' => $assignedVehicle?->vehicle_type,
                    'plate_number' => $assignedVehicle?->plate_number,
                    'status' => 'started',
                    'started_at' => $req->started_at,
                    'passengers' => $req->passenger_names ?? [$req->requester_name],
                ]);
                $req->trip_id = $trip->id;
            } else {
                $trip = \App\Models\Trip::find($req->trip_id);
                if ($trip) {
                    $assignedVehicle = $req->assigned_vehicle_id
                        ? \App\Models\Vehicle::find($req->assigned_vehicle_id)
                        : null;
                    $trip->status = 'started';
                    $trip->started_at = $req->started_at;
                    $trip->driver_name = $user->full_name ?? $user->name ?? $user->username;
                    $trip->start_location = $trip->start_location ?? $req->departure_place;
                    $trip->end_location = $trip->end_location ?? $req->destination;
                    $trip->vehicle_type = $trip->vehicle_type ?? $assignedVehicle?->vehicle_type;
                    $trip->plate_number = $trip->plate_number ?? $assignedVehicle?->plate_number;
                    $trip->passengers = $trip->passengers ?? ($req->passenger_names ?? [$req->requester_name]);
                    $trip->save();
                }
            }
        } else {
            $req->status = 'completed';
            $req->completed_at = Carbon::now();

            if ($req->trip_id) {
                $trip = \App\Models\Trip::find($req->trip_id);
                if ($trip) {
                    $trip->status = 'completed';
                    $trip->completed_at = $req->completed_at;
                    $trip->save();
                }
            }
        }
        $req->save();
        $this->logStatusHistory($req, $req->status, $user->id);

        return response()->json($req->load('trip'));
    }

    private function logStatusHistory(RideRequest $req, string $status, ?int $userId): void
    {
        $last = RequestStatusHistory::where('request_id', $req->id)
            ->orderByDesc('id')
            ->first();

        if ($last && $last->status === $status) {
            return;
        }

        RequestStatusHistory::create([
            'request_id' => $req->id,
            'status' => $status,
            'changed_by' => $userId,
        ]);
    }

}
