<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class TripProofPhoto extends Model
{
    protected $fillable = [
        'trip_id',
        'file_path',
        'location',
        'captured_at',
    ];

    protected $casts = [
        'captured_at' => 'datetime',
    ];

    protected $appends = [
        'file_url',
    ];

    public function getFileUrlAttribute()
    {
        if (!$this->file_path) {
            return null;
        }
        return Storage::disk('public')->url($this->file_path);
    }

    public function trip()
    {
        return $this->belongsTo(Trip::class, 'trip_id', 'trip_id');
    }
}
