<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Vehicle extends Model
{
    protected $fillable = [
        'vehicle_id',
        'vehicle_type',
        'vehicle_brand',
        'vehicle_model',
        'description',
        'status',
        'plate_number',
    ];
}
