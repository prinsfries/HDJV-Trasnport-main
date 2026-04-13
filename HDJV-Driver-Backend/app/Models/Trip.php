<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Trip extends Model
{
    protected $fillable = [
        'trip_id',
        'request_id',
        'driver_name',
        'vehicle_type',
        'plate_number',
        'start_location',
        'end_location',
        'status',
        'started_at',
        'completed_at',
        'odometer_start',
        'odometer_end',
        'passengers',
    ];

    protected $casts = [
        'passengers' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function proofPhotos()
    {
        return $this->hasMany(TripProofPhoto::class, 'trip_id', 'trip_id');
    }

    public function request()
    {
        return $this->belongsTo(Request::class, 'request_id');
    }
}
