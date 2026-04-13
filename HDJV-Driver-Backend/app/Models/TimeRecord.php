<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimeRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'record_date',
        'regular_in',
        'regular_out',
        'regular_hours',
        'ot_in',
        'ot_out',
        'ot_hours',
        'notes',
    ];

    protected $casts = [
        'record_date' => 'date',
        'regular_hours' => 'float',
        'ot_hours' => 'float',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
