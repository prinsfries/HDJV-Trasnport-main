<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
?>

<?php
$currentPage = basename($_SERVER['PHP_SELF']);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payroll System</title>

    <!-- 🧩 Favicons -->
    <link rel="icon" type="image/x-icon" href="/payroll-system/favicon.ico">
    <link rel="shortcut icon" href="favicon.ico">


    <!-- Bootstrap 4 CSS -->
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">

    <!-- Bootstrap Select CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-select@1.14.0-beta3/dist/css/bootstrap-select.min.css">

    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">


    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>

    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">


    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">


    <!-- Optional: Your custom CSS -->
    <link rel="stylesheet" href="/assets/css/styles.css">

</head>
<body>

<!-- ✅ UNIFIED NAVIGATION BAR - MENU CENTERED -->
<nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
    <div class="container-fluid">

        <!-- BRAND LEFT -->
        <a class="navbar-brand fw-bold" href="/payroll-system/index.php">
            Payroll Dashboard
        </a>

        <!-- MOBILE TOGGLER -->
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span class="navbar-toggler-icon"></span>
        </button>

        <!-- MENU LINKS CENTERED -->
        <div class="collapse navbar-collapse justify-content-center" id="navbarNav">
            <ul class="navbar-nav text-center">
                <li class="nav-item mx-2">
                    <a class="nav-link px-3 <?= ($currentPage == 'upload_attendance.php') ? 'active bg-primary rounded text-white' : 'text-light' ?>" 
                       href="/payroll-system/modules/attendance/upload_attendance.php">
                        Office Attendance
                    </a>
                </li>
                <li class="nav-item mx-2">
                    <a class="nav-link px-3 <?= ($currentPage == 'upload_attendance_biometrics.php') ? 'active bg-primary rounded text-white' : 'text-light' ?>" 
                       href="/payroll-system/modules/attendance/upload_attendance_biometrics.php">
                        Site Attendance
                    </a>
                </li>
                <li class="nav-item mx-2">
                    <a class="nav-link px-3 <?= ($currentPage == 'view_employees.php') ? 'active bg-primary rounded text-white' : 'text-light' ?>" 
                       href="/payroll-system/modules/employees/view_employees.php">
                        Employees
                    </a>
                </li>
                <li class="nav-item mx-2">
                    <a class="nav-link px-3 <?= ($currentPage == 'upload_employee.php') ? 'active bg-primary rounded text-white' : 'text-light' ?>" 
                       href="/payroll-system/upload_employee.php">
                        Profiling/Schedule
                    </a>
                </li>
                <li class="nav-item mx-2">
                    <a class="nav-link px-3 <?= ($currentPage == 'set_holiday.php') ? 'active bg-primary rounded text-white' : 'text-light' ?>" 
                       href="/payroll-system/modules/holidays/set_holiday.php">
                        Set Holiday
                    </a>
                </li>
                <li class="nav-item mx-2">
                    <a class="nav-link px-3 <?= ($currentPage == 'saturday_off.php') ? 'active bg-primary rounded text-white' : 'text-light' ?>" 
                       href="/payroll-system/modules/payroll/saturday_off.php">
                        Saturday Off
                    </a>
                </li>
            </ul>
        </div>

        <!-- ADMIN + LOGOUT RIGHT -->
        <div class="d-flex align-items-center ms-auto">
            <span class="navbar-text text-white me-3">
                <?= isset($_SESSION['admin']) ? $_SESSION['admin'] . ' - Administrator' : ''; ?>
            </span>
            <?php if (isset($_SESSION['admin'])): ?>
                <a href="/payroll-system/logout.php" class="btn btn-outline-light btn-sm">
                    Logout
                </a>
            <?php endif; ?>
        </div>

    </div>
</nav>


<!-- ✅ START FULLSCREEN WRAPPER -->
<div class="fullscreen-container d-flex flex-column" style="height: 100vh;">

