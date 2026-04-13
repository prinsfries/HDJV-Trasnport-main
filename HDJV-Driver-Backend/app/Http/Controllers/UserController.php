<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Notification;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    private function shouldIncludeCredentials(Request $request): bool
    {
        $actor = $request->user();
        if (!$actor) {
            return false;
        }

        $isAdmin = in_array($actor->role, ['admin', 'kradmin', 'gaadmin'], true);
        return $isAdmin && $request->boolean('include_credentials');
    }

    public function index(Request $request)
    {
        $page = (int) $request->get('page', 1);
        $limit = (int) $request->get('limit', 50);
        $search = trim((string) $request->get('search', ''));
        $sortBy = (string) $request->get('sort_by', 'id');
        $sortDir = strtolower((string) $request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';
        $role = $request->get('role');
        $roleIn = $request->get('role_in');
        $roleExclude = $request->get('role_exclude');
        $joinYear = $request->get('join_year');

        $query = User::query();

        $roleInList = [];
        if ($roleIn) {
            $roleInList = array_filter(array_map('trim', explode(',', (string) $roleIn)));
        }
        $isPassengerQuery = in_array($role, ['passenger', 'krpassenger'], true)
            || count(array_intersect($roleInList, ['passenger', 'krpassenger'])) > 0;

        if ($isPassengerQuery) {
            $startOfMonth = Carbon::now()->startOfMonth();
            $endOfMonth = Carbon::now()->endOfMonth();
            $query->withCount([
                'rideRequests as coupon_used_count' => function ($q) use ($startOfMonth, $endOfMonth) {
                    $q->where('used_coupon', true)
                        ->whereBetween('created_at', [$startOfMonth, $endOfMonth]);
                },
            ]);
        }

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('first_name', 'like', $like)
                    ->orWhere('middle_name', 'like', $like)
                    ->orWhere('last_name', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('username', 'like', $like)
                    ->orWhere('contact', 'like', $like);
            });
        }

        if ($role) {
            $query->where('role', $role);
        }
        if ($roleIn) {
            if (count($roleInList) > 0) {
                $query->whereIn('role', $roleInList);
            }
        }
        if ($roleExclude) {
            $roles = array_filter(array_map('trim', explode(',', (string) $roleExclude)));
            if (count($roles) > 0) {
                $query->whereNotIn('role', $roles);
            }
        }
        if ($joinYear) {
            $query->whereYear('created_at', (int) $joinYear);
        }

        switch ($sortBy) {
            case 'name':
            case 'full_name':
                $query->orderBy('last_name', $sortDir)->orderBy('first_name', $sortDir)->orderBy('id', $sortDir);
                break;
            case 'first_name':
            case 'last_name':
            case 'email':
            case 'username':
            case 'contact':
            case 'role':
            case 'created_at':
            case 'id':
                $query->orderBy($sortBy, $sortDir)->orderBy('id', $sortDir);
                break;
            default:
                $query->orderByDesc('id');
                break;
        }

        $total = (clone $query)->count();
        $items = $query
            ->offset(($page - 1) * $limit)
            ->limit($limit)
            ->get();

        if ($this->shouldIncludeCredentials($request)) {
            $items->each->append('visible_password');
        }

        return response()->json([
            'data' => $items,
            'total' => $total,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'first_name' => 'required|string',
            'middle_name' => 'nullable|string',
            'last_name' => 'required|string',
            'suffix' => 'nullable|string',
            'email' => 'required|email|unique:users',
            'username' => 'nullable|string|unique:users',
            'password' => 'nullable|string|min:6',
            'contact' => 'nullable|string',
            'is_active' => 'boolean',
            'is_approved' => 'boolean',
        ]);

        // If username not provided, use email
        if (empty($validated['username'])) {
            $validated['username'] = $validated['email'];
        }

        // Generate default password if not provided
        if (empty($validated['password'])) {
            $lastName = strtolower($validated['last_name'] ?? 'user');
            $joinDate = now()->format('mdY'); // Month + Day + Year (e.g., "02042026")
            $defaultPassword = $lastName . $joinDate; // lastname + numeric date
        } else {
            $defaultPassword = $validated['password'];
        }

        $validated['password'] = Hash::make($defaultPassword);
        $validated['default_password'] = $defaultPassword;
        $validated['password_changed'] = false;

        if (!array_key_exists('is_approved', $validated)) {
            $validated['is_approved'] = true;
        }
        if ($validated['is_approved'] && !array_key_exists('is_active', $validated)) {
            $validated['is_active'] = true;
            $validated['approved_at'] = Carbon::now();
        }

        $user = User::create($validated);
        return response()->json($user, 201);
    }

    public function show($id)
    {
        $user = User::findOrFail($id);

        if ($this->shouldIncludeCredentials(request())) {
            $user->append('visible_password');
        }

        return $user;
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $actor = $request->user();
        $isSelf = $actor && $actor->id === $user->id;
        $isAdmin = $actor && $actor->role === 'admin';
        $forcePasswordChange = filter_var($request->input('force_password_change', false), FILTER_VALIDATE_BOOLEAN);

        $validated = $request->validate([
            'first_name' => 'string',
            'middle_name' => 'nullable|string',
            'last_name' => 'string',
            'suffix' => 'nullable|string',
            'email' => 'email|unique:users,email,' . $id,
            'username' => 'string|unique:users,username,' . $id,
            'password' => [
                'string',
                'min:8',
                'max:64',
                // Must contain at least one uppercase, one lowercase, one digit, one special character
                'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).+$/'
            ],
            'contact' => 'nullable|string',
            'is_active' => 'boolean',
            'is_approved' => 'boolean',
            'preferences' => 'nullable|array',
        ]);

        if (isset($validated['password'])) {
            if ($isSelf && !$isAdmin) {
                if ($user->password_changed && !$forcePasswordChange) {
                    $request->validate([
                        'current_password' => 'required|string'
                    ]);
                    if (!Hash::check($request->input('current_password'), $user->password)) {
                        return response()->json([
                            'message' => 'Current password is incorrect.',
                            'errors' => ['current_password' => ['Current password is incorrect.']]
                        ], 422);
                    }
                }
            }
            $validated['password'] = Hash::make($validated['password']);
            $validated['password_changed'] = true;
            $validated['default_password'] = null;
        }

        $wasApproved = $user->is_approved;

        if (array_key_exists('is_approved', $validated)) {
            if ($validated['is_approved'] && !$wasApproved) {
                $validated['approved_at'] = Carbon::now();
                $validated['is_active'] = true;

                Notification::create([
                    'user_id' => $user->id,
                    'type' => 'account_approved',
                    'title' => 'Account approved',
                    'body' => 'Your account has been approved. You can now log in.',
                    'data' => ['user_id' => $user->id],
                ]);
            }
        }

        $user->update($validated);
        return response()->json($user);
    }

    public function destroy($id)
    {
        $user = User::findOrFail($id);
        $user->delete();
        return response()->json(null, 204);
    }
}
