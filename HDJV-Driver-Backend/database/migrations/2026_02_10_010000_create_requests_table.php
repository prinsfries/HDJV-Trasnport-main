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
        Schema::create('requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->string('requester_name');
            $table->string('requester_contact')->nullable();
            $table->string('departure_place');
            $table->string('destination');
            $table->timestamp('requested_at')->nullable();
            $table->string('purpose')->nullable();
            $table->unsignedInteger('persons')->default(1);
            $table->json('passenger_names')->nullable();
            $table->boolean('used_coupon')->default(false);
            $table->enum('status', ['pending', 'accepted', 'rejected', 'assigned', 'in_progress', 'completed'])->default('pending');

            $table->foreignId('accepted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('accepted_at')->nullable();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_driver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_vehicle_id')->nullable()->constrained('vehicles')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('trip_id')->nullable()->constrained('trips')->nullOnDelete();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('requests');
    }
};
