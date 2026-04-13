<?php

namespace Database\Seeders;

use App\Models\TimeRecord;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class TimeRecordSeeder extends Seeder
{
    /**
     * Seed the time_records table with sample data.
     */
    public function run(): void
    {
        $driverIds = User::where('role', 'driver')->pluck('id')->all();
        if (count($driverIds) === 0) {
            return;
        }

        $days = 30;
        $startDate = Carbon::now()->subDays($days - 1)->startOfDay();
        $now = Carbon::now();

        $records = [];

        foreach ($driverIds as $driverId) {
            for ($i = 0; $i < $days; $i++) {
                if (random_int(1, 100) > 70) {
                    continue;
                }

                $recordDate = $startDate->copy()->addDays($i);

                $regularIn = $recordDate->copy()->setTime(random_int(6, 9), random_int(0, 1) ? 0 : 30);
                $regularOut = $regularIn->copy()->addHours(random_int(8, 10))->addMinutes(random_int(0, 1) ? 0 : 30);
                $regularHours = round($regularIn->diffInMinutes($regularOut) / 60, 2);

                $hasOvertime = random_int(1, 100) <= 35;
                $otIn = null;
                $otOut = null;
                $otHours = null;

                if ($hasOvertime) {
                    $otIn = $regularOut->copy()->addMinutes(15);
                    $otOut = $otIn->copy()->addHours(random_int(1, 3));
                    $otHours = round($otIn->diffInMinutes($otOut) / 60, 2);
                }

                $records[] = [
                    'user_id' => $driverId,
                    'record_date' => $recordDate->toDateString(),
                    'regular_in' => $regularIn->format('H:i:s'),
                    'regular_out' => $regularOut->format('H:i:s'),
                    'regular_hours' => $regularHours,
                    'ot_in' => $otIn?->format('H:i:s'),
                    'ot_out' => $otOut?->format('H:i:s'),
                    'ot_hours' => $otHours,
                    'notes' => random_int(1, 100) <= 10 ? 'Auto-generated record' : null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        if (count($records) === 0) {
            return;
        }

        TimeRecord::insert($records);
    }
}
