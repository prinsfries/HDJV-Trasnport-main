<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('request_status_histories', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('request_id');
            $table->string('status');
            $table->unsignedBigInteger('changed_by')->nullable();
            $table->timestamps();

            $table->foreign('request_id')->references('id')->on('requests')->onDelete('cascade');
            $table->foreign('changed_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['request_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('request_status_histories');
    }
};
