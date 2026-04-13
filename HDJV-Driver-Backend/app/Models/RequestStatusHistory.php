<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RequestStatusHistory extends Model
{
    protected $fillable = [
        'request_id',
        'status',
        'changed_by',
    ];

    public function request()
    {
        return $this->belongsTo(Request::class, 'request_id');
    }
}
