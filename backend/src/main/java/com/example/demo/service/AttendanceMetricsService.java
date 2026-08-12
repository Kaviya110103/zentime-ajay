package com.example.demo.service;

import com.example.demo.MODELS.AdditionalWorkingDayType;
import com.example.demo.MODELS.AttendanceRecord;
import com.example.demo.MODELS.Employee;
import com.example.demo.MODELS.EmployeeAdditionalWorkingDay;
import com.example.demo.MODELS.LeavePermission;
import com.example.demo.repo.AttendanceRecordRepository;
import com.example.demo.repo.EmployeeRepository;
import com.example.demo.repo.EmployeeAdditionalWorkingDayRepository;
import com.example.demo.repo.LeavePermissionRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class AttendanceMetricsService {
    public static final int MAX_APPROVED_PERMISSIONS_PER_MONTH = 2;
    public static final int MAX_APPROVED_PERMISSION_MINUTES_PER_MONTH = 120;
    private static final int DEFAULT_MINUTES_PER_PERMISSION = 60;

    private static final DateTimeFormatter DB_DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TIME_FORMATTER_HH_MM = DateTimeFormatter.ofPattern("H:mm");
    private static final DateTimeFormatter TIME_FORMATTER_HH_MM_SS = DateTimeFormatter.ofPattern("H:mm:ss");

    private final EmployeeRepository employeeRepository;
    private final AttendanceRecordRepository attendanceRecordRepository;
    private final EmployeeAdditionalWorkingDayRepository employeeAdditionalWorkingDayRepository;
    private final LeavePermissionRepository leavePermissionRepository;

    public AttendanceMetricsService(
            EmployeeRepository employeeRepository,
            AttendanceRecordRepository attendanceRecordRepository,
            EmployeeAdditionalWorkingDayRepository employeeAdditionalWorkingDayRepository,
            LeavePermissionRepository leavePermissionRepository) {
        this.employeeRepository = employeeRepository;
        this.attendanceRecordRepository = attendanceRecordRepository;
        this.employeeAdditionalWorkingDayRepository = employeeAdditionalWorkingDayRepository;
        this.leavePermissionRepository = leavePermissionRepository;
    }

    public int calculateDailyLateMinutes(AttendanceRecord record) {
        if (record == null || record.getTimeIn() == null) {
            return 0;
        }
        ShiftWindow shiftWindow = resolveShiftWindow(record);
        LocalTime shiftStart = shiftWindow.start();
        LocalTime timeIn = record.getTimeIn().toLocalTime();
        if (!timeIn.isAfter(shiftStart)) {
            return 0;
        }
        return (int) Duration.between(shiftStart, timeIn).toMinutes();
    }

    public int calculateDailyEarlyOutMinutes(AttendanceRecord record) {
        if (record == null || record.getTimeOut() == null) {
            return 0;
        }
        ShiftWindow shiftWindow = resolveShiftWindow(record);
        LocalTime shiftEnd = shiftWindow.end();
        LocalTime timeOut = record.getTimeOut().toLocalTime();
        if (!timeOut.isBefore(shiftEnd)) {
            return 0;
        }
        return (int) Duration.between(timeOut, shiftEnd).toMinutes();
    }

    public int calculateDailyMissedMinutes(AttendanceRecord record) {
        return calculateDailyLateMinutes(record) + calculateDailyEarlyOutMinutes(record);
    }

    public boolean hasAdditionalShiftWindow(AttendanceRecord record) {
        if (record == null) {
            return false;
        }
        Employee employee = record.getEmployee();
        LocalDate date = resolveRecordDate(record);
        return resolveAdditionalWorkingDay(employee, date) != null;
    }

    public int synchronizeMissedMinutes(AttendanceRecord record) {
        if (record == null) {
            return 0;
        }
        int recalculated = calculateDailyMissedMinutes(record);
        Integer current = record.getMissedTimes();
        if (current == null || current != recalculated) {
            record.setMissedtimes(recalculated);
            try {
                attendanceRecordRepository.save(record);
            } catch (Exception ex) {
                ex.printStackTrace();
            }
        }
        return recalculated;
    }

    public void synchronizeMissedMinutes(List<AttendanceRecord> records) {
        // List endpoints must not rewrite records while loading the table.
        // Manual admin edits should remain visible until an explicit attendance action updates them.
    }

    public MonthlyMetrics calculateMonthlyMetrics(Long employeeId, int month, int year) {
        Optional<Employee> employeeOpt = employeeRepository.findById(employeeId);
        if (employeeOpt.isEmpty()) {
            return MonthlyMetrics.empty();
        }

        List<AttendanceRecord> records = attendanceRecordRepository.findByEmployeeId(employeeId);
        int absentCount = 0;
        int presentCount = 0;
        int monthlyLateDays = 0;
        int monthlyLateMinutes = 0;
        int monthlyEarlyOutMinutes = 0;
        int totalMissedMinutes = 0;

        for (AttendanceRecord record : records) {
            if (!isRecordInMonth(record.getDate(), month, year)) {
                continue;
            }

            if (record.getAttendanceStatus() != null) {
                if ("Absent".equalsIgnoreCase(record.getAttendanceStatus())) {
                    absentCount++;
                } else if ("Present".equalsIgnoreCase(record.getAttendanceStatus())) {
                    presentCount++;
                }
            }

            int lateMinutes = calculateDailyLateMinutes(record);
            int earlyOutMinutes = calculateDailyEarlyOutMinutes(record);
            int missedMinutes = lateMinutes + earlyOutMinutes;
            if (lateMinutes > 0) {
                monthlyLateDays++;
            }

            monthlyLateMinutes += lateMinutes;
            monthlyEarlyOutMinutes += earlyOutMinutes;
            totalMissedMinutes += missedMinutes;
        }

        PermissionUsage permissionUsage = getApprovedPermissionUsage(employeeId, month, year, null);

        return new MonthlyMetrics(
                absentCount,
                presentCount,
                monthlyLateDays,
                monthlyLateMinutes,
                monthlyEarlyOutMinutes,
                totalMissedMinutes,
                permissionUsage.approvedPermissionCount(),
                permissionUsage.approvedPermissionMinutes());
    }

    public int resolveMaxApprovedPermissionsPerMonth(Employee employee) {
        if (employee == null) {
            return (int) PayrollCompatibilityDefaults.DEFAULT_PERMISSION_HOURS_ALLOWED;
        }
        if (employee.getPermissionHoursAllowed() != null) {
            return (int) Math.ceil(Math.max(0.0, employee.getPermissionHoursAllowed()));
        }
        if (employee.getPermissionAllowancePerMonth() == null) {
            return (int) PayrollCompatibilityDefaults.DEFAULT_PERMISSION_HOURS_ALLOWED;
        }
        return Math.max(0, employee.getPermissionAllowancePerMonth());
    }

    public int resolveMaxApprovedPermissionMinutesPerMonth(Employee employee) {
        double allowedHours = PayrollCompatibilityDefaults.resolvePermissionHoursAllowed(employee);
        return (int) Math.round(Math.max(0.0, allowedHours) * 60.0);
    }

    public PermissionUsage getApprovedPermissionUsage(Long employeeId, int month, int year, Long excludeLeaveId) {
        List<LeavePermission> permissions = leavePermissionRepository.findByEmployeeIdAndStatus(employeeId, "approved");
        int approvedPermissionCount = 0;
        int approvedPermissionMinutes = 0;

        for (LeavePermission permission : permissions) {
            if (excludeLeaveId != null && excludeLeaveId.equals(permission.getId())) {
                continue;
            }
            if (!"Permission".equalsIgnoreCase(permission.getLeaveType())) {
                continue;
            }
            if (!isPermissionInMonth(permission, month, year)) {
                continue;
            }

            approvedPermissionCount++;
            approvedPermissionMinutes += calculatePermissionDurationMinutes(permission);
        }

        return new PermissionUsage(approvedPermissionCount, approvedPermissionMinutes);
    }

    public int calculatePermissionDurationMinutes(LeavePermission permission) {
        if (permission == null) {
            return 0;
        }
        return calculatePermissionDurationMinutes(permission.getStartTime(), permission.getEndTime());
    }

    public int calculatePermissionDurationMinutes(String startTimeRaw, String endTimeRaw) {
        Optional<LocalTime> startOpt = parseFlexibleTime(startTimeRaw);
        Optional<LocalTime> endOpt = parseFlexibleTime(endTimeRaw);
        if (startOpt.isEmpty() || endOpt.isEmpty()) {
            return 0;
        }

        LocalTime start = startOpt.get();
        LocalTime end = endOpt.get();
        if (!end.isAfter(start)) {
            return 0;
        }
        return (int) Duration.between(start, end).toMinutes();
    }

    public int resolveShiftDurationMinutes(Employee employee) {
        LocalTime shiftStart = resolveShiftStart(employee);
        LocalTime shiftEnd = resolveShiftEnd(employee);
        int shiftMinutes = (int) Duration.between(shiftStart, shiftEnd).toMinutes();
        return Math.max(shiftMinutes, 1);
    }

    private boolean isRecordInMonth(String dbDate, int month, int year) {
        if (dbDate == null || dbDate.isBlank()) {
            return false;
        }
        try {
            LocalDate date = LocalDate.parse(dbDate.trim(), DB_DATE_FORMATTER);
            return date.getMonthValue() == month && date.getYear() == year;
        } catch (DateTimeParseException ignored) {
            return false;
        }
    }

    private boolean isPermissionInMonth(LeavePermission permission, int month, int year) {
        if (permission == null) {
            return false;
        }
        String dateSource = permission.getDate();
        if (dateSource == null || dateSource.isBlank()) {
            dateSource = permission.getStartDate();
        }
        return isRecordInMonth(dateSource, month, year);
    }

    private LocalTime resolveShiftStart(Employee employee) {
        return PayrollCompatibilityDefaults.resolveShiftStart(employee);
    }

    private LocalTime resolveShiftEnd(Employee employee) {
        return PayrollCompatibilityDefaults.resolveShiftEnd(employee);
    }

    private ShiftWindow resolveShiftWindow(AttendanceRecord record) {
        Employee employee = record == null ? null : record.getEmployee();
        LocalTime defaultStart = resolveShiftStart(employee);
        LocalTime defaultEnd = resolveShiftEnd(employee);
        LocalDate date = resolveRecordDate(record);
        EmployeeAdditionalWorkingDay additionalDay = resolveAdditionalWorkingDay(employee, date);
        if (additionalDay == null) {
            return new ShiftWindow(defaultStart, defaultEnd);
        }

        Optional<LocalTime> additionalStart = parseFlexibleTime(additionalDay.getTimeIn());
        Optional<LocalTime> additionalEnd = parseFlexibleTime(additionalDay.getTimeOut());
        if (additionalStart.isEmpty() || additionalEnd.isEmpty()) {
            return new ShiftWindow(defaultStart, defaultEnd);
        }
        return new ShiftWindow(additionalStart.get(), additionalEnd.get());
    }

    private LocalDate resolveRecordDate(AttendanceRecord record) {
        if (record == null) {
            return null;
        }
        LocalDate parsed = parseRecordDate(record.getDate());
        if (parsed != null) {
            return parsed;
        }
        if (record.getTimeIn() != null) {
            return record.getTimeIn().toLocalDate();
        }
        if (record.getTimeOut() != null) {
            return record.getTimeOut().toLocalDate();
        }
        return null;
    }

    private LocalDate parseRecordDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim();
        DateTimeFormatter[] formatters = new DateTimeFormatter[] {
                DB_DATE_FORMATTER,
                DateTimeFormatter.ISO_LOCAL_DATE,
                DateTimeFormatter.ofPattern("dd-MM-yyyy")
        };
        for (DateTimeFormatter formatter : formatters) {
            try {
                return LocalDate.parse(value, formatter);
            } catch (DateTimeParseException ignored) {
                // try next format
            }
        }
        return null;
    }

    private EmployeeAdditionalWorkingDay resolveAdditionalWorkingDay(Employee employee, LocalDate date) {
        if (employee == null || date == null) {
            return null;
        }
        List<EmployeeAdditionalWorkingDay> days = employee.getAdditionalWorkingDays();
        if ((days == null || days.isEmpty()) && employee.getId() != null) {
            try {
                days = employeeAdditionalWorkingDayRepository.findByEmployee_Id(employee.getId());
            } catch (Exception ex) {
                days = List.of();
            }
        }
        if (days == null || days.isEmpty()) {
            return null;
        }
        Map<AdditionalWorkingDayType, EmployeeAdditionalWorkingDay> additionalMap =
                new EnumMap<>(AdditionalWorkingDayType.class);
        for (EmployeeAdditionalWorkingDay day : days) {
            if (day != null && day.getDayType() != null) {
                additionalMap.putIfAbsent(day.getDayType(), day);
            }
        }

        AdditionalWorkingDayType type = resolveAdditionalWorkingType(date);
        return resolveAdditionalDayFromMap(type, additionalMap);
    }

    private EmployeeAdditionalWorkingDay resolveAdditionalDayFromMap(
            AdditionalWorkingDayType type,
            Map<AdditionalWorkingDayType, EmployeeAdditionalWorkingDay> additionalMap) {
        if (type == null || additionalMap == null || additionalMap.isEmpty()) {
            return null;
        }

        EmployeeAdditionalWorkingDay exact = additionalMap.get(type);
        if (exact != null) {
            return exact;
        }

        return switch (type) {
            case ODD_SATURDAY -> additionalMap.get(AdditionalWorkingDayType.EVEN_SATURDAY);
            case EVEN_SATURDAY -> additionalMap.get(AdditionalWorkingDayType.ODD_SATURDAY);
            case ODD_SUNDAY -> additionalMap.get(AdditionalWorkingDayType.EVEN_SUNDAY);
            case EVEN_SUNDAY -> additionalMap.get(AdditionalWorkingDayType.ODD_SUNDAY);
        };
    }

    private AdditionalWorkingDayType resolveAdditionalWorkingType(LocalDate date) {
        DayOfWeek dayOfWeek = date.getDayOfWeek();
        if (dayOfWeek != DayOfWeek.SATURDAY && dayOfWeek != DayOfWeek.SUNDAY) {
            return null;
        }

        int occurrence = 0;
        for (LocalDate cursor = date.withDayOfMonth(1); !cursor.isAfter(date); cursor = cursor.plusDays(1)) {
            if (cursor.getDayOfWeek() == dayOfWeek) {
                occurrence++;
            }
        }
        boolean isOdd = occurrence % 2 == 1;
        if (dayOfWeek == DayOfWeek.SATURDAY) {
            return isOdd ? AdditionalWorkingDayType.ODD_SATURDAY : AdditionalWorkingDayType.EVEN_SATURDAY;
        }
        return isOdd ? AdditionalWorkingDayType.ODD_SUNDAY : AdditionalWorkingDayType.EVEN_SUNDAY;
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

    public record PermissionUsage(int approvedPermissionCount, int approvedPermissionMinutes) {
    }

    public record MonthlyMetrics(
            int absentCount,
            int presentCount,
            int monthlyLateDays,
            int monthlyLateMinutes,
            int monthlyEarlyOutMinutes,
            int totalMissedMinutes,
            int approvedPermissionCount,
            int approvedPermissionMinutes) {
        public static MonthlyMetrics empty() {
            return new MonthlyMetrics(0, 0, 0, 0, 0, 0, 0, 0);
        }
    }

    private record ShiftWindow(LocalTime start, LocalTime end) {
    }
}
