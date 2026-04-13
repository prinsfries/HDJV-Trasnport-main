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
        Schema::create('trip_proof_photos', function (Blueprint $table) {
            $table->id();
            $table->string('trip_id');
            $table->string('file_path');
            $table->string('location')->nullable();
            $table->timestamp('captured_at')->nullable();
            $table->timestamps();

            $table->foreign('trip_id')
                ->references('trip_id')
                ->on('trips')
                ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trip_proof_photos');
    }
};
