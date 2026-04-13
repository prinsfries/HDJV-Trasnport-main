<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use App\Models\Request as RideRequest;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'first_name',
        'middle_name',
        'last_name',
        'suffix',
        'email',
        'username',
        'password',
        'default_password',
        'password_changed',
        'is_active',
        'is_approved',
        'role',
        'contact',
        'preferences',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'default_password',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'password_changed' => 'boolean',
        'is_active' => 'boolean',
        'is_approved' => 'boolean',
        'preferences' => 'array',
        'approved_at' => 'datetime',
    ];
    }

    protected $appends = [
        'full_name',
    ];

    /**
     * Get the password that should be visible to admins
     * Only show default_password if password hasn't been changed
     */
    public function getVisiblePasswordAttribute()
    {
        return $this->password_changed ? null : $this->default_password;
    }

    /**
     * Get the full name of the user
     * Combines first, middle, last name and suffix
     */
    public function getFullNameAttribute()
    {
        $parts = [];
        
        if ($this->first_name) {
            $parts[] = $this->first_name;
        }
        
        if ($this->middle_name) {
            $parts[] = $this->middle_name;
        }
        
        if ($this->last_name) {
            $parts[] = $this->last_name;
        }
        
        if ($this->suffix) {
            $parts[] = $this->suffix;
        }
        
        return implode(' ', $parts);
    }

    /**
     * Get the FCM tokens for the user
     */
    public function fcmTokens(): HasMany
    {
        return $this->hasMany(FcmToken::class);
    }

    /**
     * Driver time records.
     */
    public function timeRecords(): HasMany
    {
        return $this->hasMany(TimeRecord::class);
    }

    /**
     * Passenger ride requests.
     */
    public function rideRequests(): HasMany
    {
        return $this->hasMany(RideRequest::class, 'requester_id');
    }
}
