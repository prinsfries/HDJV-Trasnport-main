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
        Schema::create('time_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('record_date');
            $table->time('regular_in')->nullable();
            $table->time('regular_out')->nullable();
            $table->decimal('regular_hours', 5, 2)->nullable();
            $table->time('ot_in')->nullable();
            $table->time('ot_out')->nullable();
            $table->decimal('ot_hours', 5, 2)->nullable();
            $table->string('notes')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'record_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('time_records');
    }
};
