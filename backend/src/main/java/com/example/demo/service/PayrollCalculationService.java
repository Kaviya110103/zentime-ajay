package com.example.demo.service;

import com.example.demo.MODELS.*;
import com.example.demo.repo.AttendanceRecordRepository;
import com.example.demo.repo.AttendanceSupportRequestRepository;
import com.example.demo.repo.EmployeeRepository;
import com.example.demo.repo.HolidayRepository;
import com.example.demo.repo.LeavePolicyRepository;
import com.example.demo.repo.LeavePermissionRepository;
import com.example.demo.repo.OvertimeRequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class PayrollCalculationService {
    private static final DateTimeFormatter DB_DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TIME_FORMATTER_HH_MM = DateTimeFormatter.ofPattern("H:mm");
    private static final DateTimeFormatter TIME_FORMATTER_HH_MM_SS = DateTimeFormatter.ofPattern("H:mm:ss");
    private static final String SWAP_WEEKOFF_TYPE = "swap weekoff";

    private final EmployeeRepository employeeRepository;
    private final AttendanceRecordRepository attendanceRecordRepository;
    private final AttendanceSupportRequestRepository attendanceSupportRequestRepository;
    private final LeavePermissionRepository leavePermissionRepository;
    private final HolidayRepository holidayRepository;
    private final LeavePolicyRepository leavePolicyRepository;
    private final SchemaMaintenanceService schemaMaintenanceService;
    private final OvertimeRequestRepository overtimeRequestRepository;
    private final AttendanceClassificationService attendanceClassificationService;

    public PayrollCalculationService(
            EmployeeRepository employeeRepository,
            AttendanceRecordRepository attendanceRecordRepository,
            AttendanceSupportRequestRepository attendanceSupportRequestRepository,
            LeavePermissionRepository leavePermissionRepository,
            HolidayRepository holidayRepository,
            LeavePolicyRepository leavePolicyRepository,
            SchemaMaintenanceService schemaMaintenanceService,
            OvertimeRequestRepository overtimeRequestRepository,
            AttendanceClassificationService attendanceClassificationService) {
        this.employeeRepository = employeeRepository;
        this.attendanceRecordRepository = attendanceRecordRepository;
        this.attendanceSupportRequestRepository = attendanceSupportRequestRepository;
        this.leavePermissionRepository = leavePermissionRepository;
        this.holidayRepository = holidayRepository;
        this.leavePolicyRepository = leavePolicyRepository;
        this.schemaMaintenanceService = schemaMaintenanceService;
        this.overtimeRequestRepository = overtimeRequestRepository;
        this.attendanceClassificationService = attendanceClassificationService;
    }

    @Transactional(readOnly = true)
    public PayrollResult calculateMonthlyPayroll(Long employeeId, int month, int year) {
        return calculateMonthlyPayroll(employeeId, month, year, null);
    }

    @Transactional(readOnly = true)
    public PayrollResult calculateMonthlyPayroll(Long employeeId, int month, int year, Long clientIdOverride) {
        schemaMaintenanceService.ensureEmployeeSchema();
        Optional<Employee> employeeOpt = employeeRepository.findById(employeeId);
        if (employeeOpt.isEmpty()) {
            return PayrollResult.empty();
        }

        Employee employee = employeeOpt.get();
        if (clientIdOverride != null && !clientIdOverride.equals(employee.getClientId())) {
            throw new IllegalArgumentException("Employee does not belong to this client");
        }
        Long effectiveClientId = clientIdOverride != null ? clientIdOverride : employee.getClientId();
        LocalDate firstDate = LocalDate.of(year, month, 1);
        LocalDate lastDate = firstDate.withDayOfMonth(firstDate.lengthOfMonth());
        LeaveAllowancePolicy leaveAllowancePolicy = resolveLeaveAllowancePolicy(employee);
        int daysInMonth = firstDate.lengthOfMonth();
        int normalShiftMinutes = resolveNormalShiftMinutes(employee);

        LocalDate joiningDate = parseJoiningDate(employee.getDateOfJoining());
        List<AttendanceRecord> monthRecords = attendanceRecordRepository.findByEmployeeId(employeeId).stream()
                .filter(record -> {
                    LocalDate date = record == null ? null : parseDbDate(record.getDate());
                    return date != null && date.getYear() == year && date.getMonthValue() == month;
                }).toList();
        List<Map<String, Object>> classifiedRecords = attendanceClassificationService.classifyRecords(monthRecords, effectiveClientId);
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        Map<LocalDate, Map<String, Object>> actualByDate = new HashMap<>();
        for (Map<String, Object> row : classifiedRecords) {
            LocalDate date = parseDbDate(String.valueOf(row.get("date")));
            row = normalizeCurrentOpenPunch(row, date, today);
            if (actualByDate.putIfAbsent(date, row) != null) {
                throw new IllegalStateException("Payroll review required: duplicate attendance date " + date);
            }
        }

        List<Map<String, Object>> calendarRows =
                attendanceClassificationService.classifyCalendar(employee, firstDate, lastDate, effectiveClientId);
        Map<LocalDate, Integer> scheduledMinutesByDate = new HashMap<>();
        int configuredWeekOffDays = 0;
        int additionalWorkingDays = 0;
        int classifiedScheduledDayCount = 0;
        int classifiedScheduledMinutesTotal = 0;
        for (int index = 0; index < calendarRows.size(); index++) {
            Map<String, Object> row = calendarRows.get(index);
            LocalDate date = parseDbDate(String.valueOf(row.getOrDefault("date", "")));
            if (date == null) {
                continue;
            }
            // Recorded shift snapshots also determine the monthly denominator.
            row = actualByDate.getOrDefault(date, row);
            int expectedMinutes = Math.max(0, objectInt(row.get("expectedMinutes")));
            if (objectBoolean(row.get("reviewRequired"))) {
                throw new IllegalStateException("Payroll review required for " + date + ": " + row.get("reviewReason"));
            }
            scheduledMinutesByDate.put(date, expectedMinutes);
            if (expectedMinutes > 0) {
                classifiedScheduledDayCount++;
                classifiedScheduledMinutesTotal += expectedMinutes;
            }
            if (objectBoolean(row.get("weekOff"))) {
                configuredWeekOffDays++;
            }
            if (objectBoolean(row.get("additionalWorkingDay"))) {
                additionalWorkingDays++;
            }
        }

        Map<LocalDate, Double> holidayFractionByDate =
                buildHolidayMap(effectiveClientId, firstDate, lastDate);
        double publicHolidayDays = holidayFractionByDate.values().stream()
                .filter(Objects::nonNull)
                .mapToDouble(value -> Math.max(0.0, Math.min(1.0, value)))
                .sum();

        LeaveBuckets leaveBuckets = buildLeaveBuckets(
                employeeId,
                month,
                year,
                holidayFractionByDate,
                scheduledMinutesByDate);
        int casualBalance = leaveAllowancePolicy.casualLeaveAllowed();
        leaveBuckets.applyCasualBalance(scheduledMinutesByDate, casualBalance);
        int clUtilizedDays = leaveBuckets.paidCasualDates.size() + leaveBuckets.unpaidCasualDates.size();

        Map<LocalDate, Integer> approvedOtLimits = new HashMap<>();
        for (AttendanceRecord record : monthRecords) {
            if (Boolean.TRUE.equals(record.getOvertimeApproved())) {
                approvedOtLimits.merge(parseDbDate(record.getDate()), resolveRecordedOvertimeMinutes(record), Math::max);
            }
        }
        for (OvertimeRequest request : overtimeRequestRepository.findByEmployeeIdAndStatus(employeeId, OvertimeRequestStatus.APPROVED)) {
            if (request.getOvertimeHours() != null && request.getOvertimeHours() > 0) {
                approvedOtLimits.merge(parseDbDate(request.getDate()), (int) Math.round(request.getOvertimeHours() * 60), Math::max);
            }
        }
        Map<LocalDate, Integer> supportApprovedMinutesByDate =
                buildSupportApprovedMinutesByDate(employeeId, month, year);
        int overtimeMinutes = 0;

        Set<LocalDate> presentWorkingDates = new HashSet<>();
        Set<LocalDate> lateDates = new HashSet<>();
        Map<LocalDate, Integer> classifiedWorkedMinutesByDate = new HashMap<>();
        Map<LocalDate, Integer> classifiedLateMinutesByDate = new HashMap<>();
        Map<LocalDate, Integer> classifiedPayableMinutesByDate = new HashMap<>();
        for (Map<String, Object> row : classifiedRecords) {
            LocalDate date = parseDbDate(String.valueOf(row.getOrDefault("date", "")));
            if (date == null) {
                continue;
            }
            row = normalizeCurrentOpenPunch(row, date, today);
            if (joiningDate != null && date.isBefore(joiningDate)) continue;
            String countStatus = String.valueOf(row.getOrDefault("countStatus", ""));
            int workedMinutes = Math.max(0, objectInt(row.get("workedMinutes")));
            int missedMinutes = Math.max(0, objectInt(row.get("lateMinutes")));
            int payableMinutes = Math.max(0, objectInt(row.get("payableMinutes")));
            if ("Present".equalsIgnoreCase(countStatus)) {
                presentWorkingDates.add(date);
                if (workedMinutes > 0) {
                    classifiedWorkedMinutesByDate.merge(date, workedMinutes, Integer::sum);
                }
                if (payableMinutes > 0) {
                    classifiedPayableMinutesByDate.merge(date, payableMinutes, Integer::sum);
                }
            }
            if (missedMinutes > 0) {
                lateDates.add(date);
                classifiedLateMinutesByDate.merge(date, missedMinutes, Integer::sum);
            }
        }

        int approvedPermissionMinutes = 0;
        Set<LocalDate> paidDates = new HashSet<>(leaveBuckets.paidLeaveDates);
        paidDates.addAll(leaveBuckets.paidCasualDates);
        Map<LocalDate, Map<String, Object>> permissionSchedule = new HashMap<>();
        for (Map<String, Object> row : calendarRows) {
            LocalDate date = parseDbDate(String.valueOf(row.get("date")));
            if (date != null) permissionSchedule.put(date, row);
        }
        permissionSchedule.putAll(actualByDate);
        Map<LocalDate, Integer> permissionCredits = permissionCredits(employee, monthRecords, permissionSchedule, paidDates, month, year);

        if (employee.getSalary() == null) throw new IllegalStateException("Payroll review required: missing salary");
        double salary = employee.getSalary() == null ? 0.0 : employee.getSalary();
        double scheduledWorkingDays = classifiedScheduledDayCount;
        int scheduledWorkingMinutes = classifiedScheduledMinutesTotal;
        if (scheduledWorkingMinutes <= 0) throw new IllegalStateException("Payroll review required: no scheduled minutes");
        if (!Double.isFinite(salary) || salary < 0) throw new IllegalStateException("Payroll review required: invalid salary");
        BigDecimal monthlySalary = BigDecimal.valueOf(salary);
        int attendancePresentMinutesTotal = 0;
        int payableRegularMinutes = 0;
        int eligibleScheduledMinutes = 0;
        List<Map<String, Object>> dailyRows = new ArrayList<>();
        for (LocalDate date = firstDate; !date.isAfter(lastDate); date = date.plusDays(1)) {
            if (joiningDate != null && date.isBefore(joiningDate)) continue;
            int scheduledMinutes = Math.max(0, scheduledMinutesByDate.getOrDefault(date, 0));
            eligibleScheduledMinutes += scheduledMinutes;
            int workedMinutes = classifiedWorkedMinutesByDate.getOrDefault(date, 0);
            attendancePresentMinutesTotal += workedMinutes;
            int configuredSupportMinutes = supportApprovedMinutesByDate.getOrDefault(date, 0);
            // Support credits without an interval cannot safely be combined with an existing punch.
            if (configuredSupportMinutes > 0 && workedMinutes > 0) {
                throw new IllegalStateException("Payroll review required: overlapping support credit on " + date);
            }
            boolean paidLeave = leaveBuckets.paidLeaveDates.contains(date) || leaveBuckets.paidCasualDates.contains(date);
            int permission = paidLeave ? 0 : Math.min(permissionCredits.getOrDefault(date, 0), Math.max(0, scheduledMinutes - workedMinutes));
            approvedPermissionMinutes += permission;
            int payable = paidLeave ? scheduledMinutes : Math.min(scheduledMinutes, workedMinutes + Math.max(configuredSupportMinutes, permission));
            payableRegularMinutes += payable;
            Map<String, Object> actual = actualByDate.get(date);
            int ot = actual == null ? 0 : Math.min(objectInt(actual.get("candidateOvertimeMinutes")), approvedOtLimits.getOrDefault(date, 0));
            overtimeMinutes += ot;
            Map<String, Object> day = new LinkedHashMap<>();
            if (actual != null) day.putAll(actual);
            else for (Map<String, Object> calendarRow : calendarRows) {
                if (date.equals(parseDbDate(String.valueOf(calendarRow.get("date"))))) { day.putAll(calendarRow); break; }
            }
            day.put("paidCreditMinutes", Math.max(0, payable - workedMinutes));
            day.put("payableMinutes", payable);
            day.put("approvedOvertimeMinutes", ot);
            day.put("unpaidMissingMinutes", Math.max(0, scheduledMinutes - payable));
            day.put("dayEarnedAmount", moneyForMinutes(monthlySalary, payable, scheduledWorkingMinutes));
            day.put("overtimeAmount", moneyForMinutes(monthlySalary, ot, scheduledWorkingMinutes));
            dailyRows.add(day);
        }
        int payableScheduledMinutes = payableRegularMinutes;
        int payableWorkingMinutes = payableScheduledMinutes;

        int expectedWorkingDays = (int) Math.round(scheduledWorkingDays);
        int workedDays = presentWorkingDates.size();
        int totalLateMinutes = classifiedLateMinutesByDate.values().stream()
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .sum();
        int presentPayableMinutes = classifiedPayableMinutesByDate.values().stream()
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .sum();
        int absentMinutes = Math.max(0, eligibleScheduledMinutes - payableScheduledMinutes);
        int absentDays = normalShiftMinutes > 0
                ? (int) Math.ceil(absentMinutes / (double) normalShiftMinutes)
                : 0;
        double payablePresentDays = normalShiftMinutes > 0
                ? payableScheduledMinutes / (double) normalShiftMinutes
                : 0.0;
        double absentPayableDays = normalShiftMinutes > 0
                ? absentMinutes / (double) normalShiftMinutes
                : 0.0;

        double perMinuteSalary = scheduledWorkingMinutes > 0 ? salary / scheduledWorkingMinutes : 0.0;
        double perHourSalary = perMinuteSalary * 60.0;
        double perDaySalary = scheduledWorkingDays > 0 ? salary / scheduledWorkingDays : 0.0;
        int unpaidMissingMinutes = Math.max(0, absentMinutes - totalLateMinutes);
        BigDecimal proratedBasic = moneyForMinutes(monthlySalary, eligibleScheduledMinutes, scheduledWorkingMinutes);
        BigDecimal lateAmount = moneyForMinutes(monthlySalary, totalLateMinutes, scheduledWorkingMinutes);
        BigDecimal unpaidMissingAmount = moneyForMinutes(monthlySalary, unpaidMissingMinutes, scheduledWorkingMinutes);
        double netSalary = proratedBasic.subtract(unpaidMissingAmount).doubleValue();
        reconcileDailyAmounts(dailyRows, "dayEarnedAmount", proratedBasic);
        BigDecimal overtimeAmount = moneyForMinutes(monthlySalary, overtimeMinutes, scheduledWorkingMinutes);
        reconcileDailyAmounts(dailyRows, "overtimeAmount", overtimeAmount);

        double expectedHours = minutesToHours(scheduledWorkingMinutes);
        double payableHours = minutesToHours(payableWorkingMinutes);
        double workedHours = minutesToHours(attendancePresentMinutesTotal);
        double missingHours = minutesToHours(absentMinutes);
        int holidayDaysFull = (int) holidayFractionByDate.values().stream()
                .filter(value -> value != null && value >= 1.0)
                .count();
        int holidayDaysHalf = (int) holidayFractionByDate.values().stream()
                .filter(value -> value != null && value > 0.0 && value < 1.0)
                .count();
        int derivedUnpaidLeaveDays = Math.max(0, absentDays - leaveBuckets.unpaidCasualDates.size());

        return new PayrollResult(
                employeeId,
                year,
                month,
                daysInMonth,
                Math.max(0, daysInMonth - configuredWeekOffDays - (int) Math.ceil(publicHolidayDays)),
                expectedWorkingDays,
                holidayDaysFull,
                holidayDaysHalf,
                leaveBuckets.paidLeaveDates.size(),
                leaveBuckets.paidCasualDates.size(),
                leaveBuckets.unpaidCasualDates.size(),
                derivedUnpaidLeaveDays,
                workedDays,
                absentDays,
                absentMinutes,
                expectedHours,
                payableHours,
                workedHours,
                scheduledWorkingMinutes,
                attendancePresentMinutesTotal,
                presentPayableMinutes,
                scheduledWorkingDays,
                payablePresentDays,
                absentPayableDays,
                perDaySalary,
                perMinuteSalary,
                perHourSalary,
                missingHours,
                netSalary,
                minutesToHours(overtimeMinutes),
                configuredWeekOffDays,
                publicHolidayDays,
                casualBalance,
                clUtilizedDays,
                approvedPermissionMinutes,
                lateDates.size(),
                totalLateMinutes,
                normalShiftMinutes,
                scheduledWorkingMinutes,
                payableWorkingMinutes,
                salary,
                perMinuteSalary,
                proratedBasic.doubleValue(),
                additionalWorkingDays, dailyRows, overtimeAmount,
                proratedBasic,
                unpaidMissingAmount,
                lateAmount,
                unpaidMissingMinutes);
    }

    private Map<String, Object> normalizeCurrentOpenPunch(Map<String, Object> row, LocalDate date, LocalDate today) {
        if (row == null || date == null || today == null || !date.equals(today)) {
            return row;
        }
        if (!objectBoolean(row.get("reviewRequired")) || !hasValue(row.get("timeIn")) || hasValue(row.get("timeOut"))) {
            return row;
        }
        Map<String, Object> pending = new LinkedHashMap<>(row);
        pending.put("displayStatus", "Pending");
        pending.put("countStatus", "Pending");
        pending.put("payableStatus", "Pending");
        pending.put("payable", false);
        pending.put("payableMinutes", 0);
        pending.put("workedMinutes", 0);
        pending.put("workedHours", 0.0);
        pending.put("workingDurationDisplay", "Pending");
        pending.put("candidateOvertimeMinutes", 0);
        pending.put("lateMinutes", 0);
        pending.put("earlyOutMinutes", 0);
        pending.put("calculatedMissedMinutes", 0);
        pending.put("missedTimes", 0);
        pending.put("reviewRequired", false);
        pending.put("reviewReason", null);
        pending.put("payrollPending", true);
        pending.put("payrollPendingReason", "Time Out pending");
        return pending;
    }

    static BigDecimal moneyForMinutes(BigDecimal salary, int minutes, int denominator) {
        return salary.multiply(BigDecimal.valueOf(minutes)).divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP);
    }

    private void reconcileDailyAmounts(List<Map<String, Object>> rows, String key, BigDecimal total) {
        BigDecimal sum = rows.stream().map(row -> (BigDecimal) row.get(key)).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal difference = total.subtract(sum);
        // Allocate the currency rounding residual once; daily displayed amounts then sum exactly.
        for (int i = rows.size() - 1; i >= 0 && difference.signum() != 0; i--) {
            Map<String, Object> row = rows.get(i);
            BigDecimal amount = (BigDecimal) row.get(key);
            String minutesKey = "overtimeAmount".equals(key) ? "approvedOvertimeMinutes" : "payableMinutes";
            if (objectInt(row.get(minutesKey)) > 0) {
                BigDecimal adjustment = difference.signum() > 0 ? difference : difference.max(amount.negate());
                row.put(key, amount.add(adjustment));
                row.put(key + "RoundingAdjustment", adjustment);
                difference = difference.subtract(adjustment);
            }
        }
    }

    private LocalDate parseJoiningDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try { return LocalDate.parse(raw); }
        catch (DateTimeParseException ignored) {
            LocalDate date = parseDbDate(raw);
            if (date == null) throw new IllegalStateException("Payroll review required: invalid joining date");
            return date;
        }
    }

    private Map<LocalDate, Integer> permissionCredits(Employee employee, List<AttendanceRecord> records,
            Map<LocalDate, Map<String, Object>> rows, Set<LocalDate> paidDates, int month, int year) {
        Map<LocalDate, BitSet> covered = new TreeMap<>();
        for (LeavePermission leave : leavePermissionRepository.findByEmployeeIdAndStatus(employee.getId(), "approved")) {
            if (!isPermissionType(leave.getLeaveType())) continue;
            LocalDate date = parseDbDate(leave.getDate());
            if (date == null) date = parseDbDate(leave.getStartDate());
            if (date == null || date.getYear() != year || date.getMonthValue() != month) continue;
            LocalDate joining = parseJoiningDate(employee.getDateOfJoining());
            if (paidDates.contains(date) || (joining != null && date.isBefore(joining))) continue;
            Map<String, Object> row = rows.get(date);
            if (row == null || objectInt(row.get("expectedMinutes")) <= 0) continue;
            Optional<LocalTime> start = parseFlexibleTime(leave.getStartTime());
            Optional<LocalTime> end = parseFlexibleTime(leave.getEndTime());
            Optional<LocalTime> shiftStart = parseFlexibleTime(String.valueOf(row.get("expectedShiftStart")));
            if (start.isEmpty() || end.isEmpty() || shiftStart.isEmpty()) {
                throw new IllegalStateException("Payroll review required: invalid permission time on " + date);
            }
            LocalDateTime shift = date.atTime(shiftStart.get());
            LocalDateTime from = date.atTime(start.get());
            LocalDateTime to = date.atTime(end.get());
            if (!to.isAfter(from)) to = to.plusDays(1);
            int expected = objectInt(row.get("expectedMinutes"));
            LocalDateTime shiftEnd = shift.plusMinutes(expected);
            if (shiftEnd.toLocalDate().isAfter(date) && !to.isAfter(shift)) {
                from = from.plusDays(1); to = to.plusDays(1);
            }
            AttendanceRecord record = null;
            for (AttendanceRecord candidate : records) if (date.equals(parseDbDate(candidate.getDate()))) { record = candidate; break; }
            LocalDateTime in = record == null || record.getTimeIn() == null ? null : AttendanceMinuteCalculator.minute(record.getTimeIn());
            LocalDateTime out = record == null || record.getTimeOut() == null ? null : AttendanceMinuteCalculator.minute(record.getTimeOut());
            BitSet minutes = covered.computeIfAbsent(date, unused -> new BitSet(expected));
            for (int minute = 0; minute < expected; minute++) {
                LocalDateTime point = shift.plusMinutes(minute);
                if (!point.isBefore(from) && point.isBefore(to)
                        && (in == null || out == null || point.isBefore(in) || !point.isBefore(out))) minutes.set(minute);
            }
        }
        int remaining = (int) Math.round(PayrollCompatibilityDefaults.resolvePermissionHoursAllowed(employee) * 60);
        Map<LocalDate, Integer> result = new HashMap<>();
        for (Map.Entry<LocalDate, BitSet> entry : covered.entrySet()) {
            int credit = Math.min(remaining, entry.getValue().cardinality());
            result.put(entry.getKey(), credit);
            remaining -= credit;
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<PayrollDebugEntry> calculateMonthlyPayrollDebug(Long employeeId, int month, int year, Long clientIdOverride) {
        schemaMaintenanceService.ensureEmployeeSchema();
        Optional<Employee> employeeOpt = employeeRepository.findById(employeeId);
        if (employeeOpt.isEmpty()) {
            return List.of();
        }

        Employee employee = employeeOpt.get();
        Long effectiveClientId = clientIdOverride != null ? clientIdOverride : employee.getClientId();
        LocalDate firstDate = LocalDate.of(year, month, 1);
        LocalDate lastDate = firstDate.withDayOfMonth(firstDate.lengthOfMonth());
        Set<LocalDate> approvedSwapWeekoffDates =
                resolveApprovedSwapWeekoffDates(employeeId, month, year);

        SchedulePolicy policy = resolveSchedulePolicy(employee);
        LeaveAllowancePolicy leaveAllowancePolicy = resolveLeaveAllowancePolicy(employee);
        Map<LocalDate, ShiftWindow> shiftWindowsByDate =
                buildShiftWindows(employee, policy, firstDate, lastDate, approvedSwapWeekoffDates);
        Map<LocalDate, Integer> scheduledMinutesByDate = new HashMap<>();
        for (Map.Entry<LocalDate, ShiftWindow> entry : shiftWindowsByDate.entrySet()) {
            scheduledMinutesByDate.put(entry.getKey(), entry.getValue().minutes);
        }

        Map<LocalDate, Double> holidayFractionByDate =
                buildHolidayMap(effectiveClientId, firstDate, lastDate);
        LeaveBuckets leaveBuckets = buildLeaveBuckets(
                employeeId,
                month,
                year,
                holidayFractionByDate,
                scheduledMinutesByDate);
        int casualBalance = leaveAllowancePolicy.casualLeaveAllowed();
        leaveBuckets.applyCasualBalance(scheduledMinutesByDate, casualBalance);

        WorkSummary workSummary = buildWorkedMinutesByDate(employee, month, year);

        List<PayrollDebugEntry> rows = new ArrayList<>();
        for (Map.Entry<LocalDate, ShiftWindow> entry : shiftWindowsByDate.entrySet()) {
            LocalDate date = entry.getKey();
            ShiftWindow window = entry.getValue();
            int scheduledMinutes = window == null ? 0 : window.minutes;

            boolean holiday = holidayFractionByDate.containsKey(date);
            boolean paidLeave = leaveBuckets.paidLeaveDates.contains(date);
            boolean unpaidLeave = leaveBuckets.unpaidLeaveDates.contains(date);
            boolean paidCasual = leaveBuckets.paidCasualDates.contains(date);
            boolean unpaidCasual = leaveBuckets.unpaidCasualDates.contains(date);

            WorkEntry workEntry = workSummary.workEntries.get(date);
            int workedMinutes = workSummary.workedMinutesByDate.getOrDefault(date, 0);
            boolean workedDay = workedMinutes > 0;
            boolean weekOff = scheduledMinutes <= 0;
            boolean payableDay = workedDay || weekOff || holiday || paidLeave || paidCasual;
            int payableMinutes = 0;
            int overtimeMinutes = 0;

            if (payableDay) {
                payableMinutes = Math.max(0, scheduledMinutes);
            }

            if (workEntry != null
                    && workEntry.recordedOvertimeMinutes > 0
                    && workSummary.overtimeApprovedDates.contains(date)) {
                overtimeMinutes = workEntry.recordedOvertimeMinutes;
            } else if (workSummary.overtimeApprovedDates.contains(date)
                    && window != null
                    && window.end != null
                    && workEntry != null
                    && workEntry.earliestTimeInTime != null
                    && workEntry.latestTimeOutTime != null
                    && workEntry.latestTimeOutTime.isAfter(window.end)) {
                LocalTime overtimeStart = workEntry.earliestTimeInTime.isAfter(window.end)
                        ? workEntry.earliestTimeInTime
                        : window.end;
                if (workEntry.latestTimeOutTime.isAfter(overtimeStart)) {
                    overtimeMinutes = (int) Duration.between(overtimeStart, workEntry.latestTimeOutTime).toMinutes();
                }
            }

            rows.add(new PayrollDebugEntry(
                    date.toString(),
                    window != null && window.start != null ? window.start.toString() : null,
                    window != null && window.end != null ? window.end.toString() : null,
                    workEntry != null && workEntry.earliestTimeInTime != null ? workEntry.earliestTimeInTime.toString() : null,
                    workEntry != null && workEntry.latestTimeOutTime != null ? workEntry.latestTimeOutTime.toString() : null,
                    scheduledMinutes,
                    payableMinutes,
                    overtimeMinutes,
                    workSummary.overtimeApprovedDates.contains(date),
                    holiday,
                    paidLeave || paidCasual,
                    (unpaidLeave || unpaidCasual) && !payableDay
            ));
        }

        return rows;
    }

    private EmployeeAdditionalWorkingDay resolveAdditionalOverride(
            LocalDate date,
            Map<LocalDate, Integer> saturdayIndex,
            Map<LocalDate, Integer> sundayIndex,
            Map<AdditionalWorkingDayType, EmployeeAdditionalWorkingDay> additionalMap) {
        DayOfWeek dayOfWeek = date.getDayOfWeek();
        if (dayOfWeek == DayOfWeek.SATURDAY) {
            Integer index = saturdayIndex.get(date);
            if (index != null) {
                boolean isOdd = index % 2 == 1;
                AdditionalWorkingDayType type = isOdd
                        ? AdditionalWorkingDayType.ODD_SATURDAY
                        : AdditionalWorkingDayType.EVEN_SATURDAY;
                return resolveAdditionalDayFromMap(type, additionalMap);
            }
        } else if (dayOfWeek == DayOfWeek.SUNDAY) {
            Integer index = sundayIndex.get(date);
            if (index != null) {
                boolean isOdd = index % 2 == 1;
                AdditionalWorkingDayType type = isOdd
                        ? AdditionalWorkingDayType.ODD_SUNDAY
                        : AdditionalWorkingDayType.EVEN_SUNDAY;
                return resolveAdditionalDayFromMap(type, additionalMap);
            }
        }
        return null;
    }

    private EmployeeAdditionalWorkingDay resolveAdditionalDayFromMap(
            AdditionalWorkingDayType type,
            Map<AdditionalWorkingDayType, EmployeeAdditionalWorkingDay> additionalMap) {
        if (type == null || additionalMap == null || additionalMap.isEmpty()) {
            return null;
        }
        return additionalMap.get(type);
    }

    private Map<LocalDate, Integer> buildWeekdayIndex(LocalDate start, LocalDate end, DayOfWeek target) {
        Map<LocalDate, Integer> indexMap = new HashMap<>();
        int count = 0;
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            if (date.getDayOfWeek() == target) {
                count++;
                indexMap.put(date, count);
            }
        }
        return indexMap;
    }

    private Map<LocalDate, Double> buildHolidayMap(Long clientId, LocalDate start, LocalDate end) {
        if (clientId == null) {
            return Collections.emptyMap();
        }
        Map<LocalDate, Double> holidayMap = new HashMap<>();
        List<Holiday> holidays = holidayRepository.findByClientIdAndHolidayDateBetweenOrderByHolidayDateAsc(
                clientId,
                start,
                end);
        for (Holiday holiday : holidays) {
            if (holiday == null || holiday.getHolidayDate() == null) {
                continue;
            }
            double fraction = "HALF".equalsIgnoreCase(holiday.getHolidayType()) ? 0.5 : 1.0;
            holidayMap.put(holiday.getHolidayDate(), fraction);
        }
        return holidayMap;
    }

    private LeaveBuckets buildLeaveBuckets(
            Long employeeId,
            int month,
            int year,
            Map<LocalDate, Double> holidayMap,
            Map<LocalDate, Integer> scheduledMinutesByDate) {
        List<LeavePermission> approvedLeaves =
                leavePermissionRepository.findByEmployeeIdAndStatus(employeeId, "approved");

        Set<LocalDate> paidLeaveDates = new HashSet<>();
        Set<LocalDate> unpaidLeaveDates = new HashSet<>();
        List<LocalDate> casualLeaveDates = new ArrayList<>();

        for (LeavePermission leave : approvedLeaves) {
            LeaveCategory category = resolveLeaveCategory(leave.getLeaveType());
            if (category == LeaveCategory.IGNORE) {
                continue;
            }

            for (LocalDate date : expandLeaveDates(leave, month, year)) {
                if (scheduledMinutesByDate != null) {
                    Integer scheduledMinutes = scheduledMinutesByDate.get(date);
                    if (scheduledMinutes == null || scheduledMinutes <= 0) {
                        continue;
                    }
                }
                if (category == LeaveCategory.CASUAL) {
                    casualLeaveDates.add(date);
                } else if (category == LeaveCategory.PAID) {
                    paidLeaveDates.add(date);
                } else if (category == LeaveCategory.UNPAID) {
                    unpaidLeaveDates.add(date);
                }
            }
        }

        Collections.sort(casualLeaveDates);
        List<LocalDate> uniqueCasualDates = new ArrayList<>(new LinkedHashSet<>(casualLeaveDates));
        return new LeaveBuckets(paidLeaveDates, unpaidLeaveDates, uniqueCasualDates);
    }

    private WorkSummary buildWorkedMinutesByDate(
            Employee employee,
            int month,
            int year) {
        Long employeeId = employee == null ? null : employee.getId();
        if (employeeId == null) {
            return new WorkSummary(new HashMap<>(), new HashSet<>(), new HashMap<>(), 0);
        }
        List<AttendanceRecord> records = attendanceRecordRepository.findByEmployeeId(employeeId);
        Map<LocalDate, Integer> workedMinutesByDate = new HashMap<>();
        Set<LocalDate> overtimeApprovedDates = new HashSet<>();
        Map<LocalDate, WorkEntry> workEntries = new HashMap<>();

        for (AttendanceRecord record : records) {
            LocalDate date = parseDbDate(record.getDate());
            if (date == null || date.getMonthValue() != month || date.getYear() != year) {
                continue;
            }
            LocalDateTime normalizedIn = normalizeToMinute(record.getTimeIn());
            LocalDateTime normalizedOut = normalizeToMinute(record.getTimeOut());
            int minutes = resolveWorkedMinutes(record, normalizedIn, normalizedOut);

            if (minutes <= 0) {
                continue;
            }
            workedMinutesByDate.merge(date, minutes, Integer::sum);
            WorkEntry entry = workEntries.getOrDefault(date, new WorkEntry());
            if (normalizedIn != null && (entry.earliestTimeIn == null || normalizedIn.isBefore(entry.earliestTimeIn))) {
                entry.earliestTimeIn = normalizedIn;
                entry.earliestTimeInTime = normalizedIn.toLocalTime();
            }
            if (normalizedOut != null && (entry.latestTimeOut == null || normalizedOut.isAfter(entry.latestTimeOut))) {
                entry.latestTimeOut = normalizedOut;
                entry.latestTimeOutTime = normalizedOut.toLocalTime();
            }
            entry.recordedOvertimeMinutes += resolveRecordedOvertimeMinutes(record);
            entry.permissionUsedMinutes += resolvePermissionUsedMinutes(record);
            workEntries.put(date, entry);
            if (Boolean.TRUE.equals(record.getOvertimeApproved())) {
                overtimeApprovedDates.add(date);
            }
        }

        List<OvertimeRequest> approvedRequests =
                overtimeRequestRepository.findByEmployeeIdAndStatus(employeeId, OvertimeRequestStatus.APPROVED);
        for (OvertimeRequest request : approvedRequests) {
            if (request == null || request.getDate() == null) {
                continue;
            }
            LocalDate requestDate = parseDbDate(request.getDate());
            if (requestDate == null || requestDate.getMonthValue() != month || requestDate.getYear() != year) {
                continue;
            }
            overtimeApprovedDates.add(requestDate);
        }

        int totalPermissionUsedMinutes = 0;
        for (WorkEntry entry : workEntries.values()) {
            totalPermissionUsedMinutes += entry == null ? 0 : entry.permissionUsedMinutes;
        }
        return new WorkSummary(workedMinutesByDate, overtimeApprovedDates, workEntries, totalPermissionUsedMinutes);
    }

    private Map<LocalDate, Integer> buildSupportApprovedMinutesByDate(Long employeeId, int month, int year) {
        if (employeeId == null) {
            return Collections.emptyMap();
        }
        Map<LocalDate, Integer> approvedMinutesByDate = new HashMap<>();
        List<AttendanceSupportRequest> approvedRequests =
                attendanceSupportRequestRepository.findByEmployeeIdAndStatus(
                        employeeId,
                        AttendanceSupportStatus.APPROVED);
        for (AttendanceSupportRequest request : approvedRequests) {
            if (request == null || request.getAttendanceDate() == null
                    || request.getAttendanceDate().getMonthValue() != month
                    || request.getAttendanceDate().getYear() != year) {
                continue;
            }
            int approvedMinutes = request.getApprovedMinutes() == null
                    ? 0
                    : Math.max(0, request.getApprovedMinutes());
            approvedMinutesByDate.merge(request.getAttendanceDate(), approvedMinutes, Math::max);
        }
        return approvedMinutesByDate;
    }

    private int resolveWorkedMinutes(AttendanceRecord record, LocalDateTime normalizedIn, LocalDateTime normalizedOut) {
        if (record == null) {
            return 0;
        }
        // New attendance rows may carry worked_hours directly. Legacy rows fall back to timeIn/timeOut.
        if (record.getWorkedHours() != null && record.getWorkedHours() > 0) {
            return (int) Math.round(record.getWorkedHours() * 60.0);
        }
        if (normalizedIn == null || normalizedOut == null || !normalizedOut.isAfter(normalizedIn)) {
            return 0;
        }
        return (int) Duration.between(normalizedIn, normalizedOut).toMinutes();
    }

    private int resolveRecordedOvertimeMinutes(AttendanceRecord record) {
        if (record == null || record.getOvertime() == null || record.getOvertime() <= 0) {
            return 0;
        }
        return (int) Math.round(record.getOvertime() * 60.0);
    }

    private int resolvePermissionUsedMinutes(AttendanceRecord record) {
        if (record == null || record.getPermissionUsed() == null || record.getPermissionUsed() <= 0) {
            return 0;
        }
        return (int) Math.round(record.getPermissionUsed() * 60.0);
    }

    private int calculateApprovedPermissionMinutes(Long employeeId, int month, int year) {
        if (employeeId == null) {
            return 0;
        }
        List<LeavePermission> approvedLeaves =
                leavePermissionRepository.findByEmployeeIdAndStatus(employeeId, "approved");
        int totalMinutes = 0;
        for (LeavePermission leave : approvedLeaves) {
            if (leave == null || !isPermissionType(leave.getLeaveType())) {
                continue;
            }
            LocalDate permissionDate = parseDbDate(leave.getDate());
            if (permissionDate == null) {
                permissionDate = parseDbDate(leave.getStartDate());
            }
            if (permissionDate == null
                    || permissionDate.getMonthValue() != month
                    || permissionDate.getYear() != year) {
                continue;
            }
            Optional<LocalTime> startOpt = parseFlexibleTime(leave.getStartTime());
            Optional<LocalTime> endOpt = parseFlexibleTime(leave.getEndTime());
            if (startOpt.isEmpty() || endOpt.isEmpty()) {
                continue;
            }
            LocalTime start = startOpt.get();
            LocalTime end = endOpt.get();
            if (!end.isAfter(start)) {
                continue;
            }
            totalMinutes += (int) Duration.between(start, end).toMinutes();
        }
        return Math.max(0, totalMinutes);
    }

    private SchedulePolicy resolveSchedulePolicy(Employee employee) {
        String policyRaw = employee == null ? null : employee.getLeavePolicyType();
        String weekOffRaw = employee == null ? null : employee.getWeekOff();

        LeavePolicyType policyType = LeavePolicyType.WEEKOFF;
        if (policyRaw != null && !policyRaw.isBlank()) {
            String normalized = policyRaw.trim().toUpperCase();
            if (normalized.contains("WEEKEND")) {
                policyType = LeavePolicyType.WEEKEND_OFF;
            } else if (normalized.contains("SAT") && normalized.contains("SUN")) {
                policyType = LeavePolicyType.WEEKEND_OFF;
            }
        } else if (weekOffRaw != null) {
            String normalized = weekOffRaw.trim().toUpperCase();
            if (normalized.contains("SAT") && normalized.contains("SUN")) {
                policyType = LeavePolicyType.WEEKEND_OFF;
            } else if ("WEEKEND".equals(normalized) || "WEEKEND_OFF".equals(normalized)) {
                policyType = LeavePolicyType.WEEKEND_OFF;
            }
        }

        DayOfWeek weekOffDay = parseDayOfWeek(weekOffRaw);
        if (weekOffDay == null) {
            weekOffDay = DayOfWeek.SUNDAY;
        }
        return new SchedulePolicy(policyType, weekOffDay);
    }

    private LeaveAllowancePolicy resolveLeaveAllowancePolicy(Employee employee) {
        int fallbackCasual = employee != null && employee.getCasualLeaveBalance() != null
                ? Math.max(0, employee.getCasualLeaveBalance())
                : PayrollCompatibilityDefaults.DEFAULT_CASUAL_LEAVE_ALLOWED;
        int fallbackSick = PayrollCompatibilityDefaults.DEFAULT_SICK_LEAVE_ALLOWED;
        int fallbackEarned = PayrollCompatibilityDefaults.DEFAULT_EARNED_LEAVE_ALLOWED;

        if (employee == null || employee.getId() == null) {
            return new LeaveAllowancePolicy(fallbackCasual, fallbackSick, fallbackEarned);
        }

        return leavePolicyRepository.findByEmployee_Id(employee.getId())
                .map(policy -> new LeaveAllowancePolicy(
                        policy.getCasualLeaveAllowed() == null ? fallbackCasual : Math.max(0, policy.getCasualLeaveAllowed()),
                        policy.getSickLeaveAllowed() == null ? fallbackSick : Math.max(0, policy.getSickLeaveAllowed()),
                        policy.getEarnedLeaveAllowed() == null ? fallbackEarned : Math.max(0, policy.getEarnedLeaveAllowed())))
                .orElseGet(() -> new LeaveAllowancePolicy(fallbackCasual, fallbackSick, fallbackEarned));
    }

    private DayOfWeek parseDayOfWeek(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.trim().toUpperCase();
        if (normalized.length() >= 3) {
            normalized = normalized.substring(0, 3);
        }
        return switch (normalized) {
            case "MON" -> DayOfWeek.MONDAY;
            case "TUE" -> DayOfWeek.TUESDAY;
            case "WED" -> DayOfWeek.WEDNESDAY;
            case "THU" -> DayOfWeek.THURSDAY;
            case "FRI" -> DayOfWeek.FRIDAY;
            case "SAT" -> DayOfWeek.SATURDAY;
            case "SUN" -> DayOfWeek.SUNDAY;
            default -> null;
        };
    }

    private LeaveCategory resolveLeaveCategory(String raw) {
        if (raw == null || raw.isBlank()) {
            return LeaveCategory.UNPAID;
        }
        String normalized = raw.trim().toUpperCase();
        if (isSwapWeekoffType(raw)) {
            return LeaveCategory.IGNORE;
        }
        if (normalized.contains("PERMISSION")) {
            return LeaveCategory.IGNORE;
        }
        if ("CL".equals(normalized) || normalized.contains("CASUAL")) {
            return LeaveCategory.CASUAL;
        }
        if (normalized.contains("UNPAID") || normalized.contains("LOP") || normalized.contains("LOSS")) {
            return LeaveCategory.UNPAID;
        }
        if (normalized.contains("PAID")) {
            return LeaveCategory.PAID;
        }
        return LeaveCategory.UNPAID;
    }

    private List<LocalDate> expandLeaveDates(LeavePermission leave, int month, int year) {
        List<LocalDate> dates = new ArrayList<>();

        LocalDate start = parseDbDate(leave.getStartDate());
        LocalDate end = parseDbDate(leave.getEndDate());
        if (start == null || end == null) {
            LocalDate single = parseDbDate(leave.getDate());
            if (single != null) {
                dates.add(single);
            }
        } else {
            for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
                dates.add(date);
            }
        }

        List<LocalDate> filtered = new ArrayList<>();
        for (LocalDate date : dates) {
            if (date.getMonthValue() == month && date.getYear() == year) {
                filtered.add(date);
            }
        }
        return filtered;
    }

    private LocalDate parseDbDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim(), DB_DATE_FORMATTER);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private int resolveNormalShiftMinutes(Employee employee) {
        LocalTime start = PayrollCompatibilityDefaults.resolveShiftStart(employee);
        LocalTime end = PayrollCompatibilityDefaults.resolveShiftEnd(employee);
        return Math.max((int) Duration.between(start, end).toMinutes(), 0);
    }

    private int resolveAllowedPermissionMinutes(Employee employee) {
        return (int) Math.round(PayrollCompatibilityDefaults.resolvePermissionHoursAllowed(employee) * 60.0);
    }

    private void mergePaidNonWorkingFraction(
            Map<LocalDate, Double> fractionsByDate,
            LocalDate date,
            Double fraction) {
        if (date == null || fraction == null || fraction <= 0) {
            return;
        }
        fractionsByDate.merge(date, Math.min(1.0, fraction), Math::max);
    }

    private Optional<LocalTime> parseFlexibleTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        String value = raw.trim();
        try {
            return Optional.of(LocalTime.parse(value, TIME_FORMATTER_HH_MM_SS));
        } catch (DateTimeParseException ignored) {
            // Fallback to HH:mm.
        }
        try {
            return Optional.of(LocalTime.parse(value, TIME_FORMATTER_HH_MM));
        } catch (DateTimeParseException ignored) {
            return Optional.empty();
        }
    }

    private double minutesToHours(double minutes) {
        return Math.round((minutes / 60.0) * 100.0) / 100.0;
    }

    private double roundMoney(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private boolean hasValue(Object value) {
        return value != null && !String.valueOf(value).isBlank();
    }

    private int objectInt(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value == null) {
            return 0;
        }
        try {
            return Integer.parseInt(String.valueOf(value).trim());
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private boolean objectBoolean(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        return value != null && Boolean.parseBoolean(String.valueOf(value));
    }

    private ShiftWindow resolveClassificationShiftWindow(List<Map<String, Object>> calendarRows, LocalDate date) {
        if (calendarRows == null || date == null) {
            return null;
        }
        for (Map<String, Object> row : calendarRows) {
            LocalDate rowDate = parseDbDate(String.valueOf(row.getOrDefault("date", "")));
            if (!date.equals(rowDate)) {
                continue;
            }
            Optional<LocalTime> start = parseFlexibleTime(String.valueOf(row.getOrDefault("expectedShiftStart", "")));
            Optional<LocalTime> end = parseFlexibleTime(String.valueOf(row.getOrDefault("expectedShiftEnd", "")));
            int minutes = Math.max(0, objectInt(row.get("expectedMinutes")));
            if (start.isPresent() && end.isPresent() && minutes > 0) {
                return new ShiftWindow(start.get(), end.get(), minutes);
            }
            return new ShiftWindow(null, null, 0);
        }
        return null;
    }

    private enum LeavePolicyType {
        WEEKOFF,
        WEEKEND_OFF
    }

    private enum LeaveCategory {
        CASUAL,
        PAID,
        UNPAID,
        IGNORE
    }

    private record SchedulePolicy(LeavePolicyType type, DayOfWeek weekOffDay) {
        boolean isWeekOff(DayOfWeek day) {
            if (type == LeavePolicyType.WEEKEND_OFF) {
                return day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY;
            }
            return day == weekOffDay;
        }
    }

    private record LeaveAllowancePolicy(int casualLeaveAllowed, int sickLeaveAllowed, int earnedLeaveAllowed) {
    }

    private static class LeaveBuckets {
        private final Set<LocalDate> paidLeaveDates;
        private final Set<LocalDate> unpaidLeaveDates;
        private final List<LocalDate> casualLeaveDates;
        private final Set<LocalDate> paidCasualDates = new HashSet<>();
        private final Set<LocalDate> unpaidCasualDates = new HashSet<>();

        private LeaveBuckets(Set<LocalDate> paidLeaveDates,
                             Set<LocalDate> unpaidLeaveDates,
                             List<LocalDate> casualLeaveDates) {
            this.paidLeaveDates = paidLeaveDates;
            this.unpaidLeaveDates = unpaidLeaveDates;
            this.casualLeaveDates = casualLeaveDates;
        }

        void applyCasualBalance(Map<LocalDate, Integer> scheduledMinutesByDate, int balance) {
            int remainingBalance = Math.max(0, balance);
            for (LocalDate date : casualLeaveDates) {
                Integer scheduledMinutes = scheduledMinutesByDate.get(date);
                if (scheduledMinutes == null || scheduledMinutes <= 0) {
                    continue;
                }
                if (remainingBalance > 0) {
                    paidCasualDates.add(date);
                    remainingBalance--;
                } else {
                    unpaidCasualDates.add(date);
                }
            }
        }
    }

    private static class WorkSummary {
        private final Map<LocalDate, Integer> workedMinutesByDate;
        private final Set<LocalDate> overtimeApprovedDates;
        private final Map<LocalDate, WorkEntry> workEntries;
        private final int totalPermissionUsedMinutes;

        private WorkSummary(Map<LocalDate, Integer> workedMinutesByDate,
                            Set<LocalDate> overtimeApprovedDates,
                            Map<LocalDate, WorkEntry> workEntries,
                            int totalPermissionUsedMinutes) {
            this.workedMinutesByDate = workedMinutesByDate;
            this.overtimeApprovedDates = overtimeApprovedDates;
            this.workEntries = workEntries;
            this.totalPermissionUsedMinutes = totalPermissionUsedMinutes;
        }

        private int totalPermissionUsedMinutes() {
            return totalPermissionUsedMinutes;
        }
    }

    private static class WorkEntry {
        private LocalDateTime earliestTimeIn;
        private LocalDateTime latestTimeOut;
        private LocalTime earliestTimeInTime;
        private LocalTime latestTimeOutTime;
        private int recordedOvertimeMinutes = 0;
        private int permissionUsedMinutes = 0;
    }

    private Map<LocalDate, ShiftWindow> buildShiftWindows(
            Employee employee,
            SchedulePolicy policy,
            LocalDate start,
            LocalDate end,
            Set<LocalDate> approvedSwapWeekoffDates) {
        Map<AdditionalWorkingDayType, EmployeeAdditionalWorkingDay> additionalMap = new EnumMap<>(AdditionalWorkingDayType.class);
        if (employee.getAdditionalWorkingDays() != null) {
            for (EmployeeAdditionalWorkingDay day : employee.getAdditionalWorkingDays()) {
                if (day != null && day.getDayType() != null) {
                    additionalMap.putIfAbsent(day.getDayType(), day);
                }
            }
        }

        Map<LocalDate, ShiftWindow> schedule = new LinkedHashMap<>();
        Map<LocalDate, Integer> saturdayIndex = buildWeekdayIndex(start, end, DayOfWeek.SATURDAY);
        Map<LocalDate, Integer> sundayIndex = buildWeekdayIndex(start, end, DayOfWeek.SUNDAY);

        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            DayOfWeek dayOfWeek = date.getDayOfWeek();
            boolean isWeekOff = policy.isWeekOff(dayOfWeek);
            boolean isSwapWeekoffDate =
                    approvedSwapWeekoffDates != null && approvedSwapWeekoffDates.contains(date);

            EmployeeAdditionalWorkingDay override = resolveAdditionalOverride(
                    date,
                    saturdayIndex,
                    sundayIndex,
                    additionalMap);

            if (isSwapWeekoffDate) {
                schedule.put(date, new ShiftWindow(null, null, 0));
                continue;
            }

            if (override != null) {
                LocalTime startTime = parseFlexibleTime(override.getTimeIn()).orElse(PayrollCompatibilityDefaults.DEFAULT_SHIFT_START);
                LocalTime endTime = parseFlexibleTime(override.getTimeOut()).orElse(PayrollCompatibilityDefaults.DEFAULT_SHIFT_END);
                int minutes = Math.max((int) Duration.between(startTime, endTime).toMinutes(), 0);
                schedule.put(date, new ShiftWindow(startTime, endTime, minutes));
                continue;
            }

            if (isWeekOff || dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY) {
                schedule.put(date, new ShiftWindow(null, null, 0));
                continue;
            }

            LocalTime startTime = PayrollCompatibilityDefaults.resolveShiftStart(employee);
            LocalTime endTime = PayrollCompatibilityDefaults.resolveShiftEnd(employee);
            int minutes = Math.max((int) Duration.between(startTime, endTime).toMinutes(), 0);
            schedule.put(date, new ShiftWindow(startTime, endTime, minutes));
        }
        return schedule;
    }

    private Set<LocalDate> resolveApprovedSwapWeekoffDates(Long employeeId, int month, int year) {
        if (employeeId == null) {
            return Collections.emptySet();
        }
        List<LeavePermission> approvedLeaves =
                leavePermissionRepository.findByEmployeeIdAndStatus(employeeId, "approved");
        Set<LocalDate> swapWeekoffDates = new HashSet<>();
        for (LeavePermission leave : approvedLeaves) {
            if (!isSwapWeekoffType(leave.getLeaveType())) {
                continue;
            }
            swapWeekoffDates.addAll(expandLeaveDates(leave, month, year));
        }
        return swapWeekoffDates;
    }

    private boolean isSwapWeekoffType(String leaveTypeRaw) {
        if (leaveTypeRaw == null) {
            return false;
        }
        return leaveTypeRaw.trim().toLowerCase(Locale.ROOT).equals(SWAP_WEEKOFF_TYPE);
    }

    private boolean isPermissionType(String leaveTypeRaw) {
        if (leaveTypeRaw == null) {
            return false;
        }
        return leaveTypeRaw.trim().equalsIgnoreCase("Permission");
    }

    private static class ShiftWindow {
        private final LocalTime start;
        private final LocalTime end;
        private final int minutes;

        private ShiftWindow(LocalTime start, LocalTime end, int minutes) {
            this.start = start;
            this.end = end;
            this.minutes = minutes;
        }
    }

    public record PayrollDebugEntry(
            String date,
            String shiftStart,
            String shiftEnd,
            String actualIn,
            String actualOut,
            int scheduledMinutes,
            int payableMinutes,
            int overtimeMinutes,
            boolean overtimeApproved,
            boolean holiday,
            boolean paidLeave,
            boolean unpaidLeave
    ) {
    }

    private LocalDateTime normalizeToMinute(LocalDateTime value) {
        if (value == null) {
            return null;
        }
        return value.withSecond(0).withNano(0);
    }

    public record PayrollResult(
            Long employeeId,
            int year,
            int month,
            int daysInMonth,
            int scheduledDays,
            int expectedWorkingDays,
            int holidayDaysFull,
            int holidayDaysHalf,
            int paidLeaveDays,
            int paidCasualDays,
            int unpaidCasualDays,
            int unpaidLeaveDays,
            int workedDays,
            int absentDays,
            int absentMinutes,
            double expectedHours,
            double payableHours,
            double workedHours,
            int expectedWorkingMinutes,
            int presentWorkingMinutes,
            int payablePresentMinutes,
            double scheduledWorkingDays,
            double payablePresentDays,
            double absentPayableDays,
            double perDaySalary,
            double perMinuteSalary,
            double perHourSalary,
            double missingHours,
            double netSalary,
            double overtimeHours,
            int configuredWeekOffDays,
            double publicHolidayDays,
            int clEntitlementDays,
            int clUtilizedDays,
            int permissionDurationMinutes,
            int lateAttendanceDays,
            int lateAttendanceMinutes,
            int regularShiftMinutes,
            int scheduledWorkingMinutes,
            int payableWorkingMinutes,
            double basicSalary,
            double perMinuteRate,
            double estimatedNetSalary,
            int additionalWorkingDays,
            List<Map<String, Object>> dailyRows,
            BigDecimal overtimeAmount,
            BigDecimal proratedBasic,
            BigDecimal attendanceDeduction,
            BigDecimal lateAmount,
            int unpaidMissingMinutes) {
        public static PayrollResult empty() {
            return new PayrollResult(null, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, List.of(), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0);
        }
    }
}
