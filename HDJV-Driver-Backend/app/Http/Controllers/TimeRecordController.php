<?php

namespace App\Http\Controllers;

use App\Models\TimeRecord;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class TimeRecordController extends Controller
{
    public function index(Request $request)
    {
        $driverId = $request->query('driver_id');
        if (!$driverId) {
            return response()->json(['message' => 'driver_id is required'], 422);
        }

        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        $query = TimeRecord::with('user')
            ->where('user_id', $driverId)
            ->orderBy('record_date');

        if ($dateFrom) {
            $query->whereDate('record_date', '>=', $dateFrom);
        }
        if ($dateTo) {
            $query->whereDate('record_date', '<=', $dateTo);
        }

        return $query->get();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'driver_id' => 'required|exists:users,id',
            'record_date' => 'required|date',
            'regular_in' => 'nullable|date_format:H:i',
            'regular_out' => 'nullable|date_format:H:i',
            'ot_in' => 'nullable|date_format:H:i',
            'ot_out' => 'nullable|date_format:H:i',
            'notes' => 'nullable|string',
        ]);

        $driver = User::findOrFail($validated['driver_id']);
        if ($driver->role && $driver->role !== 'driver') {
            return response()->json(['message' => 'Selected user is not a driver'], 422);
        }

        $regularHours = $this->calculateHours($validated['regular_in'] ?? null, $validated['regular_out'] ?? null);
        $otHours = $this->calculateHours($validated['ot_in'] ?? null, $validated['ot_out'] ?? null);

        $record = TimeRecord::updateOrCreate(
            [
                'user_id' => $validated['driver_id'],
                'record_date' => $validated['record_date'],
            ],
            [
                'regular_in' => $validated['regular_in'] ?? null,
                'regular_out' => $validated['regular_out'] ?? null,
                'regular_hours' => $regularHours,
                'ot_in' => $validated['ot_in'] ?? null,
                'ot_out' => $validated['ot_out'] ?? null,
                'ot_hours' => $otHours,
                'notes' => $validated['notes'] ?? null,
            ]
        );

        return response()->json($record->load('user'));
    }

    public function destroy($id)
    {
        $record = TimeRecord::findOrFail($id);
        $record->delete();
        return response()->json(null, 204);
    }

    public function today(Request $request)
    {
        $date = $request->query('date');
        if (!$date) {
            return response()->json(['message' => 'date is required'], 422);
        }

        $page = max((int) $request->query('page', 0), 0);
        $pageSize = max((int) $request->query('page_size', 0), 0);
        $search = trim((string) $request->query('search', ''));

        $usePagination = $page > 0 || $pageSize > 0 || $search !== '';
        $page = $page > 0 ? $page : 1;
        $pageSize = $pageSize > 0 ? $pageSize : 200;

        $driversQuery = User::where('role', 'driver')
            ->orderBy('last_name')
            ->orderBy('first_name');

        if ($search !== '') {
            $like = '%' . $search . '%';
            $driversQuery->where(function ($query) use ($like) {
                $query->where('first_name', 'like', $like)
                    ->orWhere('last_name', 'like', $like)
                    ->orWhere('contact', 'like', $like)
                    ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [$like]);
            });
        }

        $totalDrivers = $driversQuery->count();

        if ($usePagination) {
            $drivers = $driversQuery
                ->skip(($page - 1) * $pageSize)
                ->take($pageSize)
                ->get();
        } else {
            $drivers = $driversQuery->get();
        }

        $driverIds = $drivers->pluck('id');
        $records = TimeRecord::whereDate('record_date', $date)
            ->whereIn('user_id', $driverIds)
            ->get();

        $recordsByDriver = $records->keyBy('user_id');

        $payload = $drivers->map(function ($driver) use ($recordsByDriver, $date) {
            $record = $recordsByDriver->get($driver->id);
            return [
                'driver' => [
                    'id' => $driver->id,
                    'full_name' => $driver->full_name,
                    'contact' => $driver->contact,
                ],
                'record_date' => $date,
                'record' => $record,
            ];
        });

        if (!$usePagination) {
            return response()->json($payload);
        }

        $totals = TimeRecord::whereDate('record_date', $date)
            ->selectRaw('COALESCE(SUM(regular_hours), 0) as regular, COALESCE(SUM(ot_hours), 0) as overtime')
            ->first();

        return response()->json([
            'items' => $payload,
            'total' => $totalDrivers,
            'page' => $page,
            'page_size' => $pageSize,
            'totals' => [
                'regular' => (float) ($totals->regular ?? 0),
                'overtime' => (float) ($totals->overtime ?? 0),
            ],
        ]);
    }

    private function calculateHours(?string $start, ?string $end): ?float
    {
        if (!$start || !$end) {
            return null;
        }

        try {
            $startTime = Carbon::createFromFormat('H:i', $start);
            $endTime = Carbon::createFromFormat('H:i', $end);
        } catch (\Exception $e) {
            return null;
        }

        if ($endTime->lessThan($startTime)) {
            $endTime->addDay();
        }

        $minutes = $startTime->diffInMinutes($endTime);
        return round($minutes / 60, 2);
    }
}
