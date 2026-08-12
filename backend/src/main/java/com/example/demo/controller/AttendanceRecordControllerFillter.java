package com.example.demo.controller;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.demo.MODELS.AttendanceRecord;
import com.example.demo.MODELS.Employee;
import com.example.demo.repo.AttendanceRecordRepository;
import com.example.demo.repo.EmployeeRepository;
import com.example.demo.service.AttendanceClassificationService;
import com.example.demo.service.AttendanceMetricsService;
import com.example.demo.service.EmployeeService;
import com.example.demo.service.AttendanceSchedulerService;

import java.util.HashMap;
import java.util.Map;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.Comparator;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/attendance-records")
@CrossOrigin(origins = "*")

public class AttendanceRecordControllerFillter {

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private EmployeeService employeeService;

    @Autowired
    private AttendanceMetricsService attendanceMetricsService;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private AttendanceSchedulerService attendanceSchedulerService;

    @Autowired
    private AttendanceClassificationService attendanceClassificationService;

    private void safeSyncRecords(List<AttendanceRecord> records) {
        try {
            attendanceMetricsService.synchronizeMissedMinutes(records);
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    private void safeSyncRecord(AttendanceRecord record) {
        try {
            attendanceMetricsService.synchronizeMissedMinutes(record);
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    private void applyResponseMissedTimes(List<AttendanceRecord> records) {
        if (records == null || records.isEmpty()) {
            return;
        }
        for (AttendanceRecord record : records) {
            applyResponseMissedTimes(record);
        }
    }

    private void applyResponseMissedTimes(AttendanceRecord record) {
        if (record == null || record.getTimeIn() == null || record.getTimeOut() == null) {
            return;
        }
        try {
            if (attendanceMetricsService.hasAdditionalShiftWindow(record)) {
                record.setMissedTimes(attendanceMetricsService.calculateDailyMissedMinutes(record));
            }
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateAttendanceRecord(
            @PathVariable("id") Long id,
            @RequestBody Map<String, Object> payload,
            @RequestParam(value = "clientId", required = false) String clientIdRaw) {
        try {
            Long clientId = parseLongOrNull(clientIdRaw);
            Optional<AttendanceRecord> optional = attendanceRecordRepository.findById(id);
            if (optional.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            AttendanceRecord record = optional.get();
            if (clientId != null
                    && (record.getEmployee() == null || !clientId.equals(record.getEmployee().getClientId()))) {
                return ResponseEntity.status(403).body(Map.of("message", "Attendance record does not belong to this client."));
            }

            if (payload == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Request body is required."));
            }
            if (payload.containsKey("date")) {
                record.setDate(asText(payload.get("date")));
            }
            if (payload.containsKey("timeIn")) {
                record.setTimeIn(parseDateTime(payload.get("timeIn"), record.getDate()));
            }
            if (payload.containsKey("timeOut")) {
                record.setTimeOut(parseDateTime(payload.get("timeOut"), record.getDate()));
            }
            if (payload.containsKey("attendanceStatus")) {
                record.setAttendanceStatus(asText(payload.get("attendanceStatus")));
            }
            if (payload.containsKey("dayStatus")) {
                record.setDayStatus(asText(payload.get("dayStatus")));
            }
            if (payload.containsKey("location")) {
                record.setLocation(asText(payload.get("location")));
            }
            if (payload.containsKey("missedTimes")) {
                record.setMissedTimes(asInteger(payload.get("missedTimes")));
            }
            if (payload.containsKey("overtime")) {
                record.setOvertime(asDouble(payload.get("overtime")));
            }
            if (payload.containsKey("permissionUsed")) {
                record.setPermissionUsed(asDouble(payload.get("permissionUsed")));
            }

            updateWorkedHours(record);
            AttendanceRecord saved = attendanceRecordRepository.save(record);
            if (!payload.containsKey("missedTimes")) {
                safeSyncRecord(saved);
            }
            return ResponseEntity.ok(saved);
        } catch (Exception ex) {
            ex.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("message", ex.getMessage() == null ? "Unable to update attendance record." : ex.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAttendanceRecord(
            @PathVariable("id") Long id,
            @RequestParam(value = "clientId", required = false) String clientIdRaw) {
        Long clientId = parseLongOrNull(clientIdRaw);
        Optional<AttendanceRecord> optional = attendanceRecordRepository.findById(id);
        if (optional.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        AttendanceRecord record = optional.get();
        if (clientId != null
                && (record.getEmployee() == null || !clientId.equals(record.getEmployee().getClientId()))) {
            return ResponseEntity.status(403).body("Attendance record does not belong to this client.");
        }

        attendanceRecordRepository.delete(record);
        return ResponseEntity.ok(Map.of("deleted", true, "id", id));
    }

    // 1. Get all attendance details
    @GetMapping("/all")
    public ResponseEntity<List<Map<String, Object>>> getAllAttendanceRecords(
            @RequestParam(value = "clientId", required = false) Long clientId,
            @RequestParam(value = "limit", defaultValue = "200") int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        try {
            List<Object[]> rows = attendanceRecordRepository.findAttendanceRecordRows(
                    clientId, PageRequest.of(0, safeLimit));
            List<Map<String, Object>> records = rows.stream().map(this::toAttendanceRecordMap).toList();
            return ResponseEntity.ok(attendanceClassificationService.classifyRecordMaps(records, clientId));
        } catch (Exception ex) {
            ex.printStackTrace();
            return ResponseEntity.ok(List.of());
        }
    }

    private Map<String, Object> toAttendanceRecordMap(AttendanceRecord source) {
        Map<String, Object> record = new HashMap<>();
        record.put("id", source.getId());
        record.put("timeIn", source.getTimeIn());
        record.put("timeOut", source.getTimeOut());
        record.put("dayStatus", source.getDayStatus());
        record.put("location", source.getLocation());
        record.put("attendanceStatus", source.getAttendanceStatus());
        record.put("date", source.getDate());
        record.put("missedTimes", source.getMissedTimes());
        record.put("workedHours", source.getWorkedHours());
        record.put("overtime", source.getOvertime());
        record.put("permissionUsed", source.getPermissionUsed());
        record.put("shiftId", source.getShiftId());

        Employee employeeSource = source.getEmployee();
        record.put("employeeId", employeeSource == null ? null : employeeSource.getId());
        Map<String, Object> employee = new HashMap<>();
        if (employeeSource != null) {
            employee.put("id", employeeSource.getId());
            employee.put("employeeId", employeeSource.getId());
            employee.put("firstName", employeeSource.getFirstName());
            employee.put("lastName", employeeSource.getLastName());
            employee.put("branch", employeeSource.getBranch());
            employee.put("employeeCode", employeeSource.getEmployeeCode());
            employee.put("weekOff", employeeSource.getWeekOff());
            employee.put("shiftStartTime", employeeSource.getShiftStartTime());
            employee.put("shiftEndTime", employeeSource.getShiftEndTime());
            employee.put("leavePolicyType", employeeSource.getLeavePolicyType());
        }
        record.put("employee", employee);
        return record;
    }

    private Map<String, Object> toAttendanceRecordMap(Object[] row) {
        Map<String, Object> record = new HashMap<>();
        record.put("id", row[0]);
        record.put("timeIn", row[1]);
        record.put("timeOut", row[2]);
        record.put("dayStatus", row[3]);
        record.put("location", row[4]);
        record.put("attendanceStatus", row[5]);
        record.put("date", row[6]);
        record.put("missedTimes", row[7]);
        record.put("workedHours", row[8]);
        record.put("overtime", row[9]);
        record.put("permissionUsed", row[10]);
        record.put("shiftId", row[11]);
        record.put("employeeId", row[12]);

        Map<String, Object> employee = new HashMap<>();
        employee.put("id", row[12]);
        employee.put("employeeId", row[12]);
        employee.put("firstName", row[13]);
        employee.put("lastName", row[14]);
        employee.put("branch", row[15]);
        employee.put("employeeCode", row[16]);
        employee.put("weekOff", row[17]);
        employee.put("shiftStartTime", row[18]);
        employee.put("shiftEndTime", row[19]);
        employee.put("leavePolicyType", row[20]);
        record.put("employee", employee);
        return record;
    }

    // 2. Get attendance details by employee ID
    @GetMapping("/by-employee")
    public List<Map<String, Object>> getAttendanceByEmployeeId(
            @RequestParam("employeeId") String employeeId,
            @RequestParam(value = "clientId", required = false) Long clientId,
            @RequestParam(value = "limit", defaultValue = "200") int limit) {
        Optional<Employee> employee = resolveEmployeeByRef(employeeId);
        if (employee.isEmpty()) {
            return List.of();
        }

        int safeLimit = Math.max(1, Math.min(limit, 200));
        List<AttendanceRecord> records = attendanceRecordRepository.findByEmployeeIdOrderByIdDesc(
                employee.get().getId(), PageRequest.of(0, safeLimit));
        applyResponseMissedTimes(records);
        return attendanceClassificationService.classifyRecords(records, clientId);
    }

    // 3. Get attendance details by month and employee ID
    @GetMapping("/by-employee-month")
    public List<Map<String, Object>> getAttendanceByEmployeeIdAndMonth(
            @RequestParam("employeeId") String employeeId,
            @RequestParam("month") int month,
            @RequestParam("year") int year,
            @RequestParam(value = "clientId", required = false) Long clientId) {
        Optional<Employee> employee = resolveEmployeeByRef(employeeId);
        if (employee.isEmpty()) {
            return List.of();
        }
        YearMonth yearMonth = YearMonth.of(year, month);
        LocalDate from = yearMonth.atDay(1);
        LocalDate to = yearMonth.atEndOfMonth();
        attendanceSchedulerService.ensureAbsentForEmployeeDateRange(employee.get(), from, to);

        List<AttendanceRecord> records = attendanceRecordRepository.findByEmployeeId(employee.get().getId())
                .stream()
                .filter(record -> isRecordInMonth(record, month, year))
                .sorted(Comparator
                        .comparing((AttendanceRecord record) -> parseFlexibleDate(record.getDate()),
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(record -> Optional.ofNullable(record.getId()).orElse(Long.MAX_VALUE)))
                .toList();
        safeSyncRecords(records);
        applyResponseMissedTimes(records);
        return attendanceClassificationService.classifyRecords(records, clientId);
    }

    @GetMapping("/by-employee-month-metrics")
    public ResponseEntity<?> getAttendanceMetricsByEmployeeIdAndMonth(
            @RequestParam("employeeId") String employeeId,
            @RequestParam("month") int month,
            @RequestParam("year") int year) {
        Optional<Employee> employee = resolveEmployeeByRef(employeeId);
        if (employee.isEmpty()) {
            Map<String, Object> emptyResponse = new HashMap<>();
            emptyResponse.put("employeeId", employeeId);
            emptyResponse.put("month", month);
            emptyResponse.put("year", year);
            emptyResponse.put("absentCount", 0);
            emptyResponse.put("presentCount", 0);
            emptyResponse.put("workingDays", 0);
            emptyResponse.put("totalLateMinutes", 0);
            emptyResponse.put("totalEarlyOutMinutes", 0);
            emptyResponse.put("totalMissedTimes", 0);
            emptyResponse.put("lateDays", 0);
            emptyResponse.put("approvedPermissionCount", 0);
            emptyResponse.put("approvedPermissionMinutes", 0);
            emptyResponse.put("maxPermissionsPerMonth", AttendanceMetricsService.MAX_APPROVED_PERMISSIONS_PER_MONTH);
            emptyResponse.put("maxPermissionMinutesPerMonth", AttendanceMetricsService.MAX_APPROVED_PERMISSION_MINUTES_PER_MONTH);
            return ResponseEntity.ok(emptyResponse);
        }

        Long resolvedEmployeeId = employee.get().getId();
        AttendanceMetricsService.MonthlyMetrics metrics =
                attendanceMetricsService.calculateMonthlyMetrics(resolvedEmployeeId, month, year);

        Map<String, Object> response = new HashMap<>();
        response.put("employeeId", resolvedEmployeeId);
        response.put("month", month);
        response.put("year", year);
        response.put("absentCount", metrics.absentCount());
        response.put("presentCount", metrics.presentCount());
        response.put("workingDays", metrics.presentCount());
        response.put("lateDays", metrics.monthlyLateDays());
        response.put("totalLateMinutes", metrics.monthlyLateMinutes());
        response.put("totalEarlyOutMinutes", metrics.monthlyEarlyOutMinutes());
        response.put("totalMissedTimes", metrics.totalMissedMinutes());
        response.put("approvedPermissionCount", metrics.approvedPermissionCount());
        response.put("approvedPermissionMinutes", metrics.approvedPermissionMinutes());
        response.put("maxPermissionsPerMonth", attendanceMetricsService.resolveMaxApprovedPermissionsPerMonth(employee.get()));
        response.put("maxPermissionMinutesPerMonth", attendanceMetricsService.resolveMaxApprovedPermissionMinutesPerMonth(employee.get()));
        return ResponseEntity.ok(response);
    }

    // 4. Get attendance details by date and employee ID
    @GetMapping("/by-employee-date")
    public ResponseEntity<?> getAttendanceByEmployeeIdAndDate(
            @RequestParam("employeeId") String employeeId,
            @RequestParam("date") String date,
            @RequestParam(value = "clientId", required = false) Long clientId) {
        Optional<Employee> employee = resolveEmployeeByRef(employeeId);
        if (employee.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        LocalDate targetDate = parseFlexibleDate(date);
        if (targetDate == null) {
            return ResponseEntity.ok(List.of());
        }

        List<String> dateCandidates = List.of(
                targetDate.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")),
                targetDate.format(DateTimeFormatter.ofPattern("yyyy-MM-dd")),
                targetDate.format(DateTimeFormatter.ofPattern("dd-MM-yyyy")));
        List<Map<String, Object>> records = attendanceRecordRepository
                .findAttendanceRecordRowsByEmployeeAndDates(employee.get().getId(), dateCandidates, clientId)
                .stream()
                .map(this::toAttendanceRecordMap)
                .toList();

        if (records.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        if (records.size() == 1) {
            return ResponseEntity.ok(attendanceClassificationService.classifyRecordMaps(records, clientId).stream()
                    .findFirst()
                    .orElseGet(HashMap::new));
        }

        return ResponseEntity.ok(attendanceClassificationService.classifyRecordMaps(records, clientId));
    }

    // 5. Get attendance details by employee branch
    @GetMapping("/by-branch")
    public List<Map<String, Object>> getAttendanceByBranch(
            @RequestParam("branch") String branch,
            @RequestParam(value = "clientId", required = false) Long clientId) {
        List<AttendanceRecord> records = attendanceRecordRepository.findByEmployeeBranch(branch);
        safeSyncRecords(records);
        applyResponseMissedTimes(records);
        return attendanceClassificationService.classifyRecords(records, clientId);
    }

    // 6. Get all details by particular month and particular date for all employees
    @GetMapping("/by-month-date")
    public List<AttendanceRecord> getAttendanceByMonthAndDate(
            @RequestParam("month") int month,
            @RequestParam("year") int year,
            @RequestParam("date") String date) {
        List<AttendanceRecord> records = attendanceRecordRepository.findAll()
                .stream()
                .filter(record -> isRecordInMonth(record, month, year))
                .filter(record -> {
                    LocalDate recordDate = parseFlexibleDate(record.getDate());
                    LocalDate targetDate = parseFlexibleDate(date);
                    if (recordDate == null || targetDate == null) {
                        return false;
                    }
                    return recordDate.equals(targetDate);
                })
                .toList();
        safeSyncRecords(records);
        applyResponseMissedTimes(records);
        return records;
    }

    // 7. Get all attendance details by date and attendance status (Present/Absent)
    @GetMapping("/by-date-status")
    public List<AttendanceRecord> getAttendanceByDateAndStatus(
            @RequestParam("date") String date,
            @RequestParam("attendanceStatus") String attendanceStatus) {
        List<AttendanceRecord> records = attendanceRecordRepository.findByDateAndAttendanceStatus(date, attendanceStatus);
        safeSyncRecords(records);
        applyResponseMissedTimes(records);
        return records;
    }
    @GetMapping("/branches")
public List<String> getAllBranches() {
    return attendanceRecordRepository.findAllDistinctBranches();
}

@PutMapping("/calculate-missed-times")
public ResponseEntity<?> calculateAndUpdateMissedTimes(@RequestParam("attendanceId") Long attendanceId) {
    Optional<AttendanceRecord> optional = attendanceRecordRepository.findById(attendanceId);
    if (optional.isEmpty()) {
        return ResponseEntity.status(404).body("Attendance record not found.");
    }
    AttendanceRecord record = optional.get();

    if (record.getTimeIn() != null && record.getTimeOut() != null) {
        employeeService.updateMissedTimes(record);
        return ResponseEntity.ok("Missed times calculated and updated: " + record.getMissedTimes() + " minutes.");
    } else {
        return ResponseEntity.badRequest().body("Both timeIn and timeOut must be set to calculate missed times.");
    }
}
@PutMapping("/calculate-missed-times-all")
public ResponseEntity<?> calculateMissedTimesForAll() {
    List<AttendanceRecord> records = attendanceRecordRepository.findAll();
    int updatedCount = 0;

    for (AttendanceRecord record : records) {
        if (record.getTimeIn() != null && record.getTimeOut() != null) {
            employeeService.updateMissedTimes(record);
            updatedCount++;
        }
    }
    return ResponseEntity.ok("Missed times calculated and updated for " + updatedCount + " records.");
}

@PutMapping("/upload-both-images-all")
public ResponseEntity<?> uploadBothImagesForAll(@RequestParam("file") MultipartFile file) {
    try {
        byte[] imageBytes = file.getBytes();
        List<AttendanceRecord> records = attendanceRecordRepository.findAll();
        for (AttendanceRecord record : records) {
            record.setImageIn(imageBytes);
            record.setImageOut(imageBytes);
        }
        attendanceRecordRepository.saveAll(records);
        return ResponseEntity.ok("Both images uploaded for all attendance records.");
    } catch (Exception e) {
        return ResponseEntity.status(500).body("Failed to upload images for all records.");
    }
}

@GetMapping("/by-status-month")
    public List<AttendanceRecord> getAttendanceByStatusAndMonth(
            @RequestParam("attendanceStatus") String attendanceStatus,
            @RequestParam("month") int month,
            @RequestParam("year") int year) {
        List<AttendanceRecord> records = attendanceRecordRepository.findByAttendanceStatus(attendanceStatus)
                .stream()
                .filter(record -> isRecordInMonth(record, month, year))
                .toList();
        safeSyncRecords(records);
        applyResponseMissedTimes(records);
        return records;
    }

@GetMapping("/by-month-status-branch")
    public List<AttendanceRecord> getAttendanceByMonthStatusBranch(
            @RequestParam("month") int month,
            @RequestParam("year") int year,
            @RequestParam("attendanceStatus") String attendanceStatus,
            @RequestParam("branch") String branch) {
        List<AttendanceRecord> records = attendanceRecordRepository.findByAttendanceStatus(attendanceStatus)
                .stream()
                .filter(record -> isRecordInMonth(record, month, year))
                .filter(record -> record.getEmployee() != null
                        && record.getEmployee().getBranch() != null
                        && record.getEmployee().getBranch().equalsIgnoreCase(branch))
                .toList();
        safeSyncRecords(records);
        applyResponseMissedTimes(records);
        return records;
    }



@GetMapping("/check-today-attendance")
    public ResponseEntity<?> checkTodayAttendance(@RequestParam("employeeId") String employeeId) {
    Optional<Employee> employee = resolveEmployeeByRef(employeeId);
    if (employee.isEmpty()) {
        return ResponseEntity.ok("Employee not found.");
    }

    LocalDate today = java.time.LocalDate.now();
    List<String> candidates = List.of(
            today.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")),
            today.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd")),
            today.format(java.time.format.DateTimeFormatter.ofPattern("dd-MM-yyyy"))
    );
    List<AttendanceRecord> records = new ArrayList<>();
    for (String candidate : candidates) {
        records = attendanceRecordRepository.findByEmployeeIdAndDate(employee.get().getId(), candidate);
        if (!records.isEmpty()) {
            break;
        }
    }

    if (records.isEmpty()) {
        return ResponseEntity.ok("No attendance for today!");
    }

    AttendanceRecord record = records.get(0); // Assuming one record per day per employee

    if ("Absent".equalsIgnoreCase(record.getAttendanceStatus())) {
        return ResponseEntity.ok("Absent today!");
    }
    if (!"Present".equalsIgnoreCase(record.getAttendanceStatus())) {
        return ResponseEntity.ok("Not marked as present today!");
    }
    if (record.getTimeIn() == null) {
        return ResponseEntity.ok("Time-in not marked!");
    }
    if (record.getTimeOut() == null) {
        return ResponseEntity.ok("Time-out not marked!");
    }
    if (record.getDayStatus() == null || !"Completed".equalsIgnoreCase(record.getDayStatus())) {
        return ResponseEntity.ok("Day not closed!");
    }
    return ResponseEntity.ok("Attendance complete for today.");
}
// Get attendance details of all employees for a particular date
@GetMapping("/by-date")
public List<Map<String, Object>> getAttendanceByDate(
        @RequestParam("date") String date,
        @RequestParam(value = "clientId", required = false) Long clientId,
        @RequestParam(value = "limit", defaultValue = "200") int limit) {
    int safeLimit = Math.max(1, Math.min(limit, 200));
    List<AttendanceRecord> records = clientId == null
            ? attendanceRecordRepository.findByDateOrderByIdDesc(date, PageRequest.of(0, safeLimit))
            : attendanceRecordRepository.findByDateAndEmployee_ClientIdOrderByIdDesc(date, clientId, PageRequest.of(0, safeLimit));
    safeSyncRecords(records);
    applyResponseMissedTimes(records);
    return attendanceClassificationService.classifyRecords(records, clientId);
}

private Optional<Employee> resolveEmployeeByRef(String employeeRef) {
    if (employeeRef == null || employeeRef.isBlank()) {
        return Optional.empty();
    }

    String normalized = employeeRef.trim();
    try {
        return employeeRepository.findById(Long.parseLong(normalized));
    } catch (NumberFormatException ignored) {
        // Continue with employee-code lookup.
    }

    Optional<Employee> byCode = employeeRepository.findByEmployeeCode(normalized.toUpperCase());
    if (byCode.isPresent()) {
        return byCode;
    }

    Matcher matcher = Pattern.compile("(?i)(?:^|\\.)EMP(\\d+)$").matcher(normalized);
    if (matcher.find()) {
        try {
            return employeeRepository.findById(Long.parseLong(matcher.group(1)));
        } catch (NumberFormatException ignored) {
            // Keep empty below.
        }
    }

    return Optional.empty();
}

private boolean isRecordInMonth(AttendanceRecord record, int month, int year) {
    if (record == null) {
        return false;
    }
    LocalDate date = parseFlexibleDate(record.getDate());
    if (date == null) {
        return false;
    }
    return date.getMonthValue() == month && date.getYear() == year;
}

private LocalDate parseFlexibleDate(String raw) {
    if (raw == null || raw.isBlank()) {
        return null;
    }
    String value = raw.trim();
    DateTimeFormatter[] formatters = new DateTimeFormatter[] {
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
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

private LocalDateTime parseDateTime(Object raw, String recordDate) {
    String value = asText(raw);
    if (value == null || value.isBlank()) {
        return null;
    }
    DateTimeFormatter[] dateTimeFormatters = new DateTimeFormatter[] {
            DateTimeFormatter.ISO_LOCAL_DATE_TIME,
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")
    };
    for (DateTimeFormatter formatter : dateTimeFormatters) {
        try {
            return LocalDateTime.parse(value, formatter);
        } catch (DateTimeParseException ignored) {
            // try next format
        }
    }

    LocalDate date = parseFlexibleDate(recordDate);
    if (date == null) {
        date = LocalDate.now();
    }
    DateTimeFormatter[] timeFormatters = new DateTimeFormatter[] {
            DateTimeFormatter.ofPattern("H:mm:ss"),
            DateTimeFormatter.ofPattern("H:mm")
    };
    for (DateTimeFormatter formatter : timeFormatters) {
        try {
            return LocalDateTime.of(date, java.time.LocalTime.parse(value, formatter));
        } catch (DateTimeParseException ignored) {
            // try next format
        }
    }
    return null;
}

private String asText(Object value) {
    if (value == null) {
        return null;
    }
    String text = String.valueOf(value).trim();
    return text.isEmpty() ? null : text;
}

private Integer asInteger(Object value) {
    String text = asText(value);
    if (text == null) {
        return null;
    }
    try {
        return Integer.parseInt(text);
    } catch (NumberFormatException ex) {
        return null;
    }
}

private Double asDouble(Object value) {
    String text = asText(value);
    if (text == null) {
        return null;
    }
    try {
        return Double.parseDouble(text);
    } catch (NumberFormatException ex) {
        return null;
    }
}

private Long parseLongOrNull(String value) {
    if (value == null || value.isBlank()) {
        return null;
    }
    try {
        return Long.parseLong(value.trim());
    } catch (NumberFormatException ex) {
        return null;
    }
}

private void updateWorkedHours(AttendanceRecord record) {
    if (record == null || record.getTimeIn() == null || record.getTimeOut() == null
            || !record.getTimeOut().isAfter(record.getTimeIn())) {
        if (record != null) {
            record.setWorkedHours(null);
        }
        return;
    }
    long minutes = java.time.Duration.between(record.getTimeIn(), record.getTimeOut()).toMinutes();
    record.setWorkedHours(Math.round((minutes / 60.0) * 100.0) / 100.0);
}
@GetMapping("/by-date-status-all")
public List<AttendanceRecord> getAttendanceByDateAndStatusAll(
        @RequestParam("date") String date,
        @RequestParam("attendanceStatus") String attendanceStatus,
        @RequestParam(value = "clientId", required = false) Long clientId,
        @RequestParam(value = "limit", defaultValue = "200") int limit) {
    int safeLimit = Math.max(1, Math.min(limit, 200));
    List<AttendanceRecord> records = clientId == null
            ? attendanceRecordRepository.findByDateAndAttendanceStatusOrderByIdDesc(date, attendanceStatus, PageRequest.of(0, safeLimit))
            : attendanceRecordRepository.findByDateAndAttendanceStatusAndEmployee_ClientIdOrderByIdDesc(date, attendanceStatus, clientId, PageRequest.of(0, safeLimit));
    safeSyncRecords(records);
    applyResponseMissedTimes(records);
    return records;
}
// Get all ABSENT employees for a particular date
@GetMapping("/absent-by-date")
public List<AttendanceRecord> getAbsentByDate(
        @RequestParam("date") String date,
        @RequestParam(value = "clientId", required = false) Long clientId,
        @RequestParam(value = "limit", defaultValue = "200") int limit) {
    int safeLimit = Math.max(1, Math.min(limit, 200));
    List<AttendanceRecord> records = clientId == null
            ? attendanceRecordRepository.findByDateAndAttendanceStatusOrderByIdDesc(date, "Absent", PageRequest.of(0, safeLimit))
            : attendanceRecordRepository.findByDateAndAttendanceStatusAndEmployee_ClientIdOrderByIdDesc(date, "Absent", clientId, PageRequest.of(0, safeLimit));
    safeSyncRecords(records);
    applyResponseMissedTimes(records);
    return records;
}

@GetMapping("/auto-absent/run-today")
public ResponseEntity<?> runAutoAbsentToday() {
    int updated = attendanceSchedulerService.runAutoAbsentForToday();
    return ResponseEntity.ok(Map.of("updatedAbsentCount", updated));
}

@GetMapping("/debug-dates")
public ResponseEntity<?> debugAttendanceDates(@RequestParam("employeeId") String employeeId) {
    Optional<Employee> employee = resolveEmployeeByRef(employeeId);
    if (employee.isEmpty()) {
        return ResponseEntity.ok(List.of());
    }
    List<Map<String, Object>> rows = attendanceRecordRepository.findByEmployeeId(employee.get().getId())
            .stream()
            .map(record -> {
                Map<String, Object> row = new HashMap<>();
                row.put("id", record.getId());
                row.put("dateRaw", record.getDate());
                LocalDate parsed = parseFlexibleDate(record.getDate());
                row.put("dateParsed", parsed != null ? parsed.toString() : null);
                row.put("status", record.getAttendanceStatus());
                return row;
            })
            .sorted(Comparator.comparing(r -> String.valueOf(r.get("dateParsed")), Comparator.nullsLast(String::compareTo)))
            .collect(Collectors.toList());
    return ResponseEntity.ok(rows);
}























































}
