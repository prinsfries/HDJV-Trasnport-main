<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use App\Models\Request as RideRequest;
use App\Models\RequestStatusHistory;
use App\Models\User;
use App\Models\Vehicle;

class RequestSeeder extends Seeder
{
    /**
     * Seed the requests table.
     */
    public function run(): void
    {
        $passengers = User::whereIn('role', ['passenger', 'krpassenger'])->get();
        $kradmin = User::where('role', 'kradmin')->first();
        $gaadmin = User::where('role', 'gaadmin')->first();
        $drivers = User::where('role', 'driver')->get();
        $vehicles = Vehicle::all();

        if ($passengers->isEmpty()) {
            $this->command->warn('No passengers found. Please run UserSeeder first.');
            return;
        }

        $locations = [
            'Manila', 'Quezon City', 'Caloocan', 'Makati', 'Pasay', 'Taguig', 'Pasig', 'Mandaluyong',
            'San Juan', 'Marikina', 'Muntinlupa', 'Las Piñas', 'Parañaque', 'Valenzuela', 'Cebu City',
            'Davao City', 'Baguio City', 'Bacolod City', 'Iloilo City', 'Cagayan de Oro',
            'General Santos', 'Zamboanga City', 'Antipolo', 'Tuguegarao', 'Batangas City',
            'Lipa City', 'San Pablo', 'Lucena', 'Olongapo', 'Tacloban'
        ];

        $purposes = [
            'Work commute', 'Medical appointment', 'Family visit', 'School drop-off',
            'Business meeting', 'Airport transfer', 'Errands', 'Event attendance'
        ];

        $names = [
            'Juan', 'Maria', 'Jose', 'Ana', 'Pedro', 'Sofia', 'Miguel', 'Isabella',
            'Carlos', 'Elena', 'Mateo', 'Daniel', 'Gabriel', 'Camila', 'Andrea', 'Luis'
        ];

        $statuses = ['pending', 'accepted', 'assigned', 'in_progress', 'completed', 'rejected'];

        $monthlyCouponCount = [];

        for ($i = 0; $i < 1000; $i++) {
            $passenger = $passengers->random();
            $departure = $locations[array_rand($locations)];
            $destination = $locations[array_rand($locations)];
            while ($destination === $departure) {
                $destination = $locations[array_rand($locations)];
            }

            $status = $statuses[array_rand($statuses)];
            $createdAt = Carbon::now()->subDays(rand(0, 30))->subHours(rand(0, 12));

            $usedCoupon = false;
            if ($passenger->role === 'krpassenger') {
                $monthKey = $createdAt->format('Y-m');
                $counterKey = $passenger->id . ':' . $monthKey;
                $currentCount = $monthlyCouponCount[$counterKey] ?? 0;
                if ($currentCount < 3 && (bool) random_int(0, 1)) {
                    $usedCoupon = true;
                    $monthlyCouponCount[$counterKey] = $currentCount + 1;
                }
            }

            $data = [
                'requester_id' => $passenger->id,
                'requester_name' => $passenger->full_name ?? $passenger->name ?? $passenger->username ?? 'Passenger',
                'requester_contact' => $passenger->contact ?? null,
                'departure_place' => $departure,
                'destination' => $destination,
                'requested_at' => (clone $createdAt)->addHours(rand(1, 72)),
                'purpose' => $purposes[array_rand($purposes)],
                'persons' => 1,
                'passenger_names' => [],
                'used_coupon' => $usedCoupon,
                'status' => $status,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ];

            $extraCount = rand(0, 3);
            $passengerNames = [];
            for ($j = 0; $j < $extraCount; $j++) {
                $passengerNames[] = $names[array_rand($names)];
            }
            $requesterName = $data['requester_name'];
            if (!in_array($requesterName, $passengerNames, true)) {
                $passengerNames[] = $requesterName;
            }
            $data['passenger_names'] = $passengerNames;
            $data['persons'] = count($passengerNames);

            if (in_array($status, ['accepted', 'assigned', 'in_progress', 'completed'], true) && $kradmin) {
                $data['accepted_by'] = $kradmin->id;
                $data['accepted_at'] = (clone $createdAt)->addMinutes(rand(5, 90));
            }
            if ($status === 'rejected' && $kradmin) {
                $data['accepted_by'] = $kradmin->id;
                $data['accepted_at'] = (clone $createdAt)->addMinutes(rand(5, 90));
            }

            if (in_array($status, ['assigned', 'in_progress', 'completed'], true) && $gaadmin && $drivers->isNotEmpty()) {
                $driver = $drivers->random();
                $data['assigned_by'] = $gaadmin->id;
                $data['assigned_driver_id'] = $driver->id;
                $data['assigned_at'] = (clone $data['accepted_at'])->addMinutes(rand(10, 120));
                if ($vehicles->isNotEmpty()) {
                    $data['assigned_vehicle_id'] = $vehicles->random()->id;
                }
            }

            if (in_array($status, ['in_progress', 'completed'], true)) {
                $data['started_at'] = (clone ($data['assigned_at'] ?? $createdAt))->addMinutes(rand(5, 60));
            }

            if ($status === 'completed') {
                $data['completed_at'] = (clone $data['started_at'])->addMinutes(rand(20, 180));
            }

            $req = RideRequest::create($data);
            $this->seedStatusHistory($req, $status, $createdAt, $kradmin, $gaadmin);
        }
    }

    private function seedStatusHistory(RideRequest $req, string $status, Carbon $createdAt, ?User $kradmin, ?User $gaadmin): void
    {
        $history = [];
        $history[] = [
            'request_id' => $req->id,
            'status' => 'pending',
            'changed_by' => $req->requester_id,
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ];

        if ($status === 'rejected') {
            $rejectedAt = $req->accepted_at ?? (clone $createdAt)->addMinutes(10);
            $history[] = [
                'request_id' => $req->id,
                'status' => 'rejected',
                'changed_by' => $kradmin?->id,
                'created_at' => $rejectedAt,
                'updated_at' => $rejectedAt,
            ];
            RequestStatusHistory::insert($history);
            return;
        }

        if (in_array($status, ['accepted', 'assigned', 'in_progress', 'completed'], true)) {
            $acceptedAt = $req->accepted_at ?? (clone $createdAt)->addMinutes(10);
            $history[] = [
                'request_id' => $req->id,
                'status' => 'accepted',
                'changed_by' => $kradmin?->id,
                'created_at' => $acceptedAt,
                'updated_at' => $acceptedAt,
            ];
        }

        if (in_array($status, ['assigned', 'in_progress', 'completed'], true)) {
            $assignedAt = $req->assigned_at ?? (clone ($req->accepted_at ?? $createdAt))->addMinutes(20);
            $history[] = [
                'request_id' => $req->id,
                'status' => 'assigned',
                'changed_by' => $gaadmin?->id,
                'created_at' => $assignedAt,
                'updated_at' => $assignedAt,
            ];
        }

        if (in_array($status, ['in_progress', 'completed'], true)) {
            $startedAt = $req->started_at ?? (clone ($req->assigned_at ?? $createdAt))->addMinutes(30);
            $history[] = [
                'request_id' => $req->id,
                'status' => 'in_progress',
                'changed_by' => $req->assigned_driver_id,
                'created_at' => $startedAt,
                'updated_at' => $startedAt,
            ];
        }

        if ($status === 'completed') {
            $completedAt = $req->completed_at ?? (clone ($req->started_at ?? $createdAt))->addMinutes(60);
            $history[] = [
                'request_id' => $req->id,
                'status' => 'completed',
                'changed_by' => $req->assigned_driver_id,
                'created_at' => $completedAt,
                'updated_at' => $completedAt,
            ];
        }

        RequestStatusHistory::insert($history);
    }
}
