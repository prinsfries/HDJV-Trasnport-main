<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class UserSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the users table with 100+ records.
     */
    public function run(): void
    {
        $firstNames = [
            'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
            'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua',
            'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Jason', 'Edward', 'Jeffrey', 'Ryan',
            'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon',
            'Benjamin', 'Samuel', 'Gregory', 'Frank', 'Alexander', 'Raymond', 'Patrick', 'Jack', 'Dennis', 'Jerry',
            'Tyler', 'Aaron', 'Jose', 'Adam', 'Henry', 'Nathan', 'Douglas', 'Zachary', 'Peter', 'Kyle',
            'Walter', 'Ethan', 'Jeremy', 'Harold', 'Keith', 'Christian', 'Noah', 'Bryan', 'Mason', 'Roger',
            'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen',
            'Lisa', 'Nancy', 'Betty', 'Helen', 'Sandra', 'Donna', 'Carol', 'Ruth', 'Sharon', 'Michelle',
            'Laura', 'Sarah', 'Kimberly', 'Deborah', 'Dorothy', 'Amy', 'Angela', 'Ashley', 'Brenda', 'Emma',
            'Olivia', 'Cynthia', 'Marie', 'Janet', 'Catherine', 'Frances', 'Christine', 'Samantha', 'Debra', 'Rachel'
        ];

        $lastNames = [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
            'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
            'Lee', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
            'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green',
            'Adams', 'Baker', 'Gonzalez', 'Nelson', 'Carter', 'Mitchell', 'Perez', 'Roberts', 'Turner', 'Phillips',
            'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Sanchez', 'Morris', 'Rogers', 'Reed',
            'Cook', 'Morgan', 'Bell', 'Murphy', 'Bailey', 'Rivera', 'Cooper', 'Richardson', 'Cox', 'Howard',
            'Ward', 'Torres', 'Peterson', 'Gray', 'Ramirez', 'James', 'Watson', 'Brooks', 'Kelly', 'Sanders'
        ];

        $roles = ['kradmin', 'gaadmin', 'driver', 'passenger', 'krpassenger'];
        $statuses = [true, false];
        $approvals = [true, false];

        // Create 1000 users
        for ($i = 1; $i <= 1000; $i++) {
            $firstName = $firstNames[array_rand($firstNames)];
            $lastName = $lastNames[array_rand($lastNames)];
            $role = $roles[array_rand($roles)];
            $isActive = $statuses[array_rand($statuses)];
            $isApproved = $approvals[array_rand($approvals)];

            if (!$isApproved) {
                $isActive = false;
            }
            
            $username = strtolower($firstName . '.' . $lastName . $i);
            $email = $username . '@hdjv.com';
            $contact = '09' . str_pad(rand(100000000, 999999999), 9, '0', STR_PAD_LEFT);
            
            // Generate default password based on lastname and date
            $defaultPassword = strtolower($lastName) . now()->format('mdY');
            
            User::create([
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $email,
                'username' => $username,
                'password' => Hash::make($defaultPassword),
                'default_password' => $defaultPassword,
                'password_changed' => false,
                'is_active' => $isActive,
                'is_approved' => $isApproved,
                'approved_at' => $isApproved ? now() : null,
                'role' => $role,
                'contact' => $contact,
            ]);
        }

        // Add specific admin users
        $adminUsers = [
            [
                'first_name' => 'Kradmin',
                'last_name' => 'User',
                'email' => 'kradmin@hdjv.com',
                'username' => 'kradmin',
                'default_password' => 'kradmin123',
                'role' => 'kradmin',
                'contact' => '09000000000',
            ],
            [
                'first_name' => 'Gaadmin',
                'last_name' => 'User',
                'email' => 'gaadmin@hdjv.com',
                'username' => 'gaadmin',
                'default_password' => 'gaadmin123',
                'role' => 'gaadmin',
                'contact' => '09000000001',
            ],
        ];

        foreach ($adminUsers as $userData) {
            User::create([
                'first_name' => $userData['first_name'],
                'last_name' => $userData['last_name'],
                'email' => $userData['email'],
                'username' => $userData['username'],
                'password' => Hash::make($userData['default_password']),
                'default_password' => $userData['default_password'],
                'password_changed' => false,
                'is_active' => true,
                'is_approved' => true,
                'approved_at' => now(),
                'role' => $userData['role'],
                'contact' => $userData['contact'],
            ]);
        }

        // Add specific passenger users
        $passengerUsers = [
            [
                'first_name' => 'Test',
                'last_name' => 'Passenger',
                'email' => 'passenger@hdjv.com',
                'username' => 'passenger',
                'default_password' => 'passenger123',
                'role' => 'passenger',
                'contact' => '09000000002',
            ],
            [
                'first_name' => 'Test',
                'last_name' => 'Krpassenger',
                'email' => 'krpassenger@hdjv.com',
                'username' => 'krpassenger',
                'default_password' => 'krpassenger123',
                'role' => 'krpassenger',
                'contact' => '09000000003',
            ],
            [
                'first_name' => 'Test',
                'last_name' => 'Driver',
                'email' => 'driver@hdjv.com',
                'username' => 'driver',
                'default_password' => 'driver123',
                'role' => 'driver',
                'contact' => '09000000004',
            ],
        ];

        foreach ($passengerUsers as $userData) {
            $isApproved = (bool) random_int(0, 1);
            $isActive = $isApproved;
            User::create([
                'first_name' => $userData['first_name'],
                'last_name' => $userData['last_name'],
                'email' => $userData['email'],
                'username' => $userData['username'],
                'password' => Hash::make($userData['default_password']),
                'default_password' => $userData['default_password'],
                'password_changed' => false,
                'is_active' => $isActive,
                'is_approved' => $isApproved,
                'approved_at' => $isApproved ? now() : null,
                'role' => $userData['role'],
                'contact' => $userData['contact'],
            ]);
        }
    }
}
