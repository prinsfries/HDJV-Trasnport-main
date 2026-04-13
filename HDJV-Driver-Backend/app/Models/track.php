<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class track extends Model
{
    protected $fillable = [
        'vehicle_id',
        'latitude',
        'longitude',
        'location_name',
        'status',
        'speed',
        'heading',
        'recorded_at',
    ];

    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'speed' => 'decimal:2',
        'heading' => 'integer',
        'recorded_at' => 'datetime',
    ];
}
