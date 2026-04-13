<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('trips', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('request_id')->nullable();
            $table->string('trip_id')->unique();
            $table->string('driver_name')->nullable();
            $table->string('vehicle_type')->nullable();
            $table->string('plate_number')->nullable();
            $table->string('start_location')->nullable();
            $table->string('end_location')->nullable();
            $table->string('status')->default('not_started');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('odometer_start')->nullable();
            $table->string('odometer_end')->nullable();
            $table->json('passengers')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trips');
    }
};
