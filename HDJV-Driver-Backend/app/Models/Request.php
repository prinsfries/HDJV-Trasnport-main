<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Request extends Model
{
    protected $fillable = [
        'requester_id',
        'requester_name',
        'requester_contact',
        'departure_place',
        'destination',
        'requested_at',
        'purpose',
        'persons',
        'passenger_names',
        'used_coupon',
        'status',
        'accepted_by',
        'accepted_at',
        'assigned_by',
        'assigned_driver_id',
        'assigned_vehicle_id',
        'assigned_at',
        'started_at',
        'completed_at',
        'trip_id',
    ];

    protected $casts = [
        'passenger_names' => 'array',
        'used_coupon' => 'boolean',
        'requested_at' => 'datetime',
        'accepted_at' => 'datetime',
        'assigned_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function trip()
    {
        return $this->belongsTo(Trip::class, 'trip_id');
    }

    public function assignedDriver()
    {
        return $this->belongsTo(User::class, 'assigned_driver_id');
    }

    public function assignedVehicle()
    {
        return $this->belongsTo(Vehicle::class, 'assigned_vehicle_id');
    }

    public function statusHistories()
    {
        return $this->hasMany(RequestStatusHistory::class, 'request_id');
    }
}
