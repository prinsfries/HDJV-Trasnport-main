<?php

namespace App\Http\Controllers;

use App\Models\Trip;
use Illuminate\Http\Request;

class TripProofPhotoController extends Controller
{
    public function index(string $tripId)
    {
        $trip = Trip::where('trip_id', $tripId)->firstOrFail();

        $photos = $trip->proofPhotos()
            ->orderBy('captured_at')
            ->get();

        return response()->json($photos);
    }

    public function store(Request $request, string $tripId)
    {
        $data = $request->validate([
            'photo' => ['required', 'image', 'max:10240'],
            'location' => ['nullable', 'string'],
            'captured_at' => ['nullable', 'date'],
        ]);

        $trip = Trip::firstOrCreate(
            ['trip_id' => $tripId],
            ['status' => 'not_started']
        );

        $file = $request->file('photo');
        $path = $file->store("proof-photos/{$tripId}", 'public');

        $photo = $trip->proofPhotos()->create([
            'file_path' => $path,
            'location' => $data['location'] ?? null,
            'captured_at' => $data['captured_at'] ?? null,
        ]);

        return response()->json($photo, 201);
    }
}
