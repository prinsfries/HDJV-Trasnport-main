<?php

namespace App\Services;

use App\Models\Request as RideRequest;
use App\Models\RequestStatusHistory;
use App\Models\Notification;
use App\Models\User;
use Carbon\Carbon;

class RequestAutoRejectService
{
    protected FirebaseNotificationService $firebaseService;

    public function __construct(FirebaseNotificationService $firebaseService)
    {
        $this->firebaseService = $firebaseService;
    }

    public function run(): int
    {
        $cutoff = Carbon::today();
        $expired = RideRequest::where('status', 'pending')
            ->whereNotNull('requested_at')
            ->where('requested_at', '<', $cutoff)
            ->get();

        if ($expired->isEmpty()) {
            return 0;
        }

        foreach ($expired as $req) {
            $req->status = 'rejected';
            $req->accepted_by = null;
            $req->accepted_at = Carbon::now();
            $req->save();
            $this->logStatusHistory($req, 'rejected', null);

            // Notify requester about auto-rejection
            Notification::create([
                'user_id' => $req->requester_id,
                'type' => 'request_rejected_expired',
                'title' => 'Request rejected',
                'body' => "Your request #{$req->id} was rejected because the scheduled time has passed.",
                'data' => ['request_id' => $req->id],
            ]);

            $requester = User::find($req->requester_id);
            if ($requester) {
                $this->firebaseService->sendRequestNotification('request_rejected_expired', $requester, [
                    'id' => $req->id,
                    'departure_place' => $req->departure_place,
                    'destination' => $req->destination,
                ]);
            }
        }

        return $expired->count();
    }

    private function logStatusHistory(RideRequest $req, string $status, ?int $userId): void
    {
        $last = RequestStatusHistory::where('request_id', $req->id)
            ->orderByDesc('id')
            ->first();

        if ($last && $last->status === $status) {
            return;
        }

        RequestStatusHistory::create([
            'request_id' => $req->id,
            'status' => $status,
            'changed_by' => $userId,
        ]);
    }
}
