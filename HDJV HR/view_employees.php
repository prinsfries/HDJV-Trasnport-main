<?php
session_start();

if (!isset($_SESSION['admin'])) {
    header("Location: /payroll-system/login.php");
    exit;
}

require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/header.php';

// Fetch all employees ordered by latest first
$result = $conn->query("SELECT * FROM employees ORDER BY id DESC");
$employees = [];
while ($row = $result->fetch_assoc()) {
    $employees[] = $row;
}

// Count totals for stats
$totalEmployees = count($employees);
$activeCount = count(array_filter($employees, fn($e) => strtolower($e['status']) === 'active'));
$inactiveCount = $totalEmployees - $activeCount;

// Fetch unique teams
$teamResult = $conn->query("SELECT DISTINCT team FROM employees WHERE team IS NOT NULL AND team != '' ORDER BY team ASC");
$teams = [];
while ($row = $teamResult->fetch_assoc()) {
    $teams[] = $row['team'];
}

// Fetch unique statuses
$statusResult = $conn->query("SELECT DISTINCT status FROM employees WHERE status IS NOT NULL AND status != '' ORDER BY status ASC");
$statuses = [];
while ($row = $statusResult->fetch_assoc()) {
    $statuses[] = $row['status'];
}

// Fetch unique workparts
$workpartResult = $conn->query("SELECT DISTINCT workpart FROM employees WHERE workpart IS NOT NULL AND workpart != '' ORDER BY workpart ASC");
$workparts = [];
while ($row = $workpartResult->fetch_assoc()) {
    $workparts[] = $row['workpart'];
}

// Prepare status counts for chart
$statusCounts = array_fill_keys($statuses, 0);
foreach ($employees as $emp) {
    $status = $emp['status'];
    if (isset($statusCounts[$status])) {
        $statusCounts[$status]++;
    }
}

// Encode for JS
$statusLabels = json_encode(array_keys($statusCounts));
$statusData = json_encode(array_values($statusCounts));
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>View Employees</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>

  <style>
  body {
    background-color: #f8f9fa;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }

  input#searchInput {
    border-radius: 0.35rem;
    padding-left: 2rem;
    background-image: url("https://cdn-icons-png.flaticon.com/512/622/622669.png");
    background-size: 1rem;
    background-repeat: no-repeat;
    background-position: 0.5rem center;
  }

  table th, table td {
    vertical-align: middle;
    font-size: 14px;
    padding: 0.55rem 0.75rem;
  }

  table th {
    background-color: #343a40;
    color: #fff;
    font-weight: 600;
  }

  table tbody tr:hover {
    background-color: #e9f5ff;
  }

  .table-responsive::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .table-responsive::-webkit-scrollbar-thumb {
    background: #b0b0b0;
    border-radius: 3px;
  }

  .table-responsive::-webkit-scrollbar-track {
    background: #f1f3f6;
  }

  td .preview-img {
  display: none;
  position: absolute;
  top: 50%;
  left: 60px; /* adjust horizontal offset */
  transform: translateY(-50%);
  z-index: 1000;
  border: 1px solid #ccc;
  background: #fff;
  padding: 5px;
  border-radius: 5px;
  box-shadow: 0 0 5px rgba(0,0,0,0.3);
}

td .preview-img img {
  width: 150px; /* size of preview */
  height: 150px;
  object-fit: cover;
  border-radius: 5px;
}

td:hover .preview-img {
  display: block;
}  

#imgPreview {
  display: none;
  position: absolute;
  width: 150px;
  height: 150px;
  object-fit: cover;
  border-radius: 5px;
  border: 1px solid #ccc;
  background: #fff;
  box-shadow: 0 0 5px rgba(0,0,0,0.3);
  z-index: 9999;
}

.table tbody td, .table thead th {
  vertical-align: middle;
  white-space: nowrap;
}


</style>
</head>
<body>

<div class="container-fluid p-4">
  <h2 class="text-primary mb-3 text-center">📋 Employee Master List</h2>

  <!-- Search & Filter & Export -->
  <div class="row mb-3">
    <div class="col-md-3 mb-2">
      <input type="text" id="searchInput" class="form-control" placeholder="🔍 Search employees..." />
    </div>
    <div class="col-md-2 mb-2">
      <select id="statusFilter" class="form-select">
        <option value="">All Status</option>
        <?php foreach ($statuses as $status): ?>
          <option value="<?= htmlspecialchars($status) ?>"><?= htmlspecialchars($status) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="col-md-2 mb-2">
      <select id="teamFilter" class="form-select">
        <option value="">All Teams</option>
        <?php foreach ($teams as $team): ?>
          <option value="<?= htmlspecialchars($team) ?>"><?= htmlspecialchars($team) ?></option>
        <?php endforeach; ?>
      </select>
    </div>

          <!-- 🔽 Package Filter -->
        <div class="col-md-2 mb-2">
        <select id="packageFilter" class="form-select">
          <option value="">All Packages</option>
          <?php
            $packageOptions = array_unique(array_column($employees, 'package'));
            foreach ($packageOptions as $package) {
              if ($package !== '') {
                echo "<option value=\"" . htmlspecialchars($package) . "\">" . htmlspecialchars($package) . "</option>";
              }
            }
          ?>
        </select>
      </div>



    <div class="col-md-2 mb-2">
      <select id="workpartFilter" class="form-select">
        <option value="">All Workparts</option>
        <?php foreach ($workparts as $wp): ?>
          <option value="<?= htmlspecialchars($wp) ?>"><?= htmlspecialchars($wp) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="col-md-3 mb-2">
      <button id="exportBtn" class="btn btn-success w-100">⬇ Export Table</button>
    </div>
  </div>

  <!-- Employee Table -->
  <div class="card shadow-sm">
    <div class="card-body p-3">
      <div class="table-responsive" style="max-height:70vh; overflow-y:auto;">
        <table class="table table-bordered table-hover table-striped align-middle text-nowrap" id="employeeTable">
          <thead class="table-dark sticky-top">
          <tr>
            <th>Profile</th>
            <th>ID</th>
            <th>Badge No</th>
            <th>Job No</th>
            <th>ERP No</th>
            <th>LRS No</th>
            <th>Name</th>
            <th>Team</th>
            <th>Workpart</th>
            <th>Jobtrade</th>
            <th>Category</th>
            <th>Status</th>
            <th>Package</th>
            <th>Rate</th>
          </tr>
          </thead>
          <tbody id="employeeBody">
          <!-- Rows will load here dynamically -->
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- Scripts -->
<script>
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const teamFilter = document.getElementById("teamFilter");
  const workpartFilter = document.getElementById("workpartFilter");
  const tableRows = document.querySelectorAll("#employeeTable tbody tr");

  function filterTable() {
    const search = searchInput.value.toLowerCase();
    const status = statusFilter.value.toLowerCase();
    const team = teamFilter.value.toLowerCase();
    const workpart = workpartFilter.value.toLowerCase();

    tableRows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const rowStatus = row.cells[11].textContent.toLowerCase();
      const rowTeam = row.cells[7].textContent.toLowerCase();
      const rowWorkpart = row.cells[8].textContent.toLowerCase();


      const matchSearch = text.includes(search);
      const matchStatus = !status || rowStatus === status;
      const matchTeam = !team || rowTeam === team;
      const matchWorkpart = !workpart || rowWorkpart === workpart;

      row.style.display = matchSearch && matchStatus && matchTeam && matchWorkpart ? "" : "none";
    });
  }

  searchInput.addEventListener("input", filterTable);
  statusFilter.addEventListener("change", filterTable);
  teamFilter.addEventListener("change", filterTable);
  workpartFilter.addEventListener("change", filterTable);

  // Export logic
  document.getElementById("exportBtn").addEventListener("click", () => {
    const table = document.getElementById("employeeTable");
    const wb = XLSX.utils.table_to_book(table, { sheet: "Employees" });
    XLSX.writeFile(wb, "employee_list.xlsx");
  });
  
  //Hover Profile Picture
  const preview = document.createElement('img');
preview.id = 'imgPreview';
document.body.appendChild(preview);

document.querySelectorAll('.hover-preview').forEach(img => {
  img.addEventListener('mouseenter', e => {
    preview.src = e.target.dataset.src;
    preview.style.display = 'block';
  });
  img.addEventListener('mousemove', e => {
    preview.style.top = (e.pageY + 10) + 'px';
    preview.style.left = (e.pageX + 10) + 'px';
  });
  img.addEventListener('mouseleave', () => {
    preview.style.display = 'none';
  });
});


//package filtering
const packageFilter = document.getElementById("packageFilter");

function performFilter() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const selectedStatus = statusFilter.value.toLowerCase().trim();
  const selectedTeam = teamFilter.value.toLowerCase().trim();
  const selectedWorkpart = workpartFilter.value.toLowerCase().trim();
  const selectedPackage = packageFilter.value.toLowerCase().trim();

  tableRows.forEach(row => {
    const text = row.textContent.toLowerCase();
    const rowStatus = row.cells[10].textContent.toLowerCase().trim();
    const rowPackage = row.cells[11].textContent.toLowerCase().trim();
    const rowTeam = row.cells[7].textContent.toLowerCase().trim();
    const rowWorkpart = row.cells[8].textContent.toLowerCase().trim();

    const matchesSearch = !searchTerm || text.includes(searchTerm);
    const matchesStatus = !selectedStatus || rowStatus === selectedStatus;
    const matchesTeam = !selectedTeam || rowTeam === selectedTeam;
    const matchesWorkpart = !selectedWorkpart || rowWorkpart === selectedWorkpart;
    const matchesPackage = !selectedPackage || rowPackage === selectedPackage;

    row.style.display = (matchesSearch && matchesStatus && matchesTeam && matchesWorkpart && matchesPackage) ? "" : "none";
  });
}

// Call filterTable and performFilter together on any change
searchInput.addEventListener("input", performFilter);
statusFilter.addEventListener("change", performFilter);
teamFilter.addEventListener("change", performFilter);
workpartFilter.addEventListener("change", performFilter);
packageFilter.addEventListener("change", performFilter);

// === Lazy Loading Setup ===
// === Combined Lazy Loading + Filtering ===
let offset = 0;
const limit = 50;
let loading = false;
let hasMoreData = true;

// Gather filter values
function getFilterParams() {
  const search = document.getElementById("searchInput").value.trim();
  const status = document.getElementById("statusFilter").value.trim();
  const team = document.getElementById("teamFilter").value.trim();
  const workpart = document.getElementById("workpartFilter").value.trim();
  const packageVal = document.getElementById("packageFilter").value.trim();

  const params = new URLSearchParams({
    offset,
    search,
    status,
    team,
    workpart,
    package: packageVal
  });

  return params.toString();
}

async function loadEmployees(reset = false) {
  if (loading || (!hasMoreData && !reset)) return;
  loading = true;

  if (reset) {
    offset = 0;
    hasMoreData = true;
    document.getElementById('employeeBody').innerHTML = '';
  }

  const response = await fetch(`fetch_employees.php?${getFilterParams()}`);
  const data = await response.json();

  if (data.length === 0) {
    hasMoreData = false;
    loading = false;
    return;
  }

  const tbody = document.getElementById('employeeBody');
  data.forEach(emp => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        ${emp.profile_pic ? 
          `<img src="${emp.profile_pic}" alt="Profile" style="width:40px;height:40px;border-radius:50%;">` :
          `<img src="https://via.placeholder.com/40" alt="No Image" style="border-radius:50%;">`
        }
      </td>
      <td>${emp.id}</td>
      <td>${emp.badge_no ?? ''}</td>
      <td>${emp.job_no ?? ''}</td>
      <td>${emp.erp_no ?? ''}</td>
      <td>${emp.lrs_no ?? ''}</td>
      <td>${emp.name ?? ''}</td>
      <td>${emp.team ?? ''}</td>
      <td>${emp.workpart ?? ''}</td>
      <td>${emp.jobtrade ?? ''}</td>
      <td>${emp.category ?? ''}</td>
      <td>${emp.status ?? ''}</td>
      <td>${emp.package ?? ''}</td>
      <td>${emp.rate ?? ''}</td>
    `;
    tbody.appendChild(tr);
  });

  offset += limit;
  loading = false;
}

// === Lazy load on scroll ===
document.querySelector('.table-responsive').addEventListener('scroll', function() {
  if (this.scrollTop + this.clientHeight >= this.scrollHeight - 50) {
    loadEmployees();
  }
});

// === Filter trigger ===
["searchInput", "statusFilter", "teamFilter", "workpartFilter", "packageFilter"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => loadEmployees(true));
  document.getElementById(id).addEventListener("change", () => loadEmployees(true));
});

// Initial load
loadEmployees();


</script>
</body>
</html>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
