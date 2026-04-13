<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Support\Str;
use Carbon\Carbon;

class TripSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the trips table with 100+ records.
     */
    public function run(): void
    {
        // Get existing users and vehicles
        $users = User::where('role', 'driver')
            ->orWhere('role', 'kradmin')
            ->orWhere('role', 'gaadmin')
            ->get()
            ->map(function($user) {
            return $user->full_name;
        })->toArray();
        $vehicles = Vehicle::pluck('plate_number')->toArray();
        
        if (empty($users)) {
            $this->command->warn('No users found. Please run UserSeeder first.');
            return;
        }
        
        if (empty($vehicles)) {
            $this->command->warn('No vehicles found. Please run VehicleSeeder first.');
            return;
        }

        $locations = [
            'Manila', 'Quezon City', 'Caloocan', 'Makati', 'Pasay', 'Taguig', 'Pasig', 'Mandaluyong',
            'San Juan', 'Marikina', 'Muntinlupa', 'Las Piñas', 'Parañaque', 'Valenzuela', 'Cebu City',
            'Davao City', 'Baguio City', 'Angeles City', 'Bacolod City', 'Iloilo City', 'Cagayan de Oro',
            'General Santos', 'Zamboanga City', 'Antipolo', 'Tuguegarao', 'Legazpi', 'Batangas City',
            'Lipa City', 'Tarlac City', 'San Pablo', 'Puerto Princesa', 'Butuan', 'Dagupan',
            'Iligan', 'Laoag', 'Lucena', 'Naga', 'Olongapo', 'Ormoc', 'San Fernando', 'Tacloban',
            'Vigan'
        ];

        $statuses = ['not_started', 'started', 'completed'];

        // Generate 1000 trips
        for ($i = 1; $i <= 1000; $i++) {
            $driverName = $users[array_rand($users)];
            $vehicleType = $this->getVehicleTypeFromPlate($vehicles[array_rand($vehicles)]);
            $plateNumber = $vehicles[array_rand($vehicles)];
            $startLocation = $locations[array_rand($locations)];
            $endLocation = $locations[array_rand($locations)];
            $status = $statuses[array_rand($statuses)];
            
            // Ensure start and end locations are different
            while ($startLocation === $endLocation) {
                $endLocation = $locations[array_rand($locations)];
            }
            
            $tripId = Str::upper(Str::random(10));
            
            $tripData = [
                'trip_id' => $tripId,
                'driver_name' => $driverName,
                'vehicle_type' => $vehicleType,
                'plate_number' => $plateNumber,
                'start_location' => $startLocation,
                'end_location' => $endLocation,
                'status' => $status,
                'passengers' => $this->generatePassengers(),
            ];
            
            // Add timestamps based on status
            if ($status === 'completed') {
                $tripData['started_at'] = Carbon::now()->subDays(rand(1, 30))->subHours(rand(1, 12));
                $tripData['completed_at'] = (clone $tripData['started_at'])->addHours(rand(2, 8));
                $tripData['odometer_start'] = rand(10000, 50000);
                $tripData['odometer_end'] = $tripData['odometer_start'] + rand(50, 500);
            } elseif ($status === 'started') {
                $tripData['started_at'] = Carbon::now()->subHours(rand(1, 12));
                $tripData['odometer_start'] = rand(10000, 50000);
            }
            
            Trip::create($tripData);
        }
    }

    /**
     * Generate random passenger data.
     */
    private function generatePassengers(): array
    {
        $passengerCount = rand(0, 4);
        $passengers = [];
        
        $firstNames = ['Juan', 'Maria', 'Jose', 'Ana', 'Pedro', 'Sofia', 'Miguel', 'Isabella', 'Carlos', 'Elena'];
        $lastNames = ['Santos', 'Reyes', 'Cruz', 'Garcia', 'Ramos', 'Flores', 'Martinez', 'Lopez', 'Gonzalez', 'Perez'];
        
        for ($i = 0; $i < $passengerCount; $i++) {
            $passengers[] = [
                'name' => $firstNames[array_rand($firstNames)] . ' ' . $lastNames[array_rand($lastNames)],
                'age' => rand(18, 65),
                'contact' => '09' . str_pad(rand(100000000, 999999999), 9, '0', STR_PAD_LEFT),
            ];
        }
        
        return $passengers;
    }

    /**
     * Get vehicle type from plate number (simplified).
     */
    private function getVehicleTypeFromPlate(string $plateNumber): string
    {
        $types = ['Sedan', 'SUV', 'Van', 'Truck', 'Bus'];
        return $types[array_rand($types)];
    }
}
