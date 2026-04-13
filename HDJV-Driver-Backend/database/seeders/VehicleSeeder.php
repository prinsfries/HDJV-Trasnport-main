<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Vehicle;

class VehicleSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the vehicles table with 100+ records.
     */
    public function run(): void
    {
        $vehicleTypes = [
            'Sedan', 'SUV', 'Truck', 'Van', 'Pickup', 'Bus', 'Motorcycle', 'Minivan', 'Convertible',
            'Wagon', 'Crossover', 'Mid-size SUV', 'Full-size SUV'
        ];

        $vehicleBrands = [
            'Toyota', 'Honda', 'Ford', 'Nissan', 'Hyundai', 'Mitsubishi', 'Isuzu', 'Suzuki', 'Kia', 'Chevrolet'
        ];

        $vehicleModels = [
            'Hilux', 'Fortuner', 'Vios', 'Civic', 'City', 'Ranger', 'Everest', 'Navara', 'Strada', 'Stargazer',
            'Montero', 'Mirage', 'D-Max', 'Almera', 'Innova', 'Avanza', 'Raize', 'Ertiga', 'Stonic', 'Colorado'
        ];

        $vehicleDescriptions = [
            'Company service vehicle for daily operations.',
            'Reserved for executive and visitor transport.',
            'Assigned for on-call company errands.',
            'Fleet vehicle for scheduled employee trips.',
            'Dedicated for long-distance travel.',
            'Standard service unit with regular maintenance.',
            'Utility vehicle for logistics support.',
            'Backup vehicle for peak demand days.',
        ];

        $statuses = ['Active', 'Maintenance', 'Inactive'];

        $usedPlates = [];

        // Generate 1000 vehicles
        for ($i = 1; $i <= 1000; $i++) {
            $vehicleType = $vehicleTypes[array_rand($vehicleTypes)];
            $status = $statuses[array_rand($statuses)];
            
            // Generate vehicle ID
            $vehicleId = 'VH-' . str_pad($i, 3, '0', STR_PAD_LEFT);
            
            // Generate plate number
            $plateNumber = $this->generatePlateNumber($usedPlates);
            $usedPlates[] = $plateNumber;
            
            Vehicle::create([
                'vehicle_id' => $vehicleId,
                'vehicle_type' => $vehicleType,
                'vehicle_brand' => $vehicleBrands[array_rand($vehicleBrands)],
                'vehicle_model' => $vehicleModels[array_rand($vehicleModels)],
                'description' => $vehicleDescriptions[array_rand($vehicleDescriptions)],
                'status' => $status,
                'plate_number' => $plateNumber,
            ]);
        }
    }

    /**
     * Generate a random Philippine plate number format.
     */
    private function generatePlateNumber(array $usedPlates): string
    {
        $letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        $numbers = '0123456789';
        
        // Format: ABC-1234 or XYZ-5678
        do {
            $plateLetters = substr(str_shuffle($letters), 0, 3);
            $plateNumbers = substr(str_shuffle($numbers), 0, 4);
            $plate = $plateLetters . '-' . $plateNumbers;
        } while (in_array($plate, $usedPlates, true));
        
        return $plate;
    }
}
