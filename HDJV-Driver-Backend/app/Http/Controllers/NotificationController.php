<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Carbon\Carbon;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $page = (int) $request->get('page', 1);
        $limit = (int) $request->get('limit', 20);
        
        $query = Notification::where('user_id', $user->id)->orderByDesc('created_at');
        
        $total = $query->count();
        $notifications = $query
            ->offset(($page - 1) * $limit)
            ->limit($limit)
            ->get();
            
        return response()->json($notifications);
    }

    public function markRead(Request $request, $id)
    {
        $user = $request->user();
        $notification = Notification::where('user_id', $user->id)->findOrFail($id);
        $notification->read_at = Carbon::now();
        $notification->save();
        return response()->json($notification);
    }

    public function markAllRead(Request $request)
    {
        $user = $request->user();
        Notification::where('user_id', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => Carbon::now()]);
        return response()->json(['message' => 'OK']);
    }
}
