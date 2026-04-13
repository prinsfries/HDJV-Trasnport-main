<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\TripProofPhoto;
use App\Models\Trip;

class TripProofPhotoSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the trip_proof_photos table with 100+ records.
     */
    public function run(): void
    {
        // Get existing trips
        $trips = Trip::pluck('trip_id')->toArray();
        
        if (empty($trips)) {
            $this->command->warn('No trips found. Please run TripSeeder first.');
            return;
        }

        $photoTypes = [
            'start_trip', 'end_trip', 'passenger_selfie', 'vehicle_condition', 'fuel_receipt', 
            'toll_receipt', 'parking_receipt', 'incident_photo', 'waypoint_photo', 'delivery_proof'
        ];

        $locations = [
            'Starting Point', 'Destination', 'Checkpoint 1', 'Checkpoint 2', 'Fuel Station',
            'Toll Gate', 'Parking Area', 'Rest Stop', 'Client Location', 'Warehouse'
        ];

        // Generate 1000 proof photos
        for ($i = 1; $i <= 1000; $i++) {
            $tripId = $trips[array_rand($trips)];
            $photoType = $photoTypes[array_rand($photoTypes)];
            $location = $locations[array_rand($locations)];
            
            // Generate realistic file path
            $fileName = 'trip_' . $tripId . '_' . $photoType . '_' . time() . '_' . $i . '.jpg';
            $filePath = 'trip_photos/' . date('Y/m/d') . '/' . $fileName;
            
            TripProofPhoto::create([
                'trip_id' => $tripId,
                'file_path' => $filePath,
                'location' => $location,
                'captured_at' => now()->subDays(rand(1, 30))->subHours(rand(1, 23))->subMinutes(rand(1, 59)),
            ]);
        }
    }
}
