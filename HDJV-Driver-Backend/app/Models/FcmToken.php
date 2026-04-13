<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FcmToken extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'token',
        'device_type',
        'device_id',
        'last_used_at',
    ];

    protected $casts = [
        'last_used_at' => 'datetime',
    ];

    /**
     * Get the user that owns the token.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope to get active tokens (used within last 30 days)
     */
    public function scopeActive($query)
    {
        return $query->where('last_used_at', '>=', now()->subDays(30));
    }

    /**
     * Scope to get tokens by device type
     */
    public function scopeByDeviceType($query, string $deviceType)
    {
        return $query->where('device_type', $deviceType);
    }
}
