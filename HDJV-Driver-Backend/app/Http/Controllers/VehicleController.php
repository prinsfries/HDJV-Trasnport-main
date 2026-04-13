<?php

namespace App\Http\Controllers;

use App\Models\Vehicle;
use Illuminate\Http\Request;

class VehicleController extends Controller
{
    public function index(Request $request)
    {
        $page = (int) $request->get('page', 1);
        $limit = (int) $request->get('limit', 50);
        $search = trim((string) $request->get('search', ''));
        $sortBy = (string) $request->get('sort_by', 'id');
        $sortDir = strtolower((string) $request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';
        $vehicleType = $request->get('vehicle_type');
        $status = $request->get('status');

        $query = Vehicle::query();

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('vehicle_id', 'like', $like)
                    ->orWhere('plate_number', 'like', $like)
                    ->orWhere('vehicle_type', 'like', $like)
                    ->orWhere('vehicle_brand', 'like', $like)
                    ->orWhere('vehicle_model', 'like', $like)
                    ->orWhere('description', 'like', $like);
            });
        }

        if ($vehicleType) {
            $query->where('vehicle_type', $vehicleType);
        }
        if ($status) {
            $query->where('status', $status);
        }

        switch ($sortBy) {
            case 'vehicle_id':
            case 'vehicle_brand':
            case 'vehicle_model':
            case 'description':
            case 'vehicle_type':
            case 'plate_number':
            case 'created_at':
            case 'id':
                $query->orderBy($sortBy, $sortDir)->orderBy('id', $sortDir);
                break;
            default:
                $query->orderByDesc('id');
                break;
        }

        $total = (clone $query)->count();
        $items = $query
            ->offset(($page - 1) * $limit)
            ->limit($limit)
            ->get();

        return response()->json([
            'data' => $items,
            'total' => $total,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'vehicle_id' => 'required|string|unique:vehicles',
            'vehicle_type' => 'required|string',
            'vehicle_brand' => 'nullable|string',
            'vehicle_model' => 'nullable|string',
            'description' => 'nullable|string',
            'status' => 'required|in:Active,Inactive,Maintenance',
            'plate_number' => 'required|string|unique:vehicles',
        ]);

        $vehicle = Vehicle::create($validated);
        return response()->json($vehicle, 201);
    }

    public function show($id)
    {
        return Vehicle::findOrFail($id);
    }

    public function update(Request $request, $id)
    {
        $vehicle = Vehicle::findOrFail($id);

        $validated = $request->validate([
            'vehicle_id' => 'string|unique:vehicles,vehicle_id,' . $id,
            'vehicle_type' => 'string',
            'vehicle_brand' => 'nullable|string',
            'vehicle_model' => 'nullable|string',
            'description' => 'nullable|string',
            'status' => 'in:Active,Inactive,Maintenance',
            'plate_number' => 'string|unique:vehicles,plate_number,' . $id,
        ]);

        $vehicle->update($validated);
        return response()->json($vehicle);
    }

    public function destroy($id)
    {
        $vehicle = Vehicle::findOrFail($id);
        $vehicle->delete();
        return response()->json(null, 204);
    }
}
