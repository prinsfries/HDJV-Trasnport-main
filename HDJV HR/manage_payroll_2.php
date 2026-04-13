<?php
// ---------------------- Top of file ----------------------
ob_start();
session_start();
require_once "../../includes/db.php";
require_once "../../includes/header.php";

error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING); // suppress notices/warnings


// ----------------- Helper: round hours for payroll -----------------
function round_hours_for_payroll($hours) {
    $whole = floor($hours);
    $fraction = $hours - $whole;

    if ($fraction < 0.3) return $whole;       // anything < 0.3 → round down
    if ($fraction < 0.8) return $whole + 0.5; // 0.3 ≤ fraction < 0.8 → 0.5
    return $whole + 1;                         // fraction ≥ 0.8 → next whole
}

function is_half_day_note($note) {
    if (!$note) return false;

    // normalize: lowercase + remove non-letters
    $normalized = strtolower($note);
    $normalized = preg_replace('/[^a-z]/', '', $normalized);

    // catch all variants: halfday, halfdya, halfleave, etc.
    return strpos($normalized, 'half') !== false;
}


// ----------------- Helper: adjust_time_in_for_shift -----------------
function adjust_time_in_for_shift($time_in, $shift) {
    if (!$time_in) return ['real' => null, 'adjusted' => null];

    $in_dt = DateTime::createFromFormat('Y-m-d H:i:s', $time_in);
    if (!$in_dt) $in_dt = DateTime::createFromFormat('Y-m-d H:i', $time_in);
    if (!$in_dt) return ['real' => $time_in, 'adjusted' => $time_in];

    if (!$shift) {
        return ['real' => $in_dt->format('Y-m-d H:i:s'), 'adjusted' => $in_dt->format('Y-m-d H:i:s')];
    }

    $parts = explode('-', $shift);
    if (count($parts) !== 2) return ['real' => $in_dt->format('Y-m-d H:i:s'), 'adjusted' => $in_dt->format('Y-m-d H:i:s')];

    $shift_start = DateTime::createFromFormat('g:i A', trim($parts[0]));
    if (!$shift_start) return ['real' => $in_dt->format('Y-m-d H:i:s'), 'adjusted' => $in_dt->format('Y-m-d H:i:s')];

    // Align shift start to the same date as time_in
    $shift_start->setDate((int)$in_dt->format('Y'), (int)$in_dt->format('m'), (int)$in_dt->format('d'));

    // RULE: if early → adjust to shift start, else keep actual
    $adjusted = ($in_dt < $shift_start) ? $shift_start : $in_dt;

    return [
        'real'     => $in_dt->format('Y-m-d H:i:s'),
        'adjusted' => $adjusted->format('Y-m-d H:i:s')
    ];
}

function get_saturdays_in_month($year,$month){
    $saturdays=[];$d=new DateTime("$year-$month-01");
    while($d->format('m')==$month){if($d->format('N')==6)$saturdays[]=$d->format('Y-m-d');$d->modify('+1 day');}
    return $saturdays;
}

function get_saturday_type_241($date){
    $saturdays=get_saturdays_in_month($date->format('Y'),$date->format('m'));
    $pattern=['off_fixed_ot','half_day','off_fixed_ot','half_day'];
    foreach($saturdays as $idx=>$sat){if($sat==$date->format('Y-m-d')) return $pattern[$idx]??'regular';}
    return 'regular';
}

function is_saturday_off($date_str, $monthly_hours, $badge_no = null, $conn = null) {
    $d = new DateTime($date_str);
    if ($d->format('N') != 6) return false; // Not Saturday

    if ($monthly_hours == 273) return false; // always work
    if ($monthly_hours == 252 && $badge_no && $conn) {
        $stmt = $conn->prepare("SELECT 1 FROM employee_saturdays WHERE badge_no=? AND DATE(date)=? LIMIT 1");
        $date_only = $d->format('Y-m-d'); 
        $stmt->bind_param('ss', $badge_no, $date_only); 
        $stmt->execute();
        return $stmt->get_result()->num_rows > 0;
    }

    // Updated: 241 monthly hours also checks database for off Saturdays
    if ($monthly_hours == 241 && $badge_no && $conn) {
        $stmt = $conn->prepare("SELECT 1 FROM employee_saturdays WHERE badge_no=? AND DATE(date)=? LIMIT 1");
        $date_only = $d->format('Y-m-d'); 
        $stmt->bind_param('ss', $badge_no, $date_only); 
        $stmt->execute();
        return $stmt->get_result()->num_rows > 0;
    }

    if ($monthly_hours == 231) return true; // all Saturdays off
    return false;
}

function calculate_payroll_full(
    $work_date,
    $total_hours,
    $rate_per_hour,
    $monthly_hours,
    $badge_no = null,
    $conn = null,
    $holiday_type = null,
    $is_night_diff = false,
    $mins_late = 0,
    $undertime_hours = 0,
    $absent_days = 0
) {
    $date = new DateTime($work_date);
    $dow = $date->format('N'); // 1=Mon, 7=Sun

    $regular_hours = $fixed_ot_hours = $extra_ot_hours = 0;
    $basic_pay = $fixed_ot_pay = $extra_ot_pay = 0;
    
    // ------------------- Rate per day & cutoff -------------------
    $basic = $rate_per_hour * 8;           
    $fixed_ot = $rate_per_hour * 2 * 1.25; 
    $rate_per_day = $basic + $fixed_ot;

    // Compute total monthly rate (for cutoff calculation)
    $rate = $rate_per_hour * $monthly_hours;
    $rate_per_cutoff = $rate / 2;

    // ------------------- Determine base hours -------------------
    if ($dow == 6) { // Saturday
        $sat_off = is_saturday_off($work_date, $monthly_hours, $badge_no, $conn);
        if ($sat_off) {
            $regular_hours = min(8, $total_hours);
            $ot_hours = max(0, $total_hours - 8);

            $basic_pay = $regular_hours * $rate_per_hour * 1.3;
            $extra_ot_hours = $ot_hours;
            $extra_ot_pay = $extra_ot_hours * $rate_per_hour * 1.3 * 1.3;

        } else {
            $sched_reg = ($monthly_hours == 241) ? (get_saturday_type_241($date) == 'half_day' ? 5 : 8) : 8;
            $regular_hours = min($total_hours, $sched_reg);
            $fixed_ot_hours = max(0, $total_hours - $regular_hours);

            $basic_pay = $regular_hours * $rate_per_hour;
            $fixed_ot_pay = $fixed_ot_hours * $rate_per_hour * 1.25;
        }

    } elseif ($dow == 7) { // Sunday
        $regular_hours = min(8, $total_hours);
        $ot_hours = max(0, $total_hours - 8);

        $basic_pay = $regular_hours * $rate_per_hour * 1.3;
        $extra_ot_hours = $ot_hours;
        $extra_ot_pay = $extra_ot_hours * $rate_per_hour * 1.3 * 1.3;

    } else { // Weekday
        $regular_hours = min(8, $total_hours);
        $fixed_ot_hours = ($total_hours > 0) ? 2 : 0; // permanent 2 if present
        $extra_ot_hours = max(0, $total_hours - 10);

        $basic_pay = $regular_hours * $rate_per_hour;
        $fixed_ot_pay = $fixed_ot_hours * $rate_per_hour * 1.25;
        $extra_ot_pay = $extra_ot_hours * $rate_per_hour * 1.25;
    }

    // ------------------- Apply holiday / special rules -------------------
    if ($holiday_type) {
        switch ($holiday_type) {
            case 'special':
                $basic_pay = $regular_hours * $rate_per_hour * 0.3;
                $fixed_ot_pay = $fixed_ot_hours * $rate_per_hour * 1.3 * 1.3;
                break;

            case 'special_sunday':
                $basic_pay = $regular_hours * $rate_per_hour * 1.5;
                $fixed_ot_pay = $fixed_ot_hours * $rate_per_hour * 1.5 * 1.3;
                break;

            case 'legal':
                $basic_pay = $regular_hours * $rate_per_hour * 1.0;
                $fixed_ot_pay = $fixed_ot_hours * $rate_per_hour * 2 * 1.3;
                // Add rate per day bonus
                $basic_pay += $rate_per_day;
                break;

            case 'legal_sunday':
                $basic_pay = $regular_hours * $rate_per_hour * 1.5;
                $fixed_ot_pay = $fixed_ot_hours * $rate_per_hour * 1.5 * 1.3;
                // Add rate per day bonus
                $basic_pay += $rate_per_day;
                break;

            case 'service_incentive':
                $basic_pay = $regular_hours * $rate_per_hour;
                $fixed_ot_pay = $fixed_ot_hours * $rate_per_hour;
                break;
        }
    }

    // ------------------- Apply Night Differential -------------------
    if ($is_night_diff) {
        $basic_pay += $regular_hours * $rate_per_hour * 0.10;

        if ($dow == 7 || in_array($holiday_type, ['special_sunday', 'legal_sunday'])) {
            $fixed_ot_pay += $fixed_ot_hours * $rate_per_hour * 1.3 * 0.10;
            $extra_ot_pay += $extra_ot_hours * $rate_per_hour * 1.3 * 1.3 * 0.10;
        } else {
            $fixed_ot_pay += $fixed_ot_hours * $rate_per_hour * 1.25 * 0.10;
            $extra_ot_pay += $extra_ot_hours * $rate_per_hour * 1.25 * 0.10;
        }
    }

    // ------------------- Monetary Late Deduction -------------------
    $rate_per_minute = $rate_per_hour / 60;
    $late_deduction = $rate_per_minute * $mins_late;
    $undertime_deduction = $rate_per_hour * $undertime_hours;
    $absent_deduction = $absent_days * $rate_per_day;
    

    // ------------------- Final Gross Pay -------------------
    $gross_pay = round($basic_pay + $fixed_ot_pay + $extra_ot_pay - $late_deduction - $undertime_deduction - $absent_deduction, 2);

    // ------------------- Return Values -------------------
    return [
        'basic_hours' => $regular_hours,
        'fixed_ot_hours' => $fixed_ot_hours,
        'additional_ot_hours' => $extra_ot_hours,
        'basic_pay' => round($basic_pay, 2),
        'fixed_ot_pay' => round($fixed_ot_pay, 2),
        'extra_ot_pay' => round($extra_ot_pay, 2),
        'gross_pay' => $gross_pay,
        'rate_per_day' => round($rate_per_day, 2),
        'rate_per_cutoff' => round($rate_per_cutoff, 2),
        'rate_per_minute' => round($rate_per_minute, 4),
        'late_deduction' => round($late_deduction, 2),
        'undertime_deduction' => round($undertime_deduction, 2),
        'absent_deduction' => round($absent_deduction, 2)
    ];
}


function get_cutoff_date_range($month,$cutoff){
    $start=date('Y-m-01',strtotime($month));
    if($cutoff==='1st') $end=date('Y-m-15',strtotime($month));
    else {$start=date('Y-m-16',strtotime($month)); $end=date('Y-m-t',strtotime($month));}
    return [$start,$end];
}

// ----------------- Inputs -----------------
$month=$_GET['month']??date('Y-m');
$cutoff=$_GET['cutoff']??'1st';
$team=$_GET['team']??'';
list($start_date,$end_date)=get_cutoff_date_range($month,$cutoff);

// ================== GLOBAL LEAVE MAP (ONCE ONLY) ==================
$leaveMap = [];

$sqlLeave = "
    SELECT badge_no, start_date, end_date, note, leave_type
    FROM leave_requests
    WHERE (
        start_date BETWEEN ? AND ?
        OR end_date BETWEEN ? AND ?
        OR (? BETWEEN start_date AND end_date)
        OR (? BETWEEN start_date AND end_date)
    )
";

$stmtLeave = $conn->prepare($sqlLeave);
if (!$stmtLeave) {
    die("Prepare failed (leave_requests): " . $conn->error);
}

$stmtLeave->bind_param(
    'ssssss',
    $start_date,
    $end_date,
    $start_date,
    $end_date,
    $start_date,
    $end_date
);

$stmtLeave->execute();
$resLeave = $stmtLeave->get_result();

while ($row = $resLeave->fetch_assoc()) {

    $empNo = (int)$row['badge_no'];
    $note  = $row['note'] ?? '';
    $type  = strtolower(trim($row['leave_type'] ?? ''));

    $start = new DateTime($row['start_date']);
    $end   = new DateTime($row['end_date']);

    // expand leave into daily entries
    while ($start <= $end) {
        $date = $start->format('Y-m-d');

        $leaveMap[$empNo][$date] = [
            'note'       => $note,
            'leave_type' => $type,
        ];

        $start->modify('+1 day');
    }
}
// ================================================================


// ----------------- Build employee list -----------------
$where=["status='active'"];
$params=[];$types='';
if($team){$where[]="team=?";$params[]=$team;$types.='s';}
$where_sql=implode(' AND ',$where);
$sql="SELECT badge_no,name,job_no,jobtrade,rate,monthly_hours,team,shift FROM employees WHERE $where_sql AND rate >= 10000 ORDER BY name ASC";
$stmt=$conn->prepare($sql);
if($types)$stmt->bind_param($types,...$params);
$stmt->execute();$res=$stmt->get_result();$employees=[];
while($row=$res->fetch_assoc()) $employees[]=$row;

// ----------------- Minimal Employee & Teams Setup -----------------
$total_employees = count($employees);
$total_payroll = 0.0;

// ---------- Fetch Absent Days (including On Leave) ----------
$absent_days_all = [];
$sqlAbsent = "
    SELECT employee_no, COUNT(*) AS absent_days
    FROM attendance_records
    WHERE (status = 'Absent' OR status = 'On Leave')
      AND date BETWEEN ? AND ?
    GROUP BY employee_no
";
$stmtAbsent = $conn->prepare($sqlAbsent);
$stmtAbsent->bind_param('ss', $start_date, $end_date);
$stmtAbsent->execute();
$resAbsent = $stmtAbsent->get_result();

// Make sure keys are cast to int
while ($row = $resAbsent->fetch_assoc()) {
    $absent_days_all[intval($row['employee_no'])] = intval($row['absent_days']);
}

// Merge results into $employees array
foreach ($employees as $idx => $emp) {
    $emp_no = intval($emp['badge_no']);
    $absent = $absent_days_all[$emp_no] ?? 0;

    // 🔥 SUBTRACT HALF-DAY LEAVES FROM ABSENT
    if (!empty($leaveMap[$emp_no])) {
        foreach ($leaveMap[$emp_no] as $date => $leave) {
            if (is_half_day_note($leave['note'])) {
                $absent = max(0, $absent - 1);
            }
        }
    }

    $employees[$idx]['absent_days'] = $absent;
}



// ---------- Fetch Days Worked ----------

foreach ($employees as $idx => $emp) {
    $emp_no = intval($emp['badge_no']);
    $days_worked = 0;

    // Fetch attendance records for the cutoff period
    $sqlWork = "SELECT date, status 
                FROM attendance_records 
                WHERE employee_no = ? 
                  AND date BETWEEN ? AND ?";
    $stmtWork = $conn->prepare($sqlWork);
    $stmtWork->bind_param('iss', $emp_no, $start_date, $end_date);
    $stmtWork->execute();
    $resWork = $stmtWork->get_result();

    while ($row = $resWork->fetch_assoc()) {
        $status = strtolower(trim($row['status']));

        // Skip Absent
        if (strpos($status, 'absent') !== false) continue;

        // Skip Rest Day
        if (strpos($status, 'rest day') !== false) continue;

        // Skip On Leave unless it is Leave With Pay
        if (strpos($status, 'on leave') !== false && strpos($status, 'leave with pay') === false) continue;

        // Count as worked if Leave With Pay or anything else
        $days_worked++;
    }

    $employees[$idx]['days_worked'] = $days_worked;
}


// Helper: round down DateTime to nearest 30 minutes
function roundDownToNearestHalfHour(DateTime $dt) {
    $minutes = (int)$dt->format('i');
    $hour = (int)$dt->format('H');
    $rounded_min = ($minutes < 30) ? 0 : 30;
    $dt->setTime($hour, $rounded_min, 0);
    return $dt;
}

// ---------- Fetch Basic Hours ----------
foreach ($employees as $idx => $emp) {
    $emp_no = intval($emp['badge_no']);
    $total_basic_hours = 0;
    $daily_basic = [];

    $sqlBasic = "SELECT date, time_in, out_date, time_out, shift, status
                 FROM attendance_records
                 WHERE employee_no = ? AND date BETWEEN ? AND ?";
    $stmtBasic = $conn->prepare($sqlBasic);
    $stmtBasic->bind_param('iss', $emp_no, $start_date, $end_date);
    $stmtBasic->execute();
    $resBasic = $stmtBasic->get_result();

    while ($row = $resBasic->fetch_assoc()) {
       $status = trim($row['status'] ?? '');

        // Special / Regular / Leave With Pay
        $normalized = preg_replace('/\s+/', ' ', strtolower($status));

        if (
            $normalized === 'special non-working with pay' ||
            $normalized === 'regular' ||
            $normalized === 'leave with pay'
        ) {
            $daily_basic[$row['date']] = "10 hrs (" . $status . ")";
            $total_basic_hours += 10;
            continue;
        }

        
        // Skip invalid logs only for normal working days
        if (empty($row['time_in']) || empty($row['time_out']) ||
            $row['time_in'] === '00:00:00' || $row['time_out'] === '00:00:00') {
            continue;
        }

        // Skip non-working days
        if (
            strpos($status, 'saturday off') !== false ||
            strpos($status, 'restday') !== false
        ) continue;

        // Determine shift
        $shift_start_str = '07:00 AM';
        $shift_end_str   = '06:00 PM';
        if (!empty($row['shift']) && strpos($row['shift'], '-') !== false) {
            list($shift_start_str, $shift_end_str) = explode('-', $row['shift']);
            $shift_start_str = trim($shift_start_str);
            $shift_end_str   = trim($shift_end_str);
        }

        $shift_start = new DateTime($row['date'] . ' ' . $shift_start_str);
        $shift_end   = new DateTime($row['date'] . ' ' . $shift_end_str);
        if ($shift_end < $shift_start) $shift_end->modify('+1 day');

        // Use shift start/end instead of actual clock-in/out
        $worked_start = clone $shift_start;
        $worked_end   = clone $shift_end;

        // Deduct lunch if overlap
        $shift_hours = ($shift_end->getTimestamp() - $shift_start->getTimestamp()) / 3600;
        if ($shift_hours >= 6) {
            $break_start = clone $shift_start;
            $break_start->modify('+5 hours');
            $break_end = clone $break_start;
            $break_end->modify('+1 hour');

            $overlap_start = max($worked_start->getTimestamp(), $break_start->getTimestamp());
            $overlap_end   = min($worked_end->getTimestamp(), $break_end->getTimestamp());
            if ($overlap_end > $overlap_start) {
                $worked_minutes = ($worked_end->getTimestamp() - $worked_start->getTimestamp()) / 60;
                $worked_minutes -= ($overlap_end - $overlap_start) / 60;
            } else {
                $worked_minutes = ($worked_end->getTimestamp() - $worked_start->getTimestamp()) / 60;
            }
        } else {
            $worked_minutes = ($worked_end->getTimestamp() - $worked_start->getTimestamp()) / 60;
        }

        // Convert to hr:min
        $hours = floor($worked_minutes / 60);
        $minutes = round($worked_minutes % 60);
        $formatted_basic = sprintf("%d hr%s %d min%s",
            $hours, ($hours != 1 ? "s" : ""), $minutes, ($minutes != 1 ? "s" : "")
        );

        $daily_basic[$row['date']] = $formatted_basic;
        $total_basic_hours += $worked_minutes / 60;
    }

    $employees[$idx]['basic_hours'] = round($total_basic_hours, 2);
    $employees[$idx]['daily_basic_hours'] = $daily_basic;
}


// ---------- Fetch Overtime Hours (Categorized but Display as Total) ----------
foreach ($employees as $idx => $emp) {
    $emp_no = intval($emp['badge_no']);
    $daily_ot = [];

    // 🟢 Separate accumulators
    $ot_regular = 0;
    $ot_saturday_off = 0;
    $ot_special_holiday = 0;
    $ot_regular_holiday = 0;

    // ---------- Attendance OT ----------
    $sqlOT = "SELECT date, out_date, time_in, time_out, shift, status
              FROM attendance_records
              WHERE employee_no = ? AND date BETWEEN ? AND ?";
    $stmtOT = $conn->prepare($sqlOT);
    $stmtOT->bind_param('iss', $emp_no, $start_date, $end_date);
    $stmtOT->execute();
    $resOT = $stmtOT->get_result();

    // ---------- Early In Requests ----------
    $earlyInMap = [];
    $sqlEI = "SELECT early_in_date, early_in_time FROM early_in_requests 
              WHERE badge_no = ? AND status = 'Approved' 
              AND early_in_date BETWEEN ? AND ?";
    $stmtEI = $conn->prepare($sqlEI);
    $stmtEI->bind_param('sss', $emp_no, $start_date, $end_date);
    $stmtEI->execute();
    $resEI = $stmtEI->get_result();
    while ($rowEI = $resEI->fetch_assoc()) {
        $earlyInMap[$rowEI['early_in_date']] = $rowEI['early_in_time'];
    }

    while ($row = $resOT->fetch_assoc()) {
        $status = strtolower(trim($row['status']));
        if (empty($row['time_out']) || $row['time_out'] === '00:00:00') continue;

        // --- Default shift ---
        $shift_start_str = '07:00 AM';
        $shift_end_str   = '06:00 PM';
        if (!empty($row['shift']) && strpos($row['shift'], '-') !== false) {
            list($shift_start_str, $shift_end_str) = explode('-', $row['shift']);
            $shift_start_str = trim($shift_start_str);
            $shift_end_str   = trim($shift_end_str);
        }

        $ot_decimal = 0;


       // 🟣 CASE 1: Saturday Off or Restday/Sunday OT (hour-based, no minute rounding)
        if (strpos(strtolower($status), 'saturday off') !== false ||
                strpos(strtolower($status), 'restday/sunday ot') !== false) {
            
                if (!empty($row['time_in']) && !empty($row['time_out'])) {
    
            // --- Shift start and end (as timestamps) ---
            $shift_start_ts = strtotime($row['date'] . ' ' . $shift_start_str);
            $shift_end_ts   = strtotime($row['date'] . ' ' . $shift_end_str);
    
            // If shift_end is logically before shift_start (overnight shift), add 1 day
            if ($shift_end_ts <= $shift_start_ts) {
                $shift_end_ts += 24 * 3600;
            }
    
            // --- Actual IN/OUT ---
            $in_ts  = strtotime($row['date'] . ' ' . $row['time_in']);
            $out_ts = strtotime($row['out_date'] . ' ' . $row['time_out']);
    
            // If out_ts < in_ts, assume out is next day
            if ($out_ts <= $in_ts) {
                $out_ts += 24 * 3600;
            }
    
            // --- Clip worked interval: shift start is lower bound, actual out is upper bound ---
            $work_start = max($in_ts, $shift_start_ts);
            $work_end   = $out_ts; // <-- use actual out time
    
            $worked_hours = 0;
            if ($work_end > $work_start) {
                $worked_hours = ($work_end - $work_start) / 3600.0;
            }
    
            // --- Break deduction if applicable (shift >= 6h) ---
            $shift_hours = ($shift_end_ts - $shift_start_ts) / 3600.0;
            if ($shift_hours >= 6 && $worked_hours > 0) {
                $break_start_ts = $shift_start_ts + 5 * 3600; // break starts 5h after shift start
                $break_end_ts   = $break_start_ts + 3600;    // 1h break
    
                // overlap between worked interval and break
                $break_overlap_start = max($work_start, $break_start_ts);
                $break_overlap_end   = min($work_end, $break_end_ts);
                $break_hours = max(0, ($break_overlap_end - $break_overlap_start) / 3600.0);
    
                // Deduct break
                $worked_hours = max(0, $worked_hours - $break_hours);
            }
    
            // --- Round down to nearest 0.5 hour ---
            $ot_decimal = max(0, floor($worked_hours * 2) / 2);
    
            // --- Accumulate Saturday OT ---
            $ot_saturday_off += $ot_decimal;
        }
    }



        // 🟢 CASE 2: Regular OT (Before + After Shift)
        if (!empty($row['time_in']) && !empty($row['time_out'])) {
            $shift_start_ts = strtotime($row['date'] . ' ' . $shift_start_str);
            $shift_end_ts   = strtotime($row['date'] . ' ' . $shift_end_str);
            $actual_in_ts   = strtotime($row['date'] . ' ' . $row['time_in']);
            $actual_out_ts  = strtotime($row['out_date'] . ' ' . $row['time_out']);

            // ----- Early In Before Shift -----
            if (isset($earlyInMap[$row['date']])) {
                $early_in_ts = strtotime($row['date'] . ' ' . $earlyInMap[$row['date']]);
                if ($early_in_ts < $shift_start_ts) {
                    $minutes_before_shift = ($shift_start_ts - $early_in_ts) / 60;
                    $ot_decimal = floor(($minutes_before_shift / 60) * 2) / 2;
                    $ot_regular += $ot_decimal;
                }
            }
        
                // ----- OT After Shift -----
                // ✅ Count only if status = 'Overtime'
                $status_clean = strtolower(trim($row['status']));
                if (($status_clean === 'overtime' || $status_clean === 'undertime + overtime') 
                && $actual_out_ts > $shift_end_ts) {
            
                $minutes_after_shift = ($actual_out_ts - $shift_end_ts) / 60;
                if ($minutes_after_shift >= 30) {
                    $ot_decimal = floor(($minutes_after_shift / 60) * 2) / 2;
                    $ot_regular += $ot_decimal;
                }
            }

            }

         $raw_status = trim($row['status'] ?? '');
        $normalized_status = strtolower(preg_replace('/\s+/', ' ', $raw_status));

        // 🔵 Special OT (only for exact "Special Non-Working Worked")
        if ($normalized_status === "special non-working worked") {
            if (!empty($row['time_in']) && !empty($row['time_out'])) {
                $in_ts  = strtotime($row['date'] . ' ' . $row['time_in']);
                $out_ts = strtotime($row['out_date'] . ' ' . $row['time_out']);
        
                // Identify shift length
                $shift_start_ts = strtotime($row['date'] . ' ' . $shift_start_str);
                $shift_end_ts   = strtotime($row['date'] . ' ' . $shift_end_str);
                $shift_hours = ($shift_end_ts - $shift_start_ts) / 3600;
        
                // Deduct break if shift >= 6 hrs
                if ($shift_hours >= 6) {
                    $break_start_ts = $shift_start_ts + 5 * 3600;
                    $break_end_ts   = $break_start_ts + 3600;
        
                    if ($in_ts < $break_end_ts && $out_ts > $break_start_ts) {
                        $overlap_start = max($in_ts, $break_start_ts);
                        $overlap_end   = min($out_ts, $break_end_ts);
                        $break_minutes = ($overlap_end - $overlap_start) / 60;
                        $worked_minutes = ($out_ts - $in_ts) / 60 - $break_minutes;
                    } else {
                        $worked_minutes = ($out_ts - $in_ts) / 60;
                    }
                } else {
                    $worked_minutes = ($out_ts - $in_ts) / 60;
                }
        
                // Convert to OT hours (rounded down to nearest 0.5)
                $ot_decimal = max(0, floor(($worked_minutes / 60) * 2) / 2);
        
                // Accumulate OT
                $ot_special_holiday += $ot_decimal;
        
            } else {
                // No clock in/out → OT is 0
                $ot_decimal = 0;
            }
        
            // Store daily breakdown
            $daily_ot[$row['date']] = [
                'ot_decimal' => $ot_decimal,
                'status'     => ucfirst($row['status'])
            ];
        
        } else {
            // For all other statuses (Regular Work, etc.)
            // Do NOT compute OT, but still store in daily breakdown
            $daily_ot[$row['date']] = [
                'ot_decimal' => 0,
                'status'     => ucfirst($row['status'])
            ];
        }


        
        // 🔴 Regular Holiday
        if ($status === "regular worked") {
            if (!empty($row['time_in']) && !empty($row['time_out'])) {
                $in_ts  = strtotime($row['date'] . ' ' . $row['time_in']);
                $out_ts = strtotime($row['out_date'] . ' ' . $row['time_out']);
        
                // Identify shift length
                $shift_start_ts = strtotime($row['date'] . ' ' . $shift_start_str);
                $shift_end_ts   = strtotime($row['date'] . ' ' . $shift_end_str);
                $shift_hours = ($shift_end_ts - $shift_start_ts) / 3600;
        
                // Deduct break if shift >= 6 hrs
                if ($shift_hours >= 6) {
                    $break_start_ts = $shift_start_ts + 5 * 3600;  // 5 hours after start
                    $break_end_ts   = $break_start_ts + 3600;      // 1 hour break
        
                    if ($in_ts < $break_end_ts && $out_ts > $break_start_ts) {
                        $overlap_start = max($in_ts, $break_start_ts);
                        $overlap_end   = min($out_ts, $break_end_ts);
                        $break_minutes = ($overlap_end - $overlap_start) / 60;
                        $worked_minutes = ($out_ts - $in_ts) / 60 - $break_minutes;
                    } else {
                        $worked_minutes = ($out_ts - $in_ts) / 60;
                    }
                } else {
                    $worked_minutes = ($out_ts - $in_ts) / 60;
                }
        
                // Convert to OT hours (rounded down to nearest 0.5)
                $ot_decimal = max(0, floor(($worked_minutes / 60) * 2) / 2);
        
                // Accumulate OT
                $ot_regular_holiday += $ot_decimal;
        
            } else {
                // No clock in/out → OT is 0
                $ot_decimal = 0;
            }
        
            // Store daily breakdown
            $daily_ot[$row['date']] = [
                'ot_decimal' => $ot_decimal,
                'status'     => ucfirst($row['status'])
            ];
        
        } else {
            // For all other statuses (Regular Work, etc.)
            // Do NOT compute OT, but still store in daily breakdown
            $daily_ot[$row['date']] = [
                'ot_decimal' => 0,
                'status'     => ucfirst($row['status'])
            ];
        }

        if ($ot_decimal <= 0) continue;

        // Store daily breakdown
        $daily_ot[$row['date']] = [
            'ot_decimal' => $ot_decimal,
            'status'     => ucfirst($row['status'])
        ];
    }

    // ✅ Total OT
    $total_ot_hours = $ot_regular + $ot_saturday_off + $ot_special_holiday + $ot_regular_holiday;
    $employees[$idx]['overtime_hours'] = round($total_ot_hours, 2);
    $employees[$idx]['daily_overtime'] = $daily_ot;
    $employees[$idx]['ot_regular'] = round($ot_regular, 2);
    $employees[$idx]['ot_saturday_off'] = round($ot_saturday_off, 2);
    $employees[$idx]['ot_special_holiday'] = round($ot_special_holiday, 2);
    $employees[$idx]['ot_regular_holiday'] = round($ot_regular_holiday, 2);
}


// ---------- Fetch Late Minutes (Minutes Only, Adjusted for Break) ---------------
foreach ($employees as $idx => $emp) {
    $emp_no = intval($emp['badge_no']);
    $daily_late_new = [];

    $sqlLate = "SELECT date, time_in, shift, status FROM attendance_records 
                WHERE employee_no = ? AND date BETWEEN ? AND ?";
    $stmtLate = $conn->prepare($sqlLate);
    $stmtLate->bind_param('iss', $emp_no, $start_date, $end_date);
    $stmtLate->execute();
    $resLate = $stmtLate->get_result();

    while ($row = $resLate->fetch_assoc()) {

        // Skip if no time_in
        if (empty($row['time_in']) || $row['time_in'] === '00:00:00') continue;
        
         // Skip if Saturday Off
        $status = trim($row['status'] ?? '');

        if (
            $status === 'Saturday Off' ||
            $status === 'Restday/Sunday OT' ||
            $status === 'Rest Day'
        ) {
            continue;
        }


        // Skip late if approved undertime exists
        $checkUT = $conn->prepare("
            SELECT id FROM undertime_requests 
            WHERE badge_no = ? 
              AND undertime_date = ?
              AND status = 'Approved'
            LIMIT 1
        ");
        $checkUT->bind_param('is', $emp_no, $row['date']);
        $checkUT->execute();
        $utResult = $checkUT->get_result();
        if ($utResult->num_rows > 0) continue;

        // Determine shift
        $shift_start_str = '07:00 AM';
        $shift_end_str   = '06:00 PM';
        if (!empty($row['shift']) && strpos($row['shift'], '-') !== false) {
            list($shift_start_str, $shift_end_str) = explode('-', $row['shift']);
            $shift_start_str = trim($shift_start_str);
            $shift_end_str   = trim($shift_end_str);
        }

        $shift_start = new DateTime($row['date'] . ' ' . $shift_start_str);
        $shift_end   = new DateTime($row['date'] . ' ' . $shift_end_str);
        $time_in     = new DateTime($row['date'] . ' ' . $row['time_in']);

        // Handle night shift
        if ($shift_end <= $shift_start) {
            $shift_end->modify('+1 day');
            if ($time_in < $shift_start) $time_in->modify('+1 day');
        }

        // 10-minute grace
        $grace_period = clone $shift_start;
        $grace_period->modify('+10 minutes');

        // Compute raw late in minutes
        $minutes_late = max(0, intval(round(($time_in->getTimestamp() - $shift_start->getTimestamp()) / 60)));

        // Skip if still within grace
        if ($minutes_late <= 10) continue;

        // Deduct break if late overlaps with break
        $shift_hours = ($shift_end->getTimestamp() - $shift_start->getTimestamp()) / 3600;
        if ($shift_hours >= 6) {
            $break_start = clone $shift_start;
            $break_start->modify('+5 hours'); // dynamic break start
            $break_end = clone $break_start;
            $break_end->modify('+1 hour');    // break duration 1 hour

            // Overlap between actual late period and break
            $late_start_ts = $shift_start->getTimestamp();
            $late_end_ts   = $time_in->getTimestamp();
            $overlap_start = max($late_start_ts, $break_start->getTimestamp());
            $overlap_end   = min($late_end_ts, $break_end->getTimestamp());

            if ($overlap_end > $overlap_start) {
                $minutes_late -= ($overlap_end - $overlap_start) / 60;
            }
        }

        // Ensure non-negative
        $minutes_late = max(0, $minutes_late);

        // Cap at 5 hours max (300 minutes)
        $minutes_late = min($minutes_late, 300);

        // Store
        $daily_late_new[$row['date']] = $minutes_late;
    }

    $employees[$idx]['daily_late_new_rule'] = $daily_late_new;
}




/***********************************************
 *  BLOCK 1 — MANUAL FILED UNDERTIME (PRIMARY)
 ***********************************************/
foreach ($employees as $idx => $emp) {

    $emp_no = intval($emp['badge_no']);
    $daily_manual_ut = [];

    // Get filed undertime
    $sqlUT = "SELECT undertime_date, start_time, end_time 
              FROM undertime_requests
              WHERE badge_no = ? 
              AND undertime_date BETWEEN ? AND ?";
    $stmtUT = $conn->prepare($sqlUT);
    $stmtUT->bind_param('iss', $emp_no, $start_date, $end_date);
    $stmtUT->execute();
    $resUT = $stmtUT->get_result();

    while ($row = $resUT->fetch_assoc()) {

        // Start + end time
        $ut_start = new DateTime($row['undertime_date'] . ' ' . ($row['start_time'] ?: '00:00:00'));
        $ut_end   = new DateTime($row['undertime_date'] . ' ' . ($row['end_time']   ?: '00:00:00'));

        // Determine shift
        $shift_start_str = '07:00 AM';
        $shift_end_str   = '06:00 PM';
        if (!empty($emp['shift']) && strpos($emp['shift'], '-') !== false) {
            list($s_start, $s_end) = explode('-', $emp['shift']);
            $shift_start_str = trim($s_start);
            $shift_end_str   = trim($s_end);
        }
        $shift_start = new DateTime($row['undertime_date'] . ' ' . $shift_start_str);
        $shift_end   = new DateTime($row['undertime_date'] . ' ' . $shift_end_str);
        if ($shift_end <= $shift_start) $shift_end->modify('+1 day');

        // FALLBACK: use actual time-in if filed end is earlier
        $stmtIn = $conn->prepare("SELECT time_in FROM attendance_records WHERE employee_no = ? AND date = ? LIMIT 1");
        $stmtIn->bind_param('is', $emp_no, $row['undertime_date']);
        $stmtIn->execute();
        $resIn = $stmtIn->get_result();

        if ($resIn->num_rows > 0) {
            $act_row = $resIn->fetch_assoc();
            if (!empty($act_row['time_in']) && $act_row['time_in'] !== '00:00:00') {
                $actual_in = new DateTime($row['undertime_date'] . ' ' . $act_row['time_in']);
                if ($actual_in > $ut_end) {
                    $ut_end = clone $actual_in;
                }
            }
        }

        // Round to nearest 30 mins UP
        $h = intval($ut_end->format('H'));
        $m = intval($ut_end->format('i'));
        $rounded_minutes = ceil($m / 30) * 30;
        if ($rounded_minutes == 60) {
            $h++;
            $rounded_minutes = 0;
        }
        $ut_end->setTime($h, $rounded_minutes);

        // Calculate undertime
        $minutes_ut = ($ut_end->getTimestamp() - $ut_start->getTimestamp()) / 60;

        // Deduct 1-hour break if shift >= 6 hours
        $shift_hours = ($shift_end->getTimestamp() - $shift_start->getTimestamp()) / 3600;
        if ($shift_hours >= 6) {
            $break_start = clone $shift_start;
            $break_start->modify('+5 hours');
            $break_end = clone $break_start;
            $break_end->modify('+1 hour');

            $overlap_start = max($ut_start->getTimestamp(), $break_start->getTimestamp());
            $overlap_end   = min($ut_end->getTimestamp(), $break_end->getTimestamp());
            if ($overlap_end > $overlap_start) {
                $minutes_ut -= ($overlap_end - $overlap_start) / 60;
            }
        }

        // Cap 10 hours
        $minutes_ut = min($minutes_ut, 600);

        // Convert to hours
        $hours_ut = max(0, round($minutes_ut / 60, 2));

        // SAVE
        $daily_manual_ut[$row['undertime_date']] = $hours_ut;
    }

    // Store manual undertime
    $employees[$idx]['daily_undertime_manual'] = $daily_manual_ut;
}


/***********************************************
 *  BLOCK 2 — AUTOMATIC UNDERTIME (FINAL FIXED)
 ***********************************************/
foreach ($employees as $idx => $emp) {

    // Skip if manual UT exists
    if (!empty($employees[$idx]['daily_undertime_manual'])) {
        $employees[$idx]['daily_undertime_new'] = $employees[$idx]['daily_undertime_manual'];
        continue;
    }

    $emp_no = intval($emp['badge_no']);
    $daily_auto_ut = [];

    // Extract shift
    $shift_start_str = '07:00 AM';
    $shift_end_str   = '06:00 PM';
    if (!empty($emp['shift']) && strpos($emp['shift'], '-') !== false) {
        list($s_start, $s_end) = explode('-', $emp['shift']);
        $shift_start_str = trim($s_start);
        $shift_end_str   = trim($s_end);
    }

    // Loop dates
    $current_date = new DateTime($start_date);
    $end_date_dt  = new DateTime($end_date);

   while ($current_date <= $end_date_dt) {

    $date_str = $current_date->format('Y-m-d');

    $shift_start = new DateTime($date_str . ' ' . $shift_start_str);
    $shift_end   = new DateTime($date_str . ' ' . $shift_end_str);
    if ($shift_end <= $shift_start) $shift_end->modify('+1 day');

    $ut_hours = 0;
    
    if (isset($leaveMap[$emp_no][$date_str])) {

    $leaveNote = $leaveMap[$emp_no][$date_str]['note'] ?? '';
    $leaveType = $leaveMap[$emp_no][$date_str]['leave_type'] ?? '';

    if (
        is_half_day_note($leaveNote) &&
        $leaveType !== 'leave with pay'
    ) {
        $daily_auto_ut[$date_str] = 5.0;
        $current_date->modify('+1 day');
        continue;
    }
}


    // Check if current date is a holiday
    $stmtHoliday = $conn->prepare("SELECT id FROM holidays WHERE holiday_date = ? LIMIT 1");
    $stmtHoliday->bind_param('s', $date_str);
    $stmtHoliday->execute();
    $resHoliday = $stmtHoliday->get_result();
    if ($resHoliday->num_rows > 0) {
        $daily_auto_ut[$date_str] = 0;
        $current_date->modify('+1 day');
        continue;
    }

    // Fetch attendance including status
    $stmtAtt = $conn->prepare("
        SELECT time_out, status 
        FROM attendance_records 
        WHERE employee_no = ? AND date = ? LIMIT 1
    ");
    $stmtAtt->bind_param('is', $emp_no, $date_str);
    $stmtAtt->execute();
    $resAtt = $stmtAtt->get_result();

    if ($resAtt->num_rows > 0) {
        $act = $resAtt->fetch_assoc();

        $status = trim($act['status'] ?? '');

        if (
            $status === 'Saturday Off' ||
            $status === 'Restday/Sunday OT' ||
            $status === 'Rest Day'
        ) {
            $daily_auto_ut[$date_str] = 0;
            $current_date->modify('+1 day');
            continue; // 🚫 NO AUTO UNDERTIME
        }


        if (!empty($act['time_out']) && $act['time_out'] !== '00:00:00') {

            $actual_out = new DateTime($date_str . ' ' . $act['time_out']);

            // Only compute undertime if actual_out < shift_end
            if ($actual_out < $shift_end) {

                // Check if approved undertime exists for the same date
                $checkUT = $conn->prepare("
                    SELECT id 
                    FROM undertime_requests 
                    WHERE badge_no = ? AND undertime_date = ? AND status = 'Approved'
                    LIMIT 1
                ");
                $checkUT->bind_param('is', $emp_no, $date_str);
                $checkUT->execute();
                $utResult = $checkUT->get_result();
                if ($utResult->num_rows > 0) {
                    // Skip UT because approved UT exists for this date
                    $daily_auto_ut[$date_str] = 0;
                    $current_date->modify('+1 day');
                    continue;
                }

                // Compute raw undertime in minutes
                $minutes_ut = ($shift_end->getTimestamp() - $actual_out->getTimestamp()) / 60;

                // Deduct break if shift >= 6 hours
                $shift_hours = ($shift_end->getTimestamp() - $shift_start->getTimestamp()) / 3600;
                if ($shift_hours >= 6) {
                    $break_start = clone $shift_start;
                    $break_start->modify('+5 hours'); // break start
                    $break_end = clone $break_start;
                    $break_end->modify('+1 hour');    // break end

                    // Deduct only overlapping break time
                    $overlap_start = max($actual_out->getTimestamp(), $break_start->getTimestamp());
                    $overlap_end   = min($shift_end->getTimestamp(), $break_end->getTimestamp());

                    if ($overlap_end > $overlap_start) {
                        $minutes_ut -= ($overlap_end - $overlap_start) / 60;
                    }
                }

                if ($minutes_ut < 0) $minutes_ut = 0;
                $minutes_ut = min($minutes_ut, 600); // cap 10 hours

                // Round after break deduction
                $ut_hours = ceil($minutes_ut / 30) * 0.5;
            }
        }
    }

    $daily_auto_ut[$date_str] = $ut_hours;
    $current_date->modify('+1 day');
}


    $employees[$idx]['daily_undertime_new'] = $daily_auto_ut;
}


// ---------- Fetch Hours Worked (Combine Basic + OT) ----------
foreach ($employees as $idx => $emp) {
    $basic_hours = isset($emp['basic_hours']) ? floatval($emp['basic_hours']) : 0;
    $ot_hours    = isset($emp['overtime_hours']) ? floatval($emp['overtime_hours']) : 0;

    // Combine both for total hours worked
    $total_hours_worked = $basic_hours + $ot_hours;

    // Save to array
    $employees[$idx]['hours_worked'] = round($total_hours_worked, 2);
}

// ---------- Deduct Undertime from Basic Hours ----------
foreach ($employees as $idx => $emp) {
    $total_basic_hours = $emp['basic_hours'] ?? 0;
    $total_ut_hours = array_sum($emp['daily_undertime_new'] ?? []);
    $employees[$idx]['basic_hours'] = round(max(0, $total_basic_hours - $total_ut_hours), 2);
}

// ---------- Deduct Lateness from Basic Hours ----------
foreach ($employees as $idx => $emp) {
    $total_basic_hours = $emp['basic_hours'] ?? 0;

    // Get total late minutes
    $daily_late = $emp['daily_late_new_rule'] ?? [];
    $total_late_minutes = array_sum($daily_late);

    // Convert minutes to hours
    $total_late_hours = $total_late_minutes / 60;

    // Deduct from basic hours
    $employees[$idx]['basic_hours'] = round(max(0, $total_basic_hours - $total_late_hours), 2);
}



// ----------------- Payroll Computation -----------------
foreach ($employees as $idx => $emp) {
    
    // 🔒 HARD RESET — MUST BE FIRST
    $ot_regular = 0;
    $ot_saturday_off = 0;
    $sat_ot_extra = 0;
    $ot_special_holiday = 0;
    $special_ot_extra = 0;   // 🔥 FIX
    $ot_regular_holiday = 0;
    $ot_sunday = 0;          // 🔥 FIX
    $sun_ot_extra = 0;
    $night_diff_hours = 0;
    $sat_total_hours = 0;
    $sun_total_hours = 0;
    $worked_minutes = 0;     // 🔥 FIX
    
    

    
    $emp_no = intval($emp['badge_no']);
    
     // ---------- FETCH DEDUCTIONS (ONCE ONLY) ----------
        $deduction_sql = "
            SELECT total_deduction, adjustment_add
            FROM deductions
            WHERE badge_no = ?
              AND date_deducted = ?
            LIMIT 1
        ";
        
        $stmtDed = $conn->prepare($deduction_sql);
        $cutoff_date = $start_date; // must match date_deducted
        $stmtDed->bind_param("is", $emp_no, $cutoff_date);
        $stmtDed->execute();
        $resDed = $stmtDed->get_result();
        
        $total_deduction = 0;
        $adjustment_add  = 0;
        
        if ($resDed && $resDed->num_rows > 0) {
            $rowDed = $resDed->fetch_assoc();
            $total_deduction = floatval($rowDed['total_deduction'] ?? 0);
            $adjustment_add  = floatval($rowDed['adjustment_add'] ?? 0);
        }

    
    $monthly_rate = floatval($emp['rate']);
    $monthly_hours = max(1, intval($emp['monthly_hours']));
    $hourly_rate = $monthly_rate / $monthly_hours;
    $rate_per_cutoff = $monthly_rate / 2; // base pay for cutoff
    
    // ---------- Early In Requests ----------
    $earlyInMap = [];
    $sqlEI = "SELECT early_in_date, early_in_time 
              FROM early_in_requests 
              WHERE badge_no = ? AND status = 'Approved' 
                AND early_in_date BETWEEN ? AND ?";
    $stmtEI = $conn->prepare($sqlEI);
    $stmtEI->bind_param('sss', $emp_no, $start_date, $end_date);
    $stmtEI->execute();
    $resEI = $stmtEI->get_result();
    while ($rowEI = $resEI->fetch_assoc()) {
        $earlyInMap[$rowEI['early_in_date']] = $rowEI['early_in_time'];
    }

    // ---------- Attendance Records ----------
    $sqlOT = "SELECT date, out_date, time_in, time_out, shift, status
              FROM attendance_records
              WHERE employee_no = ? AND date BETWEEN ? AND ?";
    $stmtOT = $conn->prepare($sqlOT);
    $stmtOT->bind_param('iss', $emp_no, $start_date, $end_date);
    $stmtOT->execute();
    $resOT = $stmtOT->get_result();

    while ($row = $resOT->fetch_assoc()) {
        $status = strtolower(trim($row['status']));
        if (empty($row['time_out']) || $row['time_out'] === '00:00:00') continue;

        // --- Default shift ---
        $shift_start_str = '07:00 AM';
        $shift_end_str   = '06:00 PM';
        if (!empty($row['shift']) && strpos($row['shift'], '-') !== false) {
            list($shift_start_str, $shift_end_str) = explode('-', $row['shift']);
            $shift_start_str = trim($shift_start_str);
            $shift_end_str   = trim($shift_end_str);
        }

        $shift_start_ts = strtotime($row['date'] . ' ' . $shift_start_str);
        $shift_end_ts   = strtotime($row['date'] . ' ' . $shift_end_str);
        $in_ts  = strtotime($row['date'] . ' ' . $row['time_in']);
        $out_ts = strtotime($row['out_date'] . ' ' . $row['time_out']);
        if ($out_ts <= $in_ts) continue;
        

        // --- Deduct break if shift >= 6 hours ---
        $worked_minutes = ($out_ts - $in_ts) / 60;
        $shift_hours = ($shift_end_ts - $shift_start_ts) / 3600;
        if ($shift_hours >= 6) {
            $break_start_ts = $shift_start_ts + 5 * 3600;
            $break_end_ts   = $break_start_ts + 3600;
            if ($in_ts < $break_end_ts && $out_ts > $break_start_ts) {
                $overlap_start = max($in_ts, $break_start_ts);
                $overlap_end   = min($out_ts, $break_end_ts);
                $worked_minutes -= ($overlap_end - $overlap_start) / 60;
            }
        }

        // --- Night Differential (10:00 PM - 6:00 AM) ---
        $nd_start = strtotime($row['date'] . ' 22:00:00');
        $nd_end   = strtotime($row['date'] . ' 06:00:00 +1 day');
        if ($out_ts > $nd_start) {
            $nd_overlap_start = max($in_ts, $nd_start);
            $nd_overlap_end   = min($out_ts, $nd_end);
            if ($nd_overlap_end > $nd_overlap_start) {
                $nd_minutes = ($nd_overlap_end - $nd_overlap_start) / 60;
                $night_diff_hours += floor(($nd_minutes / 60) * 2) / 2;
            }
        }

 
      // -------------------- SATURDAY / SUNDAY OT (hour-based, correct calculation) --------------------
        if (strpos(strtolower($status), 'saturday off') !== false || strpos(strtolower($status), 'restday/sunday ot') !== false) {
        
            if (!empty($row['time_in']) && !empty($row['time_out'])) {
        
                // --- Shift start timestamp
                $shift_start_ts = strtotime($row['date'] . ' ' . $shift_start_str);
        
                // --- Actual IN/OUT
                $in_ts  = strtotime($row['date'] . ' ' . $row['time_in']);
                $out_ts = strtotime($row['out_date'] . ' ' . $row['time_out']);
        
                // If out_ts < in_ts (data issue), add 1 day
                if ($out_ts <= $in_ts) $out_ts += 24 * 3600;
        
                // --- Clip worked interval: shift start is lower bound, actual out is upper bound
                $work_start = max($in_ts, $shift_start_ts);
                $work_end   = $out_ts; // <-- use actual out time
        
                $worked_hours = 0;
                if ($work_end > $work_start) {
                    $worked_hours = ($work_end - $work_start) / 3600.0;
                }
        
                // --- Deduct break if shift >= 6h
                $shift_end_ts = strtotime($row['date'] . ' ' . $shift_end_str);
                if ($shift_end_ts <= $shift_start_ts) $shift_end_ts += 24 * 3600;
                $shift_hours = ($shift_end_ts - $shift_start_ts) / 3600.0;
        
                if ($shift_hours >= 6 && $worked_hours > 0) {
                    $break_start_ts = $shift_start_ts + 5 * 3600; // break starts 5h after shift start
                    $break_end_ts   = $break_start_ts + 3600;    // 1h break
        
                    // overlap between worked interval and break
                    $break_overlap_start = max($work_start, $break_start_ts);
                    $break_overlap_end   = min($work_end, $break_end_ts);
                    $break_hours = max(0, ($break_overlap_end - $break_overlap_start) / 3600.0);
        
                    $worked_hours = max(0, $worked_hours - $break_hours);
                }
        
                // --- Round down to nearest 0.5 hour
                $ot_decimal = max(0, floor($worked_hours * 2) / 2);
        
                // --- Accumulate total hours
                if (strpos(strtolower($status), 'saturday off') !== false) {
                    $sat_total_hours += $ot_decimal;
                } else {
                    $sun_total_hours += $ot_decimal;
                }
            }
        }

        
        // --- Regular OT Before Shift (Early In Requests) ---
        if (isset($earlyInMap[$row['date']])) {
            $early_in_ts = strtotime($row['date'] . ' ' . $earlyInMap[$row['date']]);
            if ($early_in_ts < $shift_start_ts) {
                $minutes_before_shift = ($shift_start_ts - $early_in_ts) / 60;
                $ot_regular += floor(($minutes_before_shift / 60) * 2) / 2;
            }
        }

         // --- Regular OT After Shift ---
        $status_clean = strtolower(trim($row['status']));
        if (($status_clean === 'overtime' || $status_clean === 'undertime + overtime') && $out_ts > $shift_end_ts) {
            $minutes_after_shift = ($out_ts - $shift_end_ts) / 60;
            if ($minutes_after_shift >= 30) {
                $ot_hours = floor(($minutes_after_shift / 60) * 2) / 2;
        
                // ✅ Only accumulate if NOT "undertime + overtime"
                if ($status_clean !== 'undertime + overtime') {
                    $ot_regular += $ot_hours;
                }
            }
        }

    // --- HELPER SPECIAL HOLIDAY OT(like Saturday Off OT) ---
    $raw_status = trim($status);
    $normalized_status = strtolower(preg_replace('/\s+/', ' ', $raw_status));

    // --- Special Holiday OT (like Saturday Off OT) ---
    if ($normalized_status === "special non-working worked") {
        $worked_hours = floor(($worked_minutes / 60) * 2) / 2; // round down to nearest 0.5
        if ($worked_hours <= 8) {
            $ot_special_holiday += $worked_hours;
            $special_ot_extra = 0;
        } else {
            $ot_special_holiday += 8;
            $special_ot_extra = $worked_hours - 8;
        }

        // Optional: store daily breakdown
        $daily_ot[$row['date']] = [
            'ot_decimal'  => $worked_hours,
            'status'      => ucfirst($row['status']),
            'extra_hours' => $special_ot_extra
        ];
    }

        // --- Regular Holiday ---
        if (strpos($status, 'regular holiday') !== false) {
            $ot_regular_holiday += floor(($worked_minutes / 60) * 2) / 2;
        }
    } // end attendance loop

   // -------------------- Split Saturday OT into normal + extra --------------------
    if ($sat_total_hours <= 8) {
        $ot_saturday_off = $sat_total_hours;
        $sat_ot_extra    = 0;
    } else {
        $ot_saturday_off = 8;
        $sat_ot_extra    = $sat_total_hours - 8;
    }
    
    // -------------------- Split Sunday OT into normal + extra --------------------
    if ($sun_total_hours <= 8) {
        $ot_sunday     = $sun_total_hours;
        $sun_ot_extra  = 0;
    } else {
        $ot_sunday     = 8;
        $sun_ot_extra  = $sun_total_hours - 8;
    }

   // ---------- Deductions with late affecting rate_per_cutoff ----------
    $daily_late_minutes = $emp['daily_late_new_rule'] ?? [];
    $late_deduction = 0;
    $fixed_ot_hours_per_day = 2;
    
    foreach ($daily_late_minutes as $date => $mins) {
        // Convert mins → hours
        $hours = $mins / 60;
    
        // Round UP to nearest 0.5 hour
        $rounded = ceil($hours / 0.5) * 0.5;
    
        if ($rounded <= 0) continue;
    
        // Apply same rules as undertime
        if ($rounded <= $fixed_ot_hours_per_day) {
            // First 2 hours → OT rate (1.25x)
            $late_deduction += $rounded * $hourly_rate * 1.25;
        } else {
            // First 2 hours at 1.25x
            $late_deduction += $fixed_ot_hours_per_day * $hourly_rate * 1.25;
    
            // Remaining hours at basic rate
            $late_deduction += ($rounded - $fixed_ot_hours_per_day) * $hourly_rate;
        }
    }
    
    // ---------- Deductions with undertime affecting rate_per_cutoff ----------
    $daily_undertime_hours = $emp['daily_undertime_new'] ?? [];
    $deduction_basic = 0;
    $deduction_fixed_ot = 0;
    $fixed_ot_hours_per_day = 2;
    $total_undertime_hours = 0;
    
    foreach ($daily_undertime_hours as $day => $hours_undertime) {
    
        $ot_for_day = $emp['daily_overtime'][$day]['ot_decimal'] ?? 0;
    
        // Check if this day has "undertime + overtime" status
        $status_for_day = strtolower($emp['daily_overtime'][$day]['status'] ?? '');
    
        if ($status_for_day === 'undertime + overtime') {
            // Adjust undertime: undertime - OT
            $hours_undertime = max(0, $hours_undertime - $ot_for_day);
        }
    
        $total_undertime_hours += $hours_undertime;
    
        if ($hours_undertime <= 0) continue;
    
        // Apply normal deduction rules
        if ($hours_undertime <= $fixed_ot_hours_per_day) {
            $deduction_fixed_ot += $hours_undertime * $hourly_rate * 1.25;
        } else {
            $deduction_fixed_ot += $fixed_ot_hours_per_day * $hourly_rate * 1.25;
            $deduction_basic += ($hours_undertime - $fixed_ot_hours_per_day) * $hourly_rate;
        }
    }
    
    $undertime_deduction_total = $deduction_fixed_ot + $deduction_basic;
    
        
        // Total undertime deduction
        $undertime_deduction_total = $deduction_fixed_ot + $deduction_basic;

    
    // ---------- Absent Deduction with Fixed OT ----------
    $basic = $hourly_rate * 8;           
    $fixed_ot = $hourly_rate * 2 * 1.25; 
    $rate_per_day = $basic + $fixed_ot;
    
    $absent_days = intval($emp['absent_days'] ?? 0);
    $absent_deduction = $absent_days * $rate_per_day;

    // ---------- Night Differential Pay ----------
    $night_diff_pay = $night_diff_hours * $hourly_rate * 0.10;
    
    // ---------- Check if employee has attendance records ----------
    $has_attendance_sql = "
        SELECT COUNT(*) AS total 
        FROM attendance_records 
        WHERE employee_no = ? 
          AND date BETWEEN ? AND ?
    ";
    $stmtChk = $conn->prepare($has_attendance_sql);
    $stmtChk->bind_param('iss', $emp_no, $start_date, $end_date);
    $stmtChk->execute();
    $resChk = $stmtChk->get_result();
    $rowChk = $resChk->fetch_assoc();
    $has_attendance = intval($rowChk['total']) > 0;


    if ($has_attendance) {
        // ---------- Absent Deduction with Fixed OT ----------
        $basic = $hourly_rate * 8;           
        $fixed_ot = $hourly_rate * 2 * 1.25; 
        $rate_per_day = $basic + $fixed_ot;
        
        $absent_days = intval($emp['absent_days'] ?? 0);
        $absent_deduction = $absent_days * $rate_per_day;
    
        // ---------- Night Differential Pay ----------
        $night_diff_pay = $night_diff_hours * $hourly_rate * 0.10;
        
        // ---------- Gross Pay Adjustment for Special Holiday OT ----------
        $gross_pay = $rate_per_cutoff
            + ($ot_regular * $hourly_rate * 1.25)
            + ($ot_saturday_off * $hourly_rate * 1.3)
            + ($sat_ot_extra * $hourly_rate * 1.3 * 1.3)
            + ($ot_sunday * $hourly_rate * 1.3)          // Sunday OT normal
            + ($sun_ot_extra * $hourly_rate * 1.3 * 1.3) // Sunday OT extra
            + ($ot_special_holiday * $hourly_rate * 0.3)
            + ($special_ot_extra * $hourly_rate * 1.3 * 1.3)
            + ($ot_regular_holiday * $hourly_rate * 2.0)
            + $adjustment_add
            + $night_diff_pay
            - $late_deduction
            - $undertime_deduction_total
            - $absent_deduction;
            
        } else {
            // ❌ No attendance = No pay
            $gross_pay = 0;
            $night_diff_pay = 0;
            $absent_deduction = 0;
        }

    // ---------- Store Results ----------
    $employees[$idx]['rate_per_cutoff'] = round($rate_per_cutoff, 2);
    $employees[$idx]['ot_regular'] = round($ot_regular, 2);
    $employees[$idx]['ot_saturday_off'] = round($ot_saturday_off, 2);
    $employees[$idx]['sat_ot_extra'] = round($sat_ot_extra, 2);
    $employees[$idx]['ot_special_holiday'] = round($ot_special_holiday, 2);
    $employees[$idx]['special_ot_extra'] = round($special_ot_extra, 2);
    $employees[$idx]['ot_regular_holiday'] = round($ot_regular_holiday, 2);
    $employees[$idx]['night_diff_hours'] = round($night_diff_hours, 2);
    $employees[$idx]['night_diff_pay'] = round($night_diff_pay, 2);
    $employees[$idx]['late_deduction'] = round($late_deduction, 2);
    $employees[$idx]['undertime_deduction'] = round($undertime_deduction, 2);
    $employees[$idx]['absent_deduction'] = round($absent_deduction, 2);
    $employees[$idx]['gross_pay'] = round($gross_pay, 2);
    


// Attach to employee array
$employees[$idx]['deductions'] = round($total_deduction, 2);

// ================================
// SAVE COMPUTED PAYROLL SNAPSHOT
// ================================
$_SESSION['payroll_snapshot'] = [
    'employees'  => $employees,
    'start_date' => $start_date,
    'end_date'   => $end_date,
    'month'      => $month,
    'cutoff'     => $cutoff,
    'team'       => $team,
    'saved_at'   => date('Y-m-d H:i:s')
];


// ---------- Compute Net Pay ----------
$employees[$idx]['net_pay'] = round($gross_pay - $employees[$idx]['deductions'], 2);

}

$month = $_GET['month'] ?? date('Y-m');
$cutoff = $_GET['cutoff'] ?? '1st';
$team = $_GET['team'] ?? '';

// ----------------- Get all teams -----------------
$teams = [];
$teams_res = $conn->query("SELECT DISTINCT team FROM employees WHERE team<>'' ORDER BY team ASC");
while ($trow = $teams_res->fetch_assoc()) {
    $teams[] = $trow['team'];
}

?>

<!DOCTYPE html>
<html lang="en" >
<head>
  <meta charset="utf-8" />
  <title>Manage Payroll</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <!-- Bootstrap 5 CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />

  <!-- Bootstrap Icons -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" />

  <style>
    body, html {
      height: 100%;
      margin: 0;
      background: #f8f9fa;
    }

    .summary-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.5rem 1.8rem;
      font-size: 1.25rem;
      border-radius: 0.85rem;
      color: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
      background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
      transition: background 0.3s ease;
    }
    .summary-card.bg-info {
      background: linear-gradient(135deg, #0DCAF0 0%, #0077B6 100%);
    }
    .summary-card:hover {
      filter: brightness(1.1);
    }

    .summary-card-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 84px;
      height: 84px;
      margin-right: 1.5rem;
      border-radius: 50%;
      background: radial-gradient(circle at center, #ffffff50 0%, #ffffff15 80%);
      box-shadow: 
          inset 0 4px 8px #ffffff30,
          0 4px 15px rgba(0, 0, 0, 0.25);
      position: relative;
      transition: transform 0.3s ease;
    }
    .summary-card:hover .summary-card-icon {
      transform: scale(1.1);
      box-shadow:
          inset 0 6px 12px #ffffff50,
          0 6px 20px rgba(0, 0, 0, 0.35);
    }

    .summary-card-icon i {
      font-size: 3.8rem;
      color: white;
      text-shadow: 0 1px 4px rgba(0,0,0,0.45);
    }

    .summary-card-text {
      flex-grow: 1;
      font-weight: 600;
    }

    .summary-card-value {
      font-weight: 700;
      font-size: 1.75rem;
      min-width: 110px;
      text-align: right;
    }

    .table-wrapper {
      max-height: calc(100vh - 370px); /* Adjust based on header/filter height */
      overflow-y: auto;
      overflow-x: auto;
      border: 1px solid #dee2e6;
      border-radius: 0.25rem;
      background: white;
    }

    /* Sticky header for table */
    .table-wrapper thead th {
      position: sticky;
      top: 0;
      background-color: #fff;
      z-index: 10;
      box-shadow: inset 0 -1px 0 #dee2e6;
    }

    /* Layout tweaks */
    .content-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 1rem 2rem 2rem 2rem;
    }

    .header-row {
      flex: 0 0 auto;
      margin-bottom: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .main-row {
      flex: 1 1 auto;
      display: flex;
      gap: 1.5rem;
      overflow: hidden;
    }

    /* Filter sidebar */
    .filter-sidebar {
      flex: 0 0 280px;
      background: white;
      border-radius: 0.5rem;
      box-shadow: 0 0 8px rgb(0 0 0 / 0.1);
      padding: 1rem 1.5rem;
      overflow-y: auto;
    }

    .filter-sidebar .card-header {
      background: #0d6efd;
      color: white;
      font-weight: 700;
      border-radius: 0.5rem 0.5rem 0 0;
    }

    /* Main content area */
    .main-content {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      background: white;
      border-radius: 0.5rem;
      box-shadow: 0 0 8px rgb(0 0 0 / 0.1);
      padding: 1rem 1.5rem;
      overflow: hidden;
    }

    /* Summary cards container */
    .summary-cards {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    .summary-cards > div {
      flex: 1 1 300px;
    }

    /* Table header with integrated search */
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .table-header h5 {
      margin: 0;
      font-weight: 600;
    }
    .table-header .search-wrapper {
      flex: 1 1 280px;
      max-width: 380px;
      position: relative;
    }
    .table-header .search-wrapper input {
      border-radius: 2rem;
      padding-left: 2.5rem;
      height: 38px;
      box-shadow: 0 1px 5px rgb(0 0 0 / 0.1);
      transition: box-shadow 0.3s ease;
    }
    .table-header .search-wrapper input:focus {
      box-shadow: 0 0 8px #0d6efd;
      outline: none;
    }
    .table-header .search-wrapper .bi-search {
      position: absolute;
      left: 10px;
      top: 8px;
      color: #aaa;
      pointer-events: none;
      font-size: 1.1rem;
    }

    /* Back button */
    .btn-back {
      margin-bottom: 1rem;
    }

    /* Responsive tweaks */
    @media (max-width: 767px) {
      .filter-sidebar {
        flex: 1 1 100%;
        max-height: 280px;
        overflow-y: auto;
        margin-bottom: 1rem;
      }
      .main-content {
        flex: 1 1 100%;
        padding: 1rem 1rem 0.5rem 1rem;
      }
    }
  </style>
</head>
<body>
  <div class="content-container">
    <!-- Header Row -->
    <div class="header-row">
      <h2 class="fw-bold mb-0">📊 Monthly Payroll Dashboard</h2>

      <div class="d-flex gap-2 flex-wrap">
        <a href="../../index.php" class="btn btn-primary btn-back">
          <i class="bi bi-arrow-left-circle"></i> Back to Dashboard
        </a>
      </div>
    </div>

    <div class="main-row">
    <!-- Filters Sidebar -->
    <aside class="filter-sidebar" style="width: 280px; padding: 1rem;">
      <div class="card h-100 shadow-sm rounded-4">
        <div class="card-header bg-primary text-white fw-bold">
          <i class="bi bi-funnel-fill me-2"></i> Filters & Actions
        </div>
        <div class="card-body d-flex flex-column p-4 gap-3">
    
          <!-- Filters Form -->
          <form method="GET" class="row g-3 mb-3">
            <div class="col-12">
              <label for="monthInput" class="form-label fw-semibold">Month</label>
              <input type="month" name="month" id="monthInput"
                     value="<?= htmlspecialchars($month) ?>" class="form-control shadow-sm">
            </div>
    
            <div class="col-12">
              <label for="cutoffSelect" class="form-label fw-semibold">Cutoff</label>
              <select name="cutoff" id="cutoffSelect" class="form-select shadow-sm">
                <option value="1st" <?= $cutoff === '1st' ? 'selected' : '' ?>>1st–15th</option>
                <option value="2nd" <?= $cutoff === '2nd' ? 'selected' : '' ?>>16th–End</option>
              </select>
            </div>
    
            <div class="col-12">
              <label for="teamSelect" class="form-label fw-semibold">Team</label>
              <?php $selectedTeam = $_GET['team'] ?? ''; ?>
              <select name="team" id="teamSelect" class="form-select shadow-sm">
                <option value="" <?= $selectedTeam === '' ? 'selected' : '' ?>>-- All Teams --</option>
                <?php foreach ($teams as $t): ?>
                  <option value="<?= htmlspecialchars($t) ?>" <?= $selectedTeam === $t ? 'selected' : '' ?>>
                    <?= htmlspecialchars($t) ?>
                  </option>
                <?php endforeach; ?>
              </select>
            </div>
    
            <div class="col-12">
              <button type="submit" class="btn btn-primary w-100 mt-2 shadow-sm">
                <i class="bi bi-funnel-fill me-1"></i> Apply Filters
              </button>
            </div>
          </form>
    
          <!-- Primary Action -->
<button id="savePayrollBtn" class="btn btn-success w-100 mb-3 fw-bold">
  💾 Save Payroll
</button>

<!-- Navigation Accordion -->
<div class="accordion" id="sidebarNav">

  <!-- Payroll -->
  <div class="accordion-item">
    <h2 class="accordion-header">
      <button class="accordion-button collapsed" data-bs-toggle="collapse" data-bs-target="#navPayroll">
        <i class="bi bi-cash-coin me-2"></i> Payroll
      </button>
    </h2>
    <div id="navPayroll" class="accordion-collapse collapse">
      <div class="accordion-body p-2 d-grid gap-2">
        <a href="manage_payroll_2.php" class="btn btn-outline-primary btn-sm">
          Payroll Summary (Hourly)
        </a>
        <a href="payroll_computed_details.php" class="btn btn-outline-primary btn-sm">
          Manage Payslip
        </a>
      </div>
    </div>
  </div>

  <!-- Deductions -->
  <div class="accordion-item">
    <h2 class="accordion-header">
      <button class="accordion-button collapsed" data-bs-toggle="collapse" data-bs-target="#navDeductions">
        <i class="bi bi-receipt-cutoff me-2"></i> Deductions
      </button>
    </h2>
    <div id="navDeductions" class="accordion-collapse collapse">
      <div class="accordion-body p-2">
        <a href="../deductions/view_deductions.php" class="btn btn-outline-warning btn-sm w-100">
          View Deductions
        </a>
      </div>
    </div>
  </div>

  <!-- Setup -->
  <div class="accordion-item">
    <h2 class="accordion-header">
      <button class="accordion-button collapsed" data-bs-toggle="collapse" data-bs-target="#navSetup">
        <i class="bi bi-gear-fill me-2"></i> Setup
      </button>
    </h2>
    <div id="navSetup" class="accordion-collapse collapse">
      <div class="accordion-body p-2">
        <a href="saturday_off.php" class="btn btn-outline-success btn-sm w-100">
          Saturday Off Schedule
        </a>
      </div>
    </div>
  </div>

</div>

        </div>
      </div>
    </aside>


      <!-- Main Content -->
      <section class="main-content d-flex flex-column">
        <!-- Summary Cards -->
        <div class="summary-cards">
          <div class="summary-card bg-success d-flex">
            <div class="summary-card-icon">
              <i class="bi bi-currency-dollar"></i>
            </div>
            <div class="summary-card-text">Total Payroll</div>
            <div class="summary-card-value">₱<?= number_format($total_payroll, 2) ?></div>
          </div>
          <div class="summary-card bg-info d-flex">
            <div class="summary-card-icon">
              <i class="bi bi-people-fill"></i>
            </div>
            <div class="summary-card-text">Total Employees</div>
            <div class="summary-card-value"><?= $total_employees ?></div>
          </div>
        </div>

        <!-- Table Header with Search -->
        <div class="table-header">
          <h5>Payroll Details</h5>
          <div class="search-wrapper">
            <input
              type="text"
              id="liveSearch"
              class="form-control"
              placeholder="Search employees..."
              autocomplete="off"
              aria-label="Search employees"
            />
            <i class="bi bi-search"></i>
          </div>
        </div>

        <!-- Scrollable Table -->
        <div class="table-wrapper flex-grow-1">
          <table
            class="table table-striped table-hover align-middle mb-0 text-center"
            id="payrollTable"
          >
            <thead>
              <tr>
                <th>Name</th>
                <th>Badge No</th>
                <th>Team</th>
                <th>Monthly Hours</th>
                <th>Rate / Hour</th>
                <th>Rate / Day</th>
                <th>Rate / Cutoff</th>
                <th>Absent Days</th>
                <th>Days Worked</th>
                <th>Hours Worked</th>
                <th>Regular Hours</th>
                <th>OT Hours</th>
                <th>Late</th>
                <th>Undertime Hours</th>
                <th>Gross Pay</th>
                <th>Deductions</th>
                <th>Net Pay</th>
              </tr>
            </thead>
            <tbody>
             <?php foreach ($employees as $emp):
    $monthly_hours = floatval($emp['monthly_hours'] ?? 0);
    $rate = floatval($emp['rate'] ?? 0);
    $rate_per_hour_display = ($monthly_hours > 0) ? $rate / $monthly_hours : 0;
?>
<?php
$monthly_hours = floatval($emp['monthly_hours'] ?? 0);
$rate = floatval($emp['rate'] ?? 0);

// Rate per hour
$rate_per_hour = ($monthly_hours > 0) ? $rate / $monthly_hours : 0;

// Rate per day
$basic = $rate_per_hour * 8;           // 8 regular hours
$fixed_ot = $rate_per_hour * 2 * 1.25; // 2 OT hours at 1.25x
$rate_per_day = $basic + $fixed_ot;

// Rate per cutoff (simplified: half of monthly rate)
$rate_per_cutoff = $rate / 2;
?>
<tr>
  <td><?= htmlspecialchars($emp['name']) ?></td>
  <td><?= htmlspecialchars($emp['badge_no']) ?></td>
  <td><?= htmlspecialchars($emp['team']) ?></td>
  <td><?= number_format($monthly_hours, 2) ?></td>
  <td>₱<?= number_format($rate_per_hour_display, 2) ?></td>
  <td>₱<?= number_format($rate_per_day, 2) ?></td> <!-- Rate per Day -->
  <td>₱<?= number_format($rate_per_cutoff, 2) ?></td> <!-- Rate per Cutoff -->
  <td><?= intval($emp['absent_days'] ?? 0) ?></td> <!-- Total Absent Days -->
  <td><?= intval($emp['days_worked'] ?? 0) ?></td>
  <td><?= number_format(floatval($emp['hours_worked'] ?? 0), 2) ?></td>
  <td><?= number_format(floatval($emp['basic_hours'] ?? 0), 2) ?></td>
  <td><?= number_format(floatval($emp['overtime_hours'] ?? 0), 2) ?></td>
  <?php
    $daily_late = $emp['daily_late_new_rule'] ?? [];
    $total_late = array_sum($daily_late);
    ?>
  <td><?= $total_late ?> mins</td>
  <td>
    <?php 
    $total_ut = !empty($emp['daily_undertime_new']) ? array_sum($emp['daily_undertime_new']) : 0;
    echo number_format($total_ut, 2); 
    ?>
  </td>
  
  <td>₱<?= number_format(floatval($emp['gross_pay'] ?? 0), 2) ?></td>

  <td>₱<?= number_format(floatval($emp['deductions'] ?? 0), 2) ?></td>
  <td>₱<?= number_format(floatval($emp['net_pay'] ?? 0), 2) ?></td>
</tr>
<?php endforeach; ?>

            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>


<!-- JS -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

  <script>
    // Live search filter
    document.getElementById('liveSearch').addEventListener('input', function () {
      const searchValue = this.value.toLowerCase();
      const rows = document.querySelectorAll('#payrollTable tbody tr');
      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchValue) ? '' : 'none';
      });
    });
  </script>
  
  <script>
document.getElementById('savePayrollBtn').addEventListener('click', function () {

  if (!confirm("Save payroll for this cutoff?")) return;

  fetch("save_payroll_manual.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      month: "<?= $month ?>",
      cutoff: "<?= $cutoff ?>",
      team: "<?= $team ?>"
    })
  })
  .then(res => res.json())
  .then(data => {
    alert(data.message);
  })
  .catch(err => alert("Save failed"));
});
</script>


</body>
</html>
